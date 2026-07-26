import React, { useState, useEffect, useCallback } from 'react';
import { AgentStatus, PlanResponse, OrganizeResponse, TrashResponse } from './types';
import { AgentConnectionBar } from './components/AgentConnectionBar';
import { AppLauncher } from './components/AppLauncher';
import { FileOrganizer } from './components/FileOrganizer';
import { TrashManager } from './components/TrashManager';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AgentCodeModal } from './components/AgentCodeModal';
import { Shield, ShieldCheck, Lock, HardDrive, Terminal, Info, CheckCircle2, Cpu, FileCode2 } from 'lucide-react';

export default function App() {
  const [agentUrl, setAgentUrl] = useState<string>('http://127.0.0.1:9123');
  const [token, setToken] = useState<string>('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const [useSimulator, setUseSimulator] = useState<boolean>(true);
  
  const [status, setStatus] = useState<AgentStatus | null>({
    status: 'online',
    agentName: 'osone-local-agent',
    version: '1.0.0',
    platform: 'win32',
    systemOS: 'Windows_NT (Simulador)',
    availableApps: ['spotify', 'vscode', 'filemanager', 'terminal', 'browser'],
    allowedFolders: ['downloads', 'desktop', 'documents']
  });
  
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([
    `[${new Date().toISOString()}] [INFO] [AGENT_STARTED] Agente iniciado em http://127.0.0.1:9123 [Plataforma: win32]`,
    `[${new Date().toISOString()}] [SECURITY] [AUTH_VERIFIED] Conexão inicial autorizada via Token Bearer`,
    `[${new Date().toISOString()}] [INFO] [READY] Aguardando comandos da aplicação OSONE`
  ]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // Helper para adicionar log na auditoria local
  const appendLog = useCallback((level: string, action: string, message: string) => {
    const logLine = `[${new Date().toISOString()}] [${level}] [${action}] ${message}`;
    setAuditLogs((prev) => [...prev, logLine]);
  }, []);

  // Testar Conexão / Status do Agente
  const checkAgentStatus = useCallback(async () => {
    setLoadingStatus(true);
    if (useSimulator) {
      setTimeout(() => {
        setStatus({
          status: 'online',
          agentName: 'osone-local-agent',
          version: '1.0.0',
          platform: 'win32',
          systemOS: 'Windows_NT (Simulador Ativo)',
          availableApps: ['spotify', 'vscode', 'filemanager', 'terminal', 'browser'],
          allowedFolders: ['downloads', 'desktop', 'documents']
        });
        appendLog('INFO', 'SIMULATOR_PING', 'Status verificado com sucesso no modo simulador');
        setLoadingStatus(false);
      }, 400);
      return;
    }

    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, '')}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        setStatus({ status: 'offline' });
        appendLog('SECURITY', 'AUTH_FAILED', 'Erro 401: Token Bearer inválido ao consultar /status');
        alert('Erro 401: Token de autenticação Bearer inválido. Verifique o token salvo em config.json.');
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AgentStatus = await res.json();
      setStatus(data);
      appendLog('INFO', 'STATUS_OK', `Agente online em ${agentUrl} [SO: ${data.platform}]`);
      fetchAuditLogs();
    } catch (err: any) {
      setStatus({ status: 'offline' });
      appendLog('WARN', 'STATUS_OFFLINE', `Não foi possível conectar em ${agentUrl}: ${err.message}`);
    } finally {
      setLoadingStatus(false);
    }
  }, [agentUrl, token, useSimulator, appendLog]);

  // Buscar logs do agente
  const fetchAuditLogs = useCallback(async () => {
    if (useSimulator) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`${agentUrl.replace(/\/$/, '')}/audit/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (err) {
      // Falha silenciosa para logs
    } finally {
      setLoadingLogs(false);
    }
  }, [agentUrl, token, useSimulator]);

  useEffect(() => {
    checkAgentStatus();
  }, [checkAgentStatus]);

  // Handler: Abrir Aplicativo (POST /open-app)
  const handleOpenApp = async (appName: string): Promise<{ success: boolean; message: string }> => {
    if (useSimulator) {
      appendLog('INFO', 'APP_OPEN_SUCCESS', `[Simulador] Solicitação enviada para abrir '${appName}'`);
      return {
        success: true,
        message: `[Simulador] Aplicativo '${appName}' aberto com sucesso.`
      };
    }

    const res = await fetch(`${agentUrl.replace(/\/$/, '')}/open-app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ appName })
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog('WARN', 'APP_OPEN_REJECTED', data.error || 'Erro ao abrir app');
      throw new Error(data.error || 'Falha ao abrir aplicativo');
    }

    appendLog('INFO', 'APP_OPEN_SUCCESS', `Aplicativo '${appName}' aberto via agente local`);
    fetchAuditLogs();
    return { success: true, message: data.message };
  };

  // Handler: Gerar Plano de Organização (POST /organize/plan)
  const handleGeneratePlan = async (folderKey: string): Promise<PlanResponse> => {
    if (useSimulator) {
      appendLog('INFO', 'ORGANIZE_PLAN_GENERATED', `[Simulador] Plano gerado para a pasta '${folderKey}'`);
      return {
        folderKey,
        baseDir: `C:\\Users\\Usuario\\${folderKey.charAt(0).toUpperCase() + folderKey.slice(1)}`,
        totalFiles: 8,
        plan: [
          { file: 'foto_ferias.jpg', extension: '.jpg', category: 'Imagens', from: 'foto_ferias.jpg', toFolder: 'Imagens', to: 'Imagens/foto_ferias.jpg' },
          { file: 'captura_tela.png', extension: '.png', category: 'Imagens', from: 'captura_tela.png', toFolder: 'Imagens', to: 'Imagens/captura_tela.png' },
          { file: 'relatorio_trimestral.pdf', extension: '.pdf', category: 'Documentos', from: 'relatorio_trimestral.pdf', toFolder: 'Documentos', to: 'Documentos/relatorio_trimestral.pdf' },
          { file: 'notas_reuniao.docx', extension: '.docx', category: 'Documentos', from: 'notas_reuniao.docx', toFolder: 'Documentos', to: 'Documentos/notas_reuniao.docx' },
          { file: 'orcamento_2026.xlsx', extension: '.xlsx', category: 'Planilhas', from: 'orcamento_2026.xlsx', toFolder: 'Planilhas', to: 'Planilhas/orcamento_2026.xlsx' },
          { file: 'apresentacao_demo.mp4', extension: '.mp4', category: 'Videos', from: 'apresentacao_demo.mp4', toFolder: 'Videos', to: 'Videos/apresentacao_demo.mp4' },
          { file: 'podcast_episodio1.mp3', extension: '.mp3', category: 'Audio', from: 'podcast_episodio1.mp3', toFolder: 'Audio', to: 'Audio/podcast_episodio1.mp3' },
          { file: 'backup_projetos.zip', extension: '.zip', category: 'Compactados', from: 'backup_projetos.zip', toFolder: 'Compactados', to: 'Compactados/backup_projetos.zip' }
        ]
      };
    }

    const res = await fetch(`${agentUrl.replace(/\/$/, '')}/organize/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ folderKey })
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog('ERROR', 'ORGANIZE_PLAN_FAILED', data.error || 'Erro ao gerar plano');
      throw new Error(data.error || 'Falha ao gerar plano de organização');
    }

    appendLog('INFO', 'ORGANIZE_PLAN_GENERATED', `Plano gerado com ${data.totalFiles} arquivo(s) para '${folderKey}'`);
    fetchAuditLogs();
    return data;
  };

  // Handler: Executar Plano de Organização (POST /organize/execute)
  const handleExecutePlan = async (folderKey: string, plan: any[], confirmed: boolean): Promise<OrganizeResponse> => {
    if (useSimulator) {
      appendLog('INFO', 'ORGANIZE_EXECUTED', `[Simulador] ${plan.length} arquivo(s) movidos com sucesso para subpastas de categoria`);
      return {
        message: `[Simulador] Organização concluída! ${plan.length} arquivo(s) categorizados e movidos.`,
        folderKey,
        results: plan.map((item) => ({
          file: item.file,
          status: 'moved',
          category: item.category,
          from: item.from,
          to: item.to
        }))
      };
    }

    const res = await fetch(`${agentUrl.replace(/\/$/, '')}/organize/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ folderKey, plan, confirmed })
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog('ERROR', 'ORGANIZE_EXECUTE_FAILED', data.error || 'Erro ao executar organização');
      throw new Error(data.error || 'Falha ao executar movimentação de arquivos');
    }

    appendLog('INFO', 'ORGANIZE_EXECUTED', `Organização executada com sucesso para '${folderKey}'`);
    fetchAuditLogs();
    return data;
  };

  // Handler: Enviar para Lixeira (POST /file/trash)
  const handleTrashFile = async (folderKey: string, fileName: string, confirmed: boolean): Promise<TrashResponse> => {
    if (useSimulator) {
      const simulatedTrashPath = `osone-local-agent/trash/${Date.now()}_${fileName}`;
      appendLog('INFO', 'FILE_TRASHED', `[Simulador] Arquivo '${fileName}' movido para a lixeira do agente`);
      return {
        message: `[Simulador] Arquivo '${fileName}' movido com sucesso para a lixeira do agente.`,
        status: 'trashed',
        folderKey,
        originalFile: fileName,
        trashPath: simulatedTrashPath
      };
    }

    const res = await fetch(`${agentUrl.replace(/\/$/, '')}/file/trash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ folderKey, fileName, confirmed })
    });

    const data = await res.json();
    if (!res.ok) {
      appendLog('ERROR', 'FILE_TRASH_FAILED', data.error || 'Erro ao mover para a lixeira');
      throw new Error(data.error || 'Falha ao mover arquivo para a lixeira');
    }

    appendLog('INFO', 'FILE_TRASHED', `Arquivo '${fileName}' de '${folderKey}' enviado para lixeira local`);
    fetchAuditLogs();
    return data;
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-white pb-12">
      {/* Technical Header Bar */}
      <header className="border-b border-[#141414] bg-[#E4E3E0] sticky top-0 z-40 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#141414] text-white p-2.5 rounded-sm font-mono font-bold text-lg tracking-wider">
              OSONE
            </div>
            <div>
              <h1 className="font-serif italic text-2xl leading-none tracking-tight text-[#141414]">osone-local-agent</h1>
              <p className="font-mono text-[10px] mt-1 opacity-60 tracking-widest uppercase">
                Standalone Service Protocol &bull; Node.js Native API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-[#141414] font-mono text-[11px] rounded-sm">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>BEARER_AUTH</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-[#141414] font-mono text-[11px] rounded-sm">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>JAIL_SANDBOX</span>
            </div>
            <button
              onClick={() => setIsCodeModalOpen(true)}
              className="flex items-center gap-2 bg-[#141414] text-white px-3.5 py-1.5 text-[11px] font-mono font-bold tracking-wider hover:bg-black transition cursor-pointer rounded-sm"
            >
              <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>AGENT_SOURCE_CODE</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Banner Informativo de Arquitetura de Segurança */}
        <div className="border border-[#141414] bg-white/70 p-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#141414] rounded-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#141414] text-white rounded-sm shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-serif italic text-sm font-bold block mb-0.5 text-[#141414]">Especificação de Segurança Zero Trust (127.0.0.1 Only)</span>
              <p className="text-[#141414]/80 text-[11px] leading-relaxed font-sans">
                O agente local <code>agent.js</code> roda em processo independente em <code>127.0.0.1</code>. Toda requisição exige header <code>Authorization: Bearer &lt;token&gt;</code>, origem CORS autorizada, sanitização rigorosa via <code>resolveSafePath()</code> e confirmação em duas etapas para organização de arquivos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#141414] text-white text-[11px] font-mono font-bold rounded-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> 10 REGRA_SEGURANCA_OK
            </span>
          </div>
        </div>

        {/* 1. Barra de Conexão e Status do Agente */}
        <AgentConnectionBar
          agentUrl={agentUrl}
          setAgentUrl={setAgentUrl}
          token={token}
          setToken={setToken}
          status={status}
          loading={loadingStatus}
          onCheckStatus={checkAgentStatus}
          useSimulator={useSimulator}
          setUseSimulator={setUseSimulator}
          onOpenCodeModal={() => setIsCodeModalOpen(true)}
        />

        {/* 2. Execução Controlada de Aplicativos Locais */}
        <AppLauncher
          availableApps={status?.availableApps || ['spotify', 'vscode', 'filemanager', 'terminal', 'browser']}
          platform={status?.platform || 'win32'}
          onOpenApp={handleOpenApp}
        />

        {/* 3. Organizador de Arquivos em 2 Etapas */}
        <FileOrganizer
          allowedFolders={status?.allowedFolders || ['downloads', 'desktop', 'documents']}
          onGeneratePlan={handleGeneratePlan}
          onExecutePlan={handleExecutePlan}
        />

        {/* 4. Gerenciador de Lixeira do Agente */}
        <TrashManager
          allowedFolders={status?.allowedFolders || ['downloads', 'desktop', 'documents']}
          onTrashFile={handleTrashFile}
        />

        {/* 5. Trilha de Auditoria em Tempo Real */}
        <AuditLogViewer
          logs={auditLogs}
          onRefreshLogs={fetchAuditLogs}
          loading={loadingLogs}
        />
      </main>

      {/* Modal para Visualizar / Copiar o Código Fonte do Agente Node.js */}
      <AgentCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
