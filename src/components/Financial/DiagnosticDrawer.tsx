import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Scale,
  Layers,
  Coins,
  Ghost,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  Activity,
  ArrowRight,
  Database,
  Check,
  Clock,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { FinancialEngineService } from '../../services/financialEngineService';
import {
  HealthScanSummary,
  RepairExecutionResult,
  DiagnosticIssue,
  DiagnosticCategory,
} from '../../services/aiHealthCheckService';
import { formatCurrency } from '../../utils/numbering';
import { useAuth } from '../../context/AuthContext';
import { NoorAICopilot } from './NoorAICopilot';

interface DiagnosticDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticDrawer: React.FC<DiagnosticDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    journalEntries,
    accounts,
    systemSyncState,
    latestScanReport,
    runAiHealthScan,
    runAiHealthRepair,
    settings,
  } = useCharity();
  const { canRunAiReconcile, isAdmin } = useAuth();

  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [report, setReport] = useState<HealthScanSummary | null>(latestScanReport);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<DiagnosticCategory | 'ALL'>('ALL');
  const [repairSuccess, setRepairSuccess] = useState<RepairExecutionResult | null>(null);

  // Live balance check using the Singleton Financial Engine
  const balanceCheck = useMemo(() => {
    return FinancialEngineService.getInstance().validateBalance(journalEntries);
  }, [journalEntries]);

  // Sync report
  React.useEffect(() => {
    if (latestScanReport) {
      setReport(latestScanReport);
    } else if (isOpen && !report) {
      try {
        const initial = runAiHealthScan();
        setReport(initial);
      } catch (e) {
        console.warn('Initial scan error:', e);
      }
    }
  }, [latestScanReport, isOpen]);

  const handleScanWithAi = () => {
    setIsScanning(true);
    setRepairSuccess(null);
    setTimeout(() => {
      try {
        const scanResult = runAiHealthScan();
        setReport(scanResult);
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    }, 400);
  };

  const handleOneClickReconcile = async () => {
    setIsRepairing(true);
    try {
      const scanToFix = report || runAiHealthScan();
      const repairResult = await runAiHealthRepair(scanToFix);
      setRepairSuccess(repairResult);
      // Run immediate re-scan to verify all 0 discrepancies
      const freshReport = runAiHealthScan();
      setReport(freshReport);
    } catch (err) {
      console.error('Reconciliation error:', err);
      alert('Reconciliation failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRepairing(false);
    }
  };

  if (!isOpen) return null;

  const totalIssues = (report?.totalIssues ?? 0) + (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);
  const isHealthy = totalIssues === 0 && balanceCheck.isBalanced;

  const filteredIssues = (report?.issues || []).filter((issue) => {
    if (activeCategoryFilter === 'ALL') return true;
    return issue.category === activeCategoryFilter;
  });

  const categoryIcons: Record<string, React.ReactNode> = {
    MULTI_CURRENCY: <Coins className="w-4 h-4 text-amber-500" />,
    ORPHAN_GHOST_RECORDS: <Ghost className="w-4 h-4 text-purple-500" />,
    DOUBLE_ENTRY_IMBALANCE: <Scale className="w-4 h-4 text-rose-500" />,
    BROKEN_CUSTODIAN_FLOATS: <Layers className="w-4 h-4 text-emerald-500" />,
    OVERDUE_STATUS: <Users className="w-4 h-4 text-blue-500" />,
    GL_ACCOUNT_DRIFT: <Activity className="w-4 h-4 text-indigo-500" />,
    ALLOCATION_MISMATCH: <Database className="w-4 h-4 text-pink-500" />,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        id="diagnostic-drawer-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          id="diagnostic-drawer-panel"
          className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isHealthy
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                    : 'bg-red-500/20 text-red-400 border border-red-400/30'
                }`}
              >
                {isHealthy ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold tracking-tight">System Diagnostics & AI Reconcile</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isHealthy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {isHealthy ? 'Healthy' : `${totalIssues} Discrepancies`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous Double-Entry Integrity Validator & Self-Healing Engine
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Bar */}
          <div className="px-6 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Last Reconciled:{' '}
                <strong className="text-slate-800">
                  {systemSyncState?.lastReconciledAt
                    ? new Date(systemSyncState.lastReconciledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Today'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="drawer-scan-ai-btn"
                onClick={handleScanWithAi}
                disabled={isScanning || isRepairing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan with AI'}</span>
              </button>

              <button
                type="button"
                id="drawer-auto-reconcile-btn"
                onClick={handleOneClickReconcile}
                disabled={isRepairing || isScanning || !canRunAiReconcile}
                title={canRunAiReconcile ? 'Atomically repair discrepancies and balance ledger' : 'Administrator access required to perform automated ledger repairs'}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-xs transition-colors ${
                  !canRunAiReconcile
                    ? 'bg-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-emerald-700 hover:bg-emerald-800 cursor-pointer disabled:opacity-50'
                }`}
              >
                <Wrench className={`w-3.5 h-3.5 ${isRepairing ? 'animate-spin' : ''}`} />
                <span>
                  {isRepairing
                    ? 'Reconciling...'
                    : !canRunAiReconcile
                    ? 'AI Reconcile (Admin Only)'
                    : 'One-Click AI Bug Fix & Reconcile'}
                </span>
              </button>

              {/* Prominent Action Button: [💬 Ask Anfa Fathima] */}
              <button
                type="button"
                id="drawer-ask-noor-copilot-btn"
                onClick={() => setIsCopilotOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Open Anfa Fathima — Your Islamic Charity Accounting Assistant"
              >
                <img
                  src="/src/assets/images/anfa_fathima_avatar_1791803516715.jpg"
                  alt="Anfa Fathima"
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover border border-emerald-300 shrink-0"
                />
                <span>Ask Anfa Fathima</span>
              </button>
            </div>
          </div>

          {/* Repair Toast Success Banner */}
          {repairSuccess && (
            <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs flex items-center justify-between shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>
                  {repairSuccess.summaryMessage ||
                    'Ledger reconciled successfully: 0 discrepancies remaining, all accounts balanced.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRepairSuccess(null)}
                className="text-[10px] uppercase font-bold text-emerald-200 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {/* 1. Summary Balance Health Card */}
            <div
              className={`rounded-2xl border p-5 transition-all shadow-xs ${
                balanceCheck.isBalanced
                  ? 'bg-linear-to-br from-emerald-50 via-teal-50/40 to-white border-emerald-300 text-emerald-950'
                  : 'bg-linear-to-br from-red-50 via-amber-50/40 to-white border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      balanceCheck.isBalanced ? 'bg-emerald-500' : 'bg-red-500 animate-ping'
                    }`}
                  />
                  <h4 className="text-sm font-extrabold tracking-tight uppercase">
                    {balanceCheck.isBalanced ? '100% BALANCED (DR == CR)' : 'OUT-OF-BALANCE DETECTED'}
                  </h4>
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    balanceCheck.isBalanced
                      ? 'bg-emerald-200/80 text-emerald-900'
                      : 'bg-red-200 text-red-900'
                  }`}
                >
                  {balanceCheck.isBalanced ? 'Invariant Verified' : 'Action Required'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-center">
                <div className="bg-white/80 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Debits (Σ Dr)
                  </span>
                  <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
                    {formatCurrency(balanceCheck.totalDebits, settings.currency)}
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Credits (Σ Cr)
                  </span>
                  <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
                    {formatCurrency(balanceCheck.totalCredits, settings.currency)}
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Accounts Monitored
                  </span>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    {accounts.length}
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-black/5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Posted Journals
                  </span>
                  <div className="text-base font-extrabold text-slate-900 mt-1">
                    {journalEntries.length}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Categorized Discrepancy Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Categorized Ledger Discrepancy Breakdown
                  </h4>
                  <p className="text-xs text-slate-500">
                    Continuous integrity audit across all 8 collections
                  </p>
                </div>

                {/* Filter Pills */}
                {report && report.issues.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveCategoryFilter('ALL')}
                      className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        activeCategoryFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      All ({report.issues.length})
                    </button>
                  </div>
                )}
              </div>

              {isHealthy ? (
                <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center space-y-3 shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      All Double-Entry Ledgers Reconciled
                    </h5>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      No out-of-balance entries, custody float variances, duplicate aggregations, or orphaned transactions detected across any module.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleScanWithAi}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-Verify Integrity</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            {categoryIcons[issue.category] || <Activity className="w-4 h-4 text-slate-500" />}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {issue.categoryTitle || issue.category}
                            </span>
                            <h5 className="text-xs font-bold text-slate-900">
                              {issue.title}
                            </h5>
                          </div>
                        </div>

                        {issue.recordIdentifier && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                            {issue.recordIdentifier}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {issue.description}
                      </p>

                      {/* Expected vs Actual Diff */}
                      <div className="flex items-center gap-4 text-xs font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">EXPECTED</span>
                          <span className="font-bold text-emerald-700">{String(issue.detectedDiscrepancy.expected)}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block text-[10px]">ACTUAL</span>
                          <span className="font-bold text-red-600">{String(issue.detectedDiscrepancy.actual)}</span>
                        </div>
                      </div>

                      {/* Auto-Fix Plan Preview */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Fix Plan: {issue.suggestedAction}</span>
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                          Auto-Fixable
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
            <span className="text-slate-500">
              Double-Entry Financial Service v2.4 • Invariant Enforced
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Noor Copilot Modal from Drawer */}
      <NoorAICopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
};
