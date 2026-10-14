import React from 'react';
import { FileDown, X, ShieldAlert, CheckCircle2, Building2, QrCode } from 'lucide-react';
import { Receipt, CharityPayment, JournalEntry } from '../../types';
import { useCharity } from '../../context/CharityContext';
import { numberToWords } from '../../utils/numberToWords';
import { formatCurrency } from '../../utils/numbering';
import { triggerPrint } from '../../utils/export';
import { MemberLink, CaseLink } from '../Common/ClickableEntity';
import { getHistoricalBaseAmount, getRecordExchangeRateSnapshot } from '../../services/financialLedgerService';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

interface PrintableVoucherModalProps {
  type: 'Receipt' | 'Payment';
  data: Receipt | CharityPayment;
  onClose: () => void;
  journalEntry?: JournalEntry;
}

export const PrintableVoucherModal: React.FC<PrintableVoucherModalProps> = ({
  type,
  data,
  onClose,
  journalEntry,
}) => {
  const { settings, activeCharity } = useCharity();

  const isReceipt = type === 'Receipt';
  const receipt = isReceipt ? (data as Receipt) : null;
  const payment = !isReceipt ? (data as CharityPayment) : null;

  const isVoided = data.status === 'voided';
  const docNumber = isReceipt ? receipt!.receiptNumber : payment!.paymentNumber;
  const docDate = isReceipt ? receipt!.receiptDate : payment!.paymentDate;
  const amount = data.amount;
  const currency = data.currency || settings.currency || 'AED';
  const words = numberToWords(amount, currency);

  const orgName = activeCharity?.charityName || (activeCharity as any)?.name || settings?.charityName || 'Udyavar Muslim Unity UAE';
  const template = isReceipt ? settings?.receiptTemplate : settings?.voucherTemplate;

  const defaultTitle = isReceipt
    ? receipt?.contributionType === 'SPECIAL_CONTRIBUTION'
      ? 'SPECIAL CHARITY CONTRIBUTION RECEIPT'
      : 'OFFICIAL MEMBERSHIP DUES RECEIPT'
    : payment?.disbursementType === 'ADMINISTRATIVE_EXPENSE'
    ? 'ADMINISTRATIVE EXPENSE PAYMENT VOUCHER'
    : 'CHARITY ASSISTANCE RELIEF PAYMENT VOUCHER';

  const title = template?.headerSubtitle || defaultTitle;
  const headerOrgTitle = template?.headerTitle || orgName;

  const showQr = template ? template.showQrCode : true;
  const showCase = template ? template.showCaseAllocation : true;
  const showSignatures = template ? template.showSignatureBlock !== false : true;
  const showCustodianSignature = template ? template.showCustodianSignature !== false : true;
  const showStamp = template ? template.showStampArea : true;
  const showRecipientAck = !isReceipt && (template ? template.showRecipientAcknowledgement !== false : true);

  const handlePrint = () => {
    triggerPrint('printable-voucher-body', isReceipt ? `Receipt_${docNumber}` : `Voucher_${docNumber}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl print:max-h-none print:w-full print:shadow-none">
        {/* Modal Top Actions (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Auditable Document Viewer
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isVoided
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isVoided ? 'VOIDED RECORD' : 'POSTED & VERIFIED'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
            >
              <FileDown className="h-4 w-4" />
              Download PDF (A4)
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="overflow-y-auto p-8 print:overflow-visible print:p-6 relative overflow-hidden" id="printable-voucher-body">
          {/* Organization Logo Watermark */}
          <DocumentLogoWatermark size="lg" />

          {/* VOIDED Watermark */}
          {isVoided && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15">
              <span className="rotate-[-30deg] border-8 border-dashed border-rose-600 px-12 py-6 text-7xl font-extrabold uppercase tracking-widest text-rose-600">
                VOIDED
              </span>
            </div>
          )}

          {/* Organization Header */}
          <div className="border-b-2 border-slate-900 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <img
                    src={activeCharity?.logoUrl || settings?.logoUrl || '/logo.svg'}
                    alt={headerOrgTitle}
                    className="h-14 max-w-[200px] object-contain rounded-lg"
                  />
                  <div>
                    <h1 className="text-xl font-bold font-brand text-slate-900 tracking-wide">
                      {headerOrgTitle}
                    </h1>
                    {(activeCharity?.tagline || settings?.tagline) && (
                      <p className="text-[11px] text-emerald-800 font-medium">
                        {activeCharity?.tagline || settings?.tagline}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Registered Charity Society • Reg No: {activeCharity?.registrationNumber || settings?.registrationNumber || 'UMU-UAE-ESTD2008'}
                    </p>
                  </div>
                </div>
                <p className="pt-2 text-xs text-slate-600 max-w-md leading-relaxed">
                  {activeCharity?.address || settings?.address}
                  {(activeCharity?.city || settings?.city) && `, ${activeCharity?.city || settings?.city}`}
                  {(activeCharity?.country || settings?.country) && `, ${activeCharity?.country || settings?.country}`}
                  {' • '}Tel: {activeCharity?.phone || settings?.phone}
                  {' • '}Email: {activeCharity?.email || settings?.email}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block rounded-lg bg-slate-100 px-3.5 py-2 text-right border border-slate-200">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {isReceipt ? 'Receipt Number' : 'Voucher Number'}
                  </div>
                  <div className="text-base font-mono font-bold text-slate-900">
                    {docNumber}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Date: <span className="font-semibold text-slate-900">{docDate}</span>
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-center text-white">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-display">{title}</h2>
            </div>
          </div>

          {/* Voided Reason Banner if applicable */}
          {isVoided && (
            <div className="my-4 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                This document was voided from the ledger
              </div>
              <div className="mt-1 text-slate-700">
                <strong>Reason:</strong> {data.voidReason || 'Transaction was canceled'}
                {data.voidedBy && <span className="ml-2 text-slate-500">by {data.voidedBy}</span>}
              </div>
            </div>
          )}

          {/* Primary Details Grid */}
          <div className="mt-6 grid grid-cols-2 gap-6 text-xs sm:text-sm">
            <div className="space-y-3">
              {isReceipt ? (
                <>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Received From Member</span>
                    <div className="font-semibold text-slate-900 text-base">
                      <MemberLink
                        memberId={receipt!.memberId}
                        memberName={receipt!.memberName}
                        memberNumber={receipt!.memberNumber}
                        showMemberNumber={true}
                        className="hover:text-emerald-700 text-slate-900 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Contribution Classification</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {receipt!.contributionType === 'SPECIAL_CONTRIBUTION'
                        ? 'Special Restricted Purpose'
                        : 'Monthly Membership Dues'}
                    </span>
                  </div>
                  {receipt!.periodMonth && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 block">Dues Period Month</span>
                      <span className="font-medium text-slate-800">{receipt!.periodMonth}</span>
                    </div>
                  )}
                  {showCase && receipt!.caseNumber && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 block">Restricted Charity Case</span>
                      <div className="font-medium text-emerald-700">
                        {receipt!.caseId ? (
                          <CaseLink
                            caseId={receipt!.caseId}
                            caseTitle={receipt!.caseTitle || receipt!.caseNumber}
                            caseNumber={receipt!.caseNumber}
                            className="text-emerald-700 hover:underline font-bold"
                          />
                        ) : (
                          <span>{receipt!.caseNumber} — {receipt!.caseTitle}</span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Paid To (Beneficiary / Vendor)</span>
                    <span className="font-semibold text-slate-900 text-base">
                      {payment!.payeeName}
                    </span>
                    {payment!.mobileNumber && (
                      <span className="text-xs text-slate-500 block">Phone: {payment!.mobileNumber}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">Disbursement Classification</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {payment!.disbursementType === 'ADMINISTRATIVE_EXPENSE'
                        ? 'Administrative Operating Expense'
                        : 'Direct Charitable Assistance'}
                    </span>
                  </div>
                  {showCase && payment!.caseNumber && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 block">Linked Charity Case</span>
                      <div className="font-medium text-emerald-700">
                        {payment!.caseId ? (
                          <CaseLink
                            caseId={payment!.caseId}
                            caseTitle={payment!.caseTitle || payment!.caseNumber}
                            caseNumber={payment!.caseNumber}
                            className="text-emerald-700 hover:underline font-bold"
                          />
                        ) : (
                          <span>{payment!.caseNumber} — {payment!.caseTitle}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {payment!.adminExpenseCategory && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 block">Operating Category</span>
                      <span className="font-medium text-slate-800">{payment!.adminExpenseCategory}</span>
                    </div>
                  )}
                  {payment!.invoiceNumber && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 block">Vendor Invoice #</span>
                      <span className="font-medium text-slate-800">{payment!.invoiceNumber}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-slate-500 block">Settlement Method</span>
                <span className="font-medium text-slate-800">{data.paymentMethod}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Cash / Bank Account</span>
                <span className="font-medium text-slate-800">
                  {isReceipt ? receipt!.cashBankAccountName : payment!.cashBankAccountName}
                </span>
              </div>
              {data.referenceNumber && (
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Reference / Cheque #</span>
                  <span className="font-mono text-slate-800">{data.referenceNumber}</span>
                </div>
              )}
              {data.notes && (
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Particulars / Notes</span>
                  <span className="text-xs text-slate-600 italic">{data.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount Box */}
          <div className="mt-6 rounded-xl border-2 border-slate-900 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Total Amount Authorized
                </span>
                <div className="text-xs text-slate-600 capitalize font-medium">{words}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-slate-900 font-display">
                  {formatCurrency(amount, currency)}
                </div>
                {(() => {
                  const snap = getRecordExchangeRateSnapshot(data, settings?.currency);
                  const baseAmt = getHistoricalBaseAmount(data, settings?.currency);
                  if (snap.fromCurrency === snap.toCurrency) return null;
                  return (
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Exchange Rate: 1 {snap.fromCurrency} = {snap.rate} {snap.toCurrency} (Base Eqv: {formatCurrency(baseAmt, snap.toCurrency)})
                      <span className="block text-[10px] text-slate-400 font-sans">
                        [Locked Snapshot: {snap.asOfDate}]
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Double-Entry Ledger Breakdown */}
          <div className="mt-6 rounded-xl border border-slate-200 p-3 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-semibold text-slate-700">
              <span>Double-Entry General Ledger Verification</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Balanced (Dr = Cr)
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {isReceipt ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      <strong>Debit (Asset):</strong> {receipt!.cashBankAccountName}
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(amount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      <strong>Credit (Income):</strong> {receipt!.contributionAccountName} ({receipt!.contributionAccountCode})
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(amount, currency)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      <strong>Debit (Expense):</strong> {payment!.chartOfAccountName} ({payment!.chartOfAccountCode})
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(amount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      <strong>Credit (Asset):</strong> {payment!.cashBankAccountName}
                    </span>
                    <span className="font-mono font-medium">{formatCurrency(amount, currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Thank-You / Du'a Message Banner */}
          {template?.thankYouMessage && (
            <div
              className={`mt-5 p-3 rounded-lg border text-xs font-semibold text-center ${
                isReceipt
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              {template.thankYouMessage}
            </div>
          )}

          {/* Recipient Acknowledgment Section (For Charity Aid Vouchers) */}
          {showRecipientAck && (
            <div className="mt-5 p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Beneficiary / Recipient Acknowledgment & Declaration
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Acknowledgment of Assistance
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">
                "{template?.recipientAcknowledgmentText || 'I hereby acknowledge receipt of the assistance amount stated above in full from Udyavar Muslim Unity UAE for the specified relief/medical purpose.'}"
              </p>
              <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-500 block">Recipient / Beneficiary:</span>
                  <span className="font-bold text-slate-900 text-xs">{payment!.payeeName}</span>
                  <span className="text-[10px] text-slate-500 block">Date Received: {docDate}</span>
                </div>
                <div className="text-right">
                  <div className="w-48 ml-auto border-b border-dashed border-slate-500 mb-1" />
                  <span className="text-[10px] font-bold text-slate-700">
                    {template?.recipientSignatureTitle || 'Beneficiary Signature / Thumbprint'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Terms & Conditions / Disclaimer */}
          {template?.termsAndConditions && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-800 block mb-0.5">Terms & Conditions:</strong>
              {template.termsAndConditions}
            </div>
          )}

          {/* Bottom Area: Signatures, Stamp, and QR Code */}
          <div className="mt-8 pt-5 border-t border-slate-300">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* QR Code Block */}
              {showQr && (
                <div className="flex items-center gap-3 border border-slate-200 bg-slate-50/80 p-2.5 rounded-xl shrink-0">
                  <div className="w-16 h-16 bg-white border border-slate-300 rounded-lg flex flex-col items-center justify-center p-1 shadow-2xs">
                    <QrCode className="w-12 h-12 text-slate-800" />
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <span className="font-bold text-slate-800 block">QR VERIFIED</span>
                    <div>Doc: <span className="font-mono">{docNumber}</span></div>
                    <div>Amt: <span className="font-mono font-semibold">{formatCurrency(amount, currency)}</span></div>
                    <div>Audit: <span className="text-emerald-700 font-semibold">Valid</span></div>
                  </div>
                </div>
              )}

              {/* Signatures Area */}
              {showSignatures && (
                <div className={`grid ${showCustodianSignature ? 'grid-cols-3' : 'grid-cols-2'} gap-4 flex-1 text-center`}>
                  <div className="space-y-6">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                      {template?.preparedByTitle || 'Prepared By'}
                    </span>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                      {isReceipt ? receipt!.createdBy : payment!.preparedBy || payment!.createdBy}
                    </div>
                  </div>

                  {showCustodianSignature && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                        {template?.custodianTitle || 'Custodian / Trustee'}
                      </span>
                      <div className="min-h-10 flex items-end justify-center">
                        {(activeCharity?.signatureUrl || settings?.signatureUrl) ? (
                          <img
                            src={activeCharity?.signatureUrl || settings?.signatureUrl}
                            alt="Authorized Signature"
                            className="max-h-10 max-w-[120px] object-contain mx-auto"
                          />
                        ) : (
                          <div className="h-6" />
                        )}
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                        {isReceipt
                          ? (activeCharity?.signatoryName || settings?.signatoryName || 'Trustee / Custodian')
                          : (payment!.approvedBy || activeCharity?.signatoryName || settings?.signatoryName || 'Charity Chairman')}
                        {(activeCharity?.signatoryDesignation || settings?.signatoryDesignation) && (
                          <span className="block text-[9px] text-slate-500 font-normal">
                            {activeCharity?.signatoryDesignation || settings?.signatoryDesignation}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                      {template?.authorizedSignatoryTitle || (isReceipt ? 'Member / Payee' : 'Receiver')}
                    </span>
                    <div className="min-h-10 flex items-end justify-center">
                      <div className="h-6" />
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                      {isReceipt ? receipt!.memberName : payment!.payeeName}
                    </div>
                  </div>
                </div>
              )}

              {/* Official Stamp Area */}
              {showStamp && (
                <div className="shrink-0 flex items-center justify-center">
                  {(activeCharity?.stampUrl || settings?.stampUrl) ? (
                    <img
                      src={activeCharity?.stampUrl || settings?.stampUrl}
                      alt="Official Organization Stamp"
                      className="w-24 h-24 object-contain rounded-full border border-slate-200 shadow-2xs bg-white p-0.5"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-emerald-700/60 bg-emerald-50/30 flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-[8px] uppercase font-bold text-emerald-900 tracking-wider">Official Stamp</span>
                      <span className="text-[7px] text-emerald-700 font-medium">UMU UAE</span>
                      <span className="text-[7px] text-slate-400 font-mono mt-0.5">{new Date().getFullYear()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            {template?.footerDisclaimer || activeCharity?.footerText || settings?.footerText || 'Official Electronic Voucher • Udyavar Muslim Unity UAE.'}
          </div>
        </div>
      </div>
    </div>
  );
};

