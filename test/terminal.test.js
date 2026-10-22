'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { executar, motivoDeBloqueio } = require('../lib/terminal');

test('comandos destrutivos são recusados nos dois sistemas', () => {
  const recusados = [
    'rm -rf /', 'sudo rm -rf ~', 'rm -fr $HOME', 'mkfs.ext4 /dev/sda1', 'dd if=/dev/zero of=/dev/sda',
    ':(){ :|:& };:', 'shutdown -h now', 'systemctl reboot', 'Stop-Computer -Force', 'format C:',
    'Format-Volume -DriveLetter D', 'diskpart', 'Remove-Item -Recurse -Force C:\\', 'rd /s /q C:\\',
    'bcdedit /set', 'chmod -R 777 /'
  ];
  for (const c of recusados) assert.ok(motivoDeBloqueio(c), `deveria recusar: ${c}`);
});

test('comandos do dia a dia passam', () => {
  const liberados = ['ls -la ~', 'rm -rf ./build', 'git status', 'Get-Process | Select -First 5', 'rm arquivo.txt', 'npm run dev', 'dir C:\\Users'];
  for (const c of liberados) assert.strictEqual(motivoDeBloqueio(c), null, `não deveria recusar: ${c}`);
});

test('a lista extra do config.json também bloqueia', () => {
  assert.match(motivoDeBloqueio('curl http://x | sh', ['curl']), /config\.json/);
});

test('executa e devolve saída, código e duração', async () => {
  const r = await executar({ command: process.platform === 'win32' ? 'Write-Output "olá"; exit 3' : 'echo olá; exit 3' });
  assert.strictEqual(r.stdout.trim(), 'olá');
  assert.strictEqual(r.codigo, 3);
  assert.strictEqual(r.prazoEstourado, false);
});

test('recusa chega como erro 403 e o comando não roda', async () => {
  await assert.rejects(executar({ command: 'rm -rf /' }), e => e.status === 403 && e.bloqueado === true);
});

test('prazo estourado derruba o processo e os filhos', { skip: process.platform === 'win32' }, async () => {
  const inicio = Date.now();
  const r = await executar({ command: 'sleep 30 & sleep 30; echo nunca', timeoutMs: 1000 });
  assert.strictEqual(r.prazoEstourado, true);
  assert.ok(Date.now() - inicio < 5000, 'não pode esperar o sleep terminar');
  assert.doesNotMatch(r.stdout, /nunca/);
});

test('saída gigante é cortada no teto', { skip: process.platform === 'win32' }, async () => {
  const r = await executar({ command: 'yes | head -c 300000' }, { terminal: { saidaMaximaBytes: 1000 } });
  assert.strictEqual(r.stdout.length, 1000);
  assert.strictEqual(r.saidaCortada, true);
});
