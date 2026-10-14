import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Search,
  Download,
  FileDown,
  Ban,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  ShieldAlert,
  Coins,
  Plus,
  User,
  HeartHandshake,
  Pencil,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { convertToBaseCurrency, getHistoricalBaseAmount } from '../../services/financialLedgerService';
import { TransferHandoverModal } from './TransferHandoverModal';
import { MemberLink, CaseLink, TransactionLink } from '../Common/ClickableEntity';

export const TransactionsLedgerView: React.FC = () => {
  const { transactions, settings, voidTransaction, reverseTransaction } = useCharity();
  const { user } = useAuth();
  const { openTransactionEditor } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'AED' | 'INR'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'voided' | 'reversal'>('all');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Void modal state
  const [voidTxn, setVoidTxn] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Reverse modal state
  const [reverseTxn, setReverseTxn] = useState<Transaction | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesCurrency = currencyFilter === 'all' || (t.currency || settings.currency) === currencyFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (t.transactionNumber && t.transactionNumber.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.debitAccountName && t.debitAccountName.toLowerCase().includes(q)) ||
        (t.creditAccountName && t.creditAccountName.toLowerCase().includes(q)) ||
        (t.debitAccountCode && t.debitAccountCode.toLowerCase().includes(q)) ||
        (t.creditAccountCode && t.creditAccountCode.toLowerCase().includes(q)) ||
        (t.currency && t.currency.toLowerCase().includes(q)) ||
        (t.debitMemberName && t.debitMemberName.toLowerCase().includes(q)) ||
        (t.creditMemberName && t.creditMemberName.toLowerCase().includes(q)) ||
        (t.linkedCaseTitle && t.linkedCaseTitle.toLowerCase().includes(q)) ||
        (t.linkedCaseNumber && t.linkedCaseNumber.toLowerCase().includes(q)) ||
        (t.handoverFundType && t.handoverFundType.toLowerCase().includes(q));

      return matchesType && matchesStatus && matchesCurrency && matchesSearch;
    });
  }, [transactions, typeFilter, statusFilter, currencyFilter, searchQuery, settings.currency]);

  // Financial verification: Sum of all valid debits and credits in base currency (AED) and multi-currency
  const { totalDebitsBase, totalCreditsBase, debitsByCurrency, creditsByCurrency, multiCurrencySummary } = useMemo(() => {
    let debitsBase = 0;
    let creditsBase = 0;
    const debByCur: Record<string, number> = {};
    const credByCur: Record<string, number> = {};

    transactions
      .filter((t) => t.status === 'valid')
      .forEach((t) => {
        const cur = (t.currency || settings.currency || 'AED').toUpperCase();
        const amt = t.amount || 0;
        const baseAmt = getHistoricalBaseAmount(t, settings.currency || 'AED');

        debitsBase += baseAmt;
        creditsBase += baseAmt;

        debByCur[cur] = Number(((debByCur[cur] || 0) + amt).toFixed(2));
        credByCur[cur] = Number(((credByCur[cur] || 0) + amt).toFixed(2));
      });

    // Multi-currency summary: e.g. "AED 20.00 | ₹ 4,000.00"
    const curParts = Object.entries(debByCur)
      .filter(([_, amt]) => amt > 0)
      .map(([cur, amt]) => formatCurrency(amt, cur));
    const summary = curParts.length > 0 ? curParts.join(' | ') : formatCurrency(0, settings.currency || 'AED');

    return {
      totalDebitsBase: Number(debitsBase.toFixed(2)),
      totalCreditsBase: Number(creditsBase.toFixed(2)),
      debitsByCurrency: debByCur,
      creditsByCurrency: credByCur,
      multiCurrencySummary: summary,
    };
  }, [transactions, settings.currency]);

  const isBalanced = Math.abs(totalDebitsBase - totalCreditsBase) < 0.01;

  const handleConfirmVoid = async () => {
    if (!voidTxn || !voidReason.trim()) return;
    setIsVoiding(true);
    try {
      await voidTransaction(voidTxn.id, voidReason.trim());
      setVoidTxn(null);
      setVoidReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to void transaction.');
    } finally {
      setIsVoiding(false);
    }
  };

  const handleConfirmReverse = async () => {
    if (!reverseTxn || !reverseReason.trim()) return;
    setIsReversing(true);
    try {
      await reverseTransaction(reverseTxn.id, reverseReason.trim());
      setReverseTxn(null);
      setReverseReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to reverse transaction.');
    } finally {
      setIsReversing(false);
    }
  };

  const handleExportCsv = () => {
    const data = filteredTransactions.map((t) => ({
      'Transaction Number': t.transactionNumber,
      Date: t.date,
      Type: t.type,
      Description: t.description,
      Reference: t.reference || '',
      'Debit Account Code': t.debitAccountCode,
      'Debit Account': t.debitAccountName,
      'Credit Account Code': t.creditAccountCode,
      'Credit Account': t.creditAccountName,
      Amount: t.amount,
      Status: t.status,
      'Void / Reversal Reason': t.voidReason || '',
      'Created By': t.createdBy,
    }));
    exportToCsv('Transactions_Ledger', data);
  };

  return (
    <div id="transactions-ledger-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Transactions & General Journal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete double-entry accounting ledger maintaining balanced journal entries and unalterable audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-new-handover-transfer"
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Member Handover / Transfer</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => triggerPrint('transactions-ledger-view', 'Transactions_Ledger')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Double-Entry Balancing Verification Banner (Section 9) */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isBalanced
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}
      >
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-sm">
              {isBalanced
                ? 'Accounting Integrity Verified: Double-Entry Books Balanced'
                : 'Warning: Journal Discrepancy Detected'}
            </h3>
            <p className="text-xs opacity-80">
              Every financial transaction enforces matching debits and credits. Historical records are immutable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono font-semibold">
          <div className="text-right sm:text-left">
            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Total Debits</span>
            <span className="text-emerald-800 text-sm font-bold block">
              {formatCurrency(totalDebitsBase, settings.currency || 'AED')}
            </span>
            <span className="text-[11px] font-medium text-slate-600 block mt-0.5">
              {multiCurrencySummary}
            </span>
          </div>
          <div className="text-right sm:text-left">
            <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Total Credits</span>
            <span className="text-emerald-800 text-sm font-bold block">
              {formatCurrency(totalCreditsBase, settings.currency || 'AED')}
            </span>
            <span className="text-[11px] font-medium text-slate-600 block mt-0.5">
              {multiCurrencySummary}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search TXN #, member, description, account..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          {/* Currency Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Currency:</span>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Currencies</option>
              <option value="AED">AED (د.إ)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="Contribution">Contribution</option>
              <option value="Charity Payment">Charity Payment</option>
              <option value="Member Handover">Member Handover</option>
              <option value="Transfer">Transfer</option>
              <option value="Expense">Expense</option>
              <option value="Reversal">Reversal</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="valid">Valid</option>
              <option value="voided">Voided</option>
              <option value="reversal">Reversed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">TXN #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description & Ref</th>
                <th className="py-3 px-4">Debit Account (Dr)</th>
                <th className="py-3 px-4">Credit Account (Cr)</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No transactions found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      t.status === 'voided'
                        ? 'bg-rose-50/20 opacity-70'
                        : t.status === 'reversal'
                        ? 'bg-amber-50/20'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      <TransactionLink
                        transactionId={t.id}
                        transactionNumber={t.transactionNumber}
                        originBreadcrumb={[{ label: 'Transactions', tab: 'transactions' }]}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{t.date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.type === 'Contribution'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.type === 'Charity Payment'
                            ? 'bg-rose-100 text-rose-800'
                            : t.type === 'Member Handover'
                            ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                            : t.type === 'Transfer'
                            ? 'bg-blue-100 text-blue-800'
                            : t.type === 'Reversal'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-900 truncate">{t.description}</div>
                      {t.handoverFundType && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {t.handoverFundType === 'CHARITY_CASE' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              <HeartHandshake className="w-3 h-3 text-amber-700" />
                              {t.linkedCaseId ? (
                                <CaseLink
                                  caseId={t.linkedCaseId}
                                  caseName={t.linkedCaseTitle || t.linkedCaseNumber}
                                  originBreadcrumb={[{ label: 'Transactions', tab: 'transactions' }]}
                                  className="text-amber-900 hover:underline"
                                />
                              ) : (
                                <span>
                                  {t.linkedCaseNumber ? `${t.linkedCaseNumber} • ` : ''}
                                  {t.linkedCaseTitle || 'Charity Case'}
                                </span>
                              )}
                            </span>
                          ) : t.handoverFundType === 'MONTHLY_CONTRIBUTION' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                              <Calendar className="w-3 h-3 text-emerald-700" />
                              <span>Members' Monthly Contribution</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-900 border border-teal-300">
                              <Coins className="w-3 h-3 text-teal-700" />
                              <span>General Charity</span>
                            </span>
                          )}
                        </div>
                      )}
                      {t.reference && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {t.reference}
                        </div>
                      )}
                      {t.voidReason && (
                        <div className="text-[10px] text-rose-600 italic mt-0.5">
                          Note: {t.voidReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.debitEntityType === 'member' && (t.debitMemberId || t.debitMemberName) ? (
                        <div className="mb-0.5">
                          <MemberLink
                            memberId={t.debitMemberId || ''}
                            memberName={t.debitMemberName}
                            memberNumber={t.debitMemberNumber}
                            originBreadcrumb={[{ label: 'Transactions', tab: 'transactions' }]}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          />
                        </div>
                      ) : null}
                      <div className="text-slate-700 font-medium">
                        <span className="font-mono text-slate-400 mr-1 text-[11px]">
                          {t.debitAccountCode}
                        </span>
                        {t.debitAccountName}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {t.creditEntityType === 'member' && (t.creditMemberId || t.creditMemberName) ? (
                        <div className="mb-0.5">
                          <MemberLink
                            memberId={t.creditMemberId || ''}
                            memberName={t.creditMemberName}
                            memberNumber={t.creditMemberNumber}
                            originBreadcrumb={[{ label: 'Transactions', tab: 'transactions' }]}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                          />
                        </div>
                      ) : null}
                      <div className="text-slate-700 font-medium">
                        <span className="font-mono text-slate-400 mr-1 text-[11px]">
                          {t.creditAccountCode}
                        </span>
                        {t.creditAccountName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      <div>
                        {formatCurrency(t.amount, t.currency || settings.currency)}
                      </div>
                      {t.currency && t.currency !== settings.currency && (
                        <div className="text-[10px] font-normal text-slate-500 font-mono">
                          ≈ {formatCurrency(t.baseAmount || t.baseCurrencyAmount || t.amount, t.baseCurrency || settings.currency)}
                          {t.exchangeRateSnapshot ? ` (Rate: ${t.exchangeRateSnapshot.rate})` : (t.exchangeRate ? ` (Rate: ${t.exchangeRate})` : '')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          t.status === 'valid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'reversal'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 line-through'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openTransactionEditor(t.id)}
                          title={`Edit Transaction [${t.transactionNumber}]`}
                          className="p-1.5 rounded hover:bg-cyan-50 text-slate-500 hover:text-cyan-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {user?.role === 'administrator' && t.status === 'valid' && (
                          <>
                            <button
                              onClick={() => {
                                setReverseTxn(t);
                                setReverseReason('');
                              }}
                              title="Create Reversing Entry (Swap Dr/Cr)"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-purple-700 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setVoidTxn(t);
                                setVoidReason('');
                              }}
                              title="Void Transaction (Admin only)"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Modal */}
      {voidTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Void Transaction {voidTxn.transactionNumber}?
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Financial records are not destroyed. This transaction will be marked as Voided with an audit log.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for audit record..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidTxn(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isVoiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {reverseTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <RotateCcw className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Reverse Transaction {reverseTxn.transactionNumber}?
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              An automatic compensating journal entry will be posted swapping Debit (
              {reverseTxn.creditAccountName}) and Credit ({reverseTxn.debitAccountName}) for{' '}
              {formatCurrency(reverseTxn.amount, settings.currency)}.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Reversal <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Reason for reversal..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReverseTxn(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReversing || !reverseReason.trim()}
                onClick={handleConfirmReverse}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isReversing ? 'Reversing...' : 'Post Reversal Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Cash Transfer / Member Handover Modal */}
      <TransferHandoverModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
};
