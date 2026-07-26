import React, { useState } from 'react';
import { TrashResponse } from '../types';
import { Trash2, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  allowedFolders: string[];
  onTrashFile: (folderKey: string, fileName: string, confirmed: boolean) => Promise<TrashResponse>;
}

export const TrashManager: React.FC<Props> = ({ allowedFolders, onTrashFile }) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('downloads');
  const [fileNameInput, setFileNameInput] = useState<string>('');
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TrashResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const folderList = allowedFolders && allowedFolders.length > 0 
    ? allowedFolders 
    : ['downloads', 'desktop', 'documents'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileNameInput.trim()) {
      setErrorMsg('Informe o nome do arquivo que deseja enviar para a lixeira.');
      return;
    }
    if (!confirmed) {
      setErrorMsg('Marque a caixa de confirmação para enviar o arquivo para a lixeira.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await onTrashFile(selectedFolder, fileNameInput.trim(), true);
      setResult(res);
      setFileNameInput('');
      setConfirmed(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao mover o arquivo para a lixeira.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#141414] rounded-sm p-5 mb-6 text-[#141414]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#141414] pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif italic text-xl font-bold text-[#141414] flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-700" />
              Envio Seguro para Lixeira Local do Agente
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5 rounded-sm">
              DELECAO_PERMANENTE_BLOQUEADA (fs.unlink = FALSE)
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#141414]/70 mt-1">
            Rota <code>POST /file/trash</code>: Em vez de apagar arquivos do disco, move para a subpasta <code>trash/</code> com prefixo de timestamp.
          </p>
        </div>
      </div>

      <div className="mb-4 bg-[#E4E3E0] border border-[#141414] rounded-sm p-3 text-xs text-[#141414] font-mono flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px]">
          <strong>GARANTIA_DE_INTEGRIDADE:</strong> O agente rejeita chamadas destrutivas diretas. A lixeira local permite recuperar qualquer item movido por engano.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#E4E3E0] border border-[#141414] rounded-sm p-4 space-y-4 font-mono text-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-[#141414] uppercase mb-1">
              PASTA_AUTORIZADA:
            </label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full bg-white border border-[#141414] rounded-sm px-3 py-2 text-xs text-[#141414] focus:outline-none font-mono capitalize"
            >
              {folderList.map((folder) => (
                <option key={folder} value={folder}>
                  DIR_ {folder}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-8">
            <label className="block text-[11px] font-bold text-[#141414] uppercase mb-1">
              NOME_DO_ARQUIVO (Ex: rascunho.pdf):
            </label>
            <input
              type="text"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              placeholder="Digite o nome exato do arquivo..."
              className="w-full bg-white border border-[#141414] rounded-sm px-3 py-2 text-xs text-[#141414] focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2.5 text-xs text-[#141414] font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="accent-[#141414]"
            />
            <span>AUTORIZACAO: Confirmo a movimentação para a lixeira do agente.</span>
          </label>

          <button
            type="submit"
            disabled={loading || !confirmed || !fileNameInput.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#141414] hover:bg-black text-white font-mono font-bold px-4 py-2 rounded-sm text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{loading ? 'ENVIANDO...' : 'MOVER_PARA_LIXEIRA'}</span>
          </button>
        </div>
      </form>

      {/* Erros */}
      {errorMsg && (
        <div className="mt-4 p-3 bg-rose-100 border border-rose-500 rounded-sm text-xs text-rose-950 font-mono flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Sucesso */}
      {result && (
        <div className="mt-4 p-4 bg-emerald-100 border border-emerald-500 rounded-sm text-xs text-emerald-950 font-mono space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{result.message}</span>
          </div>
          <p>
            Arquivo Original: <code className="font-bold">{result.originalFile}</code>
          </p>
          <p className="text-[11px] text-emerald-800">
            Caminho na Lixeira: <code className="font-bold">{result.trashPath}</code>
          </p>
        </div>
      )}
    </div>
  );
};
