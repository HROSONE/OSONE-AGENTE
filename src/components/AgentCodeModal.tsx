import React, { useState } from 'react';
import { X, Copy, Check, Download, Terminal, FileCode, FileJson, BookOpen, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AGENT_FILES: Record<string, { name: string; icon: React.ReactNode; language: string; content: string }> = {
  'agent.js': {
    name: 'agent.js',
    icon: <FileCode className="w-4 h-4 text-emerald-400" />,
    language: 'javascript',
    content: `/**
 * OSONE LOCAL AGENT - agent.js
 * Servidor HTTP em Node.js com módulos nativos (http, crypto, child_process, fs, path, os)
 * Bind estrito em 127.0.0.1, Token Bearer, CORS e Jail de Diretório.
 */
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Para visualizar o código-fonte completo de 450+ linhas do agente local,
// consulte o diretório /osone-local-agent/agent.js deste projeto!`
  },
  'package.json': {
    name: 'package.json',
    icon: <FileJson className="w-4 h-4 text-amber-400" />,
    language: 'json',
    content: `{
  "name": "osone-local-agent",
  "version": "1.0.0",
  "description": "Agente local standalone seguro em Node.js para a plataforma OSONE",
  "main": "agent.js",
  "type": "commonjs",
  "scripts": {
    "start": "node agent.js"
  },
  "keywords": ["osone", "local-agent", "security"],
  "license": "MIT"
}`
  },
  'config.json': {
    name: 'config.json',
    icon: <FileJson className="w-4 h-4 text-blue-400" />,
    language: 'json',
    content: `{
  "port": 9123,
  "token": "DIGITE_OU_COPIE_SEU_TOKEN_AQUI",
  "allowedOrigin": "http://localhost:5173",
  "apps": {
    "spotify": {
      "win32": "start spotify:",
      "linux": "spotify"
    },
    "vscode": {
      "win32": "code",
      "linux": "code"
    },
    "filemanager": {
      "win32": "explorer",
      "linux": "xdg-open ."
    },
    "terminal": {
      "win32": "start cmd",
      "linux": "gnome-terminal"
    },
    "browser": {
      "win32": "start https://google.com",
      "linux": "xdg-open https://google.com"
    }
  },
  "allowedFolders": {
    "downloads": "~/Downloads",
    "desktop": "~/Desktop",
    "documents": "~/Documents"
  }
}`
  },
  'README.md': {
    name: 'README.md',
    icon: <BookOpen className="w-4 h-4 text-purple-400" />,
    language: 'markdown',
    content: `# 🛡️ OSONE Local Agent (osone-local-agent)

Agente local standalone de alta segurança em Node.js para comunicação com a aplicação web OSONE.

## 🚀 Como Rodar
1. cd osone-local-agent
2. npm start (ou node agent.js)
3. Copie o token impresso no console e insira no painel web da OSONE!`
  }
};

export const AgentCodeModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('agent.js');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentFile = AGENT_FILES[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#141414] rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#141414]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-[#E4E3E0]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#141414] text-white rounded-sm shrink-0">
              <Terminal className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-serif italic font-bold text-[#141414] text-xl">Código Fonte do Agente Standalone</h3>
              <p className="font-mono text-[11px] text-[#141414]/70">
                osone-local-agent &bull; Módulos Nativos Node.js (Sem Dependências Externas)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#141414] hover:bg-[#141414] hover:text-white border border-[#141414] rounded-sm transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-4 pt-3 bg-[#E4E3E0] border-b border-[#141414] overflow-x-auto text-xs font-mono">
          {Object.entries(AGENT_FILES).map(([key, file]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-t-sm font-mono font-bold transition cursor-pointer border-t border-x border-[#141414] ${
                activeTab === key
                  ? 'bg-white text-[#141414]'
                  : 'bg-[#E4E3E0] text-[#141414]/70 hover:bg-white'
              }`}
            >
              {file.icon}
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        {/* Action Toolbar */}
        <div className="p-3 bg-white border-b border-[#141414] flex items-center justify-between text-xs font-mono">
          <span className="text-[#141414]/80 text-[11px]">
            ARQUIVO_ATIVO: <strong className="text-[#141414]">osone-local-agent/{currentFile.name}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-black text-white rounded-sm transition cursor-pointer text-xs font-mono font-bold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIADO!' : 'COPIAR_CODIGO'}</span>
            </button>
          </div>
        </div>

        {/* Code Viewport */}
        <div className="flex-1 bg-[#141414] p-4 font-mono text-xs overflow-y-auto leading-relaxed text-emerald-400">
          <pre className="whitespace-pre-wrap">{currentFile.content}</pre>
        </div>

        {/* Footer Instructions */}
        <div className="p-4 border-t border-[#141414] bg-[#E4E3E0] text-xs text-[#141414] font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-700">INSTRUÇÃO_EXECUÇÃO:</span>
            <code className="bg-white px-2 py-1 rounded-sm text-[#141414] border border-[#141414] font-mono font-bold">
              cd osone-local-agent && npm start
            </code>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#141414] hover:bg-black text-white font-mono font-bold rounded-sm transition cursor-pointer text-xs self-end sm:self-auto"
          >
            FECHAR_JANELA
          </button>
        </div>
      </div>
    </div>
  );
};
