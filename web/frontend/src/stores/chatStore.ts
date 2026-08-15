import { create } from 'zustand';
import { sendChat, sendAnalyzerChat } from '../api/client';
import type { ChatBlock } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  blocks?: ChatBlock[];
  timestamp: number;
}

interface ChatState {
  // Side-panel chat
  messages: ChatMessage[];
  sessionId: string;
  loading: boolean;
  panelState: 'closed' | 'docked' | 'expanded';
  send: (message: string, source: string) => Promise<{ pipeline?: boolean; run_id?: string; agents?: string[] } | null>;
  setPanelState: (state: 'closed' | 'docked' | 'expanded') => void;
  clearMessages: () => void;

  // Master Analyzer chat
  analyzerMessages: ChatMessage[];
  analyzerSessionId: string;
  analyzerLoading: boolean;
  sendAnalyzer: (message: string, sources: string[]) => Promise<void>;
  clearAnalyzer: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getSessionId(): string {
  let id = localStorage.getItem('chat_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chat_session_id', id);
  }
  return id;
}

function getAnalyzerSessionId(): string {
  let id = localStorage.getItem('analyzer_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('analyzer_session_id', id);
  }
  return id;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // ── Side-panel chat state ──
  messages: [],
  sessionId: getSessionId(),
  loading: false,
  panelState: 'closed',

  send: async (message, source) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], loading: true }));

    try {
      const data = await sendChat(message, source, get().sessionId);

      if (data.session_id) {
        set({ sessionId: data.session_id });
        localStorage.setItem('chat_session_id', data.session_id);
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        blocks: data.blocks,
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], loading: false }));

      if (data.pipeline && data.run_id) {
        return { pipeline: true, run_id: data.run_id, agents: data.agents };
      }
      return null;
    } catch (e) {
      const errMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        blocks: [{ type: 'error', content: (e as Error).message }],
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, errMsg], loading: false }));
      return null;
    }
  },

  setPanelState: (state) => set({ panelState: state }),

  clearMessages: () => {
    const newSessionId = crypto.randomUUID();
    localStorage.setItem('chat_session_id', newSessionId);
    set({ messages: [], sessionId: newSessionId });
  },

  // ── Master Analyzer chat state ──
  analyzerMessages: [],
  analyzerSessionId: getAnalyzerSessionId(),
  analyzerLoading: false,

  sendAnalyzer: async (message, sources) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    set((s) => ({ analyzerMessages: [...s.analyzerMessages, userMsg], analyzerLoading: true }));

    try {
      const data = await sendAnalyzerChat(message, sources, get().analyzerSessionId);

      if (data.session_id) {
        set({ analyzerSessionId: data.session_id });
        localStorage.setItem('analyzer_session_id', data.session_id);
      }

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        blocks: data.blocks,
        timestamp: Date.now(),
      };
      set((s) => ({ analyzerMessages: [...s.analyzerMessages, assistantMsg], analyzerLoading: false }));
    } catch (e) {
      const errMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        blocks: [{ type: 'error', content: (e as Error).message }],
        timestamp: Date.now(),
      };
      set((s) => ({ analyzerMessages: [...s.analyzerMessages, errMsg], analyzerLoading: false }));
    }
  },

  clearAnalyzer: () => {
    const newSessionId = crypto.randomUUID();
    localStorage.setItem('analyzer_session_id', newSessionId);
    set({ analyzerMessages: [], analyzerSessionId: newSessionId });
  },
}));
