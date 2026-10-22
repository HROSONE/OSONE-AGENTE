'use strict';
/**
 * WINDOWS: UM POWERSHELL QUE FICA ABERTO.
 *
 * Mouse, teclado e janelas no Windows passam pelo `user32.dll`, e o jeito sem dependências de
 * chegar nele é C# compilado pelo `Add-Type`. Compilar custa perto de um segundo; a cada clique,
 * o assistente esperaria isso toda vez. Aqui o PowerShell abre uma vez, compila uma vez, e cada
 * pedido é uma linha: o script vai em base64 (sem aspas nem acentos para escapar) e a resposta volta
 * em base64 com um marcador. Se o processo morrer, o próximo pedido abre outro.
 *
 * O C# é escrito em C# 5: é o que o Windows PowerShell 5.1, presente em todo Windows 10/11, compila.
 */
const { spawn } = require('child_process');

const CODIGO_CSHARP = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class OsoneAgente {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }
  [StructLayout(LayoutKind.Explicit)] struct UNIAO { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public HARDWAREINPUT hi; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNIAO u; }
  delegate bool EnumWindowsProc(IntPtr h, IntPtr l);

  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int tamanho);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int indice);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int max);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int comando);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint de, uint para, bool ligar);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();

  static void Enviar(INPUT[] lista) { SendInput((uint)lista.Length, lista, Marshal.SizeOf(typeof(INPUT))); }
  static INPUT Mouse(uint flags, int dados) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; i.u.mi.mouseData = unchecked((uint)dados); return i; }
  static INPUT Tecla(ushort vk, ushort scan, uint flags) { INPUT i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i; }

  // Coordenadas em pixels físicos: sem isto, numa tela com escala de 125% o clique cai no lugar errado.
  public static void Iniciar() { try { SetProcessDPIAware(); } catch (Exception) { } }
  public static void Mover(int x, int y) { SetCursorPos(x, y); }
  public static string Posicao() { POINT p; GetCursorPos(out p); return p.X + "|" + p.Y; }

  // botao: 0 esquerdo, 1 direito, 2 meio. acao: 0 clique, 1 apertar, 2 soltar.
  public static void Botao(int botao, int acao, int vezes) {
    uint desce = botao == 1 ? 0x0008u : (botao == 2 ? 0x0020u : 0x0002u);
    uint sobe = botao == 1 ? 0x0010u : (botao == 2 ? 0x0040u : 0x0004u);
    if (acao == 1) { Enviar(new INPUT[] { Mouse(desce, 0) }); return; }
    if (acao == 2) { Enviar(new INPUT[] { Mouse(sobe, 0) }); return; }
    for (int n = 0; n < Math.Max(1, vezes); n++) {
      Enviar(new INPUT[] { Mouse(desce, 0), Mouse(sobe, 0) });
      System.Threading.Thread.Sleep(60);
    }
  }

  // Positivo rola para cima/direita, como a roda do mouse. Um "passo" é um entalhe (120).
  public static void Rolar(int vertical, int horizontal) {
    if (vertical != 0) Enviar(new INPUT[] { Mouse(0x0800u, vertical * 120) });
    if (horizontal != 0) Enviar(new INPUT[] { Mouse(0x01000u, horizontal * 120) });
  }

  public static void TeclaVk(int vk, bool estendida, bool soltar) {
    uint f = (estendida ? 1u : 0u) | (soltar ? 2u : 0u);
    Enviar(new INPUT[] { Tecla((ushort)vk, 0, f) });
  }

  // Texto por KEYEVENTF_UNICODE: acentos, emoji e qualquer layout de teclado, sem depender do idioma.
  public static void Texto(string texto) {
    foreach (char c in texto) {
      if (c == '\r') continue;
      if (c == '\n') { Enviar(new INPUT[] { Tecla(0x0D, 0, 0), Tecla(0x0D, 0, 2) }); continue; }
      if (c == '\t') { Enviar(new INPUT[] { Tecla(0x09, 0, 0), Tecla(0x09, 0, 2) }); continue; }
      Enviar(new INPUT[] { Tecla(0, c, 4), Tecla(0, c, 6) });
    }
  }

  public static string Janelas() {
    StringBuilder saida = new StringBuilder();
    IntPtr ativa = GetForegroundWindow();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      int tamanho = GetWindowTextLength(h);
      if (tamanho == 0) return true;
      StringBuilder titulo = new StringBuilder(tamanho + 1);
      GetWindowText(h, titulo, titulo.Capacity);
      uint pid; GetWindowThreadProcessId(h, out pid);
      saida.Append(h.ToInt64()).Append('\t').Append(pid).Append('\t').Append(h == ativa ? 1 : 0).Append('\t')
        .Append(titulo.ToString().Replace('\t', ' ').Replace('\n', ' ')).Append('\n');
      return true;
    }, IntPtr.Zero);
    return saida.ToString();
  }

  // O Windows só deixa trazer janela para a frente quem já está na frente; unir a fila de entrada
  // com a da janela ativa é o jeito documentado de herdar essa permissão por um instante.
  public static bool Focar(long hwnd) {
    IntPtr h = new IntPtr(hwnd);
    if (IsIconic(h)) ShowWindow(h, 9);
    uint lixo;
    uint daFrente = GetWindowThreadProcessId(GetForegroundWindow(), out lixo);
    uint minha = GetCurrentThreadId();
    bool unido = daFrente != minha && AttachThreadInput(minha, daFrente, true);
    bool ok = SetForegroundWindow(h);
    BringWindowToTop(h);
    if (unido) AttachThreadInput(minha, daFrente, false);
    return ok;
  }

  // WM_CLOSE: a janela fecha como se clicassem no X, e o app ainda pode perguntar se quer salvar.
  public static bool Fechar(long hwnd) { return PostMessage(new IntPtr(hwnd), 0x0010, IntPtr.Zero, IntPtr.Zero); }

  // x|y|largura|altura da área de trabalho virtual (todas as telas).
  public static string Tela() { return GetSystemMetrics(76) + "|" + GetSystemMetrics(77) + "|" + GetSystemMetrics(78) + "|" + GetSystemMetrics(79); }
}
`;

/** Texto qualquer como expressão PowerShell segura: base64, sem nada para escapar. */
function literal(texto) {
  return `([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(String(texto), 'utf8').toString('base64')}')))`;
}

/** A linha que vai ao processo: roda o script e devolve a saída em base64 com o marcador do pedido. */
function linhaDoPedido(script, id) {
  const b64 = Buffer.from(script, 'utf8').toString('base64');
  return `$__r = try { (& ([ScriptBlock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')))) | Out-String) } catch { '__ERRO__' + $_.Exception.Message }; ` +
    `[Console]::Out.WriteLine('__INI__' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$__r)) + ' __FIM__${id}'); [Console]::Out.Flush()\n`;
}

const SCRIPT_INICIAL = `Add-Type -TypeDefinition ${literal(CODIGO_CSHARP)} -Language CSharp; [OsoneAgente]::Iniciar(); 'pronto'`;

class TrabalhadorPowerShell {
  constructor({ programa = process.env.OSONE_AGENTE_POWERSHELL || 'powershell.exe', prazoMs = 20000, iniciar = SCRIPT_INICIAL } = {}) {
    this.programa = programa;
    this.prazoMs = prazoMs;
    this.iniciar = iniciar;
    this.processo = null;
    this.fila = Promise.resolve();
    this.pendentes = new Map();
    this.buffer = '';
    this.contador = 0;
    this.pronto = null;
  }

  abrir() {
    if (this.processo) return this.pronto;
    const filho = spawn(this.programa, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.processo = filho;
    filho.stdout.setEncoding('utf8');
    filho.stdout.on('data', pedaco => this.aoReceber(pedaco));
    filho.stderr.on('data', () => { /* erros vêm pelo marcador __ERRO__ */ });
    const morrer = (motivo) => {
      if (this.processo !== filho) return;
      this.processo = null;
      this.pronto = null;
      for (const [, p] of this.pendentes) p.rejeitar(new Error(`PowerShell encerrou: ${motivo}`));
      this.pendentes.clear();
    };
    filho.on('exit', codigo => morrer(`código ${codigo}`));
    filho.on('error', erro => morrer(erro.message));
    this.pronto = this.enviarDireto(this.iniciar, 60000);
    return this.pronto;
  }

  aoReceber(pedaco) {
    this.buffer += pedaco;
    let fim;
    while ((fim = this.buffer.indexOf('\n')) >= 0) {
      const linha = this.buffer.slice(0, fim).trim();
      this.buffer = this.buffer.slice(fim + 1);
      // Marcadores dos dois lados: o PowerShell 7 escreve sequências de terminal (terminadas em
      // '=', que também é base64) antes da primeira saída, e elas grudavam na resposta.
      const m = /__INI__([A-Za-z0-9+/=]*) __FIM__(\d+)$/.exec(linha);
      if (!m) continue;
      const pendente = this.pendentes.get(Number(m[2]));
      if (!pendente) continue;
      this.pendentes.delete(Number(m[2]));
      const texto = Buffer.from(m[1], 'base64').toString('utf8');
      if (texto.startsWith('__ERRO__')) pendente.rejeitar(new Error(texto.slice(8).trim()));
      else pendente.resolver(texto.replace(/\r?\n$/, ''));
    }
  }

  enviarDireto(script, prazoMs = this.prazoMs) {
    const id = ++this.contador;
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        rejeitar(new Error(`PowerShell não respondeu em ${prazoMs} ms`));
        // Um script travado prende a fila inteira: derruba e o próximo pedido abre outro.
        try { this.processo && this.processo.kill(); } catch { /* já morreu */ }
      }, prazoMs);
      this.pendentes.set(id, {
        resolver: v => { clearTimeout(timer); resolver(v); },
        rejeitar: e => { clearTimeout(timer); rejeitar(e); }
      });
      try { this.processo.stdin.write(linhaDoPedido(script, id)); } catch (erro) { this.pendentes.delete(id); clearTimeout(timer); rejeitar(erro); }
    });
  }

  /** Um pedido por vez: dois cliques simultâneos virariam um arrasto. */
  executar(script, prazoMs) {
    const rodada = this.fila.then(async () => {
      await this.abrir();
      return this.enviarDireto(script, prazoMs);
    });
    this.fila = rodada.catch(() => {});
    return rodada;
  }

  fechar() {
    try { this.processo && this.processo.kill(); } catch { /* já fechado */ }
    this.processo = null;
  }
}

let unico = null;
function powershell() {
  if (!unico) unico = new TrabalhadorPowerShell();
  return unico;
}

module.exports = { TrabalhadorPowerShell, powershell, literal, linhaDoPedido, CODIGO_CSHARP, SCRIPT_INICIAL };
