export interface AgentState {
  id: string;
  brandId: string;
  status: 'idle' | 'researching' | 'drafting' | 'reviewing' | 'publishing';
  currentTask?: string;
  lastActive: string;
}

export interface AgentLog {
  id: string;
  agentId: string;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
  metadata?: any;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}
