'use strict';
/**
 * Ponta a ponta no Linux: abre um xterm, digita nele, aperta atalho, move e clica, fecha a janela.
 *
 * MEXE NO MOUSE E NO TECLADO DE VERDADE. Por isso só roda com OSONE_AGENTE_TESTE_NA_TELA=1 — numa
 * bateria comum, o cursor sairia andando no meio do que a pessoa está fazendo. Rode num display
 * virtual com gerenciador de janelas (sem um, nem foco nem posição do ponteiro funcionam):
 *
 *   Xvfb :99 & DISPLAY=:99 openbox & DISPLAY=:99 OSONE_AGENTE_TESTE_NA_TELA=1 npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { existe } = require('../lib/processos');

const faltando = ['xdotool', 'wmctrl', 'xterm'].filter(p => !existe(p));
const pular = process.platform !== 'linux' ? 'só no Linux'
  : process.env.OSONE_AGENTE_TESTE_NA_TELA !== '1' ? 'mexe no mouse: defina OSONE_AGENTE_TESTE_NA_TELA=1'
  : !process.env.DISPLAY ? 'sem DISPLAY'
  : faltando.length ? `faltam ${faltando.join(', ')}` : false;

const dormir = ms => new Promise(r => setTimeout(r, ms));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'osone-agente-tela-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));
process.env.OSONE_AGENTE_AUDITORIA = path.join(temp, 'audit.log');
process.env.OSONE_AGENTE_SILENCIOSO = '1';

const { criarAgente } = require('../lib');
const { executarFerramenta } = criarAgente({
  porta: 0, token: 'x'.repeat(32), origensPermitidas: [], terminal: {}, apps: {}, pastasPermitidas: {},
  permissoes: { apps: true, mouse: true, teclado: true, tela: true, janelas: true, terminal: true, arquivos: true }
});

function xterm(titulo, comando) {
  const filho = spawn('xterm', ['-u8', '-geometry', '100x20+0+0', '-title', titulo, '-e', 'sh', '-c', comando],
    { env: { ...process.env, LC_ALL: 'C.UTF-8' }, detached: true, stdio: 'ignore' });
  filho.unref();
  return filho;
}
async function esperarJanela(titulo) {
  for (let i = 0; i < 40; i++) {
    const j = (await executarFerramenta('listar_janelas')).janelas.find(x => x.titulo === titulo);
    if (j) return j;
    await dormir(150);
  }
  throw new Error(`a janela '${titulo}' não apareceu`);
}

test('digita acentos, maiúsculas acentuadas e símbolos exatamente como enviados', { skip: pular, timeout: 30000 }, async () => {
  const arquivo = path.join(temp, 'digitado.txt');
  xterm('osone-digitacao', `cat > ${arquivo}`);
  const janela = await esperarJanela('osone-digitacao');
  await executarFerramenta('focar_janela', { id: janela.id });
  const texto = 'Olá, AÇÃO ✓ 123 — çÇ ÉÁÑ ñ € São Paulo';
  await executarFerramenta('digitar', { text: `${texto}\n` });
  await executarFerramenta('tecla', { key: 'ctrl+d' });
  await dormir(700);
  assert.strictEqual(fs.readFileSync(arquivo, 'utf8').trim(), texto);
});

test('mouse vai exatamente onde foi mandado', { skip: pular, timeout: 15000 }, async () => {
  await executarFerramenta('mover_mouse', { x: 123, y: 321 });
  assert.deepStrictEqual(await executarFerramenta('posicao_do_mouse'), { x: 123, y: 321 });
  await executarFerramenta('clicar', { x: 200, y: 150 });
  assert.deepStrictEqual(await executarFerramenta('posicao_do_mouse'), { x: 200, y: 150 });
});

test('fechar janela fecha só ela', { skip: pular, timeout: 15000 }, async () => {
  xterm('osone-fechar', 'sleep 60');
  const janela = await esperarJanela('osone-fechar');
  await executarFerramenta('fechar_janela', { id: janela.id });
  await dormir(800);
  assert.ok(!(await executarFerramenta('listar_janelas')).janelas.some(j => j.titulo === 'osone-fechar'));
});

test('captura a tela em PNG', { skip: pular, timeout: 15000 }, async () => {
  const r = await executarFerramenta('ver_tela');
  assert.strictEqual(Buffer.from(r.base64, 'base64').subarray(1, 4).toString(), 'PNG');
});
