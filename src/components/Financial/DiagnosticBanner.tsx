import React, { useState } from 'react';
import {
  Sparkles,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Scale,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { FinancialEngineService } from '../../services/financialEngineService';
import {
  HealthScanSummary,
  RepairExecutionResult,
} from '../../services/aiHealthCheckService';

interface DiagnosticBannerProps {
  className?: string;
  onOpenReportModal?: () => void;
}

export const DiagnosticBanner: React.FC<DiagnosticBannerProps> = ({
  className = '',
  onOpenReportModal,
}) => {
  const {
    journalEntries,
    runAiHealthScan,
    runAiHealthRepair,
    latestScanReport,
    accounts,
  } = useCharity();

  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [report, setReport] = useState<HealthScanSummary | null>(latestScanReport);
  const [repairSuccessResult, setRepairSuccessResult] = useState<RepairExecutionResult | null>(null);

  // Directly check global double entry balance via FinancialEngineService
  const balanceCheck = React.useMemo(() => {
    return FinancialEngineService.getInstance().validateBalance(journalEntries);
  }, [journalEntries]);

  // Keep report in sync with latest context scans
  React.useEffect(() => {
    if (latestScanReport) {
      setReport(latestScanReport);
    }
  }, [latestScanReport]);

  const handleRunAiDiagnostic = async () => {
    setIsScanning(true);
    try {
      const scanResult = runAiHealthScan();
      setReport(scanResult);
    } catch (err) {
      console.error('Failed to run AI Diagnostic:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAutoReconcile = async () => {
    setIsRepairing(true);
    try {
      const scanToFix = report || runAiHealthScan();
      const repairResult = await runAiHealthRepair(scanToFix);
      setRepairSuccessResult(repairResult);
      // Run immediate re-scan to confirm perfect balance
      const freshScan = runAiHealthScan();
      setReport(freshScan);
    } catch (err) {
      console.error('Failed to auto-reconcile:', err);
    } finally {
      setIsRepairing(false);
    }
  };

  const hasDiscrepancies =
    (report && report.totalIssues > 0) || !balanceCheck.isBalanced;

  return (
    <div
      id="financial-diagnostic-banner"
      className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-xs ${
        hasDiscrepancies
          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
          : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
      } ${className}`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              hasDiscrepancies
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {hasDiscrepancies ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold tracking-tight">
                {hasDiscrepancies
                  ? 'Attention: Discrepancies Found in Ledgers'
                  : 'Double-Entry Ledgers Fully Reconciled & Balanced'}
              </h4>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  hasDiscrepancies
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {hasDiscrepancies
                  ? `${report?.totalIssues ?? (balanceCheck.imbalancedEntries.length || 1)} Issues Detected`
                  : '100% Balanced (Dr == Cr)'}
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Σ Dr: {balanceCheck.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Σ Cr: {balanceCheck.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span>•</span>
              <span>{accounts.length} Accounts Monitored</span>
              <span>•</span>
              <span>{journalEntries.length} Journal Entries Posted</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            id="btn-run-ai-diagnostic"
            onClick={handleRunAiDiagnostic}
            disabled={isScanning || isRepairing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Scan all accounts and journals for out-of-balance entries"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-600 ${
                isScanning ? 'animate-spin' : ''
              }`}
            />
            <span>{isScanning ? 'Scanning...' : 'Run AI Diagnostic'}</span>
          </button>

          {hasDiscrepancies && (
            <button
              type="button"
              id="btn-one-click-ai-auto-reconcile"
              onClick={handleAutoReconcile}
              disabled={isRepairing || isScanning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Automatically regenerate missing legs and re-derive balances from raw journal"
            >
              <Wrench
                className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`}
              />
              <span>
                {isRepairing ? 'Reconciling...' : 'One-Click AI Bug Fix & Reconcile'}
              </span>
            </button>
          )}

          {onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-black/5 text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Details</span>
            </button>
          )}
        </div>
      </div>

      {repairSuccessResult && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-200" />
            <span>
              {repairSuccessResult.summaryMessage ||
                'Ledger reconciled successfully: all discrepancies resolved, all accounts balanced.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRepairSuccessResult(null)}
            className="text-[10px] uppercase font-bold tracking-wider text-emerald-200 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
