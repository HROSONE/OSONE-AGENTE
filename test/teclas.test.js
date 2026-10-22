'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { interpretarAtalho } = require('../lib/teclas');
const { trechosParaXdotool } = require('../lib/entrada');

test('atalho com modificadores vira tecla + modificadores do mapa', () => {
  const a = interpretarAtalho('ctrl+shift+t');
  assert.strictEqual(a.tecla, 't');
  assert.deepStrictEqual(a.modificadores.map(m => m.nome), ['ctrl', 'shift']);
  assert.ok(a.mapa.vk && a.mapa.x11, 'a tecla precisa ter código no Windows (vk) e no X11');
});

test('apelidos em português e em inglês', () => {
  for (const [entrada, esperado] of [['Enter', 'enter'], ['esc', 'escape'], ['Alt+F4', 'f4'], ['volumeup', 'volumeup']]) {
    const a = interpretarAtalho(entrada);
    assert.ok(!a.erro, `${entrada}: ${a.erro}`);
    assert.strictEqual(a.tecla, esperado, entrada);
  }
  assert.ok(!interpretarAtalho('win').erro, 'win sozinho abre o menu iniciar');
});

test('modificadores também chegam pelo campo separado', () => {
  const a = interpretarAtalho('c', ['ctrl']);
  assert.deepStrictEqual(a.modificadores.map(m => m.nome), ['ctrl']);
});

test('tecla ou modificador desconhecido é recusado, nunca adivinhado', () => {
  assert.match(interpretarAtalho('ctrl+teclainventada').erro, /desconhecida/);
  assert.match(interpretarAtalho('hiper+c').erro, /Modificador desconhecido/);
  assert.match(interpretarAtalho('').erro, /obrigatório/);
});

test('maiúscula acentuada sai do type do xdotool e vai por shift + minúscula', () => {
  // Medido no Xvfb: "ÇÁÉ" pelo `type` chegava "çáé". Ver o comentário em lib/entrada.js.
  assert.deepStrictEqual(trechosParaXdotool('aÇb'), [{ texto: 'a' }, { maiuscula: 'U00E7' }, { texto: 'b' }]);
  assert.deepStrictEqual(trechosParaXdotool('São Paulo ✓ ç'), [{ texto: 'São Paulo ✓ ç' }]);
  assert.deepStrictEqual(trechosParaXdotool('ÉÑ'), [{ maiuscula: 'U00E9' }, { maiuscula: 'U00F1' }]);
});
