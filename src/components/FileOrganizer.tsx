import React, { useState } from 'react';
import { PlanResponse, OrganizeResponse } from '../types';
import { FolderTree, FileText, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, FolderCheck, Image, FileSpreadsheet, Film, Music, Archive, Wrench, FileQuestion } from 'lucide-react';

interface Props {
  allowedFolders: string[];
  onGeneratePlan: (folderKey: string) => Promise<PlanResponse>;
  onExecutePlan: (folderKey: string, plan: any[], confirmed: boolean) => Promise<OrganizeResponse>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Imagens: <Image className="w-4 h-4 text-emerald-400" />,
  Documentos: <FileText className="w-4 h-4 text-blue-400" />,
  Planilhas: <FileSpreadsheet className="w-4 h-4 text-teal-400" />,
  Videos: <Film className="w-4 h-4 text-purple-400" />,
  Audio: <Music className="w-4 h-4 text-amber-400" />,
  Compactados: <Archive className="w-4 h-4 text-indigo-400" />,
  Instaladores: <Wrench className="w-4 h-4 text-rose-400" />,
  Outros: <FileQuestion className="w-4 h-4 text-slate-400" />
};

export const FileOrganizer: React.FC<Props> = ({ allowedFolders, onGeneratePlan, onExecutePlan }) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('downloads');
  const [planData, setPlanData] = useState<PlanResponse | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [executingPlan, setExecutingPlan] = useState<boolean>(false);
  const [confirmedCheck, setConfirmedCheck] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<OrganizeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const folderList = allowedFolders && allowedFolders.length > 0 
    ? allowedFolders 
    : ['downloads', 'desktop', 'documents'];

  const handleCreatePlan = async () => {
    setLoadingPlan(true);
    setErrorMsg(null);
    setExecutionResult(null);
    setConfirmedCheck(false);
    try {
      const plan = await onGeneratePlan(selectedFolder);
      setPlanData(plan);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gerar o plano de organização.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleRunExecution = async () => {
    if (!planData || !planData.plan) return;
    if (!confirmedCheck) {
      setErrorMsg('Você precisa marcar a caixa de confirmação explícita antes de executar.');
      return;
    }

    setExecutingPlan(true);
    setErrorMsg(null);
    try {
      const result = await onExecutePlan(selectedFolder, planData.plan, true);
      setExecutionResult(result);
      // Limpa o plano ativo para evitar re-execução acidental
      setPlanData(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar a organização de arquivos.');
    } finally {
      setExecutingPlan(false);
    }
  };

  // Agrupar arquivos do plano por categoria para exibição limpa
  const groupedPlan: Record<string, typeof planData.plan> = {};
  if (planData?.plan) {
    planData.plan.forEach((item) => {
      const cat = item.category || 'Outros';
      if (!groupedPlan[cat]) groupedPlan[cat] = [];
      groupedPlan[cat].push(item);
    });
  }

  return (
    <div className="bg-white border border-[#141414] rounded-sm p-5 mb-6 text-[#141414]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#141414] pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif italic text-xl font-bold text-[#141414] flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              Organizador de Arquivos em 2 Etapas OBRIGATÓRIAS
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5 rounded-sm">
              Etapa 1: PLANO &rarr; Etapa 2: EXECUÇÃO
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#141414]/70 mt-1">
            Gera primeiramente um relatório sem alterar nenhum arquivo. A movimentação requer confirmação explícita.
          </p>
        </div>
      </div>

      {/* Seleção de Pasta Autorizada */}
      <div className="bg-[#E4E3E0] border border-[#141414] rounded-sm p-4 mb-5 flex flex-col md:flex-row items-md-center justify-between gap-4 font-mono text-xs">
        <div className="flex-1">
          <label className="block text-[11px] font-bold text-[#141414] uppercase tracking-wider mb-2">
            SELECIONAR_DIRETORIO_AUTORIZADO (allowedFolders):
          </label>
          <div className="flex gap-2 flex-wrap">
            {folderList.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedFolder(key);
                  setPlanData(null);
                  setExecutionResult(null);
                }}
                className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold border capitalize transition cursor-pointer ${
                  selectedFolder === key
                    ? 'bg-[#141414] border-[#141414] text-white'
                    : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
                }`}
              >
                DIR_ {key}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleCreatePlan}
            disabled={loadingPlan}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#141414] hover:bg-black text-white font-mono font-bold px-4 py-2 rounded-sm text-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPlan ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{loadingPlan ? 'GERANDO_PLANO...' : 'ETAPA_1: GERAR_PLANO'}</span>
          </button>
        </div>
      </div>

      {/* Mensagens de Erro */}
      {errorMsg && (
        <div className="mb-5 p-3.5 bg-rose-100 border border-rose-500 rounded-sm text-xs text-rose-950 font-mono flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* EXIBIÇÃO DO PLANO GERADO (ETAPA 1) */}
      {planData && (
        <div className="bg-[#E4E3E0] border border-[#141414] rounded-sm p-5 mb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#141414]/20 pb-3 gap-2">
            <div>
              <h4 className="font-serif italic font-bold text-[#141414] text-base flex items-center gap-2">
                <FolderCheck className="w-4 h-4 text-emerald-700" />
                Relatório de Organização Gerado (Prévia de Mapeamento)
              </h4>
              <p className="font-mono text-[11px] text-[#141414]/70 mt-0.5">
                Caminho do Sistema: <code className="font-bold text-[#141414]">{planData.baseDir}</code>
              </p>
            </div>
            <div className="text-xs bg-white border border-[#141414] px-3 py-1 rounded-sm font-mono font-bold text-[#141414]">
              TOTAL_ARQUIVOS: {planData.totalFiles}
            </div>
          </div>

          {planData.totalFiles === 0 ? (
            <div className="text-center py-6 text-[#141414]/60 font-mono text-xs">
              Nenhum arquivo não categorizado foi localizado nesta pasta. Tudo já está organizado!
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 text-xs font-mono">
              {Object.entries(groupedPlan).map(([category, files]) => (
                <div key={category} className="bg-white border border-[#141414] rounded-sm p-3">
                  <div className="flex items-center gap-2 font-bold text-[#141414] mb-2 pb-1.5 border-b border-[#141414]/10">
                    {CATEGORY_ICONS[category] || <FileText className="w-4 h-4 text-[#141414]" />}
                    <span>CATEGORIA: {category.toUpperCase()} ({files.length} ARQUIVOS)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {files.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#E4E3E0] p-2 rounded-sm border border-[#141414]/20 text-[11px]">
                        <span className="font-mono font-bold text-[#141414] truncate max-w-[180px]" title={item.file}>
                          {item.file}
                        </span>
                        <div className="flex items-center gap-1.5 text-[#141414]/80 font-mono text-[10px]">
                          <ArrowRight className="w-3 h-3 text-blue-600" />
                          <span className="text-emerald-700 font-bold">{category}/</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EXIGÊNCIA DE CONFIRMAÇÃO EXPLÍCITA PARA ETAPA 2 */}
          {planData.totalFiles > 0 && (
            <div className="pt-4 border-t border-[#141414]/20 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3.5 rounded-sm border border-[#141414]">
              <label className="flex items-center gap-2.5 text-xs text-[#141414] font-mono cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                  className="accent-[#141414]"
                />
                <span className="font-bold">
                  CONFIRMAÇÃO_EXPLÍCITA: Revisei o plano e autorizo mover os {planData.totalFiles} arquivo(s).
                </span>
              </label>

              <button
                onClick={handleRunExecution}
                disabled={!confirmedCheck || executingPlan}
                className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold px-4 py-2 rounded-sm text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{executingPlan ? 'MOVENDO_ARQUIVOS...' : 'ETAPA_2: CONFIRMAR_E_MOVER'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* RESULTADO DA EXECUÇÃO (ETAPA 2 CONCLUÍDA) */}
      {executionResult && (
        <div className="bg-emerald-100 border border-emerald-500 rounded-sm p-5 space-y-3 font-mono">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <span>{executionResult.message}</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs font-mono">
            {executionResult.results?.map((res, i) => (
              <div
                key={i}
                className={`p-2 rounded-sm border flex items-center justify-between ${
                  res.status === 'moved'
                    ? 'bg-white border-emerald-500 text-emerald-950'
                    : 'bg-rose-100 border-rose-500 text-rose-950'
                }`}
              >
                <span className="font-bold">{res.file}</span>
                <span className="text-[11px]">
                  {res.status === 'moved' ? `MOVIDO -> ${res.category}` : `ERRO: ${res.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
