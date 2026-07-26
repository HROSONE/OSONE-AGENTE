import React, { useState } from 'react';
import { ScrollText, RefreshCw, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react';

interface Props {
  logs: string[];
  onRefreshLogs: () => void;
  loading: boolean;
}

export const AuditLogViewer: React.FC<Props> = ({ logs, onRefreshLogs, loading }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'SECURITY') return log.includes('[SECURITY]') || log.includes('CORS') || log.includes('AUTH');
    if (filter === 'WARN_ERROR') return log.includes('[WARN]') || log.includes('[ERROR]');
    if (filter === 'APPS') return log.includes('APP_OPEN');
    if (filter === 'FILES') return log.includes('ORGANIZE') || log.includes('TRASH');
    return true;
  });

  return (
    <div className="bg-white border border-[#141414] rounded-sm p-5 mb-6 text-[#141414]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414] pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif italic text-xl font-bold text-[#141414] flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#141414]" />
              Log de Auditoria em Tempo Real (audit.log)
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5 rounded-sm">
              ISO_8601 &bull; PERSISTENT_LOG
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#141414]/70 mt-1">
            Registro imutável de eventos: bloqueios CORS, validação Bearer e comandos executados no sistema operacional.
          </p>
        </div>

        <button
          onClick={onRefreshLogs}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#141414] hover:bg-black text-white text-xs font-mono font-bold px-3 py-1.5 rounded-sm transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>ATUALIZAR_LOGS</span>
        </button>
      </div>

      {/* Filtros de Log */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 font-mono text-xs">
        <span className="text-[#141414] font-bold mr-1">FILTRAR:</span>
        {[
          { key: 'ALL', label: 'TODOS' },
          { key: 'SECURITY', label: 'SEGURANCA' },
          { key: 'WARN_ERROR', label: 'ALERTAS_ERROS' },
          { key: 'APPS', label: 'APLICATIVOS' },
          { key: 'FILES', label: 'ARQUIVOS' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-2.5 py-1 rounded-sm transition text-[11px] font-mono font-bold whitespace-nowrap cursor-pointer border ${
              filter === item.key
                ? 'bg-[#141414] text-white border-[#141414]'
                : 'bg-white text-[#141414] border-[#141414] hover:bg-[#141414] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal de Logs */}
      <div className="bg-[#141414] text-slate-100 border border-[#141414] rounded-sm p-4 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-6 flex flex-col items-center gap-1">
            <Terminal className="w-5 h-5 text-slate-600" />
            <span>Nenhum log gravado no audit.log para este filtro.</span>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            let colorClass = 'text-slate-300';
            if (log.includes('[SECURITY]') || log.includes('BLOCKED') || log.includes('AUTH_FAILED')) {
              colorClass = 'text-rose-400 font-bold bg-rose-950/60 px-1 rounded-xs';
            } else if (log.includes('[ERROR]')) {
              colorClass = 'text-rose-300 font-bold';
            } else if (log.includes('[WARN]')) {
              colorClass = 'text-amber-300 font-bold';
            } else if (log.includes('[INFO]')) {
              colorClass = 'text-emerald-400';
            }

            return (
              <div key={index} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
