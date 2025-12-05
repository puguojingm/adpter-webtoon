

export enum AgentType {
  MAIN = 'Master Agent',
  BREAKDOWN_WORKER = 'Breakdown Worker',
  BREAKDOWN_ALIGNER = 'Breakdown Aligner',
  SCRIPT_WORKER = 'Script Worker',
  WEBTOON_ALIGNER = 'Webtoon Aligner'
}

export enum NovelType {
  FANTASY = '玄幻',
  WUXIA = '武侠',
  URBAN = '都市',
  ROMANCE = '言情',
  ANCIENT_ROMANCE = '古言',
  SUSPENSE = '悬疑',
  MYSTERY = '推理',
  SCI_FI = '科幻',
  DOOMSDAY = '末世',
  REBIRTH = '重生'
}

export interface NovelChapter {
  id: string;
  name: string;
  content: string;
  order: number;
  isProcessed: boolean; // Indicates if this chapter has been broken down
}

export interface PlotPoint {
  id: string; // e.g. "剧情1"
  content: string; // Full text line
  scene: string;
  action: string;
  hookType: string;
  episode: number;
  status: 'unused' | 'used';
  batchIndex: number; // Which batch this belongs to
}

export interface PlotBatch {
  index: number;
  chapterRange: string; // "1-6"
  content: string; // Raw markdown content
  points: PlotPoint[];
  status: 'pending' | 'approved' | 'rejected';
  report?: string;
}

export interface ScriptFile {
  episode: number;
  title: string;
  content: string;
  status: 'draft' | 'approved' | 'rejected';
  alignerReport?: string;
}

export interface UserInfo {
  username: string;
  avatar: string;
  phone: string;
  email: string;
  balance: number;
  registerDate: string;
  lastLogin: string;
}

export interface LogEntry {
  timestamp: number;
  role: 'system' | 'user' | 'model';
  agentName: string;
  content: string;
  sysPrompt?: string;
}

export interface ExecutionLog {
  id: string;
  type: 'breakdown' | 'script';
  referenceId: string; // batchIndex (string) or episode number (string)
  status: 'PASS' | 'FAIL';
  timestamp: number;
  entries: LogEntry[];
  result?: string;
  report?: string;
}

export interface ProjectState {
  id: string;
  title: string; // Effectively the Novel Name
  type: NovelType | string;
  description: string;
  batchSize?: number; // Configurable batch size
  maxRetries?: number; // Configurable max retries
  
  // Data
  chapters: NovelChapter[];
  plotBatches: PlotBatch[];
  scripts: ScriptFile[];
  logs: ExecutionLog[]; // Execution History
  
  // User
  userInfo: UserInfo;

  // View State
  currentView: 'settings' | 'source' | 'breakdown' | 'scripts';
  
  // Processing State
  isProcessing: boolean;
  processingAction?: 'breakdown' | 'script' | null; // Granular control
  processingStatus: string; // Message to show
  activeAgent?: AgentType;
  
  // Metadata for list view (calculated)
  stats?: {
    totalChapters: number;
    processedChapters: number;
    plotBatches: number;
    scriptEpisodes: number;
    lastModified: string;
  }
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  agent?: AgentType;
  timestamp: string | number;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}