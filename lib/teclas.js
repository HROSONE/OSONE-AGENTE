'use strict';
/**
 * Teclas aceitas por /keyboard/key, portadas do agente do OSONE.
 *
 * O mapa é FECHADO de propósito: o nome que chega do assistente vira um código conhecido, nunca um
 * argumento livre de xdotool ou um trecho de PowerShell. Texto livre (acentos, emoji, frases) vai
 * por /keyboard/type.
 */

const TECLAS = {
  backspace: { x11: 'BackSpace', vk: 0x08 }, tab: { x11: 'Tab', vk: 0x09 }, enter: { x11: 'Return', vk: 0x0d },
  pause: { x11: 'Pause', vk: 0x13 }, capslock: { x11: 'Caps_Lock', vk: 0x14 }, escape: { x11: 'Escape', vk: 0x1b },
  space: { x11: 'space', vk: 0x20 },
  pageup: { x11: 'Prior', vk: 0x21, ext: true }, pagedown: { x11: 'Next', vk: 0x22, ext: true },
  end: { x11: 'End', vk: 0x23, ext: true }, home: { x11: 'Home', vk: 0x24, ext: true },
  arrowleft: { x11: 'Left', vk: 0x25, ext: true }, arrowup: { x11: 'Up', vk: 0x26, ext: true },
  arrowright: { x11: 'Right', vk: 0x27, ext: true }, arrowdown: { x11: 'Down', vk: 0x28, ext: true },
  printscreen: { x11: 'Print', vk: 0x2c, ext: true }, insert: { x11: 'Insert', vk: 0x2d, ext: true },
  delete: { x11: 'Delete', vk: 0x2e, ext: true },
  metaleft: { x11: 'Super_L', vk: 0x5b, ext: true }, metaright: { x11: 'Super_R', vk: 0x5c, ext: true },
  contextmenu: { x11: 'Menu', vk: 0x5d, ext: true },
  numlock: { x11: 'Num_Lock', vk: 0x90 }, scrolllock: { x11: 'Scroll_Lock', vk: 0x91 },
  volumemute: { x11: 'XF86AudioMute', vk: 0xad, ext: true },
  volumedown: { x11: 'XF86AudioLowerVolume', vk: 0xae, ext: true },
  volumeup: { x11: 'XF86AudioRaiseVolume', vk: 0xaf, ext: true },
  medianext: { x11: 'XF86AudioNext', vk: 0xb0, ext: true }, mediaprevious: { x11: 'XF86AudioPrev', vk: 0xb1, ext: true },
  mediastop: { x11: 'XF86AudioStop', vk: 0xb2, ext: true }, mediaplaypause: { x11: 'XF86AudioPlay', vk: 0xb3, ext: true },
  browserback: { x11: 'XF86Back', vk: 0xa6, ext: true }, browserforward: { x11: 'XF86Forward', vk: 0xa7, ext: true },
  browserrefresh: { x11: 'XF86Refresh', vk: 0xa8, ext: true },
  semicolon: { x11: 'semicolon', vk: 0xba }, equal: { x11: 'equal', vk: 0xbb }, comma: { x11: 'comma', vk: 0xbc },
  minus: { x11: 'minus', vk: 0xbd }, period: { x11: 'period', vk: 0xbe }, slash: { x11: 'slash', vk: 0xbf },
  grave: { x11: 'grave', vk: 0xc0 }, bracketleft: { x11: 'bracketleft', vk: 0xdb },
  backslash: { x11: 'backslash', vk: 0xdc }, bracketright: { x11: 'bracketright', vk: 0xdd },
  apostrophe: { x11: 'apostrophe', vk: 0xde },
  numpadmultiply: { x11: 'KP_Multiply', vk: 0x6a }, numpadadd: { x11: 'KP_Add', vk: 0x6b },
  numpadsubtract: { x11: 'KP_Subtract', vk: 0x6d }, numpaddecimal: { x11: 'KP_Decimal', vk: 0x6e },
  numpaddivide: { x11: 'KP_Divide', vk: 0x6f, ext: true }, numpadenter: { x11: 'KP_Enter', vk: 0x0d, ext: true }
};
for (let n = 0; n <= 9; n++) {
  TECLAS[String(n)] = { x11: String(n), vk: 0x30 + n };
  TECLAS[`numpad${n}`] = { x11: `KP_${n}`, vk: 0x60 + n };
}
for (let c = 0; c < 26; c++) {
  const letra = String.fromCharCode(97 + c);
  TECLAS[letra] = { x11: letra, vk: 0x41 + c };
}
for (let n = 1; n <= 24; n++) TECLAS[`f${n}`] = { x11: `F${n}`, vk: 0x6f + n };

const APELIDOS = {
  return: 'enter', intro: 'enter', enviar: 'enter', esc: 'escape', sair: 'escape',
  del: 'delete', apagar: 'delete', ins: 'insert',
  up: 'arrowup', cima: 'arrowup', setacima: 'arrowup', down: 'arrowdown', baixo: 'arrowdown', setabaixo: 'arrowdown',
  left: 'arrowleft', esquerda: 'arrowleft', setaesquerda: 'arrowleft', right: 'arrowright', direita: 'arrowright', setadireita: 'arrowright',
  pgup: 'pageup', paginacima: 'pageup', pgdn: 'pagedown', paginabaixo: 'pagedown',
  espaco: 'space', barradeespaco: 'space', caps: 'capslock', print: 'printscreen', prtsc: 'printscreen',
  menu: 'contextmenu', win: 'metaleft', windows: 'metaleft', super: 'metaleft', meta: 'metaleft', cmd: 'metaleft',
  playpause: 'mediaplaypause', play: 'mediaplaypause', proxima: 'medianext', anterior: 'mediaprevious',
  mute: 'volumemute', mudo: 'volumemute', voltar: 'browserback', avancar: 'browserforward', recarregar: 'browserrefresh'
};

// Caracteres que chegam como "tecla" (o assistente manda "+" ou "?"): a tecla física e o shift.
const CARACTERES = {
  ' ': ['space'], ';': ['semicolon'], ':': ['semicolon', 'shift'], '=': ['equal'], '+': ['equal', 'shift'],
  ',': ['comma'], '<': ['comma', 'shift'], '-': ['minus'], '_': ['minus', 'shift'], '.': ['period'], '>': ['period', 'shift'],
  '/': ['slash'], '?': ['slash', 'shift'], '`': ['grave'], '~': ['grave', 'shift'], '[': ['bracketleft'], '{': ['bracketleft', 'shift'],
  '\\': ['backslash'], '|': ['backslash', 'shift'], ']': ['bracketright'], '}': ['bracketright', 'shift'],
  "'": ['apostrophe'], '"': ['apostrophe', 'shift'], '!': ['1', 'shift'], '@': ['2', 'shift'], '#': ['3', 'shift'],
  '$': ['4', 'shift'], '%': ['5', 'shift'], '^': ['6', 'shift'], '&': ['7', 'shift'], '*': ['8', 'shift'],
  '(': ['9', 'shift'], ')': ['0', 'shift']
};

const MODIFICADORES = {
  ctrl: { x11: 'ctrl', vk: 0x11 }, alt: { x11: 'alt', vk: 0x12 }, shift: { x11: 'shift', vk: 0x10 },
  meta: { x11: 'super', vk: 0x5b, ext: true }, altgr: { x11: 'ISO_Level3_Shift', vk: 0xa5, ext: true }
};
const APELIDOS_DE_MODIFICADOR = {
  ctrl: 'ctrl', control: 'ctrl', controle: 'ctrl', strg: 'ctrl', alt: 'alt', option: 'alt', opcao: 'alt', shift: 'shift',
  meta: 'meta', win: 'meta', windows: 'meta', super: 'meta', cmd: 'meta', command: 'meta', altgr: 'altgr'
};

const normalizar = v => String(v ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_-]+/g, '');

/**
 * "ctrl+shift+s", "Alt+F4", "enter", "?" ou key + modifiers. Devolve a tecla e os modificadores
 * do mapa, ou `{ erro }`. Nada fora do mapa passa.
 */
function interpretarAtalho(tecla, modificadores) {
  const bruto = String(tecla ?? '');
  if (!bruto) return { erro: "Parâmetro 'key' é obrigatório." };
  const doCaractere = CARACTERES[bruto];
  const partes = !doCaractere && bruto.length > 1 && bruto.includes('+') ? bruto.split('+').map(p => p.trim()).filter(Boolean) : [];
  const principal = partes.length > 1 ? partes.pop() : bruto;
  const extras = Array.isArray(modificadores) ? modificadores
    : typeof modificadores === 'string' ? modificadores.split(/[+,]/).map(m => m.trim()).filter(Boolean) : [];
  const mods = [];
  for (const m of [...partes, ...extras]) {
    const canonico = APELIDOS_DE_MODIFICADOR[normalizar(m)];
    if (!canonico) return { erro: `Modificador desconhecido: '${m}'. Use ctrl, alt, shift, meta (win) ou altgr.` };
    if (!mods.includes(canonico)) mods.push(canonico);
  }
  let nome;
  const caractere = CARACTERES[principal];
  if (caractere) {
    nome = caractere[0];
    if (caractere[1] && !mods.includes('shift')) mods.push('shift');
  } else {
    const n = normalizar(principal);
    nome = TECLAS[n] ? n : APELIDOS[n];
    if (!nome && APELIDOS_DE_MODIFICADOR[n]) nome = { ctrl: 'ctrl', alt: 'alt', shift: 'shift', meta: 'metaleft', altgr: 'altgr' }[APELIDOS_DE_MODIFICADOR[n]];
  }
  const mapa = TECLAS[nome] || MODIFICADORES[nome];
  if (!mapa) return { erro: `Tecla desconhecida: '${principal}'. Para escrever texto, use /keyboard/type.` };
  return { tecla: nome, mapa, modificadores: mods.map(m => ({ nome: m, ...MODIFICADORES[m] })) };
}

module.exports = { TECLAS, MODIFICADORES, interpretarAtalho };
