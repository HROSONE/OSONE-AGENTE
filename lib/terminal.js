'use strict';
/**
 * PowerShell (Windows) e bash (Linux) para o assistente.
 *
 * ISTO NÃO É UMA SANDBOX. Com o terminal ligado, o assistente tem o poder do usuário que rodou o
 * agente. A lista abaixo é uma rede contra o acidente mais caro de um modelo de linguagem (formatar,
 * apagar a raiz, sobrescrever um disco, desligar a máquina no meio do trabalho) — não contra quem
 * quer contorná-la. Quem não confia no assistente desliga `permissoes.terminal` no config.json.
 */
const { spawn } = require('child_process');
const { ehWindows } = require('./processos');

const DESTRUTIVOS = [
  { padrao: /\brm\s+(-[a-z]*\s+)*-[a-z]*[rf][a-z]*\s+(-[a-z]*\s+)*(\/|~|\$HOME|\/\*|~\/\*)(\s|$)/i, motivo: 'apagar a raiz ou a pasta pessoal inteira' },
  { padrao: /\bmkfs(\.\w+)?\b/i, motivo: 'formatar um sistema de arquivos' },
  { padrao: /\bdd\b[^|;&]*\bof=\/dev\/(sd|nvme|hd|vd|mmcblk)/i, motivo: 'sobrescrever um disco' },
  { padrao: />\s*\/dev\/(sd|nvme|hd|vd|mmcblk)\w*/i, motivo: 'sobrescrever um disco' },
  { padrao: /:\(\)\s*\{\s*:\|:&\s*\};:/, motivo: 'fork bomb' },
  { padrao: /\b(shutdown|poweroff|halt|reboot)\b|\bsystemctl\s+(poweroff|reboot|halt)\b|\b(Stop|Restart)-Computer\b/i, motivo: 'desligar ou reiniciar a máquina' },
  { padrao: /\bformat(\.com)?\s+[a-z]:/i, motivo: 'formatar uma unidade' },
  { padrao: /\b(Format-Volume|Clear-Disk|Initialize-Disk|Remove-Partition)\b/i, motivo: 'apagar ou formatar um disco' },
  { padrao: /\bdiskpart\b/i, motivo: 'particionar discos' },
  { padrao: /\bRemove-Item\b[^|;]*-Recurse[^|;]*\s([a-z]:\\?|\\|\$env:(SystemRoot|windir|USERPROFILE))(\s|$|['"])/i, motivo: 'apagar uma unidade, o Windows ou a pasta do usuário inteira' },
  { padrao: /\b(rd|rmdir)\s+\/s\b[^|&]*\s[a-z]:\\?(\s|$)/i, motivo: 'apagar uma unidade inteira' },
  { padrao: /\bbcdedit\b|\breg\s+delete\s+HKLM/i, motivo: 'alterar a inicialização ou o registro do sistema' },
  { padrao: /\bchmod\s+(-R\s+)?[0-7]{3,4}\s+\/(\s|$)|\bchown\s+-R\s+\S+\s+\/(\s|$)/i, motivo: 'mudar permissões da raiz' }
];

function motivoDeBloqueio(comando, extras = []) {
  for (const { padrao, motivo } of DESTRUTIVOS) if (padrao.test(comando)) return motivo;
  for (const texto of extras) {
    if (texto && comando.toLowerCase().includes(String(texto).toLowerCase())) return `bloqueado no config.json ('${texto}')`;
  }
  return null;
}

/** Derruba o processo e todos os filhos: o comando que estourou o prazo pode ter aberto outros. */
function matarArvore(filho) {
  if (!filho.pid) return;
  if (ehWindows) spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
  else { try { process.kill(-filho.pid, 'SIGKILL'); } catch { try { filho.kill('SIGKILL'); } catch { /* já saiu */ } } }
}

function invocacao(comando, shell) {
  if (ehWindows) {
    if (shell === 'cmd') return ['cmd.exe', ['/d', '/s', '/c', comando]];
    // -EncodedCommand (UTF-16LE): o comando chega inteiro, com aspas e acentos, sem escape nenhum.
    const script = `[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'\n${comando}`;
    return ['powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]];
  }
  return [shell === 'sh' ? 'sh' : 'bash', ['-c', comando]];
}

function executar({ command, cwd, timeoutMs, shell } = {}, config = {}) {
  const comando = String(command ?? '').trim();
  if (!comando) return Promise.reject(Object.assign(new Error("Parâmetro 'command' é obrigatório."), { status: 400 }));
  const cfg = config.terminal || {};
  const motivo = motivoDeBloqueio(comando, cfg.bloquear);
  if (motivo) return Promise.reject(Object.assign(new Error(`Comando recusado: parece ${motivo}. Se for mesmo o que a pessoa quer, ela deve rodar à mão.`), { status: 403, bloqueado: true }));
  const prazo = Math.min(Math.max(1000, Number(timeoutMs) || cfg.prazoPadraoMs || 30000), cfg.prazoMaximoMs || 300000);
  const teto = cfg.saidaMaximaBytes || 200000;
  const [programa, args] = invocacao(comando, shell);
  return new Promise(resolve => {
    const inicio = Date.now();
    let stdout = '', stderr = '', cortado = false, estourou = false;
    const filho = spawn(programa, args, { cwd: cwd || undefined, windowsHide: true, detached: !ehWindows, env: process.env });
    const juntar = (atual, pedaco) => {
      if (atual.length >= teto) { cortado = true; return atual; }
      const novo = atual + pedaco.toString('utf8');
      if (novo.length > teto) { cortado = true; return novo.slice(0, teto); }
      return novo;
    };
    filho.stdout.on('data', p => { stdout = juntar(stdout, p); });
    filho.stderr.on('data', p => { stderr = juntar(stderr, p); });
    const timer = setTimeout(() => { estourou = true; matarArvore(filho); }, prazo);
    let feito = false;
    const terminar = codigo => {
      if (feito) return;
      feito = true;
      clearTimeout(timer);
      resolve({ codigo, stdout, stderr, duracaoMs: Date.now() - inicio, prazoEstourado: estourou, saidaCortada: cortado, shell: ehWindows ? (shell === 'cmd' ? 'cmd' : 'powershell') : (shell === 'sh' ? 'sh' : 'bash') });
    };
    filho.on('error', erro => { stderr += erro.message; terminar(-1); });
    filho.on('close', codigo => terminar(codigo));
  });
}

module.exports = { executar, motivoDeBloqueio, DESTRUTIVOS };
