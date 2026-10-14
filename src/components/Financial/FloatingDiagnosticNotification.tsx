import React, { useState } from 'react';
import { AlertTriangle, Wrench, FileSpreadsheet, X, Check, ShieldCheck } from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { FinancialEngineService } from '../../services/financialEngineService';

interface FloatingDiagnosticNotificationProps {
  onOpenDrawer: () => void;
}

export const FloatingDiagnosticNotification: React.FC<FloatingDiagnosticNotificationProps> = ({
  onOpenDrawer,
}) => {
  const {
    journalEntries,
    latestScanReport,
    runAiHealthScan,
    runAiHealthRepair,
  } = useCharity();

  const [isDismissed, setIsDismissed] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [justFixed, setJustFixed] = useState(false);

  // Check live balance
  const balanceCheck = React.useMemo(() => {
    return FinancialEngineService.getInstance().validateBalance(journalEntries);
  }, [journalEntries]);

  const issueCount =
    (latestScanReport?.totalIssues ?? 0) +
    (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);

  // If issueCount changes or becomes > 0, reset dismissed state so user is notified
  React.useEffect(() => {
    if (issueCount > 0) {
      setIsDismissed(false);
      setJustFixed(false);
    }
  }, [issueCount]);

  if (isDismissed) return null;
  if (issueCount === 0 && !justFixed) return null;

  const handleQuickFix = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRepairing(true);
    try {
      const scanToFix = latestScanReport || runAiHealthScan();
      await runAiHealthRepair(scanToFix);
      // Run immediate re-scan
      runAiHealthScan();
      setJustFixed(true);
      setTimeout(() => {
        setIsDismissed(true);
        setJustFixed(false);
      }, 3000);
    } catch (err) {
      console.error('Quick fix error:', err);
    } finally {
      setIsRepairing(false);
    }
  };

  if (justFixed) {
    return (
      <div
        id="floating-diagnostic-toast-success"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200"
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-900/90 text-white shadow-xl border border-emerald-500/30 backdrop-blur-md text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>All Discrepancies Resolved — Ledgers 100% Balanced</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id="floating-diagnostic-toast"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/95 text-white shadow-2xl border border-amber-500/40 backdrop-blur-md text-xs">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span>
            {issueCount} Ledger {issueCount === 1 ? 'Discrepancy' : 'Discrepancies'} Detected
          </span>
        </div>

        <span className="text-slate-600">•</span>

        {/* Action 1: One-Click AI Fix */}
        <button
          type="button"
          id="toast-btn-one-click-fix"
          onClick={handleQuickFix}
          disabled={isRepairing}
          className="flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer disabled:opacity-50"
        >
          <Wrench className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
          <span>{isRepairing ? 'Fixing...' : 'One-Click AI Fix'}</span>
        </button>

        <span className="text-slate-600">|</span>

        {/* Action 2: View Breakdown */}
        <button
          type="button"
          id="toast-btn-view-breakdown"
          onClick={onOpenDrawer}
          className="text-slate-300 hover:text-white font-medium hover:underline cursor-pointer"
        >
          View Breakdown
        </button>

        {/* Close / Dismiss */}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
