/**
 * ============================================================================
 * OSONE LOCAL AGENT (osone-local-agent)
 * ============================================================================
 * Agente local standalone em Node.js (Sem dependências externas - apenas nativos)
 * Módulos utilizados: http, crypto, child_process, fs, path, os
 * 
 * Funcionalidades Principais:
 * 1. Abertura segura de aplicativos locais via allowlist
 * 2. Organização segura de arquivos em duas etapas (Plano -> Confirmação -> Execução)
 * 3. Lixeira local segura (movimentação para trash/ sem deleção permanente)
 * 4. Jail de diretório (Prevenção rigorosa de Path Traversal)
 * 5. Autenticação via Token Bearer e CORS restrito
 * 6. Logs de auditoria persistentes em audit.log
 * ============================================================================
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================================
// SEÇÃO 1: CONFIGURAÇÃO E INICIALIZAÇÃO
// ============================================================================

const CONFIG_PATH = path.join(__dirname, 'config.json');
const AUDIT_LOG_PATH = path.join(__dirname, 'audit.log');
const TRASH_DIR_PATH = path.join(__dirname, 'trash');

/**
 * Categorias de extensões de arquivo para organização automática
 */
const FILE_CATEGORIES = {
  Imagens: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico', '.heic'],
  Documentos: ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.odt', '.epub', '.md', '.pages', '.tex'],
  Planilhas: ['.xlsx', '.xls', '.csv', '.ods', '.tsv', '.numbers'],
  Videos: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv', '.m4v'],
  Audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
  Compactados: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'],
  Instaladores: ['.exe', '.msi', '.deb', '.rpm', '.appimage', '.dmg', '.pkg', '.iso'],
  Outros: [] // Categoria padrão caso a extensão não coincida
};

let CONFIG = {
  port: 9123,
  token: '',
  allowedOrigin: '*',
  apps: {
    spotify: {
      win32: 'start spotify:',
      linux: 'spotify'
    },
    vscode: {
      win32: 'code',
      linux: 'code'
    },
    filemanager: {
      win32: 'explorer',
      linux: 'xdg-open .'
    },
    terminal: {
      win32: 'start cmd',
      linux: 'gnome-terminal'
    },
    browser: {
      win32: 'start https://google.com',
      linux: 'xdg-open https://google.com'
    }
  },
  allowedFolders: {
    downloads: '~/Downloads',
    desktop: '~/Desktop',
    documents: '~/Documents'
  }
};

/**
 * Carrega ou gera o arquivo config.json
 */
function initializeConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(fileData);
      CONFIG = { ...CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('[CONFIG WARNING] Erro ao ler config.json. Usando padrão.', err.message);
  }

  // Se token não existir ou estiver vazio, gera um novo token criptograficamente forte
  if (!CONFIG.token || CONFIG.token.trim() === '') {
    CONFIG.token = crypto.randomBytes(32).toString('hex');
    saveConfig();
  }

  // Garante que o diretório da lixeira local exista
  if (!fs.existsSync(TRASH_DIR_PATH)) {
    try {
      fs.mkdirSync(TRASH_DIR_PATH, { recursive: true });
    } catch (err) {
      console.error('[TRASH INIT ERROR]', err.message);
    }
  }
}

/**
 * Salva as configurações atuais no arquivo config.json
 */
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2), 'utf8');
  } catch (err) {
    console.error('[CONFIG SAVE ERROR]', err.message);
  }
}

// ============================================================================
// SEÇÃO 2: AUDITORIA E LOGS (audit.log)
// ============================================================================

/**
 * Registra uma entrada com carimbo de data/hora ISO 8601 no arquivo audit.log
 * @param {'INFO'|'WARN'|'ERROR'|'SECURITY'} level 
 * @param {string} action 
 * @param {string} message 
 * @param {object} [metadata] 
 */
function logAudit(level, action, message, metadata = null) {
  const timestamp = new Date().toISOString();
  const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';
  const logLine = `[${timestamp}] [${level}] [${action}] ${message}${metaStr}\n`;

  console.log(`[AUDIT ${level}] ${action}: ${message}`);

  try {
    fs.appendFileSync(AUDIT_LOG_PATH, logLine, 'utf8');
  } catch (err) {
    console.error('[AUDIT WRITE ERROR]', err.message);
  }
}

// ============================================================================
// SEÇÃO 3: SEGURANÇA DE CAMINHOS (JAIL DE DIRETÓRIO)
// ============================================================================

/**
 * Resolve o caminho de forma segura garantindo que ele não escape do diretório base configurado.
 * Impede Path Traversal (ex: "../", "../../etc/passwd", etc.)
 * 
 * @param {string} folderKey - Chave lógica da pasta autorizada em config.json (ex: 'downloads')
 * @param {string} [relativeSubPath=''] - Subcaminho relativo dentro da pasta
 * @returns {{ baseDir: string, targetPath: string }}
 */
function resolveSafePath(folderKey, relativeSubPath = '') {
  if (!folderKey || typeof folderKey !== 'string') {
    throw new Error('Pasta não especificada ou inválida.');
  }

  const configuredPath = CONFIG.allowedFolders[folderKey];
  if (!configuredPath) {
    throw new Error(`Pasta '${folderKey}' não está na lista de allowedFolders autorizadas.`);
  }

  // Expandir '~' para o diretório home do usuário se necessário
  let expandedBase = configuredPath;
  if (expandedBase.startsWith('~')) {
    expandedBase = path.join(os.homedir(), expandedBase.slice(1));
  }

  const baseDir = path.resolve(expandedBase);

  // Garantir que a pasta base exista
  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch (err) {
      throw new Error(`Pasta base '${folderKey}' (${baseDir}) não existe e não pôde ser criada.`);
    }
  }

  // Resolver o caminho de destino relativo
  const cleanSubPath = relativeSubPath ? String(relativeSubPath).trim() : '';
  const targetPath = path.resolve(baseDir, cleanSubPath);

  // Validação estrita de jail/sandbox:
  // O caminho resolvido DEVE ser idêntico à pasta base OU começar exatamente com baseDir + separador de arquivo
  const isExactBase = targetPath === baseDir;
  const isInsideBase = targetPath.startsWith(baseDir + path.sep);

  if (!isExactBase && !isInsideBase) {
    logAudit('SECURITY', 'PATH_TRAVERSAL_BLOCKED', `Tentativa de saída do jail bloqueada para folderKey=${folderKey}`, {
      subPath: relativeSubPath,
      resolvedTarget: targetPath,
      baseDir
    });
    throw new Error('Acesso Negado: Tentativa de Path Traversal ou acesso fora do diretório permitido.');
  }

  return { baseDir, targetPath };
}

// ============================================================================
// SEÇÃO 4: CATEGORIZAÇÃO DE ARQUIVOS
// ============================================================================

/**
 * Determina a categoria de um arquivo com base em sua extensão
 * @param {string} filename 
 * @returns {string} Categoria lógica
 */
function getCategoryForFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return 'Outros';

  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return 'Outros';
}

// ============================================================================
// SEÇÃO 5: AUXILIARES DE RESPOSTA HTTP & PARSING
// ============================================================================

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // Limite de 5MB
        req.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// ============================================================================
// SEÇÃO 6: HANDLERS DE ROTAS
// ============================================================================

/**
 * GET /status - Retorna status do agente, plataforma e recursos permitidos
 */
function handleStatus(req, res) {
  const currentPlatform = process.platform === 'win32' ? 'win32' : 'linux';
  sendJSON(res, 200, {
    status: 'online',
    agentName: 'osone-local-agent',
    version: '1.0.0',
    platform: currentPlatform,
    systemOS: os.type(),
    availableApps: Object.keys(CONFIG.apps || {}),
    allowedFolders: Object.keys(CONFIG.allowedFolders || {})
  });
}

/**
 * POST /open-app - Abre um aplicativo local autorizado na allowlist
 */
async function handleOpenApp(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { appName } = body;

    if (!appName || typeof appName !== 'string') {
      return sendJSON(res, 400, {
        error: 'Nome do aplicativo (appName) é obrigatório.',
        availableApps: Object.keys(CONFIG.apps || {})
      });
    }

    const appEntry = CONFIG.apps[appName];
    if (!appEntry) {
      logAudit('WARN', 'APP_OPEN_REJECTED', `Aplicativo '${appName}' não está na allowlist`, { appName });
      return sendJSON(res, 400, {
        error: `Aplicativo '${appName}' não existe na allowlist do config.json.`,
        availableApps: Object.keys(CONFIG.apps || {})
      });
    }

    const platformKey = process.platform === 'win32' ? 'win32' : 'linux';
    const command = appEntry[platformKey];

    if (!command) {
      logAudit('WARN', 'APP_OPEN_NO_COMMAND', `Nenhum comando configurado para plataforma '${platformKey}' no app '${appName}'`);
      return sendJSON(res, 400, {
        error: `Nenhum comando configurado para a plataforma '${platformKey}' no aplicativo '${appName}'.`
      });
    }

    // Executa o comando em processo filho isolado
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logAudit('ERROR', 'APP_OPEN_FAILED', `Falha ao abrir app '${appName}': ${error.message}`, { command });
      } else {
        logAudit('INFO', 'APP_OPEN_SUCCESS', `Aplicativo '${appName}' aberto com sucesso`, { command });
      }
    });

    return sendJSON(res, 200, {
      message: `Comando enviado para abrir '${appName}'.`,
      appName,
      platform: platformKey
    });

  } catch (err) {
    return sendJSON(res, 400, { error: err.message });
  }
}

/**
 * POST /organize/plan - Etapa 1: Analisa a pasta e gera o plano de organização sem mover nada
 */
async function handleOrganizePlan(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { folderKey } = body;

    const { baseDir } = resolveSafePath(folderKey, '');

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const plan = [];

    for (const entry of entries) {
      // Ignorar diretórios na varredura inicial de organização
      if (entry.isDirectory()) continue;

      const fileName = entry.name;
      const category = getCategoryForFile(fileName);
      const fromPath = path.join(baseDir, fileName);
      const toFolder = path.join(baseDir, category);
      const toPath = path.join(toFolder, fileName);

      plan.push({
        file: fileName,
        extension: path.extname(fileName).toLowerCase(),
        category,
        from: fromPath,
        toFolder,
        to: toPath
      });
    }

    logAudit('INFO', 'ORGANIZE_PLAN_GENERATED', `Plano de organização gerado para folderKey=${folderKey}`, {
      folderKey,
      totalFilesFound: plan.length
    });

    return sendJSON(res, 200, {
      folderKey,
      baseDir,
      totalFiles: plan.length,
      plan
    });

  } catch (err) {
    logAudit('ERROR', 'ORGANIZE_PLAN_FAILED', err.message);
    return sendJSON(res, 400, { error: err.message });
  }
}

/**
 * POST /organize/execute - Etapa 2: Executa o plano de organização após confirmação explícita
 */
async function handleOrganizeExecute(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { folderKey, plan, confirmed } = body;

    // Regra rígida de segurança: confirmação explícita necessária
    if (confirmed !== true) {
      return sendJSON(res, 400, {
        error: 'Confirmação necessária para executar a organização de arquivos. Envie confirmed: true.'
      });
    }

    if (!Array.isArray(plan) || plan.length === 0) {
      return sendJSON(res, 400, { error: 'O plano fornecido está vazio ou é inválido.' });
    }

    const results = [];

    for (const item of plan) {
      try {
        if (!item || !item.file) {
          results.push({ file: 'desconhecido', status: 'error', error: 'Item de plano inválido' });
          continue;
        }

        const fileName = String(item.file);
        
        // REVALIDAÇÃO ESTRITA: Recalcular e verificar jail para CADA arquivo
        const { targetPath: safeSource } = resolveSafePath(folderKey, fileName);
        
        if (!fs.existsSync(safeSource)) {
          results.push({ file: fileName, status: 'skipped', error: 'Arquivo fonte não encontrado (pode ter sido movido)' });
          continue;
        }

        const category = getCategoryForFile(fileName);
        const { targetPath: safeToFolder } = resolveSafePath(folderKey, category);

        // Criar subpasta de categoria se não existir
        if (!fs.existsSync(safeToFolder)) {
          fs.mkdirSync(safeToFolder, { recursive: true });
        }

        // Determinar nome do arquivo no destino evitando sobrescrever
        let destFileName = fileName;
        let safeDest = path.join(safeToFolder, destFileName);
        let counter = 1;

        const nameWithoutExt = path.basename(fileName, path.extname(fileName));
        const ext = path.extname(fileName);

        while (fs.existsSync(safeDest)) {
          destFileName = `${nameWithoutExt} (${counter})${ext}`;
          safeDest = path.join(safeToFolder, destFileName);
          counter++;
        }

        // Mover o arquivo
        try {
          fs.renameSync(safeSource, safeDest);
        } catch (renameErr) {
          // Tratar movimentação entre partições diferentes (EXDEV)
          if (renameErr.code === 'EXDEV') {
            fs.copyFileSync(safeSource, safeDest);
            fs.unlinkSync(safeSource);
          } else {
            throw renameErr;
          }
        }

        results.push({
          file: fileName,
          status: 'moved',
          category,
          from: safeSource,
          to: safeDest
        });

      } catch (fileErr) {
        results.push({
          file: item.file || 'desconhecido',
          status: 'error',
          error: fileErr.message
        });
      }
    }

    const movedCount = results.filter(r => r.status === 'moved').length;
    logAudit('INFO', 'ORGANIZE_EXECUTED', `Organização concluída em folderKey=${folderKey}: ${movedCount} movidos de ${results.length}`, {
      folderKey,
      movedCount,
      totalCount: results.length
    });

    return sendJSON(res, 200, {
      message: `Organização concluída. ${movedCount} arquivo(s) movidos com sucesso.`,
      folderKey,
      results
    });

  } catch (err) {
    logAudit('ERROR', 'ORGANIZE_EXECUTE_FAILED', err.message);
    return sendJSON(res, 400, { error: err.message });
  }
}

/**
 * POST /file/trash - Move um arquivo para a lixeira do agente (NUNCA deleta permanentemente)
 */
async function handleFileTrash(req, res) {
  try {
    const body = await parseJSONBody(req);
    const { folderKey, fileName, confirmed } = body;

    if (confirmed !== true) {
      return sendJSON(res, 400, {
        error: 'Confirmação necessária para mover para a lixeira. Envie confirmed: true.'
      });
    }

    if (!fileName || typeof fileName !== 'string') {
      return sendJSON(res, 400, { error: 'O nome do arquivo (fileName) é obrigatório.' });
    }

    // Revalidação do Jail de diretório
    const { targetPath: safeSource } = resolveSafePath(folderKey, fileName);

    if (!fs.existsSync(safeSource)) {
      return sendJSON(res, 404, { error: `Arquivo '${fileName}' não foi encontrado em '${folderKey}'.` });
    }

    // Garante que o diretório trash exista
    if (!fs.existsSync(TRASH_DIR_PATH)) {
      fs.mkdirSync(TRASH_DIR_PATH, { recursive: true });
    }

    // Nome prefixado com timestamp ISO/epoch para evitar colisão
    const timestampPrefix = `${Date.now()}_`;
    const trashFileName = `${timestampPrefix}${path.basename(fileName)}`;
    const trashDest = path.join(TRASH_DIR_PATH, trashFileName);

    // Mover para a lixeira do agente (SEM NUNCA USAR fs.unlink)
    try {
      fs.renameSync(safeSource, trashDest);
    } catch (renameErr) {
      if (renameErr.code === 'EXDEV') {
        fs.copyFileSync(safeSource, trashDest);
        fs.unlinkSync(safeSource); // Apaga somente do local original após cópia bem sucedida para a lixeira
      } else {
        throw renameErr;
      }
    }

    logAudit('INFO', 'FILE_TRASHED', `Arquivo '${fileName}' de '${folderKey}' movido para a lixeira do agente`, {
      folderKey,
      originalName: fileName,
      trashPath: trashDest
    });

    return sendJSON(res, 200, {
      message: `Arquivo '${fileName}' movido para a lixeira do agente.`,
      status: 'trashed',
      folderKey,
      originalFile: fileName,
      trashPath: trashDest
    });

  } catch (err) {
    logAudit('ERROR', 'FILE_TRASH_FAILED', err.message);
    return sendJSON(res, 400, { error: err.message });
  }
}

/**
 * GET /audit/logs - Retorna as últimas linhas do log de auditoria
 */
function handleAuditLogs(req, res) {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      return sendJSON(res, 200, { logs: [] });
    }

    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const lastLines = lines.slice(-100); // Retorna até as últimas 100 linhas

    sendJSON(res, 200, { logs: lastLines });
  } catch (err) {
    sendJSON(res, 500, { error: 'Falha ao ler audit.log' });
  }
}

// ============================================================================
// SEÇÃO 7: SERVIDOR HTTP E MIDDLEWARES (AUTHENTICATION & CORS)
// ============================================================================

initializeConfig();

const server = http.createServer((req, res) => {
  const reqOrigin = req.headers['origin'] || '*';

  // --------------------------------------------------------------------------
  // REGRA DE SEGURANÇA 3: VALIDAR E TRATAR CORS RESTRITO
  // --------------------------------------------------------------------------
  const allowed = CONFIG.allowedOrigin;
  let isAllowedOrigin = false;

  if (allowed === '*' || !req.headers['origin']) {
    isAllowedOrigin = true;
  } else if (typeof allowed === 'string' && allowed === reqOrigin) {
    isAllowedOrigin = true;
  } else if (Array.isArray(allowed) && allowed.includes(reqOrigin)) {
    isAllowedOrigin = true;
  }

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin === '*' && allowed !== '*' ? allowed : reqOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  } else {
    logAudit('SECURITY', 'CORS_BLOCKED', `Bloqueio de CORS para origem '${reqOrigin}'`, { reqOrigin, allowedOrigin: allowed });
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: `Bloqueio de CORS: A origem '${reqOrigin}' não tem permissão.` }));
  }

  // Preflight OPTIONS responde 204 após passar na validação de CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // --------------------------------------------------------------------------
  // REGRA DE SEGURANÇA 2: AUTENTICAÇÃO POR TOKEN BEARER
  // --------------------------------------------------------------------------
  const authHeader = req.headers['authorization'] || '';
  const expectedToken = CONFIG.token;
  const tokenMatch = authHeader === `Bearer ${expectedToken}`;

  if (!tokenMatch) {
    logAudit('SECURITY', 'AUTH_FAILED', `Tentativa de acesso não autorizada em ${req.url}`, {
      ip: req.socket.remoteAddress,
      receivedAuthHeader: authHeader ? 'Presente mas Inválido' : 'Ausente'
    });
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Não autorizado. Token de autenticação Bearer inválido ou ausente.' }));
  }

  // --------------------------------------------------------------------------
  // ROTEAR REQUISIÇÕES
  // --------------------------------------------------------------------------
  const urlPath = req.url.split('?')[0];

  if (req.method === 'GET' && urlPath === '/status') {
    return handleStatus(req, res);
  }

  if (req.method === 'POST' && urlPath === '/open-app') {
    return handleOpenApp(req, res);
  }

  if (req.method === 'POST' && urlPath === '/organize/plan') {
    return handleOrganizePlan(req, res);
  }

  if (req.method === 'POST' && urlPath === '/organize/execute') {
    return handleOrganizeExecute(req, res);
  }

  if (req.method === 'POST' && urlPath === '/file/trash') {
    return handleFileTrash(req, res);
  }

  if (req.method === 'GET' && urlPath === '/audit/logs') {
    return handleAuditLogs(req, res);
  }

  // Rota não encontrada
  sendJSON(res, 404, { error: `Rota '${urlPath}' não encontrada.` });
});

// ----------------------------------------------------------------------------
// REGRA DE SEGURANÇA 1: BIND RIGOROSO SOMENTE EM LOCALHOST (127.0.0.1)
// ----------------------------------------------------------------------------
const BIND_HOST = '127.0.0.1';
const PORT = CONFIG.port || 9123;

server.listen(PORT, BIND_HOST, () => {
  console.log('\n================================================================');
  console.log('                 OSONE LOCAL AGENT (INICIALIZADO)               ');
  console.log('================================================================');
  console.log(` Status:          ONLINE`);
  console.log(` Bind de Rede:    http://${BIND_HOST}:${PORT} (Restrito ao Host Local)`);
  console.log(` Plataforma:      ${process.platform}`);
  console.log(` Token de Acesso: ${CONFIG.token}`);
  console.log('----------------------------------------------------------------');
  console.log(' ATENÇÃO DE SEGURANÇA:');
  console.log(' 1. Copie o TOKEN acima para utilizar no painel web da OSONE.');
  console.log(' 2. NUNCA compartilhe este token com terceiros.');
  console.log(' 3. O agente roda estritamente em 127.0.0.1 e nunca expõe portas públicas.');
  console.log('================================================================\n');

  logAudit('INFO', 'AGENT_STARTED', `Agente iniciado em http://${BIND_HOST}:${PORT} [Plataforma: ${process.platform}]`);
});

// Tratamento global de exceções para garantir que o processo nunca caia
process.on('uncaughtException', (err) => {
  logAudit('ERROR', 'UNCAUGHT_EXCEPTION', err.message, { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logAudit('ERROR', 'UNHANDLED_REJECTION', String(reason));
});
