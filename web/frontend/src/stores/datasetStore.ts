import { create } from 'zustand';
import { fetchDatasets, deleteDataset as apiDelete } from '../api/client';
import type { DatasetInfo } from '../api/client';

interface DatasetState {
  datasets: DatasetInfo[];
  activeDataset: string | null;
  activeSource: string | null;
  loading: boolean;
  load: () => Promise<void>;
  select: (name: string, source: string) => void;
  remove: (name: string) => Promise<void>;
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  datasets: [],
  activeDataset: null,
  activeSource: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const datasets = await fetchDatasets();
      set({ datasets, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  select: (name, source) => {
    set({ activeDataset: name, activeSource: source });
  },

  remove: async (name) => {
    await apiDelete(name);
    const { activeDataset } = get();
    if (activeDataset === name) {
      set({ activeDataset: null, activeSource: null });
    }
    await get().load();
  },
}));
