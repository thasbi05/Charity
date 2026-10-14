import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  Coins,
  Scale,
  Users,
  Ghost,
  X,
  ArrowRight,
  Database,
  Check,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCharity } from '../../context/CharityContext';
import {
  HealthScanSummary,
  RepairExecutionResult,
  DiagnosticIssue,
  DiagnosticCategory,
} from '../../services/aiHealthCheckService';

interface AiDiagnosticWidgetProps {
  variant?: 'dashboard-header' | 'settings' | 'compact';
  className?: string;
}

export const AiDiagnosticWidget: React.FC<AiDiagnosticWidgetProps> = ({
  variant = 'dashboard-header',
  className = '',
}) => {
  const { user } = useAuth();
  const {
    systemSyncState,
    latestScanReport,
    runAiHealthScan,
    runAiHealthRepair,
  } = useCharity();

  const isAdmin =
    user?.role === 'administrator' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'CHARITY_ADMIN' ||
    !user?.role;

  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [activeReport, setActiveReport] = useState<HealthScanSummary | null>(latestScanReport);
  const [activeFilterCategory, setActiveFilterCategory] = useState<DiagnosticCategory | 'ALL'>('ALL');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [repairResultModal, setRepairResultModal] = useState<RepairExecutionResult | null>(null);

  // Sync active report with context state
  useEffect(() => {
    if (latestScanReport) {
      setActiveReport(latestScanReport);
    }
  }, [latestScanReport]);

  // Initial passive health check on mount if none yet
  useEffect(() => {
    if (!activeReport && typeof runAiHealthScan === 'function') {
      try {
        const initialScan = runAiHealthScan();
        setActiveReport(initialScan);
      } catch (err) {
        console.warn('Initial background health check failed:', err);
      }
    }
  }, []);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      try {
        const report = runAiHealthScan();
        setActiveReport(report);
      } catch (err) {
        console.error('AI Health scan error:', err);
      } finally {
        setIsScanning(false);
      }
    }, 600);
  };

  const handleRepair = async () => {
    setIsRepairing(true);
    try {
      const scanToUse = activeReport || runAiHealthScan();
      const result = await runAiHealthRepair(scanToUse);
      setRepairResultModal(result);
      // Run immediate re-scan to verify that everything is 100% clean
      const freshReport = runAiHealthScan();
      setActiveReport(freshReport);
    } catch (err) {
      console.error('AI Bug Fix execution failed:', err);
      alert('AI Bug Fix encounter an error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRepairing(false);
    }
  };

  const issuesCount = activeReport?.totalIssues ?? 0;
  const isHealthy = issuesCount === 0;

  const filteredIssues = useMemo(() => {
    if (!activeReport) return [];
    if (activeFilterCategory === 'ALL') return activeReport.issues;
    return activeReport.issues.filter((i) => i.category === activeFilterCategory);
  }, [activeReport, activeFilterCategory]);

  const categoryIcons: Record<DiagnosticCategory, React.ReactNode> = {
    MULTI_CURRENCY: <Coins className="w-4 h-4 text-amber-500" />,
    ORPHAN_GHOST_RECORDS: <Ghost className="w-4 h-4 text-purple-500" />,
    DOUBLE_ENTRY_IMBALANCE: <Scale className="w-4 h-4 text-rose-500" />,
    BROKEN_CUSTODIAN_FLOATS: <Layers className="w-4 h-4 text-emerald-500" />,
    OVERDUE_STATUS: <Users className="w-4 h-4 text-blue-500" />,
    GL_ACCOUNT_DRIFT: <FileSpreadsheet className="w-4 h-4 text-cyan-500" />,
    ALLOCATION_MISMATCH: <AlertCircle className="w-4 h-4 text-orange-500" />,
  };

  // If user is not an admin, render minimal read-only status badge or null
  if (!isAdmin) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${isHealthy ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' : 'bg-amber-50/80 border-amber-200 text-amber-800'} ${className}`}>
        <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        <span>{isHealthy ? 'System Health: All Ledgers Verified' : 'System Health: Audit Monitoring Active'}</span>
      </div>
    );
  }

  // Dashboard Header Compact or Full Widget
  return (
    <>
      <div
        id="admin-ai-health-widget"
        className={`rounded-2xl transition-all duration-200 border ${
          isHealthy
            ? 'bg-linear-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border-emerald-200 text-emerald-950 shadow-2xs'
            : 'bg-linear-to-r from-amber-50 via-rose-50/50 to-amber-50 border-amber-300 text-slate-900 shadow-xs'
        } ${variant === 'settings' ? 'p-5 sm:p-6 mb-6' : 'p-3.5 sm:p-4'} ${className}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          {/* Status Badge & Health Information */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                isHealthy
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              {isHealthy ? (
                <ShieldCheck className="w-5 h-5 text-emerald-100" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-100" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  id="ai-health-status-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-tight shadow-2xs ${
                    isHealthy
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border border-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isHealthy ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600 animate-ping'
                    }`}
                  />
                  <span>
                    {isHealthy
                      ? 'System Health: All Ledgers Verified'
                      : `Attention: ${issuesCount} Discrepanc${issuesCount === 1 ? 'y' : 'ies'} Found`}
                  </span>
                </span>

                {systemSyncState?.lastRepairAt && (
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Last Reconciled: {new Date(systemSyncState.lastRepairAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-1 truncate">
                {isHealthy ? (
                  <span>Automated AI checks confirmed: Multi-currency, cash custodian floats &amp; double entries balanced globally.</span>
                ) : (
                  <span className="text-amber-900 font-medium">
                    Diagnostic engine flagged {issuesCount} data inconsistencies across ledger collections.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap self-start md:self-center shrink-0">
            {/* View Discrepancies Details button (if issues or report available) */}
            {activeReport && (
              <button
                id="ai-health-inspect-btn"
                type="button"
                onClick={() => setIsDetailsModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="View full AI Diagnostic Report"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Diagnostic Report</span>
                {issuesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    {issuesCount}
                  </span>
                )}
              </button>
            )}

            {/* Scan with AI Button */}
            <button
              id="ai-health-scan-btn"
              type="button"
              disabled={isScanning || isRepairing}
              onClick={handleScan}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Records...' : 'Scan with AI'}</span>
            </button>

            {/* One-Click AI Bug Fix & Reconcile Button */}
            <button
              id="ai-health-oneclick-fix-btn"
              type="button"
              disabled={isRepairing || isScanning}
              onClick={handleRepair}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                isHealthy
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-linear-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 ring-2 ring-amber-400/50 animate-pulse'
              }`}
              title="Applies automated corrective actions and synchronizes the database globally"
            >
              {isRepairing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Wrench className="w-3.5 h-3.5 text-white" />
              )}
              <span>{isRepairing ? 'Reconciling Globally...' : 'One-Click AI Bug Fix & Reconcile'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED DIAGNOSTIC INSPECTOR MODAL */}
      {isDetailsModalOpen && activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isHealthy ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>AI Diagnostic &amp; Validation Engine</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isHealthy ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {isHealthy ? '100% Healthy' : `${issuesCount} Discrepancies`}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scanned 7 collections across {activeReport.recordsCount.receipts} receipts, {activeReport.recordsCount.payments} payments, {activeReport.recordsCount.journalEntries} journals, {activeReport.recordsCount.members} members.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Categories Selector */}
            <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveFilterCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>All Checks</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200">
                  {activeReport.issues.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterCategory('MULTI_CURRENCY')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'MULTI_CURRENCY'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Multi-Currency ({activeReport.categoryCounts.MULTI_CURRENCY})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterCategory('ORPHAN_GHOST_RECORDS')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'ORPHAN_GHOST_RECORDS'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Ghost className="w-3.5 h-3.5 text-purple-400" />
                <span>Orphan Records ({activeReport.categoryCounts.ORPHAN_GHOST_RECORDS})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterCategory('DOUBLE_ENTRY_IMBALANCE')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'DOUBLE_ENTRY_IMBALANCE'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-rose-400" />
                <span>Double-Entry Balance ({activeReport.categoryCounts.DOUBLE_ENTRY_IMBALANCE})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterCategory('BROKEN_CUSTODIAN_FLOATS')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'BROKEN_CUSTODIAN_FLOATS'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Custodian Floats ({activeReport.categoryCounts.BROKEN_CUSTODIAN_FLOATS})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilterCategory('OVERDUE_STATUS')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeFilterCategory === 'OVERDUE_STATUS'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Overdue Inconsistencies ({activeReport.categoryCounts.OVERDUE_STATUS})</span>
              </button>
            </div>

            {/* Issues List Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {filteredIssues.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No Discrepancies Found in this Category</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    All mathematical formulas, exchange rate snapshots, double entries, and physical custodian floats are verified and fully reconciled.
                  </p>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">{categoryIcons[issue.category]}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">{issue.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-semibold">
                              {issue.recordIdentifier}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                issue.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{issue.description}</p>
                        </div>
                      </div>

                      {issue.canAutoFix && (
                        <span className="shrink-0 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                          Auto-Fix Ready
                        </span>
                      )}
                    </div>

                    {/* Discrepancy comparison badge box */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-slate-400 font-medium">Expected Figure: </span>
                        <span className="font-bold text-emerald-700">{String(issue.detectedDiscrepancy.expected)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Actual In Database: </span>
                        <span className="font-bold text-rose-700">{String(issue.detectedDiscrepancy.actual)}</span>
                      </div>
                      {issue.detectedDiscrepancy.difference && (
                        <div className="sm:col-span-2 text-slate-500">
                          <span>Discrepancy Variance: </span>
                          <span className="font-semibold text-slate-800 font-mono">
                            {String(issue.detectedDiscrepancy.difference)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="font-semibold text-emerald-800">Automated AI Resolution:</span>
                      <span>{issue.suggestedAction}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Re-scanning...' : 'Re-scan Ledgers'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>

                {issuesCount > 0 && (
                  <button
                    type="button"
                    disabled={isRepairing}
                    onClick={() => {
                      handleRepair();
                      setIsDetailsModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>One-Click AI Bug Fix All</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONE-CLICK REPAIR SUCCESS SUMMARY DIALOG */}
      {repairResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-linear-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base">One-Click AI Repair Completed</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Central database updated &amp; synchronized across all users.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRepairResultModal(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Body */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-semibold">
                {repairResultModal.summaryMessage}
              </div>

              {/* Statistics Counter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-base font-bold text-amber-600">
                    {repairResultModal.fixedCounts.currencyDiscrepancies}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Currency Fixed</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-base font-bold text-purple-600">
                    {repairResultModal.fixedCounts.orphanPurged}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Orphans Purged</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-base font-bold text-rose-600">
                    {repairResultModal.fixedCounts.doubleEntriesBalanced}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Entries Balanced</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-base font-bold text-emerald-600">
                    {repairResultModal.fixedCounts.custodianFloatsReconciled}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Floats Reconciled</div>
                </div>
              </div>

              {/* Actions Detail Log */}
              {repairResultModal.actionsTaken.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>Global Reconciliations Executed:</span>
                  </h5>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono">
                    {repairResultModal.actionsTaken.map((act, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Global Real-Time Sync Indicator */}
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Universal Real-Time Sync Active:</strong> Schema version bumped. All connected Staff, Viewer, and Custodian sessions automatically receive updated clean balances.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setRepairResultModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
