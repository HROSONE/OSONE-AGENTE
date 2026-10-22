#!/usr/bin/env node
'use strict';
/**
 * OSONE AGENTE — o computador nas mãos de um assistente de IA.
 *
 *   node agente.js            inicia (cria config.json com um token na primeira vez)
 *   node agente.js --token    só mostra o token
 *   node agente.js --novo-token  troca o token (o antigo deixa de valer)
 */
const fs = require('fs');
const crypto = require('crypto');
const { criarAgente, carregarConfig, VERSAO } = require('./lib');
const { caminhoDaConfig } = require('./lib/config');
const plataforma = require('./lib/plataforma');

const args = process.argv.slice(2);
const config = carregarConfig();

if (args.includes('--novo-token')) {
  config.token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(caminhoDaConfig(), JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log(`Token novo salvo em ${caminhoDaConfig()}:\n${config.token}`);
  process.exit(0);
}
if (args.includes('--token')) {
  console.log(config.token);
  process.exit(0);
}

const { servidor } = criarAgente(config);
const resumo = plataforma.resumo();

servidor.on('error', erro => {
  if (erro.code === 'EADDRINUSE') console.error(`A porta ${config.porta} já está em uso. Feche o outro agente ou mude "porta" em ${caminhoDaConfig()}.`);
  else console.error(erro);
  process.exit(1);
});

servidor.listen(config.porta, config.host, () => {
  const ligadas = Object.entries(config.permissoes).filter(([, v]) => v).map(([k]) => k).join(', ');
  const linha = '='.repeat(64);
  console.log([
    linha,
    `  OSONE AGENTE ${VERSAO} — online`,
    linha,
    `  Endereço:    http://${config.host}:${config.porta}   (só esta máquina)`,
    `  Painel:      http://127.0.0.1:${config.porta}/`,
    `  Sistema:     ${resumo.sistema} (${resumo.sessao}) · entrada: ${resumo.entrada.motor || 'indisponível'}`,
    `  Permissões:  ${ligadas || 'nenhuma'}`,
    `  Token:       ${config.token}`,
    `  Config:      ${caminhoDaConfig()}`,
    linha,
    '  O token dá controle deste computador. Não o compartilhe nem o coloque em código público.',
    resumo.entrada.motor ? '' : `  ATENÇÃO: mouse e teclado indisponíveis — ${resumo.entrada.motivo}`,
    resumo.entrada.aviso ? `  Aviso: ${resumo.entrada.aviso}` : ''
  ].filter(Boolean).join('\n'));
});

const encerrar = () => { servidor.close(); require('./lib/powershell').powershell().fechar(); process.exit(0); };
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
