'use strict';
/**
 * O servidor de verdade, numa porta livre, com config, auditoria e lixeira em pasta temporária.
 * Nenhum teste aqui mexe em mouse, teclado ou janelas: as rotas testadas são as de segurança,
 * terminal e arquivos.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'osone-agente-teste-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));
process.env.OSONE_AGENTE_CONFIG = path.join(temp, 'config.json');
process.env.OSONE_AGENTE_AUDITORIA = path.join(temp, 'audit.log');
process.env.OSONE_AGENTE_LIXEIRA = path.join(temp, 'lixeira');
process.env.OSONE_AGENTE_SILENCIOSO = '1';
delete process.env.OSONE_AGENTE_TOKEN;

const { criarAgente, carregarConfig, FERRAMENTAS } = require('../lib');

const downloads = path.join(temp, 'Downloads');
fs.mkdirSync(downloads);
const TOKEN = 'a'.repeat(64);
fs.writeFileSync(process.env.OSONE_AGENTE_CONFIG, JSON.stringify({
  porta: 0, token: TOKEN, origensPermitidas: ['http://localhost:3000'],
  permissoes: { tela: false }, pastasPermitidas: { downloads }
}));

let base, servidor, config;
test.before(async () => {
  config = carregarConfig();
  // A porta entra na checagem do Host; descobre uma livre antes de criar o agente.
  const livre = await new Promise(r => { const s = require('net').createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  config.porta = livre;
  ({ servidor } = criarAgente(config));
  await new Promise(r => servidor.listen(livre, '127.0.0.1', r));
  base = `http://127.0.0.1:${livre}`;
});
test.after(() => servidor.close());

const pedir = (rota, { corpo, token = TOKEN, cabecalhos = {} } = {}) => fetch(base + rota, {
  method: corpo ? 'POST' : 'GET',
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...cabecalhos },
  body: corpo ? JSON.stringify(corpo) : undefined
});

test('config: chaves antigas em inglês são migradas', () => {
  const antigo = path.join(temp, 'antigo.json');
  fs.writeFileSync(antigo, JSON.stringify({ port: 4000, allowedOrigin: 'http://localhost:9999', allowedFolders: { x: '/tmp' }, token: 'b'.repeat(32) }));
  const anterior = process.env.OSONE_AGENTE_CONFIG;
  process.env.OSONE_AGENTE_CONFIG = antigo;
  try {
    const c = carregarConfig({ salvar: false });
    assert.strictEqual(c.porta, 4000);
    assert.deepStrictEqual(c.origensPermitidas, ['http://localhost:9999']);
    assert.strictEqual(c.pastasPermitidas.x, '/tmp');
    assert.strictEqual(c.permissoes.mouse, true, 'permissões que faltam vêm ligadas pelo padrão');
  } finally { process.env.OSONE_AGENTE_CONFIG = anterior; }
});

test('/ping e o painel respondem sem token', async () => {
  const ping = await (await pedir('/ping', { token: null })).json();
  assert.strictEqual(ping.nome, 'osone-agente');
  const painel = await pedir('/', { token: null });
  assert.strictEqual(painel.status, 200);
  assert.match(await painel.text(), /OSONE AGENTE/);
});

test('sem token ou com token errado: 401', async () => {
  assert.strictEqual((await pedir('/status', { token: null })).status, 401);
  assert.strictEqual((await pedir('/status', { token: 'b'.repeat(64) })).status, 401);
  assert.strictEqual((await pedir('/status', { token: 'curto' })).status, 401);
});

test('com token: /status descreve a máquina', async () => {
  const s = await (await pedir('/status')).json();
  assert.strictEqual(s.ok, true);
  assert.strictEqual(s.success, true, 'campo do agente antigo, mantido para clientes existentes');
  assert.ok(['windows', 'linux', 'darwin'].includes(s.sistema));
  assert.ok('entrada' in s && 'ferramentas' in s);
});

test('origem fora da lista: 403 mesmo com o token certo', async () => {
  const r = await pedir('/status', { cabecalhos: { Origin: 'https://site-malicioso.example' } });
  assert.strictEqual(r.status, 403);
});

test('origem permitida recebe os cabeçalhos de CORS e o preflight', async () => {
  const r = await pedir('/status', { cabecalhos: { Origin: 'http://localhost:3000' } });
  assert.strictEqual(r.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const pre = await fetch(base + '/exec', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Private-Network': 'true' } });
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers.get('access-control-allow-private-network'), 'true');
});

test('Host estranho (DNS rebinding): 421', async () => {
  const http = require('http');
  const status = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: config.porta, path: '/ping', headers: { Host: 'atacante.example' } }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject);
  });
  assert.strictEqual(status, 421);
});

test('permissão desligada no config: 403 e nada roda', async () => {
  const r = await pedir('/screen/capture');
  assert.strictEqual(r.status, 403);
  assert.match((await r.json()).erro, /permissão 'tela'/);
});

test('JSON inválido: 400', async () => {
  const r = await fetch(base + '/exec', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{nao é json' });
  assert.strictEqual(r.status, 400);
});

test('POST /ferramenta despacha pelo nome do ferramentas.json', async () => {
  const r = await (await pedir('/ferramenta', { corpo: { nome: 'terminal', args: { command: 'echo pela-ferramenta' } } })).json();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.stdout.trim(), 'pela-ferramenta');
  const desconhecida = await pedir('/ferramenta', { corpo: { nome: 'voar', args: {} } });
  assert.strictEqual(desconhecida.status, 404);
});

test('toda ferramenta do ferramentas.json tem rota, e vice-versa só sobram as auxiliares', () => {
  const declaradas = require('../ferramentas.json').ferramentas.map(f => f.name);
  for (const nome of declaradas) assert.ok(FERRAMENTAS[nome], `${nome} está declarada mas não tem rota`);
  const semDeclaracao = Object.keys(FERRAMENTAS).filter(n => !declaradas.includes(n)).sort();
  assert.deepStrictEqual(semDeclaracao, ['botao_do_mouse', 'estado_do_agente', 'posicao_do_mouse']);
});

test('terminal bloqueado é auditado como SEGURANCA', async () => {
  const r = await pedir('/exec', { corpo: { command: 'rm -rf /' } });
  assert.strictEqual(r.status, 403);
  const log = fs.readFileSync(process.env.OSONE_AGENTE_AUDITORIA, 'utf8');
  assert.match(log, /"nivel":"SEGURANCA","acao":"POST \/exec"/);
});

test('o texto digitado nunca vai para a auditoria', () => {
  // Pela função, não pela rota: digitar de verdade escreveria na janela de quem roda o teste.
  const { paraAuditoria, rotas } = require('../lib');
  const campos = rotas(config)['POST /keyboard/type'].naoAuditarCampos;
  assert.deepStrictEqual(paraAuditoria({ text: 'senha-secreta-123' }, campos), { text: '(17 caracteres)' });
  assert.doesNotMatch(fs.readFileSync(process.env.OSONE_AGENTE_AUDITORIA, 'utf8'), new RegExp(TOKEN));
});

test('organizar: planeja, exige confirmação e move por categoria', async () => {
  for (const f of ['foto.jpg', 'nota.pdf', 'musica.mp3', 'sem-ext']) fs.writeFileSync(path.join(downloads, f), 'x');
  const plano = await (await pedir('/organize/plan', { corpo: { folderKey: 'downloads' } })).json();
  assert.strictEqual(plano.totalFiles, 4);
  const semConfirmar = await pedir('/organize/execute', { corpo: { folderKey: 'downloads', plan: plano.plan } });
  assert.strictEqual(semConfirmar.status, 400);
  // Quem chama não escolhe o destino: a categoria enviada é ignorada e recalculada.
  const adulterado = plano.plan.map(p => ({ ...p, category: '../../fora' }));
  const r = await (await pedir('/organize/execute', { corpo: { folderKey: 'downloads', plan: adulterado, confirmed: true } })).json();
  assert.strictEqual(r.movidos, 4);
  assert.ok(fs.existsSync(path.join(downloads, 'Imagens', 'foto.jpg')));
  assert.ok(fs.existsSync(path.join(downloads, 'Outros', 'sem-ext')));
  assert.ok(!fs.existsSync(path.join(temp, 'fora')));
});

test('lixeira: move sem apagar e recusa sair da pasta permitida', async () => {
  fs.writeFileSync(path.join(downloads, 'velho.txt'), 'conteúdo');
  const r = await (await pedir('/file/trash', { corpo: { folderKey: 'downloads', fileName: 'velho.txt', confirmed: true } })).json();
  assert.strictEqual(fs.readFileSync(r.movidoPara, 'utf8'), 'conteúdo');
  const fuga = await pedir('/file/trash', { corpo: { folderKey: 'downloads', fileName: '../config.json', confirmed: true } });
  assert.strictEqual(fuga.status, 403);
  assert.ok(fs.existsSync(process.env.OSONE_AGENTE_CONFIG));
  const pastaDesconhecida = await pedir('/organize/plan', { corpo: { folderKey: 'sistema' } });
  assert.strictEqual(pastaDesconhecida.status, 400);
});

test('cliente.js fala com o servidor', async () => {
  const { ClienteOsoneAgente } = require('../cliente');
  const agente = new ClienteOsoneAgente({ url: base, token: TOKEN });
  assert.strictEqual((await agente.estado()).nome, 'osone-agente');
  assert.strictEqual((await agente.terminal('echo cliente')).stdout.trim(), 'cliente');
  await assert.rejects(agente.verTela(), e => e.status === 403);
  assert.throws(() => new ClienteOsoneAgente({}), /token/);
});
