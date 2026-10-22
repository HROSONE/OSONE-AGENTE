'use strict';
/**
 * O agente como biblioteca: `criarAgente(config)` devolve o servidor HTTP pronto, e
 * `executarFerramenta(nome, args)` é o mesmo despacho usado pela rota POST /ferramenta — para quem
 * quiser embutir o agente no próprio processo em vez de falar HTTP.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { carregarConfig } = require('./config');
const auditoria = require('./auditoria');
const plataforma = require('./plataforma');
const entrada = require('./entrada');
const tela = require('./tela');
const janelas = require('./janelas');
const apps = require('./apps');
const terminal = require('./terminal');
const arquivos = require('./arquivos');

const VERSAO = require('../package.json').version;
const TETO_DO_CORPO = 2 * 1024 * 1024;

// Mouse e teclado em fila: dois pedidos simultâneos virariam um clique no meio de um arrasto.
let filaDeEntrada = Promise.resolve();
const emFila = fn => (...args) => {
  const vez = filaDeEntrada.then(() => fn(...args));
  filaDeEntrada = vez.catch(() => {});
  return vez;
};

/**
 * Cada rota: método, permissão que ela exige e o que ela faz. Os nomes e campos são os mesmos do
 * agente embutido no OSONE (`/api/agent`), para um cliente servir aos dois.
 */
function rotas(config) {
  return {
    'GET /status': { fazer: () => ({ nome: 'osone-agente', versao: VERSAO, permissoes: config.permissoes, ...plataforma.resumo() }) },
    'GET /audit/logs': { fazer: (_, q) => ({ entradas: auditoria.ultimas(Number(q.get('quantas')) || 100) }) },
    'GET /apps': { permissao: 'apps', fazer: async () => ({ apps: await apps.listarInstalados() }) },
    'POST /open-app': { permissao: 'apps', fazer: c => apps.abrir(c, config) },
    'POST /close-app': { permissao: 'apps', fazer: c => apps.fechar(c) },
    'GET /screen-info': { permissao: 'tela', fazer: () => tela.info() },
    'GET /screen/capture': { permissao: 'tela', fazer: () => tela.capturar() },
    'GET /mouse/position': { permissao: 'mouse', fazer: () => entrada.posicao() },
    'POST /mouse/move': { permissao: 'mouse', fazer: emFila(entrada.mover) },
    'POST /mouse/click-at': { permissao: 'mouse', fazer: emFila(entrada.clicar) },
    'POST /mouse/button': { permissao: 'mouse', fazer: emFila(entrada.botao) },
    'POST /mouse/scroll': { permissao: 'mouse', fazer: emFila(entrada.rolar) },
    'POST /mouse/drag': { permissao: 'mouse', fazer: emFila(entrada.arrastar) },
    'POST /keyboard/type': { permissao: 'teclado', fazer: emFila(entrada.digitar), naoAuditarCampos: ['text'] },
    'POST /keyboard/key': { permissao: 'teclado', fazer: emFila(entrada.tecla) },
    'GET /window/list': { permissao: 'janelas', fazer: async () => ({ janelas: await janelas.listar() }) },
    'POST /window/focus': { permissao: 'janelas', fazer: c => janelas.focar(c) },
    'POST /window/close': { permissao: 'janelas', fazer: c => janelas.fechar(c) },
    'POST /exec': { permissao: 'terminal', fazer: c => terminal.executar(c, config) },
    'POST /organize/plan': { permissao: 'arquivos', fazer: c => arquivos.planejar(c, config) },
    'POST /organize/execute': { permissao: 'arquivos', fazer: c => arquivos.executarPlano(c, config) },
    'POST /file/trash': { permissao: 'arquivos', fazer: c => arquivos.paraLixeira(c, config) }
  };
}

/** Nome de ferramenta (ferramentas.json) → rota. Um assistente pode chamar tudo por POST /ferramenta. */
const FERRAMENTAS = {
  abrir_app: 'POST /open-app', fechar_app: 'POST /close-app', listar_apps: 'GET /apps',
  ver_tela: 'GET /screen/capture', tamanho_da_tela: 'GET /screen-info',
  mover_mouse: 'POST /mouse/move', clicar: 'POST /mouse/click-at', botao_do_mouse: 'POST /mouse/button',
  rolar: 'POST /mouse/scroll', arrastar: 'POST /mouse/drag', posicao_do_mouse: 'GET /mouse/position',
  digitar: 'POST /keyboard/type', tecla: 'POST /keyboard/key',
  listar_janelas: 'GET /window/list', focar_janela: 'POST /window/focus', fechar_janela: 'POST /window/close',
  terminal: 'POST /exec', planejar_organizacao: 'POST /organize/plan', organizar: 'POST /organize/execute',
  mandar_para_lixeira: 'POST /file/trash', estado_do_agente: 'GET /status'
};

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }

/** O que vai para o audit.log: o corpo, com os campos sensíveis trocados pelo tamanho. */
function paraAuditoria(corpo, camposOcultos = []) {
  const detalhes = { ...(corpo || {}) };
  for (const campo of camposOcultos) if (campo in detalhes) detalhes[campo] = `(${String(detalhes[campo]).length} caracteres)`;
  return detalhes;
}

function criarAgente(config = carregarConfig()) {
  const tabela = rotas(config);
  const tokenEsperado = Buffer.from(String(config.token));
  const origens = new Set((config.origensPermitidas || []).map(o => String(o).replace(/\/$/, '')));
  // O painel é servido pelo próprio agente e precisa chamá-lo.
  origens.add(`http://127.0.0.1:${config.porta}`);
  origens.add(`http://localhost:${config.porta}`);
  const hostsAceitos = new Set([`127.0.0.1:${config.porta}`, `localhost:${config.porta}`, '127.0.0.1', 'localhost', `[::1]:${config.porta}`]);

  async function despachar(chave, corpo, consulta) {
    const rota = tabela[chave];
    if (!rota) throw erro(`Rota desconhecida: ${chave}`, 404);
    if (rota.permissao && config.permissoes[rota.permissao] === false) {
      throw erro(`A permissão '${rota.permissao}' está desligada no config.json deste agente.`, 403);
    }
    const inicio = Date.now();
    try {
      const resultado = await rota.fazer(corpo || {}, consulta || new URLSearchParams());
      if (chave !== 'GET /status' && chave !== 'GET /audit/logs') auditoria.registrar('INFO', chave, { ...paraAuditoria(corpo, rota.naoAuditarCampos), ms: Date.now() - inicio });
      return resultado;
    } catch (e) {
      auditoria.registrar(e.bloqueado ? 'SEGURANCA' : 'ERRO', chave, { erro: e.message, ms: Date.now() - inicio });
      throw e;
    }
  }

  async function executarFerramenta(nome, args = {}) {
    const chave = FERRAMENTAS[nome];
    if (!chave) throw erro(`Ferramenta desconhecida: '${nome}'. Existentes: ${Object.keys(FERRAMENTAS).join(', ')}.`, 404);
    return despachar(chave, chave.startsWith('GET') ? {} : args, new URLSearchParams(chave.startsWith('GET') ? args : {}));
  }

  const servidor = http.createServer(async (req, res) => {
    const responder = (status, dados, cabecalhos = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabecalhos });
      res.end(JSON.stringify(dados));
    };
    const url = new URL(req.url, 'http://127.0.0.1');
    /*
      DNS rebinding: um site pode fazer o PRÓPRIO domínio apontar para 127.0.0.1 e falar com o
      agente como "mesma origem". O token já barraria, mas o Host denuncia antes: só aceitamos o
      endereço local.
    */
    if (!hostsAceitos.has(String(req.headers.host || '').toLowerCase())) {
      auditoria.registrar('SEGURANCA', 'host-recusado', { host: String(req.headers.host || '').slice(0, 100) });
      return responder(421, { ok: false, erro: 'Host não aceito: o agente só responde em 127.0.0.1/localhost.', error: 'misdirected request' });
    }
    const origem = req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : '';

    // CORS: só as origens do config. O token pode ter vazado para uma página; a origem, o navegador não deixa falsificar.
    const cors = {};
    if (origem) {
      if (!origens.has(origem)) {
        auditoria.registrar('SEGURANCA', 'origem-recusada', { origem, rota: url.pathname });
        return responder(403, { ok: false, erro: `Origem não permitida: ${origem}. Adicione-a em origensPermitidas no config.json.`, error: 'origin not allowed' });
      }
      Object.assign(cors, {
        'Access-Control-Allow-Origin': origem, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        // Chrome: site HTTPS chamando localhost precisa deste aceite (Private Network Access).
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Max-Age': '600'
      });
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    // Públicas: descobrir que o agente existe e abrir o painel de teste. Nenhuma faz nada no PC.
    if (req.method === 'GET' && url.pathname === '/ping') return responder(200, { ok: true, nome: 'osone-agente', versao: VERSAO }, cors);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/painel')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...cors });
      return res.end(fs.readFileSync(path.join(__dirname, '..', 'painel.html')));
    }

    const enviado = Buffer.from(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (enviado.length !== tokenEsperado.length || !crypto.timingSafeEqual(enviado, tokenEsperado)) {
      auditoria.registrar('SEGURANCA', 'token-invalido', { rota: url.pathname });
      return responder(401, { ok: false, erro: 'Token ausente ou inválido. Envie Authorization: Bearer <token>.', error: 'unauthorized' }, cors);
    }

    let corpo = {};
    if (req.method === 'POST') {
      try {
        const partes = [];
        let tamanho = 0;
        for await (const parte of req) {
          tamanho += parte.length;
          if (tamanho > TETO_DO_CORPO) throw erro('Corpo grande demais (máximo 2 MB).', 413);
          partes.push(parte);
        }
        const texto = Buffer.concat(partes).toString('utf8').trim();
        corpo = texto ? JSON.parse(texto) : {};
      } catch (e) {
        return responder(e.status || 400, { ok: false, erro: e.status ? e.message : 'JSON inválido no corpo.', error: 'bad request' }, cors);
      }
    }

    try {
      const resultado = url.pathname === '/ferramenta' && req.method === 'POST'
        ? await executarFerramenta(corpo.nome, corpo.args || {})
        : await despachar(`${req.method} ${url.pathname}`, corpo, url.searchParams);
      responder(200, { ok: true, success: true, ...resultado }, cors);
    } catch (e) {
      responder(e.status || 500, { ok: false, erro: e.message, error: e.message }, cors);
    }
  });

  return { servidor, config, executarFerramenta, FERRAMENTAS };
}

module.exports = { criarAgente, carregarConfig, paraAuditoria, rotas, FERRAMENTAS, VERSAO };
