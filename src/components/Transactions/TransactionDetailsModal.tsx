import React from 'react';
import {
  X,
  FileText,
  Calendar,
  DollarSign,
  User,
  HeartHandshake,
  ArrowRight,
  FileDown,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  Building,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useNavigation } from '../../context/NavigationContext';
import { formatCurrency } from '../../utils/numbering';
import { MemberLink, CaseLink } from '../Common/ClickableEntity';
import { triggerPrint } from '../../utils/export';
import { getHistoricalBaseAmount, getRecordExchangeRateSnapshot } from '../../services/financialLedgerService';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

export const TransactionDetailsModal: React.FC = () => {
  const { selectedTransactionId, closeTransactionDetails } = useNavigation();
  const { transactions, receipts, payments, members, cases, settings } = useCharity();

  if (!selectedTransactionId) return null;

  // Find transaction by id or transactionNumber
  const txn = transactions.find(
    (t) => t.id === selectedTransactionId || t.transactionNumber === selectedTransactionId
  );

  // If not found in transactions, look in receipts
  const receipt = receipts.find(
    (r) => r.id === selectedTransactionId || r.receiptNumber === selectedTransactionId
  );

  // If not found, look in payments
  const payment = payments.find(
    (p) => p.id === selectedTransactionId || p.paymentNumber === selectedTransactionId
  );

  const txnNumber = txn?.transactionNumber || receipt?.receiptNumber || payment?.paymentNumber || selectedTransactionId;
  const txnDate = txn?.date || receipt?.receiptDate || payment?.paymentDate || '—';
  const txnMonth = txn?.periodMonth || receipt?.periodMonth || receipt?.contributionMonth || '—';
  const txnType = txn?.type || (receipt ? 'Member Contribution' : payment ? 'Charity Disbursement' : 'Transaction');
  const txnAmount = txn?.amount || receipt?.amount || payment?.amount || 0;
  const txnCurrency = txn?.currency || receipt?.currency || payment?.currency || settings.currency;
  const txnStatus = txn?.status || receipt?.status || payment?.status || 'valid';
  const txnNotes = txn?.description || receipt?.notes || payment?.description || payment?.notes || '—';
  const txnRef = txn?.reference || receipt?.reference || payment?.paymentReference || '—';
  const txnMethod = txn?.reference ? 'Bank Transfer' : receipt?.paymentMethod || payment?.paymentMethod || 'Cash';
  const createdBy = txn?.createdBy || receipt?.createdBy || payment?.createdBy || 'System';
  const createdAt = txn?.createdAt || receipt?.createdAt || payment?.createdAt || '—';

  // Resolved Member
  const memberId = txn?.creditMemberId || txn?.debitMemberId || receipt?.memberId || payment?.paidByMemberId;
  const memberObj = members.find((m) => m.id === memberId);
  const memberName = memberObj?.fullName || receipt?.memberName || payment?.paidByMemberName;

  // Resolved From & To
  const fromName = txn?.debitMemberName || txn?.debitAccountName || receipt?.memberName || payment?.paidByMemberName || 'Treasury';
  const fromMemberId = txn?.debitMemberId || receipt?.memberId || payment?.paidByMemberId;

  const toName = txn?.creditMemberName || txn?.creditAccountName || receipt?.cashBankAccountName || payment?.payeeName || 'Charity Safe';
  const toMemberId = txn?.creditMemberId;

  // Resolved Charity Case
  const caseId = txn?.linkedCaseId || receipt?.caseId || payment?.caseId;
  const caseObj = cases.find((c) => c.id === caseId || c.caseNumber === txn?.linkedCaseNumber);
  const caseTitle = caseObj?.title || txn?.linkedCaseTitle || receipt?.caseTitle || payment?.caseTitle;
  const caseNumber = caseObj?.caseNumber || txn?.linkedCaseNumber || receipt?.caseNumber;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="printable-transaction-voucher"
        className="printable-area bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] relative"
      >
        <DocumentLogoWatermark size="md" />
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Transaction Details
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    txnStatus === 'valid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800 line-through'
                  }`}
                >
                  {txnStatus === 'valid' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                  )}
                  {txnStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500">{txnNumber}</p>
            </div>
          </div>

          <button
            onClick={closeTransactionDetails}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Main Amount Hero */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Total Transaction Amount
              </span>
              <div className="text-2xl font-bold font-display text-slate-900 mt-0.5">
                {formatCurrency(txnAmount, txnCurrency)}
              </div>
              {(() => {
                const targetRecord = txn || receipt || payment;
                const snap = getRecordExchangeRateSnapshot(targetRecord, settings?.currency);
                const baseAmt = getHistoricalBaseAmount(targetRecord, settings?.currency);
                if (snap.fromCurrency === snap.toCurrency) return null;
                return (
                  <div className="text-[11px] text-emerald-800 font-mono mt-1">
                    Exchange Rate: 1 {snap.fromCurrency} = {snap.rate} {snap.toCurrency} (Base Eqv: {formatCurrency(baseAmt, snap.toCurrency)})
                    <span className="block text-[10px] text-slate-500 font-sans">
                      [Locked Snapshot: {snap.asOfDate}]
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Classification
              </span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                {txnType}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Transaction Date
              </span>
              <span className="text-xs font-medium text-slate-800 font-mono mt-0.5 block">
                {txnDate}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Contribution Month
              </span>
              <span className="text-xs font-medium text-slate-800 font-mono mt-0.5 block">
                {txnMonth}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Payment Method
              </span>
              <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                {txnMethod}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Reference / Voucher
              </span>
              <span className="text-xs font-medium text-slate-800 font-mono mt-0.5 block">
                {txnRef}
              </span>
            </div>
          </div>

          {/* Linked Parties (Clickable) */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Linked Financial Parties (Click to drill down)
            </h3>

            {/* Member */}
            {memberName && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-600 font-medium">Associated Member:</span>
                </div>
                <MemberLink
                  memberId={memberId}
                  memberName={memberName}
                  memberNumber={memberObj?.memberNumber}
                  showMemberNumber={true}
                  className="font-bold text-emerald-800"
                />
              </div>
            )}

            {/* From */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-600 font-medium">From (Sender / Source):</span>
              </div>
              {fromMemberId ? (
                <MemberLink
                  memberId={fromMemberId}
                  memberName={fromName}
                  className="font-bold text-slate-900"
                />
              ) : (
                <span className="font-semibold text-slate-800">{fromName}</span>
              )}
            </div>

            {/* To */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">To (Receiver / Custodian):</span>
              </div>
              {toMemberId ? (
                <MemberLink
                  memberId={toMemberId}
                  memberName={toName}
                  className="font-bold text-slate-900"
                />
              ) : (
                <span className="font-semibold text-slate-800">{toName}</span>
              )}
            </div>

            {/* Charity Case */}
            {caseId && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition-colors">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-900 font-medium">Restricted Charity Case:</span>
                </div>
                <CaseLink
                  caseId={caseId}
                  caseTitle={caseTitle}
                  caseNumber={caseNumber}
                  showCaseNumber={true}
                  className="font-bold text-purple-900"
                />
              </div>
            )}
          </div>

          {/* Description & Audit Notes */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Accounting Description & Notes
            </span>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
              {txnNotes}
            </div>
          </div>

          {/* Audit Trail Metadata */}
          <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Posted By: <strong className="text-slate-600">{createdBy}</strong></span>
            <span>Recorded At: <strong className="text-slate-600">{createdAt}</strong></span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => triggerPrint('printable-transaction-voucher', `Transaction_${txnNumber}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            Download PDF
          </button>

          <button
            type="button"
            onClick={closeTransactionDetails}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
