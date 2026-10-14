import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileDown,
  Search,
  ExternalLink,
  Receipt,
  Landmark,
  Layers,
  ArrowRightLeft,
  Calendar,
  Wallet,
} from 'lucide-react';
import { AccountLedgerEntry, CurrencyViewMode } from '../../services/financialReportingService';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { useNavigation } from '../../context/NavigationContext';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

interface AccountLedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accountCode: string;
  accountName: string;
  category: string;
  normalBalance: 'Debit' | 'Credit';
  openingBalance: number;
  closingBalance: number;
  entries: AccountLedgerEntry[];
  currencyView: CurrencyViewMode;
  fromDate?: string;
  toDate?: string;
  baseCurrency?: string;
}

export const AccountLedgerDrawer: React.FC<AccountLedgerDrawerProps> = ({
  isOpen,
  onClose,
  accountCode,
  accountName,
  category,
  normalBalance,
  openingBalance,
  closingBalance,
  entries,
  currencyView,
  fromDate,
  toDate,
  baseCurrency = 'AED',
}) => {
  const { openTransactionDetails } = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        (e.entryNumber && e.entryNumber.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.reference && e.reference.toLowerCase().includes(q)) ||
        (e.memberName && e.memberName.toLowerCase().includes(q)) ||
        (e.caseTitle && e.caseTitle.toLowerCase().includes(q)) ||
        (e.counterAccountName && e.counterAccountName.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  const totalPeriodDebit = useMemo(
    () => entries.reduce((sum, e) => sum + e.baseCurrencyDebit, 0),
    [entries]
  );
  const totalPeriodCredit = useMemo(
    () => entries.reduce((sum, e) => sum + e.baseCurrencyCredit, 0),
    [entries]
  );

  const handleExportCsv = () => {
    const rows = entries.map((e) => ({
      Date: e.date,
      'Voucher / Txn #': e.entryNumber,
      Type: e.voucherType,
      Description: e.description,
      Reference: e.reference || '',
      'Counter Account': e.counterAccountName,
      'Member / Party': e.memberName || '',
      'Charity Case': e.caseTitle || '',
      Currency: e.currency,
      'Debit (Native)': e.debit,
      'Credit (Native)': e.credit,
      'Debit (Base AED)': e.baseCurrencyDebit,
      'Credit (Base AED)': e.baseCurrencyCredit,
      'Running Balance': e.runningBalance,
    }));

    exportToCsv(`GL_Ledger_${accountCode}_${accountName.replace(/\s+/g, '_')}`, rows);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        id="account-ledger-drawer"
        className="printable-area w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 ease-out relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <DocumentLogoWatermark size="lg" />
        {/* Top Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between shrink-0 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                GL #{accountCode}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/80 text-slate-300">
                {category.toUpperCase()} • Normal Side: {normalBalance}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{accountName}</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Statement Period: {fromDate || 'Inception'} &rarr; {toDate || 'Present'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              title="Export Ledger CSV"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => triggerPrint('account-ledger-drawer', `Account_Ledger_${accountCode}`)}
              title="Download Ledger PDF"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Account Financial Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Opening Balance
            </span>
            <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
              {formatCurrency(openingBalance, baseCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">As of start date</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
              <span>Period Debits</span>
            </span>
            <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
              {formatCurrency(totalPeriodDebit, baseCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{entries.length} movements</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-rose-600" />
              <span>Period Credits</span>
            </span>
            <div className="text-base font-bold font-mono text-rose-700 mt-0.5">
              {formatCurrency(totalPeriodCredit, baseCurrency)}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Inflows / Outflows</span>
          </div>

          <div className="p-3 bg-emerald-50/80 rounded-lg border border-emerald-200 shadow-xs">
            <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wider block">
              Closing Balance
            </span>
            <div className="text-base font-bold font-mono text-emerald-900 mt-0.5">
              {formatCurrency(closingBalance, baseCurrency)}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium font-sans">
              Normal: {normalBalance}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search entries by voucher #, description, member, counterparty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 font-medium">
            Showing {filteredEntries.length} of {entries.length} entries
          </span>
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-y-auto min-h-0 printable-content">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-slate-600 text-sm">No journal entries recorded</p>
              <p className="text-xs text-slate-400 mt-1">
                There are no transaction records or journal lines posting to GL #{accountCode} within this date range.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-600 font-semibold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 backdrop-blur-xs">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Particulars / Counterparty</th>
                  <th className="py-2.5 px-3 text-right">Debit ({baseCurrency})</th>
                  <th className="py-2.5 px-3 text-right">Credit ({baseCurrency})</th>
                  <th className="py-2.5 px-3 text-right">Balance ({baseCurrency})</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Opening row */}
                <tr className="bg-slate-50/60 font-semibold text-slate-600 italic">
                  <td className="py-2 px-3">{fromDate || 'Start'}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-500">OPENING</td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-sans">
                      Balance B/F
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans">Opening Balance Brought Forward</td>
                  <td className="py-2 px-3 text-right">
                    {openingBalance > 0 && normalBalance === 'Debit' ? formatCurrency(openingBalance, baseCurrency) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {openingBalance > 0 && normalBalance === 'Credit' ? formatCurrency(openingBalance, baseCurrency) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-800">
                    {formatCurrency(openingBalance, baseCurrency)}
                  </td>
                  <td className="py-2 px-3 text-center">-</td>
                </tr>

                {filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{e.date}</td>
                    <td className="py-2 px-3 font-bold text-emerald-800 whitespace-nowrap">
                      {e.entryNumber}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          e.voucherType === 'Receipt'
                            ? 'bg-emerald-100 text-emerald-800'
                            : e.voucherType === 'Payment'
                            ? 'bg-rose-100 text-rose-800'
                            : e.voucherType === 'Transfer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {e.voucherType}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans max-w-xs">
                      <div className="font-semibold text-slate-800 truncate" title={e.description}>
                        {e.description}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <span>Offset: {e.counterAccountName}</span>
                        {e.memberName && <span className="font-medium text-slate-700">• {e.memberName}</span>}
                        {e.caseTitle && <span className="text-emerald-700 font-medium">• {e.caseTitle}</span>}
                      </div>
                      {e.currency && e.currency !== baseCurrency && (
                        <div className="text-[10px] text-amber-700 font-mono">
                          Native: {formatCurrency(e.debit || e.credit, e.currency)} @ {e.exchangeRate || 0.04401}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {e.baseCurrencyDebit > 0 ? formatCurrency(e.baseCurrencyDebit, baseCurrency) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-700 whitespace-nowrap">
                      {e.baseCurrencyCredit > 0 ? formatCurrency(e.baseCurrencyCredit, baseCurrency) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(e.runningBalance, baseCurrency)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => openTransactionDetails(e.rawTransactionId || e.rawReceiptId || e.rawPaymentId || e.entryNumber)}
                        title="View Detailed Voucher"
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-semibold text-xs border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right font-sans font-bold text-slate-800">
                    Period Activity Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                    {formatCurrency(totalPeriodDebit, baseCurrency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-rose-800">
                    {formatCurrency(totalPeriodCredit, baseCurrency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(closingBalance, baseCurrency)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Official General Ledger Audit Trail • GL Account <strong>{accountCode}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );
};
