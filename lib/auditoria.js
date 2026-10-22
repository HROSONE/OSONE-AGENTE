'use strict';
/** Trilha de auditoria: uma linha JSON por ação em `audit.log`, nunca com o token nem com texto digitado. */
const fs = require('fs');
const path = require('path');

const ARQUIVO = process.env.OSONE_AGENTE_AUDITORIA || path.join(__dirname, '..', 'audit.log');
const TETO_DO_ARQUIVO = 5 * 1024 * 1024;

function registrar(nivel, acao, detalhes = {}) {
  const linha = JSON.stringify({ em: new Date().toISOString(), nivel, acao, ...detalhes });
  if (process.env.OSONE_AGENTE_SILENCIOSO !== '1') console.log(`[${nivel}] ${acao}`);
  try {
    // Gira quando passa do teto: auditoria não pode encher o disco de quem deixou o agente ligado.
    if (fs.existsSync(ARQUIVO) && fs.statSync(ARQUIVO).size > TETO_DO_ARQUIVO) {
      fs.renameSync(ARQUIVO, `${ARQUIVO}.1`);
    }
    fs.appendFileSync(ARQUIVO, `${linha}\n`);
  } catch { /* a ação não falha porque o log falhou */ }
}

function ultimas(quantas = 100) {
  try {
    const linhas = fs.readFileSync(ARQUIVO, 'utf8').trim().split('\n');
    return linhas.slice(-Math.min(Math.max(1, quantas), 1000)).map(l => { try { return JSON.parse(l); } catch { return { linha: l }; } });
  } catch {
    return [];
  }
}

module.exports = { registrar, ultimas, ARQUIVO };
