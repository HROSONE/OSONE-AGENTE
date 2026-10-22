'use strict';
/**
 * Organizar pastas e mandar para a lixeira — herdado do agente original, com a mesma trava:
 * todo caminho é resolvido DENTRO de uma pasta permitida (`pastasPermitidas`), e `../` ou caminho
 * absoluto que tente sair dela é recusado. Nada é apagado de verdade: a lixeira é uma pasta.
 */
const fs = require('fs');
const path = require('path');
const { expandirHome } = require('./config');
const { registrar } = require('./auditoria');

const LIXEIRA = process.env.OSONE_AGENTE_LIXEIRA || path.join(__dirname, '..', 'lixeira');

const CATEGORIAS = {
  Imagens: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico', '.heic'],
  Documentos: ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt', '.epub', '.md', '.pages', '.tex', '.pptx', '.ppt', '.odp'],
  Planilhas: ['.xlsx', '.xls', '.csv', '.ods', '.tsv', '.numbers'],
  Videos: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv', '.m4v'],
  Audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'],
  Compactados: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'],
  Instaladores: ['.exe', '.msi', '.deb', '.rpm', '.appimage', '.dmg', '.pkg', '.iso', '.flatpakref']
};

const categoria = arquivo => Object.entries(CATEGORIAS).find(([, exts]) => exts.includes(path.extname(arquivo).toLowerCase()))?.[0] || 'Outros';

function erro(mensagem, status = 400) { return Object.assign(new Error(mensagem), { status }); }

function caminhoSeguro(config, chave, sub = '') {
  const base = config.pastasPermitidas && config.pastasPermitidas[chave];
  if (!base) throw erro(`Pasta '${chave}' não está em pastasPermitidas. Disponíveis: ${Object.keys(config.pastasPermitidas || {}).join(', ')}.`);
  const raiz = path.resolve(expandirHome(base));
  const alvo = path.resolve(raiz, String(sub || ''));
  if (alvo !== raiz && !alvo.startsWith(raiz + path.sep)) {
    registrar('SEGURANCA', 'caminho-fora-da-pasta', { chave, sub: String(sub).slice(0, 200) });
    throw erro('Acesso negado: o caminho sai da pasta permitida.', 403);
  }
  return { raiz, alvo };
}

function mover(de, para) {
  try { fs.renameSync(de, para); } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    fs.copyFileSync(de, para);
    fs.unlinkSync(de);
  }
}

function destinoLivre(pasta, arquivo) {
  const ext = path.extname(arquivo), base = path.basename(arquivo, ext);
  let nome = arquivo, n = 1;
  while (fs.existsSync(path.join(pasta, nome))) nome = `${base} (${n++})${ext}`;
  return path.join(pasta, nome);
}

function planejar({ folderKey }, config) {
  const { raiz } = caminhoSeguro(config, folderKey);
  if (!fs.existsSync(raiz)) throw erro(`A pasta ${raiz} não existe.`, 404);
  const plano = fs.readdirSync(raiz, { withFileTypes: true })
    .filter(e => e.isFile() && !e.name.startsWith('.'))
    .map(e => ({ file: e.name, category: categoria(e.name) }));
  return { folderKey, pasta: raiz, totalFiles: plano.length, plan: plano };
}

function executarPlano({ folderKey, plan, confirmed }, config) {
  if (confirmed !== true) throw erro('Envie confirmed: true para executar o plano.');
  if (!Array.isArray(plan) || !plan.length) throw erro('O plano está vazio.');
  const results = plan.map(item => {
    const arquivo = path.basename(String(item && item.file || ''));
    try {
      const { alvo: origem } = caminhoSeguro(config, folderKey, arquivo);
      if (!fs.existsSync(origem)) return { file: arquivo, status: 'skipped', error: 'arquivo não encontrado' };
      // A categoria é recalculada aqui: quem chama não escolhe para onde o arquivo vai.
      const { alvo: pasta } = caminhoSeguro(config, folderKey, categoria(arquivo));
      fs.mkdirSync(pasta, { recursive: true });
      const destino = destinoLivre(pasta, arquivo);
      mover(origem, destino);
      return { file: arquivo, status: 'moved', to: destino };
    } catch (e) {
      return { file: arquivo, status: 'error', error: e.message };
    }
  });
  const movidos = results.filter(r => r.status === 'moved').length;
  registrar('INFO', 'organizar', { folderKey, movidos, total: results.length });
  return { folderKey, movidos, results };
}

function paraLixeira({ folderKey, fileName, confirmed }, config) {
  if (confirmed !== true) throw erro('Envie confirmed: true para mandar para a lixeira.');
  if (!fileName) throw erro("Parâmetro 'fileName' é obrigatório.");
  const { alvo } = caminhoSeguro(config, folderKey, fileName);
  if (!fs.existsSync(alvo)) throw erro(`'${fileName}' não existe em '${folderKey}'.`, 404);
  fs.mkdirSync(LIXEIRA, { recursive: true });
  const destino = path.join(LIXEIRA, `${Date.now()}_${path.basename(alvo)}`);
  mover(alvo, destino);
  registrar('INFO', 'lixeira', { folderKey, arquivo: path.basename(alvo) });
  return { movidoPara: destino };
}

module.exports = { planejar, executarPlano, paraLixeira, caminhoSeguro, categoria, LIXEIRA };
