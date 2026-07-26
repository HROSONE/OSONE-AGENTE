export interface AgentStatus {
  status: 'online' | 'offline';
  agentName?: string;
  version?: string;
  platform?: 'win32' | 'linux';
  systemOS?: string;
  availableApps?: string[];
  allowedFolders?: string[];
}

export interface FilePlanItem {
  file: string;
  extension: string;
  category: 'Imagens' | 'Documentos' | 'Planilhas' | 'Videos' | 'Audio' | 'Compactados' | 'Instaladores' | 'Outros' | string;
  from: string;
  toFolder: string;
  to: string;
}

export interface PlanResponse {
  folderKey: string;
  baseDir: string;
  totalFiles: number;
  plan: FilePlanItem[];
}

export interface OrganizeResultItem {
  file: string;
  status: 'moved' | 'skipped' | 'error';
  category?: string;
  from?: string;
  to?: string;
  error?: string;
}

export interface OrganizeResponse {
  message: string;
  folderKey: string;
  results: OrganizeResultItem[];
}

export interface TrashResponse {
  message: string;
  status: 'trashed';
  folderKey: string;
  originalFile: string;
  trashPath: string;
}

export interface AgentConfig {
  agentUrl: string;
  token: string;
  useSimulator: boolean;
}
