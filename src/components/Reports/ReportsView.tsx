import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Calendar,
  Download,
  FileDown,
  TrendingUp,
  TrendingDown,
  Scale,
  BookOpen,
  Users,
  Wallet,
  Receipt,
  HeartHandshake,
  CheckCircle2,
  Landmark,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { CHARITY_CATEGORIES } from '../../utils/defaults';
import { BalanceSheetReport } from './BalanceSheetReport';
import { TrialBalanceReport } from './TrialBalanceReport';
import { MemberLedgerTable } from '../Ledgers/MemberLedgerTable';
import { CaseLedgerTable } from '../Ledgers/CaseLedgerTable';
import { MemberLink, CaseLink, TransactionLink } from '../Common/ClickableEntity';

export type ReportType =
  | 'trial-balance'
  | 'balance-sheet'
  | 'member-ledger'
  | 'charity-case-ledger'
  | 'income-expense'
  | 'category-charity'
  | 'member-contributions'
  | 'cash-book'
  | 'account-ledger'
  | 'balance-summary';

interface ReportsViewProps {
  initialReport?: ReportType;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ initialReport }) => {
  const { members, receipts, payments, transactions, accounts, cashAccounts, cases, settings } =
    useCharity();

  const currentYear = new Date().getFullYear();
  const [activeReport, setActiveReport] = useState<ReportType>(initialReport || 'trial-balance');
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  // Filters for specific reports
  const [selectedMemberId, setSelectedMemberId] = useState<string>(() => members[0]?.id || 'all');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => cases[0]?.id || '');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');

  // Valid entries in selected date range
  const periodReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.status !== 'valid') return false;
      if (fromDate && r.receiptDate < fromDate) return false;
      if (toDate && r.receiptDate > toDate) return false;
      return true;
    });
  }, [receipts, fromDate, toDate]);

  const periodPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.status !== 'valid') return false;
      if (fromDate && p.paymentDate < fromDate) return false;
      if (toDate && p.paymentDate > toDate) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status !== 'valid') return false;
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      return true;
    });
  }, [transactions, fromDate, toDate]);

  // 1. Income & Expense Report calculations
  const totalIncome = useMemo(() => {
    return periodReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [periodReceipts]);

  const totalExpense = useMemo(() => {
    return periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [periodPayments]);

  const netSurplus = totalIncome - totalExpense;

  // 2. Category-wise Charity Assistance breakdown
  const categorySummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    CHARITY_CATEGORIES.forEach((c) => (map[c] = { count: 0, total: 0 }));

    periodPayments.forEach((p) => {
      const cat = p.charityCategory || 'Other Charity Support';
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      map[cat].count += 1;
      map[cat].total += p.amount || 0;
    });

    return Object.entries(map).map(([category, data]) => ({
      category,
      count: data.count,
      total: data.total,
    }));
  }, [periodPayments]);

  // 3. Trial Balance calculation
  const trialBalanceRows = useMemo(() => {
    return accounts.map((acc) => {
      // In a trial balance:
      // Assets & Expenses normally have Debit balances
      // Liabilities, Equity, and Incomes normally have Credit balances
      let debit = 0;
      let credit = 0;

      if (acc.type === 'Asset' || acc.type === 'Expense') {
        debit = acc.balance || 0;
      } else {
        credit = acc.balance || 0;
      }

      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit,
        credit,
      };
    });
  }, [accounts]);

  const totalTrialDebit = trialBalanceRows.reduce((sum, r) => sum + r.debit, 0);
  const totalTrialCredit = trialBalanceRows.reduce((sum, r) => sum + r.credit, 0);

  // 4. Cash Book items (Chronological Cash/Bank Inflows & Outflows)
  const cashBookRows = useMemo(() => {
    const inflows = periodReceipts.map((r) => ({
      date: r.receiptDate,
      type: 'Receipt (Inflow)',
      docNo: r.receiptNumber,
      particulars: `${r.memberName} - ${r.contributionAccountName}`,
      account: r.cashBankAccountName,
      inflow: r.amount,
      outflow: 0,
    }));

    const outflows = periodPayments.map((p) => ({
      date: p.paymentDate,
      type: 'Payment (Outflow)',
      docNo: p.paymentNumber,
      particulars: `${p.payeeName} - ${p.charityCategory}`,
      account: p.cashBankAccountName,
      inflow: 0,
      outflow: p.amount,
    }));

    const combined = [...inflows, ...outflows];
    combined.sort((a, b) => (a.date > b.date ? 1 : -1));
    return combined;
  }, [periodReceipts, periodPayments]);

  // 5. Member Contribution Report
  const filteredMemberReceipts = useMemo(() => {
    return periodReceipts.filter((r) => {
      if (selectedMemberId !== 'all' && r.memberId !== selectedMemberId) return false;
      return true;
    });
  }, [periodReceipts, selectedMemberId]);

  // 6. Selected Account Ledger with running balance
  const accountLedgerData = useMemo(() => {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    if (!acc) return { account: null, entries: [], finalBalance: 0 };

    const entries: {
      date: string;
      txnNo: string;
      description: string;
      ref: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }[] = [];

    let running = 0;
    const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';

    periodTransactions.forEach((t) => {
      let isDebit = t.debitAccountId === acc.id || t.debitAccountCode === acc.code;
      let isCredit = t.creditAccountId === acc.id || t.creditAccountCode === acc.code;

      if (!isDebit && !isCredit) return;

      const debit = isDebit ? t.amount : 0;
      const credit = isCredit ? t.amount : 0;

      if (isDebitNormal) {
        running += debit - credit;
      } else {
        running += credit - debit;
      }

      entries.push({
        date: t.date,
        txnNo: t.transactionNumber,
        description: t.description,
        ref: t.reference || '',
        debit,
        credit,
        runningBalance: running,
      });
    });

    return { account: acc, entries, finalBalance: running };
  }, [accounts, selectedAccountId, periodTransactions]);

  // CSV Export dispatcher
  const handleExportCurrentReport = () => {
    switch (activeReport) {
      case 'income-expense':
        exportToCsv('Income_and_Expense_Report', [
          { Item: 'Total Contributions & Income', Amount: totalIncome },
          { Item: 'Total Charity Assistance Disbursed', Amount: totalExpense },
          { Item: 'Net Surplus / (Deficit)', Amount: netSurplus },
        ]);
        break;

      case 'trial-balance':
        exportToCsv('Trial_Balance_Report', trialBalanceRows);
        break;

      case 'category-charity':
        exportToCsv('Category_Charity_Assistance_Report', categorySummary);
        break;

      case 'cash-book':
        exportToCsv('Cash_Book_Ledger', cashBookRows);
        break;

      case 'member-contributions':
        exportToCsv(
          'Member_Contributions_Report',
          filteredMemberReceipts.map((r) => ({
            Date: r.receiptDate,
            'Receipt #': r.receiptNumber,
            'Member #': r.memberNumber,
            'Member Name': r.memberName,
            Account: r.contributionAccountName,
            Amount: r.amount,
            Method: r.paymentMethod,
            Reference: r.referenceNumber || '',
          }))
        );
        break;

      case 'account-ledger':
        exportToCsv(
          `Account_Ledger_${accountLedgerData.account?.code || 'Account'}`,
          accountLedgerData.entries.map((e) => ({
            Date: e.date,
            'TXN #': e.txnNo,
            Description: e.description,
            Reference: e.ref,
            Debit: e.debit,
            Credit: e.credit,
            'Running Balance': e.runningBalance,
          }))
        );
        break;

      case 'balance-summary':
        exportToCsv(
          'Cash_and_Bank_Balance_Summary',
          cashAccounts.map((c) => ({
            Account: c.name,
            Type: c.type,
            Bank: c.bankName || 'N/A',
            'Account / IBAN': c.accountNumber || 'N/A',
            'Opening Balance': c.openingBalance,
            'Current Balance': c.currentBalance,
          }))
        );
        break;
    }
  };

  return (
    <div id="financial-reports-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Financial & Accounting Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate Income & Expense statements, Trial Balance, Category Charity Analysis, Cash Books, and Account Ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="reports-export-btn"
            onClick={handleExportCurrentReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            id="reports-print-btn"
            onClick={() => triggerPrint('financial-reports-view', `Financial_Report_${activeReport}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Download PDF (A4)</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Report Selection Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4 no-print">
        {/* Report Selector Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-medium">
          {[
            { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
            { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark },
            { id: 'income-expense', label: 'Income & Expense', icon: TrendingUp },
            { id: 'member-ledger', label: 'Member Ledger', icon: Users },
            { id: 'charity-case-ledger', label: 'Charity Case Ledger', icon: HeartHandshake },
            { id: 'category-charity', label: 'Charity by Category', icon: HeartHandshake },
            { id: 'member-contributions', label: 'Member Contributions', icon: Users },
            { id: 'cash-book', label: 'Cash Book', icon: BookOpen },
            { id: 'account-ledger', label: 'Account Ledger', icon: FileBarChart2 },
            { id: 'balance-summary', label: 'Liquidity Summary', icon: Wallet },
          ].map((r) => {
            const Icon = r.icon;
            const active = activeReport === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id as ReportType)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Range Picker and dynamic filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-700">
          {activeReport !== 'balance-sheet' && activeReport !== 'member-ledger' && activeReport !== 'charity-case-ledger' && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">From Date:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500">To Date:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </>
          )}

          {activeReport === 'member-ledger' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Select Member:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNumber} - {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'charity-case-ledger' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Select Charity Case:</span>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.title} ({c.beneficiaryName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'member-contributions' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Filter Member:</span>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
              >
                <option value="all">All Registered Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberNumber} - {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeReport === 'account-ledger' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">Select GL Account:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Primary Report Display Area */}
      {activeReport === 'balance-sheet' && (
        <BalanceSheetReport
          onSelectMember={(m) => {
            setSelectedMemberId(m.id);
            setActiveReport('member-ledger');
          }}
          onSelectCase={(c) => {
            setSelectedCaseId(c.id);
            setActiveReport('charity-case-ledger');
          }}
        />
      )}

      {activeReport === 'member-ledger' && (
        <div className="space-y-4">
          {(() => {
            const currentMember = members.find((m) => m.id === selectedMemberId) || members[0];
            if (!currentMember) {
              return <div className="p-8 text-center text-slate-500">No members registered yet.</div>;
            }
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
                <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-600" />
                      <span>Individual Member Financial Ledger</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Member: <strong>{currentMember.fullName}</strong> ({currentMember.memberNumber}) • Complete audit of contributions, custodian cash transfers, and case payments.
                    </p>
                  </div>
                </div>
                <MemberLedgerTable
                  member={currentMember}
                  transactions={transactions}
                  receipts={receipts}
                  currency={settings.currency}
                />
              </div>
            );
          })()}
        </div>
      )}

      {activeReport === 'charity-case-ledger' && (
        <div className="space-y-4">
          {(() => {
            const currentCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
            if (!currentCase) {
              return <div className="p-8 text-center text-slate-500">No charity cases registered yet.</div>;
            }
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
                <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <HeartHandshake className="w-5 h-5 text-purple-600" />
                      <span>Dedicated Charity Case Ledger</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Case: <strong>{currentCase.caseNumber} - {currentCase.title}</strong> • Beneficiary: <strong>{currentCase.beneficiaryName}</strong>
                    </p>
                  </div>
                </div>
                <CaseLedgerTable
                  charityCase={currentCase}
                  transactions={transactions}
                  receipts={receipts}
                  currency={settings.currency}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Printable Report Document Container (for standard accounting statements) */}
      {activeReport !== 'balance-sheet' && activeReport !== 'member-ledger' && activeReport !== 'charity-case-ledger' && (
      <div
        id="printable-report-document"
        className="printable-area bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-10 space-y-6"
      >
        {/* Report Official Header */}
        <div className="border-b-2 border-slate-800 pb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <img
              src={settings.logoUrl || '/logo.svg'}
              alt="Logo"
              className="h-14 max-w-[180px] object-contain rounded-md"
            />
            <div>
              <h2 className="text-xl font-bold font-brand text-slate-900 tracking-wide">
                {settings.charityName}
              </h2>
              {settings.tagline && (
                <p className="text-[11px] text-emerald-800 font-medium">{settings.tagline}</p>
              )}
              <p className="text-xs text-slate-500">
                {settings.address}
                {settings.city && `, ${settings.city}`}
                {settings.country && `, ${settings.country}`}
                {' • '}Phone: {settings.phone}
              </p>
              <p className="text-xs text-slate-500">
                Email: {settings.email}
                {settings.registrationNumber && ` • Reg: ${settings.registrationNumber}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <h3 className="text-base font-bold text-slate-900 uppercase">
              {activeReport === 'income-expense' && 'Statement of Income & Expenses'}
              {activeReport === 'trial-balance' && 'Trial Balance Statement'}
              {activeReport === 'category-charity' && 'Charity Assistance by Category'}
              {activeReport === 'member-contributions' && 'Member Contribution Ledger'}
              {activeReport === 'cash-book' && 'Cash & Bank Book Register'}
              {activeReport === 'account-ledger' && 'General Ledger Account Activity'}
              {activeReport === 'balance-summary' && 'Liquidity & Cash Balance Summary'}
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Period: {fromDate} to {toDate}
            </p>
            <p className="text-[10px] text-slate-400">Currency: {settings.currency}</p>
          </div>
        </div>

        {/* 1. Statement of Income & Expenses */}
        {activeReport === 'income-expense' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Incomes Box */}
              <div className="border border-slate-200 rounded-xl p-5 bg-emerald-50/20">
                <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span>Incomes / Contributions</span>
                  <span>Amount</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {periodReceipts.length === 0 ? (
                    <p className="text-slate-400 italic">No income recorded in this date range.</p>
                  ) : (
                    periodReceipts.slice(0, 10).map((r) => (
                      <div key={r.id} className="flex justify-between text-slate-700">
                        <span className="truncate pr-2">
                          {r.receiptNumber} - {r.memberName} ({r.contributionAccountName})
                        </span>
                        <span className="font-semibold shrink-0">
                          {formatCurrency(r.amount, settings.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 pt-3 border-t-2 border-emerald-700 flex justify-between text-sm font-bold text-emerald-950">
                  <span>Total Incomes:</span>
                  <span>{formatCurrency(totalIncome, settings.currency)}</span>
                </div>
              </div>

              {/* Expenses Box */}
              <div className="border border-slate-200 rounded-xl p-5 bg-rose-50/20">
                <h4 className="text-sm font-bold text-rose-900 uppercase tracking-wider mb-3 flex items-center justify-between border-b border-rose-200 pb-2">
                  <span>Charity Assistance / Expenses</span>
                  <span>Amount</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {periodPayments.length === 0 ? (
                    <p className="text-slate-400 italic">No charity disbursements in this date range.</p>
                  ) : (
                    periodPayments.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex justify-between text-slate-700">
                        <span className="truncate pr-2">
                          {p.paymentNumber} - {p.payeeName} ({p.charityCategory})
                        </span>
                        <span className="font-semibold shrink-0">
                          {formatCurrency(p.amount, settings.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 pt-3 border-t-2 border-rose-700 flex justify-between text-sm font-bold text-rose-950">
                  <span>Total Expenses:</span>
                  <span>{formatCurrency(totalExpense, settings.currency)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Net Surplus / Deficit Card */}
            <div
              className={`p-6 rounded-xl border-2 flex items-center justify-between ${
                netSurplus >= 0
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                  : 'bg-rose-50 border-rose-500 text-rose-950'
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                  Net Surplus / (Deficit) for Period
                </span>
                <p className="text-xs text-slate-600 mt-1">
                  Calculated as Total Incomes minus Total Charity Assistance disbursements
                </p>
              </div>
              <div className="text-3xl font-display font-bold">
                {formatCurrency(netSurplus, settings.currency)}
              </div>
            </div>
          </div>
        )}

        {/* 2. Trial Balance Statement */}
        {activeReport === 'trial-balance' && (
          <TrialBalanceReport />
        )}

        {/* 3. Charity Assistance by Category */}
        {activeReport === 'category-charity' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Charity Category</th>
                  <th className="py-2.5 px-4 text-center">Cases / Vouchers Count</th>
                  <th className="py-2.5 px-4 text-right">Total Disbursed ({settings.currency})</th>
                  <th className="py-2.5 px-4 text-right">Share (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categorySummary.map((cat) => {
                  const pct = totalExpense > 0 ? ((cat.total / totalExpense) * 100).toFixed(1) : '0';
                  return (
                    <tr key={cat.category} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{cat.category}</td>
                      <td className="py-2.5 px-4 text-center font-medium text-slate-600">
                        {cat.count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                        {formatCurrency(cat.total, settings.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800">
                <tr>
                  <td className="py-3 px-4 uppercase text-slate-900">Total Charity Assistance</td>
                  <td className="py-3 px-4 text-center">{periodPayments.length}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700 text-sm">
                    {formatCurrency(totalExpense, settings.currency)}
                  </td>
                  <td className="py-3 px-4 text-right">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 4. Member Contributions Report */}
        {activeReport === 'member-contributions' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Purpose Account</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount ({settings.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMemberReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No contribution records found for this selection.
                    </td>
                  </tr>
                ) : (
                  filteredMemberReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono">{r.receiptDate}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                        <TransactionLink
                          transactionId={r.id}
                          transactionNumber={r.receiptNumber}
                          originBreadcrumb={[{ label: 'Reports', tab: 'reports' }]}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <MemberLink
                          memberId={r.memberId}
                          memberName={r.memberName}
                          memberNumber={r.memberNumber}
                          originBreadcrumb={[{ label: 'Reports', tab: 'reports' }]}
                          className="font-semibold text-slate-900 hover:text-emerald-700"
                        />{' '}
                        <span className="text-slate-400 font-mono">({r.memberNumber})</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{r.contributionAccountName}</td>
                      <td className="py-2 px-3 text-slate-600">{r.paymentMethod}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(r.amount, settings.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={5} className="py-3 px-3 uppercase text-slate-900">
                    Total Contributions Collected
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-800 font-mono text-sm font-bold">
                    {formatCurrency(
                      filteredMemberReceipts.reduce((sum, r) => sum + r.amount, 0),
                      settings.currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 5. Cash Book */}
        {activeReport === 'cash-book' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Doc #</th>
                  <th className="py-2.5 px-3">Particulars</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3 text-right text-emerald-800">Inflow (+)</th>
                  <th className="py-2.5 px-3 text-right text-rose-800">Outflow (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No cash transactions in selected period.
                    </td>
                  </tr>
                ) : (
                  cashBookRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono">{row.date}</td>
                      <td className="py-2 px-3 font-mono font-semibold">{row.docNo}</td>
                      <td className="py-2 px-3 text-slate-800 font-medium">{row.particulars}</td>
                      <td className="py-2 px-3 text-slate-500">{row.account}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        {row.inflow > 0 ? formatCurrency(row.inflow, settings.currency) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600">
                        {row.outflow > 0 ? formatCurrency(row.outflow, settings.currency) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={4} className="py-3 px-3 uppercase text-slate-900">
                    Net Cash Movement in Period
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-800 font-mono text-sm">
                    +{formatCurrency(totalIncome, settings.currency)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-800 font-mono text-sm">
                    -{formatCurrency(totalExpense, settings.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 6. Account Ledger */}
        {activeReport === 'account-ledger' && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase">Account:</span>
                <span className="font-bold text-slate-900 ml-2">
                  {accountLedgerData.account?.code} - {accountLedgerData.account?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase">Normal Balance:</span>
                <span className="font-bold text-slate-900 ml-2">
                  {accountLedgerData.account?.type === 'Asset' || accountLedgerData.account?.type === 'Expense'
                    ? 'Debit'
                    : 'Credit'}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">TXN #</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Ref</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accountLedgerData.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No journal entries posted to this account in the selected date range.
                    </td>
                  </tr>
                ) : (
                  accountLedgerData.entries.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono">{e.date}</td>
                      <td className="py-2 px-3 font-mono font-medium">{e.txnNo}</td>
                      <td className="py-2 px-3 text-slate-800">{e.description}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{e.ref || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {e.debit > 0 ? formatCurrency(e.debit, '') : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {e.credit > 0 ? formatCurrency(e.credit, '') : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(e.runningBalance, settings.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={6} className="py-3 px-3 uppercase text-slate-900">
                    Closing Ledger Balance
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm text-emerald-800 font-bold">
                    {formatCurrency(accountLedgerData.finalBalance, settings.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 7. Liquidity & Cash Balance Summary */}
        {activeReport === 'balance-summary' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Account Name</th>
                  <th className="py-2.5 px-4">Account Type</th>
                  <th className="py-2.5 px-4">Bank / Institution</th>
                  <th className="py-2.5 px-4 font-mono">Account / IBAN</th>
                  <th className="py-2.5 px-4 text-right">Current Available Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashAccounts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">{c.type.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-slate-600">{c.bankName || 'In-House'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{c.accountNumber || '-'}</td>
                    <td className="py-3 px-4 text-right font-bold font-display text-emerald-700 text-sm">
                      {formatCurrency(c.currentBalance, settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-800">
                <tr>
                  <td colSpan={4} className="py-3 px-4 uppercase text-slate-900">
                    Total Liquidity Funds Available
                  </td>
                  <td className="py-3 px-4 text-right font-display text-base font-bold text-emerald-800">
                    {formatCurrency(
                      cashAccounts.reduce((sum, c) => sum + (c.currentBalance || 0), 0),
                      settings.currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Report Footer / Signature lines */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">{settings.charityName}</p>
            <p className="text-[11px] text-slate-400">Official Financial Audit Report • Generated on {new Date().toLocaleString()}</p>
          </div>

          <div className="flex items-center gap-6">
            {settings.stampUrl ? (
              <img
                src={settings.stampUrl}
                alt="Official Stamp"
                className="w-16 h-16 object-contain rounded-full border border-slate-200 p-0.5 bg-white shadow-2xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border border-dashed border-emerald-700/60 bg-emerald-50/30 flex flex-col items-center justify-center p-1 text-center">
                <span className="text-[6.5px] uppercase font-bold text-emerald-900 tracking-wider">Official Stamp</span>
                <span className="text-[5.5px] text-emerald-700 font-medium">{settings.charityName.slice(0, 14)}</span>
              </div>
            )}

            <div className="text-right">
              <div className="min-h-8 flex items-end justify-end">
                {settings.signatureUrl ? (
                  <img
                    src={settings.signatureUrl}
                    alt="Authorized Signature"
                    className="max-h-8 max-w-[120px] object-contain ml-auto"
                  />
                ) : (
                  <div className="h-5" />
                )}
              </div>
              <div className="w-40 border-b border-slate-400 mb-1 ml-auto" />
              <p className="text-slate-800 font-bold text-xs">{settings.signatoryName || 'Managing Trustee / Treasurer'}</p>
              <p className="text-[10px] text-slate-500">{settings.signatoryDesignation || 'Authorized Auditor / Treasurer'}</p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
