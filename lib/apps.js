'use strict';
/**
 * Abrir e fechar aplicativos pelo NOME, como uma pessoa diria: "spotify", "calculadora", "vs code".
 *
 * O agente antigo só abria 4 apps fixos no config.json, e rodava o comando com `exec` (shell). Este
 * procura o app instalado de verdade, e o nome vindo do assistente nunca é interpretado por shell:
 * no Linux ele vira argumento de `execFile`; no Windows, texto base64 dentro do PowerShell.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { rodar, existe, lancarDesacoplado, ehWindows } = require('./processos');
const { powershell, literal } = require('./powershell');
const { ambienteGrafico } = require('./plataforma');

const normalizar = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ehUrl = v => /^(https?|mailto|ftp):/i.test(String(v));

// Nunca fechados por pedido: derrubar qualquer um deles derruba a sessão da pessoa.
const PROTEGIDOS = new Set([
  'explorer', 'winlogon', 'csrss', 'lsass', 'svchost', 'smss', 'wininit', 'services', 'dwm', 'system', 'registry', 'fontdrvhost',
  'systemd', 'init', 'xorg', 'xwayland', 'gnome-shell', 'kwin_x11', 'kwin_wayland', 'plasmashell', 'sshd', 'dbus-daemon',
  'pipewire', 'pulseaudio', 'gdm', 'sddm', 'lightdm', 'login', 'polkitd'
]);

// ---------- Linux: arquivos .desktop ----------
function pastasDesktop() {
  const casa = os.homedir();
  return [
    path.join(casa, '.local/share/applications'),
    '/usr/share/applications', '/usr/local/share/applications',
    path.join(casa, '.local/share/flatpak/exports/share/applications'),
    '/var/lib/flatpak/exports/share/applications', '/var/lib/snapd/desktop/applications'
  ];
}

function lerDesktop(arquivo) {
  try {
    const texto = fs.readFileSync(arquivo, 'utf8');
    const entrada = texto.split(/\n\[/)[0];
    const campo = chave => (new RegExp(`^${chave}=(.*)$`, 'm').exec(entrada) || [])[1];
    if (campo('NoDisplay') === 'true' || campo('Type') !== 'Application') return null;
    return {
      id: path.basename(arquivo, '.desktop'),
      nome: campo('Name') || '',
      nomes: [campo('Name'), campo('Name\\[pt_BR\\]'), campo('Name\\[pt\\]'), campo('GenericName'), campo('GenericName\\[pt_BR\\]'), path.basename(arquivo, '.desktop')].filter(Boolean),
      exec: campo('Exec') || ''
    };
  } catch {
    return null;
  }
}

function appsDoLinux() {
  const vistos = new Map();
  for (const pasta of pastasDesktop()) {
    let arquivos = [];
    try { arquivos = fs.readdirSync(pasta).filter(a => a.endsWith('.desktop')); } catch { continue; }
    for (const a of arquivos) {
      const app = lerDesktop(path.join(pasta, a));
      if (app && !vistos.has(app.id)) vistos.set(app.id, app);
    }
  }
  return [...vistos.values()];
}

/** O melhor app para o nome: igual > começa com > contém. Empate fica com o nome mais curto. */
function escolherApp(apps, pedido) {
  const alvo = normalizar(pedido);
  if (!alvo) return null;
  let melhor = null;
  for (const app of apps) {
    for (const nome of app.nomes) {
      const n = normalizar(nome);
      const pontos = n === alvo ? 3 : n.startsWith(alvo) ? 2 : n.includes(alvo) ? 1 : 0;
      if (pontos && (!melhor || pontos > melhor.pontos || (pontos === melhor.pontos && n.length < melhor.tamanho))) {
        melhor = { app, pontos, tamanho: n.length };
      }
    }
  }
  return melhor && melhor.app;
}

/** O comando do Exec= sem os códigos de campo (%u, %F...), que só fazem sentido para o lançador. */
function argsDoExec(exec) {
  const partes = [];
  const re = /"((?:\\.|[^"])*)"|(\S+)/g;
  let m;
  while ((m = re.exec(exec))) partes.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]);
  return partes.filter(p => !/^%[a-zA-Z]$/.test(p));
}

async function abrirNoLinux(nome, alvo, configurado) {
  const env = ambienteGrafico();
  if (configurado) {
    // Comando escrito pelo dono no config.json: confiável, e pode precisar de shell.
    await lancarDesacoplado('sh', ['-c', configurado], { env });
    return { como: 'config' };
  }
  const caminho = alvo || nome;
  if (ehUrl(caminho) || fs.existsSync(caminho)) {
    const abridor = existe('xdg-open') ? 'xdg-open' : existe('gio') ? 'gio' : null;
    if (!abridor) throw Object.assign(new Error('Falta xdg-open para abrir links e arquivos (pacote xdg-utils).'), { status: 501 });
    await lancarDesacoplado(abridor, abridor === 'gio' ? ['open', caminho] : [caminho], { env });
    return { como: abridor };
  }
  if (/^[\w.+-]+$/.test(nome) && existe(nome)) {
    await lancarDesacoplado(nome, alvo ? [alvo] : [], { env });
    return { como: 'executavel' };
  }
  const app = escolherApp(appsDoLinux(), nome);
  if (!app) throw Object.assign(new Error(`Não encontrei um app instalado chamado '${nome}'.`), { status: 404 });
  if (existe('gtk-launch')) await lancarDesacoplado('gtk-launch', [app.id, ...(alvo ? [alvo] : [])], { env });
  else {
    const [programa, ...args] = argsDoExec(app.exec);
    await lancarDesacoplado(programa, [...args, ...(alvo ? [alvo] : [])], { env });
  }
  return { como: 'menu-de-aplicativos', app: app.nome };
}

// ---------- Windows ----------
const SCRIPT_ABRIR_WINDOWS = (nome, alvo) => `
$nome = ${literal(nome)}
$alvo = ${literal(alvo || '')}
function Simples([string]$t) { (($t.Normalize([Text.NormalizationForm]::FormD).ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' }) -join '').ToLowerInvariant() }
function Abrir([string]$arquivo) { if ($alvo) { Start-Process -FilePath $arquivo -ArgumentList $alvo } else { Start-Process -FilePath $arquivo } }
if ($nome -match '^(https?|mailto|ftp):' -or (Test-Path -LiteralPath $nome)) { Start-Process -FilePath $nome; 'caminho'; return }
$cmd = Get-Command $nome -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($cmd) { Abrir $cmd.Source; 'executavel|' + $cmd.Source; return }
foreach ($raiz in 'HKCU:', 'HKLM:') {
  $chave = "$raiz\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\$nome.exe"
  if (Test-Path $chave) { $exe = (Get-ItemProperty $chave).'(default)'; if ($exe) { Abrir $exe; 'app-paths|' + $exe; return } }
}
$s = Simples $nome
if (Get-Command Get-StartApps -ErrorAction SilentlyContinue) {
  $apps = @(Get-StartApps)
  $app = ($apps | Where-Object { (Simples $_.Name) -eq $s } | Select-Object -First 1)
  if (-not $app) { $app = ($apps | Where-Object { (Simples $_.Name).StartsWith($s) } | Sort-Object { $_.Name.Length } | Select-Object -First 1) }
  if (-not $app) { $app = ($apps | Where-Object { (Simples $_.Name).Contains($s) } | Sort-Object { $_.Name.Length } | Select-Object -First 1) }
  if ($app) { Start-Process ('shell:AppsFolder\\' + $app.AppID); 'menu-iniciar|' + $app.Name; return }
}
$pastas = @("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs")
$lnk = Get-ChildItem -Path $pastas -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { (Simples $_.BaseName).Contains($s) } | Sort-Object { $_.BaseName.Length } | Select-Object -First 1
if ($lnk) { Start-Process -FilePath $lnk.FullName; 'atalho|' + $lnk.BaseName; return }
throw "Não encontrei um app instalado chamado '$nome'."
`;

const SCRIPT_FECHAR_WINDOWS = (nome, forcar) => `
$alvo = (${literal(nome)}) -replace '\\.exe$', ''
$procs = @(Get-Process -Name $alvo -ErrorAction SilentlyContinue)
if (-not $procs.Count) { $procs = @(Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -like "*$alvo*" }) }
$procs = @($procs | Where-Object { $_.Id -ne ${process.pid} -and @(${[...PROTEGIDOS].map(p => `'${p}'`).join(',')}) -notcontains $_.ProcessName.ToLower() })
if (-not $procs.Count) { throw "Nenhum app aberto com o nome '$alvo'." }
foreach ($p in $procs) { if (${forcar ? '$true' : '$false'}) { Stop-Process -Id $p.Id -Force } elseif (-not $p.CloseMainWindow()) { Stop-Process -Id $p.Id } }
$procs.Count
`;

// ---------- API ----------
async function abrir({ appName, path: alvo } = {}, config = {}) {
  const nome = String(appName ?? '').trim();
  if (!nome) throw Object.assign(new Error("Parâmetro 'appName' é obrigatório."), { status: 400 });
  const doConfig = config.apps && config.apps[nome] && config.apps[nome][ehWindows ? 'win32' : 'linux'];
  if (ehWindows) {
    if (doConfig) {
      await lancarDesacoplado('cmd.exe', ['/d', '/s', '/c', doConfig]);
      return { aberto: nome, como: 'config' };
    }
    const r = String(await powershell().executar(SCRIPT_ABRIR_WINDOWS(nome, alvo), 30000)).trim();
    const [como, detalhe] = r.split('|');
    return { aberto: nome, como, ...(detalhe ? { app: detalhe } : {}) };
  }
  return { aberto: nome, ...(await abrirNoLinux(nome, alvo, doConfig)) };
}

async function fechar({ appName, appId, force } = {}) {
  const nome = String(appName || appId || '').trim();
  if (!nome) throw Object.assign(new Error("Parâmetro 'appName' é obrigatório."), { status: 400 });
  if (PROTEGIDOS.has(nome.toLowerCase().replace(/\.exe$/, ''))) throw Object.assign(new Error(`'${nome}' é um processo do sistema e não pode ser fechado pelo agente.`), { status: 403 });
  if (ehWindows) {
    const total = Number(String(await powershell().executar(SCRIPT_FECHAR_WINDOWS(nome, force === true))).trim());
    return { fechados: total };
  }
  // Por PID e não por `pkill`: `pkill -x node` derrubaria o próprio agente.
  const pids = new Set();
  for (const procura of [['-x', '-i', nome], ['-i', '-f', `(^|/)${nome.replace(/[^\w.+-]/g, '')}( |$)`]]) {
    try { (await rodar('pgrep', procura)).stdout.split('\n').filter(Boolean).forEach(p => pids.add(Number(p))); } catch { /* nenhum */ }
    if (pids.size) break;
  }
  pids.delete(process.pid);
  pids.delete(process.ppid);
  if (!pids.size) throw Object.assign(new Error(`Nenhum app aberto com o nome '${nome}'.`), { status: 404 });
  for (const pid of pids) { try { process.kill(pid, force === true ? 'SIGKILL' : 'SIGTERM'); } catch { /* já saiu */ } }
  return { fechados: pids.size };
}

/** Os apps encontrados (Linux) — útil para o assistente saber o que existe. */
function listarInstalados() {
  if (ehWindows) return powershell().executar("if (Get-Command Get-StartApps -ErrorAction SilentlyContinue) { (Get-StartApps | Select-Object -ExpandProperty Name) -join \"`n\" }")
    .then(s => String(s).split('\n').map(x => x.trim()).filter(Boolean));
  return Promise.resolve(appsDoLinux().map(a => a.nome).filter(Boolean).sort());
}

module.exports = { abrir, fechar, listarInstalados, escolherApp, argsDoExec, SCRIPT_ABRIR_WINDOWS, SCRIPT_FECHAR_WINDOWS, PROTEGIDOS };
