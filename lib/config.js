'use strict';
/**
 * Configuração do agente: lida de `config.json` (ao lado do agente ou em OSONE_AGENTE_CONFIG),
 * completada com os padrões e salva de volta com o token gerado na primeira execução.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PADRAO = {
  porta: 9123,
  // Só 127.0.0.1: o agente nunca escuta na rede. Trocar isto expõe o computador.
  host: '127.0.0.1',
  token: '',
  /*
    Origens de navegador que podem chamar o agente. Pedido sem `Origin` (curl, servidor, script)
    passa só com o token. Um site fora desta lista é recusado mesmo com o token certo: o token pode
    ter vazado para uma página, a origem o navegador não deixa falsificar.
  */
  origensPermitidas: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
  // Cada capacidade pode ser desligada. Desligada, a rota responde 403 e nada roda.
  permissoes: {
    apps: true,
    mouse: true,
    teclado: true,
    tela: true,
    janelas: true,
    terminal: true,
    arquivos: true
  },
  terminal: {
    prazoPadraoMs: 30000,
    prazoMaximoMs: 300000,
    saidaMaximaBytes: 200000,
    // Padrões extras recusados, além dos destrutivos que já vêm bloqueados (ver terminal.js).
    bloquear: []
  },
  // Atalhos opcionais: nome → comando por sistema. Fora daqui o agente procura o app instalado.
  apps: {},
  pastasPermitidas: {
    downloads: '~/Downloads',
    desktop: '~/Desktop',
    documents: '~/Documents'
  }
};

function caminhoDaConfig() {
  return process.env.OSONE_AGENTE_CONFIG || path.join(__dirname, '..', 'config.json');
}

function expandirHome(caminho) {
  const texto = String(caminho || '');
  return texto.startsWith('~') ? path.join(os.homedir(), texto.slice(1)) : texto;
}

/*
  O agente antigo usava chaves em inglês (`port`, `allowedOrigin`, `allowedFolders`). Quem já tinha
  um config.json não precisa refazê-lo: as chaves antigas são lidas e convertidas.
*/
function migrarChavesAntigas(lido) {
  const c = { ...lido };
  if (c.port !== undefined && c.porta === undefined) c.porta = c.port;
  if (c.allowedOrigin && !c.origensPermitidas) c.origensPermitidas = c.allowedOrigin === '*' ? [] : [c.allowedOrigin];
  if (c.allowedFolders && !c.pastasPermitidas) c.pastasPermitidas = c.allowedFolders;
  delete c.port; delete c.allowedOrigin; delete c.allowedFolders;
  return c;
}

function carregarConfig({ salvar = true } = {}) {
  const arquivo = caminhoDaConfig();
  let lido = {};
  try {
    if (fs.existsSync(arquivo)) lido = migrarChavesAntigas(JSON.parse(fs.readFileSync(arquivo, 'utf8')));
  } catch (erro) {
    console.warn(`[config] ${arquivo} ilegível (${erro.message}); usando o padrão.`);
  }
  const config = {
    ...PADRAO,
    ...lido,
    permissoes: { ...PADRAO.permissoes, ...(lido.permissoes || {}) },
    terminal: { ...PADRAO.terminal, ...(lido.terminal || {}) },
    pastasPermitidas: { ...PADRAO.pastasPermitidas, ...(lido.pastasPermitidas || {}) }
  };
  if (process.env.OSONE_AGENTE_TOKEN) config.token = process.env.OSONE_AGENTE_TOKEN;
  if (process.env.OSONE_AGENTE_PORTA) config.porta = Number(process.env.OSONE_AGENTE_PORTA);
  let gerouToken = false;
  if (!config.token || String(config.token).length < 16) {
    config.token = crypto.randomBytes(32).toString('hex');
    gerouToken = true;
  }
  if (salvar && (gerouToken || !fs.existsSync(arquivo))) {
    try { fs.writeFileSync(arquivo, JSON.stringify(config, null, 2), { mode: 0o600 }); } catch (erro) {
      console.warn(`[config] não consegui salvar ${arquivo}: ${erro.message}`);
    }
  }
  return config;
}

module.exports = { PADRAO, carregarConfig, caminhoDaConfig, expandirHome };
