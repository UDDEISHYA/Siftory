import { create } from 'zustand';
import {
  fetchProviders, fetchConnections, createConnection as apiCreate,
  testConnection as apiTest, deleteConnection as apiDelete,
  fetchConnectionDetail,
  type ProviderInfo, type ConnectionInfo, type ConnectionDetail,
} from '../api/client';

interface ConnectionState {
  providers: ProviderInfo[];
  connections: ConnectionInfo[];
  connectionDetails: Record<string, ConnectionDetail>;
  loading: boolean;
  loadProviders: () => Promise<void>;
  loadConnections: () => Promise<void>;
  loadConnectionDetail: (id: string) => Promise<void>;
  createConnection: (id: string, provider: string, displayName: string, creds: Record<string, string>) => Promise<void>;
  testConnection: (id: string) => Promise<{ ok: boolean; message: string; tables?: string[] }>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  providers: [],
  connections: [],
  connectionDetails: {},
  loading: false,

  loadProviders: async () => {
    try {
      const providers = await fetchProviders();
      set({ providers });
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  },

  loadConnectionDetail: async (id: string) => {
    try {
      const detail = await fetchConnectionDetail(id);
      set((state) => ({
        connectionDetails: { ...state.connectionDetails, [id]: detail },
      }));
    } catch (e) {
      console.error('Failed to load connection detail:', e);
    }
  },

  loadConnections: async () => {
    set({ loading: true });
    try {
      const connections = await fetchConnections();
      set({ connections, loading: false });
    } catch (e) {
      console.error('Failed to load connections:', e);
      set({ loading: false });
    }
  },

  createConnection: async (id, provider, displayName, creds) => {
    await apiCreate(id, provider, displayName, creds);
    await get().loadConnections();
  },

  testConnection: async (id) => {
    return await apiTest(id);
  },

  deleteConnection: async (id) => {
    await apiDelete(id);
    await get().loadConnections();
  },
}));
