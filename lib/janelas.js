'use strict';
/** Listar, focar e fechar janelas. Fechar é educado (como clicar no X); o app pode perguntar se salva. */
const { rodar, existe, ehWindows } = require('./processos');
const { powershell } = require('./powershell');
const { ambienteGrafico, comoInstalar } = require('./plataforma');

function idValido(id) {
  const texto = String(id ?? '').trim();
  if (!/^(0x[0-9a-f]+|\d+)$/i.test(texto)) throw Object.assign(new Error("'id' da janela inválido (use o id de /window/list)."), { status: 400 });
  return texto;
}

async function listar() {
  if (ehWindows) {
    const saida = await powershell().executar(`
$linhas = [OsoneAgente]::Janelas().TrimEnd("\`n").Split("\`n")
foreach ($l in $linhas) { if (-not $l) { continue }
  $c = $l.Split("\`t", 4)
  $p = Get-Process -Id ([int]$c[1]) -ErrorAction SilentlyContinue
  "$($c[0])\`t$($c[1])\`t$($c[2])\`t$(if ($p) { $p.ProcessName } else { '' })\`t$($c[3])" }`);
    return String(saida).split('\n').filter(Boolean).map(l => {
      const [id, pid, ativa, processo, ...titulo] = l.replace(/\r$/, '').split('\t');
      return { id, pid: Number(pid), ativa: ativa === '1', processo, titulo: titulo.join('\t') };
    });
  }
  if (existe('wmctrl')) {
    const { stdout } = await rodar('wmctrl', ['-lp'], { env: ambienteGrafico() });
    let ativa = '';
    try { ativa = (await rodar('xdotool', ['getactivewindow'], { env: ambienteGrafico() })).stdout.trim(); } catch { /* sem janela ativa */ }
    return stdout.split('\n').filter(Boolean).map(l => {
      const [id, , pid, , ...titulo] = l.split(/\s+/);
      return { id, pid: Number(pid), ativa: ativa !== '' && parseInt(id, 16) === Number(ativa), titulo: titulo.join(' ') };
    });
  }
  if (!existe('xdotool')) throw Object.assign(new Error(`Para listar janelas, ${comoInstalar('wmctrl')}`), { status: 501 });
  const { stdout } = await rodar('xdotool', ['search', '--onlyvisible', '--name', '.'], { env: ambienteGrafico() }).catch(() => ({ stdout: '' }));
  const janelas = [];
  for (const id of stdout.split('\n').filter(Boolean).slice(0, 200)) {
    try {
      const titulo = (await rodar('xdotool', ['getwindowname', id], { env: ambienteGrafico() })).stdout.trim();
      if (titulo) janelas.push({ id, titulo });
    } catch { /* janela sumiu no meio */ }
  }
  return janelas;
}

async function focar({ id }) {
  const alvo = idValido(id);
  if (ehWindows) {
    const ok = String(await powershell().executar(`[OsoneAgente]::Focar(${Number(alvo)})`)).trim();
    return { id: alvo, focada: ok === 'True' };
  }
  const env = ambienteGrafico();
  if (existe('wmctrl')) {
    try { await rodar('wmctrl', ['-ia', alvo], { env }); return { id: alvo, focada: true }; } catch { /* tenta o xdotool */ }
  }
  if (!existe('xdotool')) throw Object.assign(new Error(comoInstalar('wmctrl')), { status: 501 });
  const janela = String(Number(alvo));
  try {
    await rodar('xdotool', ['windowactivate', '--sync', janela], { env });
  } catch {
    // Gerenciador de janelas mínimo, sem _NET_ACTIVE_WINDOW: foco direto do X, que todo servidor aceita.
    await rodar('xdotool', ['windowraise', janela], { env }).catch(() => {});
    await rodar('xdotool', ['windowfocus', '--sync', janela], { env });
  }
  return { id: alvo, focada: true };
}

async function fechar({ id }) {
  const alvo = idValido(id);
  if (ehWindows) {
    await powershell().executar(`[OsoneAgente]::Fechar(${Number(alvo)})`);
    return { id: alvo, fechamentoPedido: true };
  }
  if (existe('wmctrl')) await rodar('wmctrl', ['-ic', alvo], { env: ambienteGrafico() });
  else if (existe('xdotool')) {
    // Sem wmctrl: foca e manda Alt+F4, que é o fechar educado de qualquer gerenciador de janelas.
    await rodar('xdotool', ['windowactivate', '--sync', String(Number(alvo))], { env: ambienteGrafico() });
    await rodar('xdotool', ['key', '--clearmodifiers', 'alt+F4'], { env: ambienteGrafico() });
  } else throw Object.assign(new Error(comoInstalar('wmctrl')), { status: 501 });
  return { id: alvo, fechamentoPedido: true };
}

module.exports = { listar, focar, fechar };
