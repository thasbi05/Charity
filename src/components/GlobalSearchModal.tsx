import React, { useState, useEffect } from 'react';
import { Search, X, Users, ReceiptText, HeartHandshake, ArrowLeftRight, BookOpen } from 'lucide-react';
import { useCharity } from '../context/CharityContext';
import { NavTab } from './Sidebar';
import { formatCurrency } from '../utils/numbering';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab, recordId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { members, receipts, payments, transactions, accounts, settings } = useCharity();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.trim().toLowerCase();

  // Search members
  const matchedMembers = cleanQuery
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(cleanQuery) ||
          m.memberNumber.toLowerCase().includes(cleanQuery) ||
          m.mobileNumber.toLowerCase().includes(cleanQuery)
      ).slice(0, 5)
    : [];

  // Search receipts
  const matchedReceipts = cleanQuery
    ? receipts.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(cleanQuery) ||
          r.memberName.toLowerCase().includes(cleanQuery) ||
          r.memberNumber.toLowerCase().includes(cleanQuery) ||
          (r.referenceNumber && r.referenceNumber.toLowerCase().includes(cleanQuery))
      ).slice(0, 5)
    : [];

  // Search charity payments
  const matchedPayments = cleanQuery
    ? payments.filter(
        (p) =>
          p.paymentNumber.toLowerCase().includes(cleanQuery) ||
          p.payeeName.toLowerCase().includes(cleanQuery) ||
          p.charityCategory.toLowerCase().includes(cleanQuery) ||
          p.mobileNumber.toLowerCase().includes(cleanQuery)
      ).slice(0, 5)
    : [];

  // Search transactions
  const matchedTxns = cleanQuery
    ? transactions.filter(
        (t) =>
          t.transactionNumber.toLowerCase().includes(cleanQuery) ||
          t.description.toLowerCase().includes(cleanQuery) ||
          (t.reference && t.reference.toLowerCase().includes(cleanQuery))
      ).slice(0, 5)
    : [];

  // Search accounts
  const matchedAccounts = cleanQuery
    ? accounts.filter(
        (a) =>
          a.name.toLowerCase().includes(cleanQuery) ||
          a.code.toLowerCase().includes(cleanQuery)
      ).slice(0, 5)
    : [];

  const totalMatches =
    matchedMembers.length +
    matchedReceipts.length +
    matchedPayments.length +
    matchedTxns.length +
    matchedAccounts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="global-search-container"
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            type="text"
            id="global-search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type member name, number, receipt #, payee, or account code..."
            className="w-full bg-transparent text-slate-800 text-sm focus:outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!cleanQuery ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>Type keywords to search across members, receipts, payments, and accounts.</p>
            </div>
          ) : totalMatches === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Members */}
              {matchedMembers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Members ({matchedMembers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {matchedMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onNavigate('members', m.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700">
                            {m.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {m.memberNumber} • {m.mobileNumber}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {formatCurrency(m.totalContributed, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Receipts */}
              {matchedReceipts.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ReceiptText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Receipts / Contributions ({matchedReceipts.length})</span>
                  </div>
                  <div className="space-y-1">
                    {matchedReceipts.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          onNavigate('receipts', r.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                            {r.receiptNumber} - {r.memberName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {r.receiptDate} • {r.paymentMethod}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600">
                          +{formatCurrency(r.amount, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Payments */}
              {matchedPayments.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                    <span>Charity Payments ({matchedPayments.length})</span>
                  </div>
                  <div className="space-y-1">
                    {matchedPayments.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onNavigate('payments', p.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-rose-700">
                            {p.paymentNumber} - {p.payeeName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.charityCategory} • {p.paymentDate}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-rose-600">
                          -{formatCurrency(p.amount, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions */}
              {matchedTxns.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                    <span>Journal Transactions ({matchedTxns.length})</span>
                  </div>
                  <div className="space-y-1">
                    {matchedTxns.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onNavigate('transactions', t.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-purple-700">
                            {t.transactionNumber} - {t.description}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t.date} • Dr: {t.debitAccountCode} / Cr: {t.creditAccountCode}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-800">
                          {formatCurrency(t.amount, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Accounts */}
              {matchedAccounts.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chart of Accounts ({matchedAccounts.length})</span>
                  </div>
                  <div className="space-y-1">
                    {matchedAccounts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onNavigate('chart-of-accounts', a.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 group-hover:text-amber-700">
                            {a.code} - {a.name}
                          </p>
                          <p className="text-xs text-slate-500">{a.type}</p>
                        </div>
                        <span className="text-xs font-medium text-slate-600">
                          {formatCurrency(a.balance, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
