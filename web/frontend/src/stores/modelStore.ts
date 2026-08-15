import { create } from 'zustand';

interface ModelState {
  activeProvider: 'anthropic' | 'openai';
  anthropicConfigured: boolean;
  openaiConfigured: boolean;
  loading: boolean;
  loadStatus: () => Promise<void>;
  setActiveProvider: (provider: 'anthropic' | 'openai') => Promise<void>;
  saveApiKey: (provider: 'anthropic' | 'openai', key: string) => Promise<void>;
}

export const useModelStore = create<ModelState>((set) => ({
  activeProvider: 'anthropic',
  anthropicConfigured: false,
  openaiConfigured: false,
  loading: false,

  loadStatus: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/models/status');
      if (!res.ok) throw new Error('Failed to load model status');
      const data = await res.json();
      set({
        activeProvider: data.active_provider || 'anthropic',
        anthropicConfigured: data.anthropic_configured,
        openaiConfigured: data.openai_configured,
        loading: false,
      });
    } catch (e) {
      console.error('Failed to load model status:', e);
      set({ loading: false });
    }
  },

  setActiveProvider: async (provider: 'anthropic' | 'openai') => {
    try {
      const res = await fetch('/api/models/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Failed to set active provider');
      set({ activeProvider: provider });
    } catch (e) {
      console.error('Failed to set active provider:', e);
    }
  },

  saveApiKey: async (provider: 'anthropic' | 'openai', key: string) => {
    const res = await fetch('/api/models/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save API key');
    }
    // Refresh status after saving
    const statusRes = await fetch('/api/models/status');
    if (statusRes.ok) {
      const data = await statusRes.json();
      set({
        activeProvider: data.active_provider || provider,
        anthropicConfigured: data.anthropic_configured,
        openaiConfigured: data.openai_configured,
      });
    }
  },
}));
