import React, { useState, useMemo } from 'react';
import {
  Scale,
  Calendar,
  Download,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import {
  FinancialReportingService,
  TrialBalanceAccountRow,
  CurrencyViewMode,
} from '../../services/financialReportingService';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { AccountLedgerDrawer } from './AccountLedgerDrawer';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

export const TrialBalanceReport: React.FC = () => {
  const {
    accounts,
    cashAccounts,
    members,
    cases,
    transactions,
    receipts,
    payments,
    journalEntries,
    cashHoldings,
    settings,
  } = useCharity();

  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [currencyView, setCurrencyView] = useState<CurrencyViewMode>('AED');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Selected account for ledger drill-down drawer
  const [drillDownAccount, setDrillDownAccount] = useState<TrialBalanceAccountRow | null>(null);

  // Compute Trial Balance
  const trialBalance = useMemo(() => {
    return FinancialReportingService.getTrialBalance({
      accounts,
      cashAccounts,
      members,
      cases,
      transactions,
      receipts,
      payments,
      journalEntries,
      cashHoldings,
      fromDate,
      toDate,
      currencyView,
      settings,
    });
  }, [
    accounts,
    cashAccounts,
    members,
    cases,
    transactions,
    receipts,
    payments,
    journalEntries,
    cashHoldings,
    fromDate,
    toDate,
    currencyView,
    settings,
  ]);

  // Filter rows by search and category
  const filteredRows = useMemo(() => {
    return trialBalance.rows.filter((r) => {
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = (r.accountCode || '').toLowerCase().includes(q);
        const matchesName = (r.accountName || '').toLowerCase().includes(q);
        const matchesSub = (r.subCategory || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesSub) return false;
      }
      return true;
    });
  }, [trialBalance.rows, searchQuery, selectedCategory]);

  // Presets
  const applyPreset = (type: 'this-year' | 'last-year' | 'this-month' | 'all-time') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');

    if (type === 'this-year') {
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-${m}-${d}`);
    } else if (type === 'last-year') {
      setFromDate(`${y - 1}-01-01`);
      setToDate(`${y - 1}-12-31`);
    } else if (type === 'this-month') {
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${d}`);
    } else if (type === 'all-time') {
      setFromDate('2020-01-01');
      setToDate(`${y}-${m}-${d}`);
    }
  };

  // Export handlers
  const handleExportCsv = () => {
    const rows = trialBalance.rows.map((r) => ({
      'Account Code (GL #)': r.accountCode,
      'Account Name': r.accountName,
      Category: r.category,
      'Sub-category': r.subCategory,
      'Normal Balance': r.normalBalance,
      'Opening Debit (AED)': r.openingDebit,
      'Opening Credit (AED)': r.openingCredit,
      'Period Debit (AED)': r.periodDebit,
      'Period Credit (AED)': r.periodCredit,
      'Closing Debit (AED)': r.closingDebit,
      'Closing Credit (AED)': r.closingCredit,
      'Net Closing Balance (AED)': r.netClosingBalance,
      'Native Currency Details': r.nativeCurrency ? `${r.nativeCurrency}` : '',
    }));

    exportToCsv(`Trial_Balance_${fromDate}_to_${toDate}`, rows);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Asset':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Liability':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Equity':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Income':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Expense':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="trial-balance-report" className="space-y-6 printable-content relative">
      <DocumentLogoWatermark size="lg" />
      {/* Top Banner & Title */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
                Official Financial Statement
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Trial Balance</h1>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Double-entry verification of all debit and credit account balances across Main Treasury,
            active Bank accounts, Member Custodians, Restricted Charity Case Funds, and Member Contributions.
          </p>
        </div>

        {/* Audit Status Badge in Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div
            className={`px-4 py-3 rounded-xl border flex items-center gap-3 backdrop-blur-md ${
              trialBalance.isBalanced
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-lg'
                : 'bg-rose-500/20 border-rose-400/40 text-rose-200 shadow-lg'
            }`}
          >
            {trialBalance.isBalanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {trialBalance.isBalanced ? 'Trial Balance Balanced' : 'Accounting Out of Balance'}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Debits: {formatCurrency(trialBalance.totalClosingDebit, 'AED')} • Credits: {formatCurrency(trialBalance.totalClosingCredit, 'AED')}
                {!trialBalance.isBalanced && ` (Diff: ${formatCurrency(trialBalance.difference, 'AED')})`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standard Controls Card: Date Filter, Fiscal Year Presets, Currency Toggle, Actions */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Date Range Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Period:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                id="input-tb-from-date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400">&rarr;</span>
              <input
                type="date"
                id="input-tb-to-date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Quick Presets */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-[11px] font-semibold border border-slate-200">
              <button
                type="button"
                onClick={() => applyPreset('this-year')}
                className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
              >
                Fiscal Year 2026
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this-month')}
                className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all-time')}
                className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Right Side: Currency Toggle & Export Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Currency:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-xs shadow-inner">
                <button
                  type="button"
                  onClick={() => setCurrencyView('AED')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    currencyView === 'AED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  AED (Base)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyView('INR')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    currencyView === 'INR'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  INR (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyView('COMBINED')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    currencyView === 'COMBINED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Combined Multi-Currency
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Excel / CSV</span>
              </button>
              <button
                onClick={() => triggerPrint('trial-balance-report', 'Trial_Balance_Report')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-emerald-600" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Sub-bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by GL #, account name, custodian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-400 font-medium">Filter Category:</span>
            {['ALL', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Accounts' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trial Balance Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th rowSpan={2} className="py-3 px-3.5 border-r border-slate-200">Account Code</th>
                <th rowSpan={2} className="py-3 px-3.5 border-r border-slate-200">Account Name & Particulars</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 text-center">Category</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-slate-200/50">
                  Opening Balance
                </th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-200 bg-slate-200/70">
                  Period Activity ({fromDate.slice(5)} &rarr; {toDate.slice(5)})
                </th>
                <th colSpan={2} className="py-2 px-3 text-center bg-emerald-50 text-emerald-950">
                  Net Closing Balance
                </th>
              </tr>
              <tr className="border-t border-slate-200 text-[9px]">
                <th className="py-1.5 px-3 text-right bg-slate-200/50">Debit</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200 bg-slate-200/50">Credit</th>
                <th className="py-1.5 px-3 text-right bg-slate-200/70">Debit</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-200 bg-slate-200/70">Credit</th>
                <th className="py-1.5 px-3 text-right bg-emerald-100/60 text-emerald-900 font-bold">Debit</th>
                <th className="py-1.5 px-3 text-right bg-emerald-100/60 text-emerald-900 font-bold">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    No accounts matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.accountCode}
                    onClick={() => setDrillDownAccount(row)}
                    className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    title="Click to view detailed General Ledger entries for this account"
                  >
                    {/* Account Code */}
                    <td className="py-2.5 px-3.5 font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover:text-emerald-700 underline decoration-dotted underline-offset-2">
                          {row.accountCode}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>

                    {/* Account Name */}
                    <td className="py-2.5 px-3.5 font-sans border-r border-slate-100">
                      <div className="font-semibold text-slate-800 group-hover:text-emerald-900 transition-colors">
                        {row.accountName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {row.subCategory}
                        {row.isCustodianSubAccount && ' • Physical Cash Custody'}
                        {row.entriesCount > 0 && ` • ${row.entriesCount} postings`}
                      </div>
                      {/* Combined Multi-Currency Pill */}
                      {currencyView === 'COMBINED' && row.nativeCurrency === 'INR' && (
                        <div className="text-[10px] text-amber-700 font-mono font-medium">
                          Custody in INR (₹ 4,000.00)
                        </div>
                      )}
                    </td>

                    {/* Category Badge */}
                    <td className="py-2.5 px-3 text-center border-r border-slate-100 font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryColor(
                          row.category
                        )}`}
                      >
                        {row.category}
                      </span>
                    </td>

                    {/* Opening Debit */}
                    <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap bg-slate-50/30">
                      {row.openingDebit > 0 ? formatCurrency(row.openingDebit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>

                    {/* Opening Credit */}
                    <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap border-r border-slate-100 bg-slate-50/30">
                      {row.openingCredit > 0 ? formatCurrency(row.openingCredit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>

                    {/* Period Debit */}
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap bg-slate-50/50">
                      {row.periodDebit > 0 ? formatCurrency(row.periodDebit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>

                    {/* Period Credit */}
                    <td className="py-2.5 px-3 text-right text-rose-700 font-semibold whitespace-nowrap border-r border-slate-100 bg-slate-50/50">
                      {row.periodCredit > 0 ? formatCurrency(row.periodCredit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>

                    {/* Closing Debit */}
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-900 whitespace-nowrap bg-emerald-50/30">
                      {row.closingDebit > 0 ? formatCurrency(row.closingDebit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>

                    {/* Closing Credit */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap bg-emerald-50/30">
                      {row.closingCredit > 0 ? formatCurrency(row.closingCredit, currencyView === 'INR' ? 'INR' : 'AED') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Integrity Check Footer */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-400 font-mono text-xs font-bold text-slate-900">
              <tr>
                <td colSpan={3} className="py-3 px-3.5 text-right font-sans uppercase tracking-wider text-slate-800">
                  GRAND TRIAL BALANCE TOTALS:
                </td>
                {/* Opening Totals */}
                <td className="py-3 px-3 text-right text-slate-700 bg-slate-200/40">
                  {formatCurrency(trialBalance.totalOpeningDebit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
                <td className="py-3 px-3 text-right text-slate-700 border-r border-slate-300 bg-slate-200/40">
                  {formatCurrency(trialBalance.totalOpeningCredit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
                {/* Period Totals */}
                <td className="py-3 px-3 text-right text-emerald-800 bg-slate-200/60">
                  {formatCurrency(trialBalance.totalPeriodDebit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
                <td className="py-3 px-3 text-right text-rose-800 border-r border-slate-300 bg-slate-200/60">
                  {formatCurrency(trialBalance.totalPeriodCredit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
                {/* Closing Totals */}
                <td className="py-3 px-3 text-right text-emerald-950 bg-emerald-100/80 text-sm">
                  {formatCurrency(trialBalance.totalClosingDebit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
                <td className="py-3 px-3 text-right text-slate-950 bg-emerald-100/80 text-sm">
                  {formatCurrency(trialBalance.totalClosingCredit, currencyView === 'INR' ? 'INR' : 'AED')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Validation & Audit Reconciliation Summary Card */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              trialBalance.isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {trialBalance.isBalanced ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {trialBalance.isBalanced
                ? 'Accounting Integrity Verified: Double-Entry Balanced'
                : 'Accounting Discrepancy Detected'}
            </h4>
            <p className="text-xs text-slate-500">
              Total Debits ({formatCurrency(trialBalance.totalClosingDebit, 'AED')}) equals Total Credits ({formatCurrency(trialBalance.totalClosingCredit, 'AED')}). Net difference is {formatCurrency(trialBalance.difference, 'AED')}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Validation Difference
            </span>
            <span className={`text-base font-bold font-mono ${trialBalance.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(trialBalance.difference, 'AED')}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Account General Ledger Drill-down Drawer */}
      {drillDownAccount && (
        <AccountLedgerDrawer
          isOpen={Boolean(drillDownAccount)}
          onClose={() => setDrillDownAccount(null)}
          accountCode={drillDownAccount.accountCode}
          accountName={drillDownAccount.accountName}
          category={drillDownAccount.category}
          normalBalance={drillDownAccount.normalBalance}
          openingBalance={drillDownAccount.netOpeningBalance}
          closingBalance={drillDownAccount.netClosingBalance}
          entries={drillDownAccount.entries}
          currencyView={currencyView}
          fromDate={fromDate}
          toDate={toDate}
          baseCurrency={currencyView === 'INR' ? 'INR' : 'AED'}
        />
      )}
    </div>
  );
};
