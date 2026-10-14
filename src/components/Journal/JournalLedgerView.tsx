import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  ArrowRightLeft,
  Calendar,
  ShieldCheck,
  Ban,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Pencil,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useNavigation } from '../../context/NavigationContext';
import { JournalEntry, FinancialTransactionClassification } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { convertToBaseCurrency, getHistoricalBaseAmount } from '../../services/financialLedgerService';
import { DiagnosticBanner } from '../Financial/DiagnosticBanner';

export const JournalLedgerView: React.FC = () => {
  const { journalEntries, settings, voidRecord, transactions } = useCharity();
  const { openTransactionEditor } = useNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [expandedJournalIds, setExpandedJournalIds] = useState<Set<string>>(new Set());

  // Void modal state
  const [voidingJournal, setVoidingJournal] = useState<JournalEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedJournalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedJournalIds(new Set(journalEntries.map((j) => j.id)));
  };

  const collapseAll = () => {
    setExpandedJournalIds(new Set());
  };

  // KPI Calculations
  const stats = useMemo(() => {
    let totalDebitsBase = 0;
    let totalCreditsBase = 0;
    const debByCur: Record<string, number> = {};
    const credByCur: Record<string, number> = {};
    let postedCount = 0;
    let voidedCount = 0;

    journalEntries.forEach((j) => {
      if (j.status !== 'VOIDED') {
        let entryBaseDebit = 0;
        let entryBaseCredit = 0;
        if (j.lines && j.lines.length > 0) {
          j.lines.forEach((l) => {
            const cur = (l.currency || settings.currency || 'AED').toUpperCase();
            const bDr = l.baseCurrencyDebit != null
              ? l.baseCurrencyDebit
              : getHistoricalBaseAmount({ amount: l.debit, currency: l.currency, baseAmount: l.baseAmount, exchangeRate: l.exchangeRate, exchangeRateSnapshot: l.exchangeRateSnapshot }, settings.currency || 'AED');
            const bCr = l.baseCurrencyCredit != null
              ? l.baseCurrencyCredit
              : getHistoricalBaseAmount({ amount: l.credit, currency: l.currency, baseAmount: l.baseAmount, exchangeRate: l.exchangeRate, exchangeRateSnapshot: l.exchangeRateSnapshot }, settings.currency || 'AED');
            entryBaseDebit += bDr;
            entryBaseCredit += bCr;
            debByCur[cur] = Number(((debByCur[cur] || 0) + (l.debit || 0)).toFixed(2));
            credByCur[cur] = Number(((credByCur[cur] || 0) + (l.credit || 0)).toFixed(2));
          });
        } else {
          entryBaseDebit = j.totalDebit || 0;
          entryBaseCredit = j.totalCredit || 0;
        }
        totalDebitsBase += entryBaseDebit;
        totalCreditsBase += entryBaseCredit;
        postedCount++;
      } else {
        voidedCount++;
      }
    });

    const isSystemBalanced = Math.abs(totalDebitsBase - totalCreditsBase) < 0.01;
    const curParts = Object.entries(debByCur)
      .filter(([_, amt]) => amt > 0)
      .map(([cur, amt]) => formatCurrency(amt, cur));
    const multiCurrencySummary = curParts.length > 0 ? curParts.join(' | ') : formatCurrency(0, settings.currency || 'AED');

    return {
      totalDebits: Number(totalDebitsBase.toFixed(2)),
      totalCredits: Number(totalCreditsBase.toFixed(2)),
      multiCurrencySummary,
      postedCount,
      voidedCount,
      isSystemBalanced,
      variance: totalDebitsBase - totalCreditsBase,
    };
  }, [journalEntries, settings.currency]);

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    return journalEntries.filter((j) => {
      const term = searchTerm.toLowerCase();
      const num = (j.journalNumber || j.entryNumber || '').toLowerCase();
      const desc = (j.description || '').toLowerCase();
      const ref = (j.referenceNumber || j.sourceRecordNumber || '').toLowerCase();
      const matchesSearch =
        num.includes(term) ||
        desc.includes(term) ||
        ref.includes(term);

      const matchesClass = classFilter === 'ALL' || j.classification === classFilter;
      return matchesSearch && matchesClass;
    });
  }, [journalEntries, searchTerm, classFilter]);

  const handleConfirmVoid = async () => {
    if (!voidingJournal) return;
    if (!voidReason.trim()) {
      setVoidError('Please provide a mandatory justification for voiding this ledger entry.');
      return;
    }

    try {
      setIsVoiding(true);
      setVoidError(null);

      if (voidingJournal.sourceDocumentType === 'Receipt' && voidingJournal.sourceDocumentId) {
        await voidRecord('Receipt', voidingJournal.sourceDocumentId, voidReason);
      } else if (voidingJournal.sourceDocumentType === 'Payment' && voidingJournal.sourceDocumentId) {
        await voidRecord('Payment', voidingJournal.sourceDocumentId, voidReason);
      } else {
        throw new Error('This journal entry does not have an automated source document to reverse.');
      }

      setVoidingJournal(null);
      setVoidReason('');
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void journal entry.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-7 w-7 text-emerald-600" />
            General Ledger & Journal Entries
          </h1>
          <p className="text-sm text-slate-500">
            Strict double-entry bookkeeping ledger: debits strictly equal credits on every posted entry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Expand All Lines
          </button>
          <button
            onClick={collapseAll}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Accounting System Invariant Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Posted Journal Entries
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {stats.postedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stats.voidedCount} voided entries archived
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Ledger Debits
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {formatCurrency(stats.totalDebits, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-slate-600 font-medium font-mono">
            {stats.multiCurrencySummary}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Ledger Credits
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono">
            {formatCurrency(stats.totalCredits, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-slate-600 font-medium font-mono">
            {stats.multiCurrencySummary}
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-xs ${
            stats.isSystemBalanced
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">
              Double-Entry Invariant
            </span>
            {stats.isSystemBalanced ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            )}
          </div>
          <div className="mt-2 text-xl font-extrabold">
            {stats.isSystemBalanced ? '100% BALANCED' : 'OUT OF BALANCE'}
          </div>
          <div className="mt-1 text-xs font-mono">
            {stats.isSystemBalanced ? 'Debits - Credits = 0.00' : `Variance: ${stats.variance}`}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by journal #, reference #, or narrative description..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
        >
          <option value="ALL">All Financial Classifications</option>
          <option value="MONTHLY_CONTRIBUTION">Monthly Contributions</option>
          <option value="SPECIAL_CONTRIBUTION">Special Designated Contributions</option>
          <option value="CHARITY_ASSISTANCE">Charity Assistance Payouts</option>
          <option value="ADMINISTRATIVE_EXPENSE">Administrative Operating Expenses</option>
          <option value="REVERSAL">Void / Reversals</option>
        </select>
      </div>

      {/* Journal Entries Accordion Table */}
      <div className="space-y-3">
        {filteredJournals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No journal entries found</h3>
            <p className="mt-1 text-xs text-slate-500">
              Transactions posted via contributions or disbursements will automatically appear here with full double-entry audit lines.
            </p>
          </div>
        ) : (
          filteredJournals.map((j) => {
            const isExpanded = expandedJournalIds.has(j.id);
            const isVoided = j.status === 'VOIDED';

            return (
              <div
                key={j.id}
                className={`rounded-2xl border bg-white shadow-xs overflow-hidden transition-all ${
                  isVoided
                    ? 'border-rose-200 bg-rose-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Journal Header Row */}
                <div
                  onClick={() => toggleExpand(j.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer gap-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {j.journalNumber}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {j.date}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            j.classification === 'MONTHLY_CONTRIBUTION'
                              ? 'bg-emerald-100 text-emerald-800'
                              : j.classification === 'SPECIAL_CONTRIBUTION'
                              ? 'bg-blue-100 text-blue-800'
                              : j.classification === 'CHARITY_ASSISTANCE'
                              ? 'bg-indigo-100 text-indigo-800'
                              : j.classification === 'ADMINISTRATIVE_EXPENSE'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {j.classification}
                        </span>
                        {isVoided && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            VOIDED
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs font-medium text-slate-800 line-clamp-1">
                        {j.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {formatCurrency(j.totalDebit, settings.currency)}
                      </div>
                      <div className="text-[10px] text-emerald-700 flex items-center justify-end gap-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Dr = Cr Balanced
                      </div>
                    </div>

                    {!isVoided && (j.sourceRecordNumber || j.sourceRecordId || j.sourceDocumentId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openTransactionEditor(j.sourceRecordNumber || j.sourceRecordId || j.sourceDocumentId || j.id);
                        }}
                        title="Edit Original Transaction"
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    )}

                    {!isVoided && j.sourceDocumentId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVoidingJournal(j);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Ban className="h-3 w-3" />
                        Void
                      </button>
                    )}
                  </div>
                </div>

                {/* Journal Lines Breakdown (Debit & Credit Rows) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-3 py-2 text-left">Account Code</th>
                            <th className="px-3 py-2 text-left">Account Name</th>
                            <th className="px-3 py-2 text-left">Line Memo</th>
                            <th className="px-3 py-2 text-right">Debit ({settings.currency})</th>
                            <th className="px-3 py-2 text-right">Credit ({settings.currency})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {j.lines?.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono font-medium text-slate-600">
                                {l.accountCode}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {l.accountName}
                              </td>
                              <td className="px-3 py-2 text-slate-500 italic">
                                {l.memo || '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                {l.debit > 0 ? formatCurrency(l.debit, settings.currency) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                {l.credit > 0 ? formatCurrency(l.credit, settings.currency) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100/80 font-bold border-t border-slate-200 text-slate-900">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-left">
                              Balanced Journal Verification
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700">
                              {formatCurrency(j.totalDebit, settings.currency)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700">
                              {formatCurrency(j.totalCredit, settings.currency)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Posted by: {j.createdBy || 'System'}</span>
                      {j.referenceNumber && <span>Reference: {j.referenceNumber}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mandatory Reason Void Modal */}
      {voidingJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-base mb-2">
              <ShieldAlert className="h-5 w-5" />
              Void Audited Journal Entry
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Financial ledger entries are <strong>immutable</strong>. Voiding entry{' '}
              <span className="font-mono font-bold text-slate-900">{voidingJournal.journalNumber}</span> will
              automatically post an inverted reversal journal entry ($Credit \leftrightarrow Debit$) and create a permanent audit record.
            </p>

            {voidError && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {voidError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate receipt recorded by mistake / Cheque bounced / Data entry error"
                required
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setVoidingJournal(null);
                  setVoidReason('');
                  setVoidError(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {isVoiding ? 'Voiding...' : 'Confirm Ledger Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
