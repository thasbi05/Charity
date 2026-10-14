import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onToggleSearch: () => void;
  onNewReceipt: () => void;
  onNewPayment: () => void;
  onToggleHelp: () => void;
  onNavigate: (tab: string) => void;
  onCloseModals: () => void;
  onToggleSidebar?: () => void;
  onToggleNoor?: () => void;
}

export const useKeyboardShortcuts = ({
  onToggleSearch,
  onNewReceipt,
  onNewPayment,
  onToggleHelp,
  onNavigate,
  onCloseModals,
  onToggleSidebar,
  onToggleNoor,
}: UseKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isModifier = isMac ? e.metaKey : e.ctrlKey;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 0. Noor Copilot Toggle: Alt + N
      if (e.altKey && !isModifier && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onToggleNoor?.();
        return;
      }

      // 1. Global Search: Ctrl+K or Cmd+K
      if (isModifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onToggleSearch();
        return;
      }

      // 2. New Receipt: Ctrl+N or Cmd+N (intercept browser new window)
      if (isModifier && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onNewReceipt();
        return;
      }

      // 3. New Payment: Ctrl+Shift+N or Alt+P
      if (
        (isModifier && e.shiftKey && (e.key === 'n' || e.key === 'N')) ||
        (e.altKey && (e.key === 'p' || e.key === 'P')) ||
        (e.altKey && (e.key === 'n' || e.key === 'N'))
      ) {
        e.preventDefault();
        onNewPayment();
        return;
      }

      // 4. Toggle Sidebar Collapse: Ctrl+[ or Cmd+[ or Ctrl+B
      if (isModifier && (e.key === '[' || e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 5. Keyboard Shortcuts Help Guide: '?' (Shift + /)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // 6. Escape: Close modals
      if (e.key === 'Escape') {
        onCloseModals();
        return;
      }

      // 7. Direct Navigation: Alt + 1-9 (or Ctrl+Alt+1-9)
      if (e.altKey && !isModifier) {
        const tabMap: Record<string, string> = {
          '1': 'dashboard',
          '2': 'members',
          '3': 'monthly-status',
          '4': 'receipts',
          '5': 'payments',
          '6': 'chart-of-accounts',
          '7': 'cash-bank',
          '8': 'transactions',
          '9': 'reports',
        };

        if (tabMap[e.key]) {
          e.preventDefault();
          onNavigate(tabMap[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSearch, onNewReceipt, onNewPayment, onToggleHelp, onNavigate, onCloseModals, onToggleSidebar, onToggleNoor]);
};
