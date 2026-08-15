import { create } from 'zustand';

export interface PinnedChart {
  id: string;
  title: string;
  imageUrl: string;
  sql?: string;
  pinnedAt: number;
}

interface DashboardState {
  pinnedCharts: PinnedChart[];
  pinChart: (chart: Omit<PinnedChart, 'id' | 'pinnedAt'>) => void;
  unpinChart: (id: string) => void;
}

function loadPinned(): PinnedChart[] {
  try {
    const raw = localStorage.getItem('dashboard_pinned_charts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinned(charts: PinnedChart[]) {
  localStorage.setItem('dashboard_pinned_charts', JSON.stringify(charts));
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  pinnedCharts: loadPinned(),

  pinChart: (chart) => {
    const newChart: PinnedChart = {
      ...chart,
      id: Math.random().toString(36).slice(2, 10),
      pinnedAt: Date.now(),
    };
    const updated = [...get().pinnedCharts, newChart];
    savePinned(updated);
    set({ pinnedCharts: updated });
  },

  unpinChart: (id) => {
    const updated = get().pinnedCharts.filter((c) => c.id !== id);
    savePinned(updated);
    set({ pinnedCharts: updated });
  },
}));
