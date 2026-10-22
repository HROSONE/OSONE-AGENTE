'use strict';
/**
 * Mouse e teclado. Windows: SendInput pelo PowerShell residente. Linux: xdotool (X11) ou ydotool
 * (Wayland). Toda coordenada é validada como número inteiro antes de virar argumento.
 */
const { rodar, ehWindows } = require('./processos');
const { powershell, literal } = require('./powershell');
const { motorDeEntrada, ambienteGrafico } = require('./plataforma');
const { interpretarAtalho } = require('./teclas');

const TETO_DE_TEXTO = 20000;

function inteiro(valor, nome) {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw Object.assign(new Error(`'${nome}' precisa ser um número.`), { status: 400 });
  return Math.round(n);
}

function botaoValido(b) {
  const nome = String(b || 'left').toLowerCase();
  const mapa = { left: 0, esquerdo: 0, right: 1, direito: 1, middle: 2, meio: 2 };
  if (!(nome in mapa)) throw Object.assign(new Error("'button' deve ser left, right ou middle."), { status: 400 });
  return mapa[nome];
}

function motor() {
  const m = motorDeEntrada();
  if (!m.motor) throw Object.assign(new Error(m.motivo), { status: 501 });
  return m.motor;
}

const xdo = (args, prazoMs = 8000) => rodar('xdotool', args, { prazoMs, env: ambienteGrafico() });
// ydotool: botões em código (0x40 = esquerdo...). C0 = clique (desce+sobe) do botão esquerdo.
const YDO_BOTAO = [0x00, 0x01, 0x02];
const ydo = (args, prazoMs = 8000) => rodar('ydotool', args, { prazoMs });
const ps = (script) => powershell().executar(script);

async function mover({ x, y }) {
  const px = inteiro(x, 'x'), py = inteiro(y, 'y');
  const m = motor();
  if (m === 'powershell') await ps(`[OsoneAgente]::Mover(${px}, ${py})`);
  else if (m === 'xdotool') await xdo(['mousemove', String(px), String(py)]);
  else await ydo(['mousemove', '--absolute', '-x', String(px), '-y', String(py)]);
  return { x: px, y: py };
}

async function posicao() {
  const m = motor();
  if (m === 'powershell') {
    const [x, y] = String(await ps('[OsoneAgente]::Posicao()')).trim().split('|').map(Number);
    return { x, y };
  }
  if (m === 'xdotool') {
    const { stdout } = await xdo(['getmouselocation', '--shell']);
    const v = Object.fromEntries(stdout.trim().split('\n').map(l => l.split('=')));
    return { x: Number(v.X), y: Number(v.Y) };
  }
  throw Object.assign(new Error('O ydotool não informa a posição do mouse.'), { status: 501 });
}

async function clicar({ x, y, button, double } = {}) {
  const b = botaoValido(button);
  const vezes = double === true ? 2 : 1;
  if (x !== undefined && y !== undefined) await mover({ x, y });
  const m = motor();
  if (m === 'powershell') await ps(`[OsoneAgente]::Botao(${b}, 0, ${vezes})`);
  else if (m === 'xdotool') await xdo(['click', '--repeat', String(vezes), '--delay', '80', String([1, 3, 2][b])]);
  else for (let i = 0; i < vezes; i++) await ydo(['click', `0x${(0xC0 | YDO_BOTAO[b]).toString(16)}`]);
  return { botao: ['left', 'right', 'middle'][b], cliques: vezes };
}

/** Apertar ou soltar sem clicar: o que um arrasto manual precisa. */
async function botao({ action, button, double } = {}) {
  const acao = String(action || 'click').toLowerCase();
  if (acao === 'click') return clicar({ button, double });
  if (!['down', 'up'].includes(acao)) throw Object.assign(new Error("'action' deve ser click, down ou up."), { status: 400 });
  const b = botaoValido(button);
  const m = motor();
  if (m === 'powershell') await ps(`[OsoneAgente]::Botao(${b}, ${acao === 'down' ? 1 : 2}, 1)`);
  else if (m === 'xdotool') await xdo([acao === 'down' ? 'mousedown' : 'mouseup', String([1, 3, 2][b])]);
  else await ydo(['click', `0x${((acao === 'down' ? 0x40 : 0x80) | YDO_BOTAO[b]).toString(16)}`]);
  return { botao: ['left', 'right', 'middle'][b], acao };
}

async function rolar({ direction, amount, x, y } = {}) {
  const dir = String(direction || 'down').toLowerCase();
  const mapa = { up: [1, 0], cima: [1, 0], down: [-1, 0], baixo: [-1, 0], left: [0, -1], esquerda: [0, -1], right: [0, 1], direita: [0, 1] };
  if (!mapa[dir]) throw Object.assign(new Error("'direction' deve ser up, down, left ou right."), { status: 400 });
  const passos = Math.min(Math.max(1, inteiro(amount ?? 3, 'amount')), 50);
  if (x !== undefined && y !== undefined) await mover({ x, y });
  const [v, h] = mapa[dir];
  const m = motor();
  if (m === 'powershell') await ps(`[OsoneAgente]::Rolar(${v * passos}, ${h * passos})`);
  else if (m === 'xdotool') {
    // X11 rola por botões: 4 cima, 5 baixo, 6 esquerda, 7 direita.
    const botaoX = v > 0 ? 4 : v < 0 ? 5 : h < 0 ? 6 : 7;
    await xdo(['click', '--repeat', String(passos), '--delay', '30', String(botaoX)]);
  } else await ydo(['mousemove', '--wheel', '-x', String(h * passos), '-y', String(-v * passos)]);
  return { direcao: dir, passos };
}

async function arrastar({ xDe, yDe, xPara, yPara, button } = {}) {
  const de = { x: inteiro(xDe, 'xDe'), y: inteiro(yDe, 'yDe') };
  const para = { x: inteiro(xPara, 'xPara'), y: inteiro(yPara, 'yPara') };
  await mover(de);
  await botao({ action: 'down', button });
  try {
    // Em passos: vários apps só reconhecem arrasto se o mouse passar pelo caminho, não se teleportar.
    for (let i = 1; i <= 12; i++) {
      await mover({ x: de.x + ((para.x - de.x) * i) / 12, y: de.y + ((para.y - de.y) * i) / 12 });
      await new Promise(r => setTimeout(r, 15));
    }
  } finally {
    await botao({ action: 'up', button });
  }
  return { de, para };
}

/*
  MAIÚSCULA ACENTUADA NO XDOTOOL (medido em 22/10/2026, Xvfb com layout americano).

  Letra que não existe no layout (Ç, É, Ñ num teclado US) é digitada por remapeamento temporário de
  uma tecla livre, e o X entrega a minúscula: "ÇÁÉ" chegava "çáé", inclusive por `xdotool key
  Ccedilla`. O que funciona é apertar shift e mandar a minúscula (`keydown shift key U00E7 keyup
  shift` → "Ç"). Esses caracteres vão um a um assim; o resto do texto segue pelo `type`, que acerta
  acento minúsculo, símbolo e emoji.
*/
function trechosParaXdotool(texto) {
  const trechos = [];
  let atual = '';
  for (const c of texto) {
    const minuscula = c.toLowerCase();
    if (c.codePointAt(0) > 0x7f && minuscula !== c && [...minuscula].length === 1) {
      if (atual) { trechos.push({ texto: atual }); atual = ''; }
      trechos.push({ maiuscula: `U${minuscula.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` });
    } else atual += c;
  }
  if (atual) trechos.push({ texto: atual });
  return trechos;
}

async function digitar({ text } = {}) {
  const texto = String(text ?? '');
  if (!texto) throw Object.assign(new Error("Parâmetro 'text' é obrigatório."), { status: 400 });
  if (texto.length > TETO_DE_TEXTO) throw Object.assign(new Error(`Texto longo demais (máximo ${TETO_DE_TEXTO} caracteres por chamada).`), { status: 400 });
  const m = motor();
  if (m === 'powershell') await ps(`[OsoneAgente]::Texto(${literal(texto)})`);
  else if (m === 'xdotool') {
    for (const trecho of trechosParaXdotool(texto)) {
      if (trecho.maiuscula) await xdo(['keydown', 'shift', 'key', trecho.maiuscula, 'keyup', 'shift']);
      else await xdo(['type', '--clearmodifiers', '--delay', '12', '--', trecho.texto], 60000);
    }
  }
  else await ydo(['type', '--', texto], 60000);
  return { caracteres: texto.length };
}

async function tecla({ key, modifiers } = {}) {
  const atalho = interpretarAtalho(key, modifiers);
  if (atalho.erro) throw Object.assign(new Error(atalho.erro), { status: 400 });
  const m = motor();
  if (m === 'powershell') {
    const aperta = k => `[OsoneAgente]::TeclaVk(${k.vk}, $${k.ext ? 'true' : 'false'}, $false);`;
    const solta = k => `[OsoneAgente]::TeclaVk(${k.vk}, $${k.ext ? 'true' : 'false'}, $true);`;
    await ps([
      ...atalho.modificadores.map(aperta), aperta(atalho.mapa), 'Start-Sleep -Milliseconds 35;',
      solta(atalho.mapa), ...atalho.modificadores.slice().reverse().map(solta)
    ].join(' '));
  } else if (m === 'xdotool') {
    await xdo(['key', '--clearmodifiers', [...atalho.modificadores.map(k => k.x11), atalho.mapa.x11].join('+')]);
  } else {
    // ydotool usa os códigos do kernel (linux/input-event-codes.h); o xdotool resolve nomes, ele não.
    throw Object.assign(new Error('Atalhos de teclado no Wayland ainda não têm suporte; use /keyboard/type para texto.'), { status: 501 });
  }
  return { tecla: atalho.tecla, modificadores: atalho.modificadores.map(k => k.nome) };
}

module.exports = { mover, posicao, clicar, botao, rolar, arrastar, digitar, tecla, trechosParaXdotool };
