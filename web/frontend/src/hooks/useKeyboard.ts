import { useEffect } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useKeyboardShortcuts() {
  const setPanelState = useChatStore((s) => s.setPanelState);
  const panelState = useChatStore((s) => s.panelState);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (panelState === 'closed') {
          setPanelState('docked');
        }
      }

      if (e.key === 'Escape' && panelState === 'expanded') {
        setPanelState('docked');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelState, setPanelState]);
}
