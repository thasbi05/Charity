import React, { useState, useMemo } from 'react';
import {
  Scale,
  Calendar,
  Download,
  FileDown,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Landmark,
  HeartHandshake,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  PieChart,
  ArrowRight,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import {
  FinancialReportingService,
  BalanceSheetResult,
  CurrencyViewMode,
  AccountLedgerEntry,
} from '../../services/financialReportingService';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { AccountLedgerDrawer } from './AccountLedgerDrawer';
import { MemberLink, CaseLink, CustodianLink } from '../Common/ClickableEntity';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

interface BalanceSheetReportProps {
  onSelectMember?: (memberId: string) => void;
  onSelectCase?: (caseId: string) => void;
}

export const BalanceSheetReport: React.FC<BalanceSheetReportProps> = () => {
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

  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [currencyView, setCurrencyView] = useState<CurrencyViewMode>('AED');

  // Drill-down Drawer State
  const [selectedLedger, setSelectedLedger] = useState<{
    code: string;
    name: string;
    category: string;
    normalBalance: 'Debit' | 'Credit';
    openingBalance: number;
    closingBalance: number;
    entries: AccountLedgerEntry[];
  } | null>(null);

  // Compute Balance Sheet
  const balanceSheet: BalanceSheetResult = useMemo(() => {
    return FinancialReportingService.getBalanceSheet({
      accounts,
      cashAccounts,
      members,
      cases,
      transactions,
      receipts,
      payments,
      journalEntries,
      cashHoldings,
      asOfDate,
      currencyView,
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
    asOfDate,
    currencyView,
  ]);

  // Presets
  const applyPreset = (preset: 'today' | 'end-of-month' | 'end-of-year') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (preset === 'today') {
      setAsOfDate(today.toISOString().slice(0, 10));
    } else if (preset === 'end-of-month') {
      const lastDay = new Date(y, m + 1, 0);
      setAsOfDate(lastDay.toISOString().slice(0, 10));
    } else if (preset === 'end-of-year') {
      setAsOfDate(`${y}-12-31`);
    }
  };

  const handleExportCsv = () => {
    const assetRows = [
      ...balanceSheet.currentAssets.treasuryCash.map((a) => ({
        Classification: 'Current Asset',
        Section: 'Cash on Hand (Treasury)',
        'Code / GL': a.code,
        Item: a.name,
        'Original Currency': a.currency,
        'Original Amount': a.originalAmount,
        'Base Amount (AED)': a.baseAmount,
        Notes: a.notes || '',
      })),
      ...balanceSheet.currentAssets.bankAccounts.map((a) => ({
        Classification: 'Current Asset',
        Section: 'Bank Accounts',
        'Code / GL': a.code,
        Item: a.name,
        'Original Currency': a.currency,
        'Original Amount': a.originalAmount,
        'Base Amount (AED)': a.baseAmount,
        Notes: a.notes || '',
      })),
      ...balanceSheet.currentAssets.custodianHoldings.map((a) => ({
        Classification: 'Current Asset',
        Section: 'Member Cash Custodian',
        'Code / GL': a.code,
        Item: a.name,
        'Original Currency': a.currency,
        'Original Amount': a.originalAmount,
        'Base Amount (AED)': a.baseAmount,
        Notes: a.notes || '',
      })),
    ];

    const liabilityRows = balanceSheet.currentLiabilities.payables.map((p) => ({
      Classification: 'Current Liability',
      Section: 'Payables',
      'Code / GL': p.code,
      Item: p.name,
      'Original Currency': 'AED',
      'Original Amount': p.amount,
      'Base Amount (AED)': p.amount,
      Notes: 'Pending disbursements or reimbursements',
    }));

    const fundRows = [
      ...balanceSheet.fundBalances.restrictedCaseFunds.map((cf) => ({
        Classification: 'Fund Balance',
        Section: 'Restricted Charity Case Fund',
        'Code / GL': cf.caseNumber,
        Item: cf.caseTitle,
        'Original Currency': cf.currency,
        'Original Amount': cf.remainingFundBalance,
        'Base Amount (AED)': cf.remainingFundBalance,
        Notes: `Collected: ${cf.totalContributionsCollected} | Disbursed: ${cf.totalAidDisbursed}`,
      })),
      {
        Classification: 'Fund Balance',
        Section: 'General Unrestricted Member Fund',
        'Code / GL': '3010',
        Item: 'Accumulated Member Surplus',
        'Original Currency': 'AED',
        'Original Amount': balanceSheet.fundBalances.generalUnrestrictedMemberFund.netUnrestrictedSurplus,
        'Base Amount (AED)': balanceSheet.fundBalances.generalUnrestrictedMemberFund.netUnrestrictedSurplus,
        Notes: `Unrestricted Revenue: ${balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalUnrestrictedIncome} | Expenses: ${balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalUnrestrictedExpenses}`,
      },
    ];

    exportToCsv(`Balance_Sheet_AsOf_${asOfDate}`, [...assetRows, ...liabilityRows, ...fundRows]);
  };

  return (
    <div id="balance-sheet-report" className="space-y-6 printable-content relative">
      <DocumentLogoWatermark size="lg" />
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-blue-400">
                Non-Profit Statement of Financial Position
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Balance Sheet</h1>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Non-profit fund accounting statement disclosing Total Liquid Assets across Treasury, Bank,
            and Peer Cash Custodians, balanced against Restricted Charity Case Funds and General Member Reserves.
          </p>
        </div>

        {/* Audit Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-3 rounded-xl border flex items-center gap-3 backdrop-blur-md ${
              balanceSheet.isBalanced
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 shadow-lg'
                : 'bg-rose-500/20 border-rose-400/40 text-rose-200 shadow-lg'
            }`}
          >
            {balanceSheet.isBalanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {balanceSheet.isBalanced ? 'Accounting Equation Balanced' : 'Accounting Out of Balance'}
              </div>
              <div className="text-[11px] font-mono text-slate-300">
                Assets: {formatCurrency(balanceSheet.totalAssets, 'AED')} = Liabilities & Funds: {formatCurrency(balanceSheet.totalLiabilitiesAndFunds, 'AED')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standard Controls Card */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>As of Date:</span>
          </div>
          <input
            type="date"
            id="input-bs-as-of-date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />

          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-[11px] font-semibold border border-slate-200">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset('end-of-month')}
              className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
            >
              End of Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset('end-of-year')}
              className="px-2.5 py-1 rounded-md text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
            >
              End of Year 2026
            </button>
          </div>
        </div>

        {/* Currency & Export Actions */}
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
                    ? 'bg-blue-600 text-white shadow-xs'
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
                    ? 'bg-blue-600 text-white shadow-xs'
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
                    ? 'bg-blue-600 text-white shadow-xs'
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
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Export Excel / CSV</span>
            </button>
            <button
              onClick={() => triggerPrint('balance-sheet-report', 'Balance_Sheet_Report')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Non-Profit Balance Sheet Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: ASSETS */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  Assets (Current & Liquid)
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {formatCurrency(balanceSheet.totalAssets, currencyView === 'INR' ? 'INR' : 'AED')}
              </span>
            </div>

            {/* 1. Treasury Cash */}
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>1. Cash on Hand (Main Treasury Safe)</span>
                <span className="font-mono">
                  {formatCurrency(balanceSheet.currentAssets.totalTreasuryCash, currencyView === 'INR' ? 'INR' : 'AED')}
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                {balanceSheet.currentAssets.treasuryCash.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSelectedLedger({
                        code: item.code,
                        name: item.name,
                        category: 'Asset',
                        normalBalance: 'Debit',
                        openingBalance: 0,
                        closingBalance: item.baseAmount,
                        entries: item.entries,
                      })
                    }
                    className="p-2.5 flex items-center justify-between hover:bg-blue-50/50 transition-colors cursor-pointer group text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400">GL #{item.code}</span>
                        <span>{item.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[10px] text-slate-400">Immediate safe physical intake float</div>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.baseAmount, currencyView === 'INR' ? 'INR' : 'AED')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Bank Accounts */}
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>2. Bank Accounts</span>
                <span className="font-mono">
                  {formatCurrency(balanceSheet.currentAssets.totalBankAccounts, currencyView === 'INR' ? 'INR' : 'AED')}
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                {balanceSheet.currentAssets.bankAccounts.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 italic">No bank accounts with active balance.</div>
                ) : (
                  balanceSheet.currentAssets.bankAccounts.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        setSelectedLedger({
                          code: item.code,
                          name: item.name,
                          category: 'Asset',
                          normalBalance: 'Debit',
                          openingBalance: 0,
                          closingBalance: item.baseAmount,
                          entries: item.entries,
                        })
                      }
                      className="p-2.5 flex items-center justify-between hover:bg-blue-50/50 transition-colors cursor-pointer group text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">GL #{item.code}</span>
                          <span>{item.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] text-slate-400">Primary operational transfers</div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.baseAmount, currencyView === 'INR' ? 'INR' : 'AED')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Member Cash Custodian Balances (Split by AED and INR converted) */}
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Member Cash Custodians & Peer Pools</span>
                </span>
                <span className="font-mono text-emerald-800">
                  {formatCurrency(balanceSheet.currentAssets.totalCustodianHoldings, currencyView === 'INR' ? 'INR' : 'AED')}
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                {balanceSheet.currentAssets.custodianHoldings.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSelectedLedger({
                        code: item.code,
                        name: item.name,
                        category: 'Asset',
                        normalBalance: 'Debit',
                        openingBalance: 0,
                        closingBalance: item.baseAmount,
                        entries: item.entries,
                      })
                    }
                    className="p-2.5 flex items-center justify-between hover:bg-emerald-50/60 transition-colors cursor-pointer group text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 group-hover:text-emerald-900 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400">{item.code}</span>
                        <span>{item.custodianMemberName || item.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {item.notes}
                        {item.currency === 'INR' && (
                          <span className="text-amber-800 font-mono ml-1 font-bold">
                            (₹ {item.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900">
                        {formatCurrency(item.baseAmount, currencyView === 'INR' ? 'INR' : 'AED')}
                      </div>
                      {item.currency === 'INR' && currencyView !== 'INR' && (
                        <div className="text-[10px] text-amber-700 font-mono">
                          ₹ {item.originalAmount.toLocaleString()} @ 0.04401
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Assets Summary Bar */}
            <div className="mt-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                Total Current Assets
              </span>
              <span className="text-base font-bold font-mono text-blue-900">
                {formatCurrency(balanceSheet.totalAssets, currencyView === 'INR' ? 'INR' : 'AED')}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIABILITIES & FUND BALANCES */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  Liabilities & Fund Balances
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {formatCurrency(balanceSheet.totalLiabilitiesAndFunds, currencyView === 'INR' ? 'INR' : 'AED')}
              </span>
            </div>

            {/* 1. Current Liabilities */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>1. Current Liabilities (Payables)</span>
                <span className="font-mono">
                  {formatCurrency(balanceSheet.totalLiabilities, currencyView === 'INR' ? 'INR' : 'AED')}
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden bg-slate-50/50">
                {balanceSheet.currentLiabilities.payables.length === 0 ? (
                  <div className="p-2.5 text-xs text-slate-400 italic">No outstanding payables or pending reimbursement debt.</div>
                ) : (
                  balanceSheet.currentLiabilities.payables.map((p) => (
                    <div
                      key={p.id}
                      onClick={() =>
                        setSelectedLedger({
                          code: p.code,
                          name: p.name,
                          category: 'Liability',
                          normalBalance: 'Credit',
                          openingBalance: 0,
                          closingBalance: p.amount,
                          entries: p.entries,
                        })
                      }
                      className="p-2.5 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-semibold text-slate-800">
                        {p.code} - {p.name}
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {formatCurrency(p.amount, currencyView === 'INR' ? 'INR' : 'AED')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Restricted Charity Case Funds */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Restricted Charity Case Funds (Awaiting Aid Distribution)</span>
                </span>
                <span className="font-mono">
                  {formatCurrency(balanceSheet.fundBalances.totalRestrictedFunds, currencyView === 'INR' ? 'INR' : 'AED')}
                </span>
              </div>
              <div className="divide-y divide-slate-100 border border-emerald-100 rounded-lg overflow-hidden bg-emerald-50/30">
                {balanceSheet.fundBalances.restrictedCaseFunds.map((cf) => (
                  <div
                    key={cf.caseId}
                    onClick={() =>
                      setSelectedLedger({
                        code: cf.caseNumber,
                        name: `Restricted Fund: ${cf.caseTitle}`,
                        category: 'Equity',
                        normalBalance: 'Credit',
                        openingBalance: 0,
                        closingBalance: cf.remainingFundBalance,
                        entries: cf.entries,
                      })
                    }
                    className="p-3 flex items-center justify-between hover:bg-emerald-100/50 transition-colors cursor-pointer group text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-emerald-900 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-200/60 font-mono font-bold text-emerald-900">
                          {cf.caseNumber}
                        </span>
                        <span>{cf.caseTitle}</span>
                        <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Beneficiary: <strong>{cf.beneficiaryName}</strong> • Collected:{' '}
                        {formatCurrency(cf.totalContributionsCollected, 'AED')} | Disbursed:{' '}
                        {formatCurrency(cf.totalAidDisbursed, 'AED')}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-900">
                      {formatCurrency(cf.remainingFundBalance, currencyView === 'INR' ? 'INR' : 'AED')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. General Unrestricted Member Fund (Retained Surplus from Monthly Dues) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. General Unrestricted Member Relief Fund</span>
                </span>
                <span className="font-mono text-blue-900">
                  {formatCurrency(
                    balanceSheet.fundBalances.generalUnrestrictedMemberFund.netUnrestrictedSurplus,
                    currencyView === 'INR' ? 'INR' : 'AED'
                  )}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Monthly Member Subscription Contributions (GL #4010):</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatCurrency(
                      balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalMemberContributions,
                      currencyView === 'INR' ? 'INR' : 'AED'
                    )}
                  </span>
                </div>
                {balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalDirectDonations > 0 && (
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Direct Public Donations & General Sadaqah (GL #4020):</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrency(
                        balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalDirectDonations,
                        currencyView === 'INR' ? 'INR' : 'AED'
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Less: General Direct Financial Aid Disbursed (GL #5010):</span>
                  <span className="font-mono font-bold text-rose-700">
                    - {formatCurrency(
                      balanceSheet.fundBalances.generalUnrestrictedMemberFund.totalGeneralAidDisbursed,
                      currencyView === 'INR' ? 'INR' : 'AED'
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-slate-900">
                  <span>Net Retained General Relief Pool:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatCurrency(
                      balanceSheet.fundBalances.generalUnrestrictedMemberFund.netUnrestrictedSurplus,
                      currencyView === 'INR' ? 'INR' : 'AED'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Fund Balances Summary Bar */}
            <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Total Liabilities & Fund Balances
              </span>
              <span className="text-base font-bold font-mono text-emerald-900">
                {formatCurrency(balanceSheet.totalLiabilitiesAndFunds, currencyView === 'INR' ? 'INR' : 'AED')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Breakdown: Custodians Backing the Liquid Assets */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Physical Custody Backing of Fund Balances
              </h3>
              <p className="text-xs text-slate-500">
                Breakdown showing which custodian holds the physical cash backing restricted and unrestricted fund obligations.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
            100% Liquid Backed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balanceSheet.custodianBacking.map((item) => (
            <div
              key={item.custodianId}
              className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    {item.custodianNumber}
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{item.custodianName}</div>
                </div>
                <span className="text-xs font-bold text-slate-700 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {item.percentageOfLiquidAssets}% of assets
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Base Equivalent:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(item.totalBaseAmount, 'AED')}
                  </span>
                </div>
                {item.inrAmount > 0 && (
                  <div className="flex justify-between text-amber-800 font-medium text-[11px]">
                    <span>Indian Rupee In-Hand:</span>
                    <span className="font-mono font-bold">
                      ₹ {item.inrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {item.aedAmount > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>UAE Cash In-Hand:</span>
                    <span className="font-mono">AED {item.aedAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar of backing */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, item.percentageOfLiquidAssets)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Account General Ledger Drill-down Drawer */}
      {selectedLedger && (
        <AccountLedgerDrawer
          isOpen={Boolean(selectedLedger)}
          onClose={() => setSelectedLedger(null)}
          accountCode={selectedLedger.code}
          accountName={selectedLedger.name}
          category={selectedLedger.category}
          normalBalance={selectedLedger.normalBalance}
          openingBalance={selectedLedger.openingBalance}
          closingBalance={selectedLedger.closingBalance}
          entries={selectedLedger.entries}
          currencyView={currencyView}
          fromDate="2026-01-01"
          toDate={asOfDate}
          baseCurrency={currencyView === 'INR' ? 'INR' : 'AED'}
        />
      )}
    </div>
  );
};
