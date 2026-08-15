import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import DatasetsPage from './pages/DatasetsPage';
import ReportsPage from './pages/ReportsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import MasterAnalyzerPage from './pages/MasterAnalyzerPage';
import ModelsPage from './pages/ModelsPage';
import { useDatasetStore } from './stores/datasetStore';
import { useConnectionStore } from './stores/connectionStore';
import { useKeyboardShortcuts } from './hooks/useKeyboard';

export default function App() {
  const loadDatasets = useDatasetStore((s) => s.load);
  const loadConnections = useConnectionStore((s) => s.loadConnections);
  const loadProviders = useConnectionStore((s) => s.loadProviders);
  useKeyboardShortcuts();

  useEffect(() => {
    loadDatasets();
    loadConnections();
    loadProviders();
  }, [loadDatasets, loadConnections, loadProviders]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/master-analyzer" element={<MasterAnalyzerPage />} />
          <Route path="/models" element={<ModelsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
