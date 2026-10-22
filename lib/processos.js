'use strict';
/**
 * Rodar programas sem shell no meio. `execFile` recebe os argumentos separados: nenhum texto vindo
 * de um assistente vira comando por acidente (aspas, `;`, `$()`), que era o risco do `exec` antigo.
 */
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ehWindows = process.platform === 'win32';

function rodar(programa, args = [], { prazoMs = 10000, entrada, env, cwd, binario = false } = {}) {
  return new Promise((resolve, reject) => {
    const filho = execFile(programa, args, {
      timeout: prazoMs,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      encoding: binario ? 'buffer' : 'utf8',
      env: env ? { ...process.env, ...env } : process.env,
      cwd
    }, (erro, stdout, stderr) => {
      if (erro) {
        const motivo = erro.killed ? `passou de ${prazoMs} ms` : (String(stderr || '').trim() || erro.message);
        return reject(Object.assign(new Error(`${path.basename(programa)}: ${motivo}`), { codigo: erro.code, stderr }));
      }
      resolve({ stdout, stderr });
    });
    if (entrada !== undefined) filho.stdin.end(entrada);
  });
}

/** O programa existe no PATH? Resultado guardado: a lista de ferramentas não muda durante a execução. */
const cacheDeProgramas = new Map();
function existe(programa) {
  if (cacheDeProgramas.has(programa)) return cacheDeProgramas.get(programa);
  const pastas = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensoes = ehWindows ? String(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  const achado = pastas.some(pasta => extensoes.some(ext => {
    try { return fs.statSync(path.join(pasta, programa + ext.toLowerCase())).isFile() || fs.statSync(path.join(pasta, programa + ext)).isFile(); } catch { return false; }
  }));
  cacheDeProgramas.set(programa, achado);
  return achado;
}

/** Abre um programa e solta: app de janela não termina, e esperar por ele travaria a resposta. */
function lancarDesacoplado(programa, args = [], { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    let filho;
    try {
      filho = spawn(programa, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        cwd,
        env: env ? { ...process.env, ...env } : process.env
      });
    } catch (erro) {
      return reject(erro);
    }
    filho.once('error', reject);
    // Um programa que não existe falha no `spawn` em milissegundos; depois disso, considera aberto.
    setTimeout(() => { filho.unref(); resolve({ pid: filho.pid }); }, 400);
  });
}

module.exports = { rodar, existe, lancarDesacoplado, ehWindows };
