/**
 * O mesmo laço com a API da OpenAI (ou qualquer API compatível: Groq, OpenRouter, Ollama...).
 *
 *   npm i openai
 *   OPENAI_API_KEY=... OSONE_AGENTE_TOKEN=... node exemplos/openai.mjs "lista as janelas abertas"
 */
import OpenAI from 'openai';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ferramentas } = require('../ferramentas.json');
const { ClienteOsoneAgente } = require('../cliente.js');

const agente = new ClienteOsoneAgente({ token: process.env.OSONE_AGENTE_TOKEN });
const openai = new OpenAI();
const tools = ferramentas.map(f => ({ type: 'function', function: f }));
const mensagens = [
  { role: 'system', content: 'Você controla o computador da pessoa pelas ferramentas. Confirme antes de ações destrutivas.' },
  { role: 'user', content: process.argv.slice(2).join(' ') || 'Que janelas estão abertas?' }
];

for (let passo = 0; passo < 15; passo++) {
  const { choices } = await openai.chat.completions.create({ model: process.env.MODELO || 'gpt-4.1-mini', messages: mensagens, tools });
  const msg = choices[0].message;
  mensagens.push(msg);
  if (!msg.tool_calls?.length) { console.log(msg.content); break; }
  for (const chamada of msg.tool_calls) {
    const args = JSON.parse(chamada.function.arguments || '{}');
    console.log(`→ ${chamada.function.name}`, JSON.stringify(args));
    let resultado;
    try { resultado = await agente.ferramenta(chamada.function.name, args); }
    catch (erro) { resultado = { erro: erro.message }; }
    // Imagem em base64 estoura o contexto como texto: aqui vai só o aviso.
    if (resultado.base64) resultado = { ok: true, aviso: 'captura feita; envie como imagem para o modelo ver' };
    mensagens.push({ role: 'tool', tool_call_id: chamada.id, content: JSON.stringify(resultado) });
  }
}
