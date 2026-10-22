/**
 * Um assistente Gemini que controla o computador pelo OSONE AGENTE.
 *
 *   npm i @google/genai
 *   GEMINI_API_KEY=... OSONE_AGENTE_TOKEN=... node exemplos/gemini.mjs "abre a calculadora e calcula 12*7"
 *
 * O laço é o mesmo para qualquer modelo com function calling: declara as ferramentas do
 * ferramentas.json, executa o que o modelo pedir via POST /ferramenta e devolve o resultado.
 */
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ferramentas } = require('../ferramentas.json');
const { ClienteOsoneAgente } = require('../cliente.js');

const agente = new ClienteOsoneAgente({ token: process.env.OSONE_AGENTE_TOKEN });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const pedido = process.argv.slice(2).join(' ') || 'Abra a calculadora.';

const historico = [{ role: 'user', parts: [{ text: pedido }] }];
for (let passo = 0; passo < 15; passo++) {
  const resposta = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: historico,
    config: {
      systemInstruction: 'Você controla o computador da pessoa pelas ferramentas. Antes de clicar, use ver_tela para saber onde. Confirme com a pessoa antes de apagar ou fechar algo com trabalho não salvo.',
      tools: [{ functionDeclarations: ferramentas }]
    }
  });
  const conteudo = resposta.candidates[0].content;
  historico.push(conteudo);
  const chamadas = conteudo.parts.filter(p => p.functionCall);
  if (!chamadas.length) { console.log(resposta.text); break; }

  const retornos = [];
  for (const { functionCall } of chamadas) {
    console.log(`→ ${functionCall.name}`, JSON.stringify(functionCall.args));
    let resultado;
    try { resultado = await agente.ferramenta(functionCall.name, functionCall.args); }
    catch (erro) { resultado = { erro: erro.message }; }
    // A captura vai como imagem; o resto como JSON.
    if (resultado.base64) {
      retornos.push({ functionResponse: { name: functionCall.name, response: { ok: true, formato: 'png' } } });
      retornos.push({ inlineData: { mimeType: 'image/png', data: resultado.base64 } });
    } else {
      retornos.push({ functionResponse: { name: functionCall.name, response: resultado } });
    }
  }
  historico.push({ role: 'user', parts: retornos });
}
