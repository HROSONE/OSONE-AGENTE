import React, { useState } from 'react';
import { AgentStatus } from '../types';
import { ShieldCheck, Server, Key, RefreshCw, AlertTriangle, CheckCircle, Terminal, HelpCircle } from 'lucide-react';

interface Props {
  agentUrl: string;
  setAgentUrl: (url: string) => void;
  token: string;
  setToken: (token: string) => void;
  status: AgentStatus | null;
  loading: boolean;
  onCheckStatus: () => void;
  useSimulator: boolean;
  setUseSimulator: (val: boolean) => void;
  onOpenCodeModal: () => void;
}

export const AgentConnectionBar: React.FC<Props> = ({
  agentUrl,
  setAgentUrl,
  token,
  setToken,
  status,
  loading,
  onCheckStatus,
  useSimulator,
  setUseSimulator,
  onOpenCodeModal
}) => {
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="bg-white border border-[#141414] rounded-sm p-5 mb-6 text-[#141414]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#141414] pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#141414] text-white rounded-sm shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif italic text-xl font-bold tracking-tight text-[#141414]">Parâmetros de Conexão do Agente</h2>
              <span className="text-[10px] px-2 py-0.5 font-mono font-bold bg-[#141414] text-white rounded-sm">
                127.0.0.1
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#141414]/70 mt-0.5">
              Localhost Binding &bull; Token Bearer Protection &bull; Sandbox Jail Enforcement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onOpenCodeModal}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#141414] hover:text-white text-[#141414] font-mono text-[11px] font-bold border border-[#141414] transition-colors cursor-pointer rounded-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-600" />
            <span>INSTALADOR_E_CODIGO</span>
          </button>

          <label className="flex items-center gap-2 bg-[#E4E3E0] hover:bg-[#d8d7d4] border border-[#141414] px-3 py-1.5 rounded-sm font-mono text-[11px] font-bold cursor-pointer transition select-none">
            <input
              type="checkbox"
              checked={useSimulator}
              onChange={(e) => setUseSimulator(e.target.checked)}
              className="accent-[#141414]"
            />
            <span className="text-[#141414]">MODO_SIMULADOR</span>
          </label>
        </div>
      </div>

      {/* Inputs de Conexão */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-5">
          <label className="block font-mono text-[11px] font-bold text-[#141414] uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> ENDERECO_LOCAL (127.0.0.1)
          </label>
          <input
            type="text"
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            disabled={useSimulator}
            placeholder="http://127.0.0.1:9123"
            className="w-full bg-[#E4E3E0] border border-[#141414] rounded-sm px-3 py-2 text-xs text-[#141414] focus:outline-none focus:bg-white font-mono disabled:opacity-50"
          />
        </div>

        <div className="md:col-span-5">
          <label className="block font-mono text-[11px] font-bold text-[#141414] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> TOKEN_BEARER (64 HEX)
            </span>
            <button
              onClick={() => setShowToken(!showToken)}
              className="text-[10px] text-[#141414] underline font-mono"
            >
              {showToken ? '[ OCULTAR ]' : '[ EXIBIR ]'}
            </button>
          </label>
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={useSimulator}
            placeholder="Cole o token do config.json..."
            className="w-full bg-[#E4E3E0] border border-[#141414] rounded-sm px-3 py-2 text-xs text-[#141414] focus:outline-none focus:bg-white font-mono disabled:opacity-50"
          />
        </div>

        <div className="md:col-span-2 pt-4 md:pt-5">
          <button
            onClick={onCheckStatus}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] hover:bg-black text-white font-mono font-bold px-4 py-2 rounded-sm text-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{loading ? 'VERIFICANDO...' : 'TESTAR_STATUS'}</span>
          </button>
        </div>
      </div>

      {/* Banner de Status */}
      <div className="mt-4 pt-3 border-t border-[#141414]/20 flex flex-wrap items-center justify-between text-xs gap-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[#141414]/70 font-bold">ESTADO_CONEXAO:</span>
          {useSimulator ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-amber-100 text-amber-950 border border-amber-400 font-bold text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              SIMULADOR ATIVO (Modo de Teste Frontend)
            </span>
          ) : status?.status === 'online' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-emerald-100 text-emerald-950 border border-emerald-500 font-bold text-[11px]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
              ONLINE &bull; Agente Conectado em {status.platform || 'OS'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-rose-100 text-rose-950 border border-rose-400 font-bold text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
              OFFLINE &bull; Não foi possível conectar ao agente em 127.0.0.1
            </span>
          )}
        </div>

        {status?.status === 'online' && !useSimulator && (
          <div className="flex items-center gap-3 text-[#141414]/80 text-[11px]">
            <span>SO: <strong className="text-[#141414]">{status.systemOS || status.platform}</strong></span>
            <span>APPS: <strong className="text-[#141414]">{status.availableApps?.length || 0}</strong></span>
            <span>PASTAS: <strong className="text-[#141414]">{status.allowedFolders?.length || 0}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
