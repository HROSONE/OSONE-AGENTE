/**
 * Sem HTTP: o agente dentro do seu próprio processo Node. Útil num app Electron ou num servidor
 * de assistente que roda na mesma máquina.
 */
const { criarAgente, carregarConfig } = require('..');

const { executarFerramenta } = criarAgente(carregarConfig());

(async () => {
  console.log(await executarFerramenta('estado_do_agente'));
  console.log(await executarFerramenta('terminal', { command: 'echo olá' }));
  // await executarFerramenta('abrir_app', { appName: 'calculadora' });
  // await executarFerramenta('digitar', { text: '12*7\n' });
})();
