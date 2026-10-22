'use strict';
/** Tamanho da tela e captura em PNG (base64), para o assistente ver onde clicar. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rodar, existe, ehWindows } = require('./processos');
const { powershell } = require('./powershell');
const { sessaoLinux, ambienteGrafico, comoInstalar } = require('./plataforma');

async function info() {
  if (ehWindows) {
    const [x, y, largura, altura] = String(await powershell().executar('[OsoneAgente]::Tela()')).trim().split('|').map(Number);
    return { x, y, largura, altura };
  }
  if (existe('xdotool') && sessaoLinux() !== 'nenhuma') {
    const { stdout } = await rodar('xdotool', ['getdisplaygeometry'], { env: ambienteGrafico() });
    const [largura, altura] = stdout.trim().split(/\s+/).map(Number);
    return { x: 0, y: 0, largura, altura };
  }
  if (existe('xdpyinfo')) {
    const { stdout } = await rodar('xdpyinfo', [], { env: ambienteGrafico() });
    const m = /dimensions:\s+(\d+)x(\d+)/.exec(stdout);
    if (m) return { x: 0, y: 0, largura: Number(m[1]), altura: Number(m[2]) };
  }
  throw Object.assign(new Error(`Não consegui medir a tela. ${comoInstalar('xdotool')}`), { status: 501 });
}

const SCRIPT_CAPTURA_WINDOWS = `
Add-Type -AssemblyName System.Drawing
$t = [OsoneAgente]::Tela().Split('|')
$bmp = New-Object System.Drawing.Bitmap ([int]$t[2]), ([int]$t[3])
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen([int]$t[0], [int]$t[1], 0, 0, $bmp.Size)
$g.Dispose()
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
[Convert]::ToBase64String($ms.ToArray())
`;

/** As ferramentas de captura do Linux, na ordem de preferência, e como cada uma entrega o PNG. */
function capturadoresLinux(arquivo) {
  const wayland = sessaoLinux() === 'wayland';
  return [
    wayland && { programa: 'grim', args: [arquivo] },
    !wayland && { programa: 'import', args: ['-window', 'root', arquivo] },
    !wayland && { programa: 'scrot', args: ['-o', arquivo] },
    { programa: 'gnome-screenshot', args: ['-f', arquivo] },
    { programa: 'spectacle', args: ['-b', '-n', '-f', '-o', arquivo] }
  ].filter(Boolean);
}

async function capturar() {
  if (ehWindows) {
    const base64 = String(await powershell().executar(SCRIPT_CAPTURA_WINDOWS, 30000)).trim();
    return { formato: 'png', base64 };
  }
  const arquivo = path.join(os.tmpdir(), `osone-agente-${process.pid}-${Date.now()}.png`);
  const tentados = [];
  try {
    for (const c of capturadoresLinux(arquivo)) {
      if (!existe(c.programa)) continue;
      tentados.push(c.programa);
      try {
        await rodar(c.programa, c.args, { prazoMs: 15000, env: ambienteGrafico() });
        if (fs.existsSync(arquivo) && fs.statSync(arquivo).size > 0) {
          return { formato: 'png', base64: fs.readFileSync(arquivo).toString('base64'), via: c.programa };
        }
      } catch { /* tenta o próximo */ }
    }
  } finally {
    try { fs.unlinkSync(arquivo); } catch { /* não chegou a existir */ }
  }
  const sugestao = sessaoLinux() === 'wayland' ? 'grim' : 'imagemagick';
  throw Object.assign(new Error(tentados.length
    ? `A captura falhou com ${tentados.join(', ')}.`
    : `Nenhum programa de captura encontrado. ${comoInstalar(sugestao)}`), { status: 501 });
}

module.exports = { info, capturar, SCRIPT_CAPTURA_WINDOWS };
