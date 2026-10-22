'use strict';
/**
 * Cliente do OSONE AGENTE para Node 18+ e navegadores (usa só `fetch`).
 *
 *   const { ClienteOsoneAgente } = require('osone-agente/cliente');
 *   const agente = new ClienteOsoneAgente({ token: 'SEU_TOKEN' });
 *   await agente.abrirApp('calculadora');
 *   await agente.digitar('olá');
 *   const resposta = await agente.ferramenta('clicar', { x: 100, y: 200 }); // nome do ferramentas.json
 */
class ClienteOsoneAgente {
  constructor({ url = 'http://127.0.0.1:9123', token, prazoMs = 60000 } = {}) {
    if (!token) throw new Error('Informe o token do agente (aparece ao iniciar: node agente.js --token).');
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.prazoMs = prazoMs;
  }

  async pedir(metodo, rota, corpo) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), this.prazoMs);
    try {
      const resposta = await fetch(this.url + rota, {
        method: metodo,
        signal: controle.signal,
        headers: { Authorization: `Bearer ${this.token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok || dados.ok === false) {
        throw Object.assign(new Error(dados.erro || `HTTP ${resposta.status}`), { status: resposta.status, dados });
      }
      return dados;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Chama qualquer ferramenta do ferramentas.json pelo nome — o que um assistente de IA precisa. */
  ferramenta(nome, args = {}) { return this.pedir('POST', '/ferramenta', { nome, args }); }

  estado() { return this.pedir('GET', '/status'); }
  abrirApp(appName, path) { return this.pedir('POST', '/open-app', { appName, path }); }
  fecharApp(appName, force = false) { return this.pedir('POST', '/close-app', { appName, force }); }
  clicar(x, y, opcoes = {}) { return this.pedir('POST', '/mouse/click-at', { x, y, ...opcoes }); }
  moverMouse(x, y) { return this.pedir('POST', '/mouse/move', { x, y }); }
  rolar(direction, amount = 3) { return this.pedir('POST', '/mouse/scroll', { direction, amount }); }
  arrastar(xDe, yDe, xPara, yPara) { return this.pedir('POST', '/mouse/drag', { xDe, yDe, xPara, yPara }); }
  digitar(text) { return this.pedir('POST', '/keyboard/type', { text }); }
  tecla(key) { return this.pedir('POST', '/keyboard/key', { key }); }
  verTela() { return this.pedir('GET', '/screen/capture'); }
  janelas() { return this.pedir('GET', '/window/list'); }
  focarJanela(id) { return this.pedir('POST', '/window/focus', { id }); }
  terminal(command, opcoes = {}) { return this.pedir('POST', '/exec', { command, ...opcoes }); }
}

if (typeof module !== 'undefined') module.exports = { ClienteOsoneAgente };
