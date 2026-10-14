import React, { useMemo } from 'react';
import {
  Download,
  FileDown,
  HeartHandshake,
  DollarSign,
  User,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet,
  Building,
  ArrowDownRight,
  ArrowRightLeft,
  Tag,
} from 'lucide-react';
import { CharityCase, Transaction, Receipt, CharityPayment, Member, CashHolding } from '../../types';
import { FinancialLedgerService } from '../../services/financialLedgerService';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { MemberLink, TransactionLink, CustodianLink } from '../Common/ClickableEntity';
import { useCharity } from '../../context/CharityContext';
import { BreadcrumbsBar } from '../Navigation/BreadcrumbsBar';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

interface CaseLedgerTableProps {
  charityCase: CharityCase;
  transactions?: Transaction[];
  receipts?: Receipt[];
  currency?: string;
  onOpenReceipt?: (receiptId: string) => void;
  showBreadcrumbs?: boolean;
}

export const CaseLedgerTable: React.FC<CaseLedgerTableProps> = ({
  charityCase,
  transactions: propTxns,
  receipts: propReceipts,
  currency = 'AED',
  showBreadcrumbs = false,
}) => {
  const {
    transactions: contextTxns,
    receipts: contextReceipts,
    payments,
    members,
    cashHoldings,
    settings,
  } = useCharity();

  const allTxns = propTxns || contextTxns;
  const allReceipts = propReceipts || contextReceipts;
  const activeCurrency = currency || settings.currency || 'AED';

  // Calculate detailed financial stats using single source of truth
  const stats = useMemo(() => {
    return FinancialLedgerService.getCaseFinancials(
      charityCase,
      allTxns,
      allReceipts,
      payments,
      members
    );
  }, [charityCase, allTxns, allReceipts, payments, members]);

  // Find custodian holding cash for this case (e.g. Ashim)
  const caseHoldings = useMemo(() => {
    return cashHoldings.filter(
      (h) => (h.caseId === charityCase.id || h.caseNumber === charityCase.caseNumber) && h.status === 'HELD'
    );
  }, [cashHoldings, charityCase]);

  const activeCustodian = caseHoldings[0];
  const totalHeldByCustodians = caseHoldings.reduce((sum, h) => sum + (h.amount || 0), 0);

  const handleExport = () => {
    const exportData = stats.ledgerRows.map((row) => ({
      Date: row.date,
      'Transaction ID': row.transactionNumber,
      'Transaction Type': row.transactionType,
      'Donor / Member': row.memberName || row.from,
      Custodian: row.custodianName || 'Treasury',
      'Disbursed To': row.to,
      Debit: row.debit,
      Credit: row.credit,
      Amount: row.amount,
      'Running Balance': row.runningBalance,
      Status: row.status,
    }));
    exportToCsv(
      `CASE_LEDGER_${charityCase.caseNumber}_${charityCase.title.replace(/\s+/g, '_')}`,
      exportData
    );
  };

  return (
    <div id="case-ledger-container" className="space-y-6 printable-content relative">
      <DocumentLogoWatermark size="lg" />
      {showBreadcrumbs && <BreadcrumbsBar />}

      {/* Main Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold font-display text-lg shadow-sm shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                  CHARITY CASE LEDGER — {charityCase.caseNumber} {charityCase.title.toUpperCase()}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    charityCase.status === 'active' || charityCase.status === 'in_progress'
                      ? 'bg-purple-100 text-purple-800'
                      : charityCase.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  {charityCase.status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Restricted earmark ledger, donor collection audit, custodian cash holdings, and beneficiary disbursements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={() => triggerPrint('case-ledger-container', `Case_Ledger_${charityCase.caseNumber}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Section 1: CASE DETAILS */}
        <div className="pt-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <HeartHandshake className="w-3.5 h-3.5 text-slate-400" />
            <span>CASE DETAILS</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Case ID
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                {charityCase.caseNumber}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Case Title
              </span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate" title={charityCase.title}>
                {charityCase.title}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Beneficiary
              </span>
              <span className="text-xs font-medium text-slate-800 mt-0.5 block truncate" title={charityCase.beneficiaryName}>
                {charityCase.beneficiaryName}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Category
              </span>
              <span className="text-xs font-medium text-slate-800 mt-0.5 block truncate">
                {charityCase.category || 'Special Aid'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Approved Target
              </span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block">
                {formatCurrency(charityCase.approvedAmount || charityCase.targetAmount || 0, activeCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: CASE FINANCIAL SUMMARY */}
        <div className="pt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span>CASE FINANCIAL SUMMARY</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Total Collected
              </span>
              <div className="text-lg font-bold font-display text-emerald-950 mt-0.5">
                {formatCurrency(stats.totalContributions || stats.totalFundsReceived, activeCurrency)}
              </div>
              <span className="text-[10px] text-emerald-700">Donations earmarked</span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200">
              <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider block">
                Transferred to Custodians
              </span>
              <div className="text-lg font-bold font-display text-blue-950 mt-0.5">
                {formatCurrency(stats.totalCashTransfers || totalHeldByCustodians, activeCurrency)}
              </div>
              <span className="text-[10px] text-blue-700">Physical handover</span>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200">
              <span className="text-[10px] font-semibold text-purple-800 uppercase tracking-wider block">
                Disbursed to Beneficiary
              </span>
              <div className="text-lg font-bold font-display text-purple-950 mt-0.5">
                {formatCurrency(stats.totalDisbursed, activeCurrency)}
              </div>
              <span className="text-[10px] text-purple-700">Directly delivered</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300">
              <span className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider block">
                Current Unspent Balance
              </span>
              <div className="text-lg font-bold font-display text-amber-950 mt-0.5">
                {formatCurrency(stats.remainingBalance, activeCurrency)}
              </div>
              <span className="text-[10px] text-amber-700">Available to disburse</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300">
              <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider block">
                Custodian Holding Cash
              </span>
              <div className="mt-1">
                {activeCustodian ? (
                  <MemberLink
                    memberId={activeCustodian.memberId}
                    memberName={activeCustodian.memberName}
                    memberNumber={activeCustodian.memberNumber}
                    className="font-bold text-emerald-800 text-xs"
                  />
                ) : (
                  <span className="text-xs font-semibold text-slate-600">Treasury Safe</span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                {totalHeldByCustodians > 0 ? `${formatCurrency(totalHeldByCustodians, activeCurrency)} in custody` : 'No cash held in hand'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: CHARITY CASE TRANSACTION LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-tight">
              CHARITY CASE TRANSACTION LEDGER
            </h2>
            <p className="text-xs text-slate-500">
              Complete chronological audit of funds collected, custodian handovers, and disbursements for {charityCase.title}.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Currency: <strong className="text-slate-800">{activeCurrency}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                <th className="py-3 px-3 whitespace-nowrap">Transaction ID</th>
                <th className="py-3 px-3 whitespace-nowrap">Transaction Type</th>
                <th className="py-3 px-3">Donor / Member</th>
                <th className="py-3 px-3">Custodian</th>
                <th className="py-3 px-3">Disbursed To</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Debit (Out)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Credit (In)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Amount</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Running Balance</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No transactions recorded for this charity case yet.
                  </td>
                </tr>
              ) : (
                stats.ledgerRows.map((row) => {
                  const isVoid = row.status === 'voided';
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoid ? 'opacity-50 bg-rose-50/30 line-through' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap font-medium">
                        {row.date}
                      </td>

                      {/* Transaction ID */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <TransactionLink
                          transactionId={row.rawTxn?.id || row.rawReceipt?.id || row.id}
                          transactionNumber={row.transactionNumber}
                          showIcon={true}
                        />
                      </td>

                      {/* Transaction Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.transactionType === 'Member Contribution' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                            Donation In
                          </span>
                        ) : row.transactionType === 'Cash Transfer' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            Custodian Handover
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <HeartHandshake className="w-3 h-3 text-purple-600" />
                            Disbursement
                          </span>
                        )}
                      </td>

                      {/* Donor / Member */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.memberId ? (
                          <MemberLink
                            memberId={row.memberId}
                            memberName={row.memberName || row.from}
                            className="text-[11px]"
                          />
                        ) : (
                          <span className="text-slate-700 font-medium">{row.from || 'Donor'}</span>
                        )}
                      </td>

                      {/* Custodian */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.custodianId ? (
                          <MemberLink
                            memberId={row.custodianId}
                            memberName={row.custodianName}
                            className="text-[11px] font-semibold text-amber-800"
                          />
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Disbursed To */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-800 font-medium">
                        {row.to || '—'}
                      </td>

                      {/* Debit (Outflow) */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {row.debit > 0 ? (
                          <div>
                            <span className="text-purple-700 font-bold">
                              -{formatCurrency(row.baseDebit ?? row.debit, activeCurrency)}
                            </span>
                            {row.currency && row.currency !== activeCurrency && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                ({formatCurrency(row.debit, row.currency)})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Credit (Inflow) */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {row.credit > 0 ? (
                          <div>
                            <span className="text-emerald-700 font-bold">
                              +{formatCurrency(row.baseCredit ?? row.credit, activeCurrency)}
                            </span>
                            {row.currency && row.currency !== activeCurrency && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                ({formatCurrency(row.credit, row.currency)})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-display font-bold text-slate-900 whitespace-nowrap">
                        <div>
                          {formatCurrency(row.baseAmount ?? row.amount, activeCurrency)}
                        </div>
                        {row.currency && row.currency !== activeCurrency && (
                          <div className="text-[10px] text-slate-500 font-mono font-normal">
                            {formatCurrency(row.amount, row.currency)}
                            {row.exchangeRate ? ` (Rate: ${row.exchangeRate})` : ''}
                          </div>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900">
                          {formatCurrency(row.runningBalance, activeCurrency)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isVoid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            VOID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            VERIFIED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {stats.ledgerRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={8} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Remaining Unspent Fund Balance for {charityCase.caseNumber}:
                  </td>
                  <td colSpan={3} className="py-3.5 px-4 text-right font-mono text-base text-emerald-800 font-bold">
                    {formatCurrency(stats.remainingBalance, activeCurrency)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
