'use strict';
/**
 * O lado do Windows sem um Windows: o PowerShell 7 (pwsh) roda no Linux e compila o mesmo C#. Isso
 * prova sintaxe dos scripts, compilação do Add-Type e o protocolo do processo residente — não prova
 * que o SendInput move o mouse, que só um Windows real mostra.
 *
 * Usa OSONE_AGENTE_POWERSHELL ou o `pwsh` do PATH; sem nenhum, os testes são pulados.
 */
const test = require('node:test');
const assert = require('node:assert');
const { existe } = require('../lib/processos');
const { TrabalhadorPowerShell, CODIGO_CSHARP, literal } = require('../lib/powershell');
const { SCRIPT_ABRIR_WINDOWS, SCRIPT_FECHAR_WINDOWS } = require('../lib/apps');
const { SCRIPT_CAPTURA_WINDOWS } = require('../lib/tela');

const programa = process.env.OSONE_AGENTE_POWERSHELL || (existe('pwsh') ? 'pwsh' : process.platform === 'win32' ? 'powershell.exe' : null);
const pular = programa ? false : 'sem PowerShell (instale o pwsh ou defina OSONE_AGENTE_POWERSHELL)';
const noWindows = process.platform === 'win32';

// Fora do Windows o user32 não existe: compila a classe mas não chama Iniciar() (SetProcessDPIAware).
const ps = programa && new TrabalhadorPowerShell({
  programa,
  iniciar: noWindows ? undefined : `Add-Type -TypeDefinition ${literal(CODIGO_CSHARP)} -Language CSharp; 'pronto'`
});
test.after(() => ps && ps.fechar());

test('o C# compila e a classe OsoneAgente existe', { skip: pular, timeout: 120000 }, async () => {
  const metodos = await ps.executar('([OsoneAgente].GetMethods() | ForEach-Object Name | Sort-Object -Unique) -join ","');
  for (const m of ['Mover', 'Posicao', 'Botao', 'Rolar', 'TeclaVk', 'Texto', 'Janelas', 'Focar', 'Fechar', 'Tela']) {
    assert.ok(metodos.split(',').includes(m), `falta ${m} em ${metodos}`);
  }
});

test('texto com acento, aspas e quebra de linha vai e volta intacto', { skip: pular, timeout: 60000 }, async () => {
  const texto = 'Olá "AÇÃO" \'ç\' ✓ $env:PATH `n €\nsegunda linha';
  assert.strictEqual(await ps.executar(`Write-Output ${literal(texto)}`), texto);
});

test('erro do script vira rejeição, e o processo continua servindo', { skip: pular, timeout: 60000 }, async () => {
  await assert.rejects(ps.executar('throw "quebrou de propósito"'), /quebrou de propósito/);
  assert.strictEqual(await ps.executar('1 + 1'), '2');
});

test('pedidos simultâneos saem na ordem', { skip: pular, timeout: 60000 }, async () => {
  const respostas = await Promise.all([1, 2, 3, 4, 5].map(n => ps.executar(`Start-Sleep -Milliseconds ${50 - n * 8}; ${n}`)));
  assert.deepStrictEqual(respostas, ['1', '2', '3', '4', '5']);
});

test('scripts de abrir, fechar e capturar não têm erro de sintaxe', { skip: pular, timeout: 60000 }, async () => {
  const scripts = {
    abrir: SCRIPT_ABRIR_WINDOWS('calculadora', ''),
    abrirComAlvo: SCRIPT_ABRIR_WINDOWS('notepad', 'C:\\Users\\Público\\nota "x".txt'),
    fechar: SCRIPT_FECHAR_WINDOWS('notepad', false),
    fecharForcado: SCRIPT_FECHAR_WINDOWS('notepad', true),
    capturar: SCRIPT_CAPTURA_WINDOWS
  };
  for (const [nome, script] of Object.entries(scripts)) {
    const erros = await ps.executar(`$e = $null; [void][System.Management.Automation.Language.Parser]::ParseInput(${literal(script)}, [ref]$null, [ref]$e); ($e | ForEach-Object { $_.Message }) -join ' | '`);
    assert.strictEqual(erros, '', `${nome}: ${erros}`);
  }
});
