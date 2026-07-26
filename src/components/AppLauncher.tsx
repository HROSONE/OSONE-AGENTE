import React, { useState } from 'react';
import { Play, Music, Code, Folder, Terminal, Globe, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  availableApps: string[];
  platform: 'win32' | 'linux';
  onOpenApp: (appName: string) => Promise<{ success: boolean; message: string }>;
}

const APP_ICONS: Record<string, React.ReactNode> = {
  spotify: <Music className="w-5 h-5 text-emerald-400" />,
  vscode: <Code className="w-5 h-5 text-blue-400" />,
  filemanager: <Folder className="w-5 h-5 text-amber-400" />,
  terminal: <Terminal className="w-5 h-5 text-purple-400" />,
  browser: <Globe className="w-5 h-5 text-sky-400" />
};

const APP_DESCRIPTIONS: Record<string, string> = {
  spotify: 'Abre o reprodutor de música Spotify',
  vscode: 'Abre o editor de código Visual Studio Code',
  filemanager: 'Abre o gerenciador de arquivos padrão do SO',
  terminal: 'Abre a janela de terminal ou prompt de comando',
  browser: 'Abre o navegador de internet padrão'
};

export const AppLauncher: React.FC<Props> = ({ availableApps, platform, onOpenApp }) => {
  const [executingApp, setExecutingApp] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ app: string; success: boolean; msg: string } | null>(null);

  const appsToDisplay = availableApps && availableApps.length > 0 
    ? availableApps 
    : ['spotify', 'vscode', 'filemanager', 'terminal', 'browser'];

  const handleLaunch = async (appName: string) => {
    setExecutingApp(appName);
    setFeedback(null);
    try {
      const res = await onOpenApp(appName);
      setFeedback({ app: appName, success: res.success, msg: res.message });
    } catch (err: any) {
      setFeedback({ app: appName, success: false, msg: err.message || 'Erro ao comunicar com o agente' });
    } finally {
      setExecutingApp(null);
    }
  };

  return (
    <div className="bg-white border border-[#141414] rounded-sm p-5 mb-6 text-[#141414]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#141414] pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif italic text-xl font-bold text-[#141414] flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-600" />
              Execução Controlada de Aplicativos Locais
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5 rounded-sm">
              POST /open-app
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#141414]/70 mt-1">
            Permite abrir apenas programas declarados na allowlist em config.json. Injeção de código é rejeitada.
          </p>
        </div>

        <div className="text-xs bg-[#E4E3E0] border border-[#141414] rounded-sm px-3 py-1.5 font-mono text-[#141414] flex items-center gap-2">
          <span>PLATAFORMA_SO:</span>
          <strong className="text-[#141414] uppercase">{platform}</strong>
        </div>
      </div>

      {/* Regra de segurança em evidência */}
      <div className="mb-5 bg-[#E4E3E0] border border-[#141414] rounded-sm p-3 text-xs text-[#141414] flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="font-mono text-[11px]">
          <strong>ALLOWLIST_ENFORCEMENT:</strong> A rota valida o identificador do app em relação ao objeto <code>apps</code> do <code>config.json</code> para a plataforma ativa ({platform}).
        </div>
      </div>

      {/* Grid de Aplicativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {appsToDisplay.map((appName) => (
          <div
            key={appName}
            className="bg-[#E4E3E0] border border-[#141414] rounded-sm p-4 flex flex-col justify-between transition group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-white border border-[#141414] rounded-sm">
                  {APP_ICONS[appName] || <Code className="w-5 h-5 text-[#141414]" />}
                </div>
                <span className="text-[10px] font-mono text-[#141414] font-bold uppercase bg-white border border-[#141414] px-2 py-0.5 rounded-sm">
                  {appName}
                </span>
              </div>
              <h4 className="font-serif italic font-bold text-[#141414] text-base capitalize">{appName}</h4>
              <p className="font-mono text-[11px] text-[#141414]/70 mt-1 line-clamp-2">
                {APP_DESCRIPTIONS[appName] || `Comando configurado em config.json para ${platform}`}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-[#141414]/20">
              <button
                onClick={() => handleLaunch(appName)}
                disabled={executingApp === appName}
                className="w-full flex items-center justify-center gap-2 bg-[#141414] hover:bg-black text-white text-xs font-mono font-bold py-2 px-3 rounded-sm transition cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>{executingApp === appName ? 'SOLICITANDO...' : `ABRIR_${appName.toUpperCase()}`}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback da Execução */}
      {feedback && (
        <div
          className={`mt-4 p-3.5 rounded-sm text-xs border font-mono flex items-start gap-2.5 ${
            feedback.success
              ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
              : 'bg-rose-100 border-rose-500 text-rose-950'
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          )}
          <div>
            <strong className="capitalize">EXECUCAO_{feedback.app.toUpperCase()}: </strong>
            {feedback.msg}
          </div>
        </div>
      )}
    </div>
  );
};
