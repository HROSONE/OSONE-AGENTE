'use strict';
/**
 * Em que máquina estamos e com o que dá para trabalhar nela.
 *
 * No Windows tudo vem com o sistema (PowerShell + user32). No Linux depende da sessão gráfica: X11
 * usa `xdotool`; Wayland não deixa um programa comum mexer no mouse dos outros, e o caminho é o
 * `ydotool` (com o serviço `ydotoold` rodando). Quando falta algo, o erro diz o que instalar.
 */
const fs = require('fs');
const os = require('os');
const { existe, ehWindows } = require('./processos');

function sessaoLinux() {
  if (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland') return 'wayland';
  if (process.env.DISPLAY) return 'x11';
  // Iniciado fora da sessão (serviço, SSH): a tela local costuma ser :0.
  try { if (fs.existsSync('/tmp/.X11-unix/X0')) return 'x11'; } catch { /* sem X */ }
  return 'nenhuma';
}

/** Variáveis para os programas gráficos: sem DISPLAY, o xdotool não acha a tela. */
function ambienteGrafico() {
  if (ehWindows) return undefined;
  const env = {};
  if (!process.env.DISPLAY && sessaoLinux() === 'x11') env.DISPLAY = ':0';
  // Sem locale UTF-8 o xdotool recusa acento ("Invalid multi-byte sequence"). Agente iniciado como
  // serviço costuma vir sem LANG; C.UTF-8 existe em toda distribuição atual.
  const locale = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '';
  if (!/utf-?8/i.test(locale)) env.LC_ALL = 'C.UTF-8';
  return Object.keys(env).length ? env : undefined;
}

function ferramentas() {
  if (ehWindows) return { powershell: true };
  const lista = ['xdotool', 'ydotool', 'wmctrl', 'xdg-open', 'gtk-launch', 'grim', 'import', 'scrot', 'gnome-screenshot', 'spectacle', 'xclip', 'wl-copy', 'pkill'];
  return Object.fromEntries(lista.map(p => [p, existe(p)]));
}

/** Como resolver a falta de uma ferramenta, na distribuição mais comum. */
function comoInstalar(programa) {
  return `Instale '${programa}' (Debian/Ubuntu: sudo apt install ${programa}; Fedora: sudo dnf install ${programa}; Arch: sudo pacman -S ${programa}).`;
}

/** Qual motor de entrada usar. `null` com o motivo quando não há nenhum. */
function motorDeEntrada() {
  if (ehWindows) return { motor: 'powershell' };
  const sessao = sessaoLinux();
  if (sessao === 'wayland') {
    if (existe('ydotool')) return { motor: 'ydotool' };
    if (existe('xdotool')) return { motor: 'xdotool', aviso: 'Wayland com xdotool só alcança janelas XWayland. Para o resto, instale ydotool e rode o ydotoold.' };
    return { motor: null, motivo: `Sessão Wayland sem ydotool. ${comoInstalar('ydotool')} Depois rode o serviço ydotoold.` };
  }
  if (sessao === 'nenhuma') return { motor: null, motivo: 'Nenhuma sessão gráfica encontrada (sem DISPLAY nem WAYLAND_DISPLAY). Rode o agente dentro da sua sessão de desktop.' };
  if (existe('xdotool')) return { motor: 'xdotool' };
  return { motor: null, motivo: `Falta o xdotool. ${comoInstalar('xdotool')}` };
}

function resumo() {
  return {
    sistema: ehWindows ? 'windows' : process.platform,
    versaoDoSistema: os.release(),
    arquitetura: process.arch,
    usuario: os.userInfo().username,
    maquina: os.hostname(),
    sessao: ehWindows ? 'windows' : sessaoLinux(),
    entrada: motorDeEntrada(),
    ferramentas: ferramentas()
  };
}

module.exports = { sessaoLinux, ambienteGrafico, ferramentas, comoInstalar, motorDeEntrada, resumo };
