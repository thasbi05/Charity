import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowLeftRight,
  HeartHandshake,
  Receipt as ReceiptIcon,
  Upload,
  Calendar,
  DollarSign,
  User,
  ShieldCheck,
  Building2,
  Tag,
  Paperclip,
  Check,
  AlertTriangle,
  FileDown,
  QrCode,
  Stamp,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import {
  Receipt,
  Transaction,
  CharityPayment,
  PaymentMethod,
  ReceiptStatus,
  CharityCategory,
} from '../../types';
import {
  CHARITY_CATEGORIES,
  ADMIN_EXPENSE_CATEGORIES,
  getDefaultAssistanceAccountCode,
  getDefaultAdminExpenseAccountCode,
} from '../../utils/defaults';
import { formatCurrency } from '../../utils/numbering';
import { numberToWords } from '../../utils/numberToWords';
import { exportElementToPdf } from '../../utils/export';
import { uploadDocument } from '../../lib/storage';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

export type TransactionOriginType =
  | 'RECEIPT'
  | 'HANDOVER_TRANSFER'
  | 'CHARITY_PAYMENT'
  | 'EXPENSE';

interface UnifiedEditTransactionModalProps {
  transactionIdentifier: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const UnifiedEditTransactionModal: React.FC<UnifiedEditTransactionModalProps> = ({
  transactionIdentifier,
  isOpen,
  onClose,
  onSaved,
}) => {
  const {
    receipts,
    transactions,
    payments,
    members,
    cases,
    accounts,
    cashAccounts,
    settings,
    updateContributionReceipt,
    updateHandoverTransfer,
    updateCharityPayment,
    updateAdminExpense,
  } = useCharity();
  const { user } = useAuth();

  const [originType, setOriginType] = useState<TransactionOriginType>('RECEIPT');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Common Form Fields
  const [date, setDate] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('AED');
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('valid');
  const [attachment, setAttachment] = useState<{
    name: string;
    url?: string;
    data?: string;
    type?: string;
    size?: number;
  } | null>(null);

  // Type 1: Member Contribution Receipt Fields
  const [receiptMemberId, setReceiptMemberId] = useState<string>('');
  const [receiptPeriodMonth, setReceiptPeriodMonth] = useState<string>('');
  const [receiptCashBankId, setReceiptCashBankId] = useState<string>('');
  const [receiptCaseId, setReceiptCaseId] = useState<string>('');

  // Type 2: Peer Handover / Transfer Fields
  const [fromType, setFromType] = useState<'member' | 'account'>('member');
  const [fromId, setFromId] = useState<string>('');
  const [toType, setToType] = useState<'member' | 'account'>('member');
  const [toId, setToId] = useState<string>('');
  const [handoverFundType, setHandoverFundType] = useState<
    'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER'
  >('MONTHLY_CONTRIBUTION');
  const [transferCaseId, setTransferCaseId] = useState<string>('');

  // Type 3: Beneficiary Charity Payment Fields
  const [payeeName, setPayeeName] = useState<string>('');
  const [payeePhone, setPayeePhone] = useState<string>('');
  const [payeeAddress, setPayeeAddress] = useState<string>('');
  const [paymentCaseId, setPaymentCaseId] = useState<string>('');
  const [charityCategory, setCharityCategory] = useState<CharityCategory>('Medical Assistance');
  const [paymentDisbursingSourceId, setPaymentDisbursingSourceId] = useState<string>('');
  const [preparedBy, setPreparedBy] = useState<string>('');
  const [verifiedBy, setVerifiedBy] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('');

  // Type 4: Administrative Operating Expense Fields
  const [adminCategory, setAdminCategory] = useState<string>('Printing & Stationery');
  const [adminExpenseAccountId, setAdminExpenseAccountId] = useState<string>('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState<string>('');
  const [expensePaidFromId, setExpensePaidFromId] = useState<string>('');

  // Matched records in memory
  const matchedReceipt = useMemo(() => {
    if (!transactionIdentifier) return null;
    return (
      receipts.find(
        (r) =>
          r.id === transactionIdentifier ||
          r.receiptNumber === transactionIdentifier ||
          r.transactionId === transactionIdentifier
      ) || null
    );
  }, [transactionIdentifier, receipts]);

  const matchedTransaction = useMemo(() => {
    if (!transactionIdentifier) return null;
    return (
      transactions.find(
        (t) =>
          t.id === transactionIdentifier ||
          t.transactionNumber === transactionIdentifier ||
          t.reference === transactionIdentifier ||
          t.linkedReceiptId === transactionIdentifier
      ) || null
    );
  }, [transactionIdentifier, transactions]);

  const matchedPayment = useMemo(() => {
    if (!transactionIdentifier) return null;
    return (
      payments.find(
        (p) =>
          p.id === transactionIdentifier ||
          p.paymentNumber === transactionIdentifier ||
          p.transactionId === transactionIdentifier ||
          (matchedTransaction && matchedTransaction.reference === p.paymentNumber)
      ) || null
    );
  }, [transactionIdentifier, payments, matchedTransaction]);

  // Initial Data Population on Open
  useEffect(() => {
    if (!isOpen || !transactionIdentifier) return;

    setError(null);
    setSuccessToast(null);

    // 1. Detect origin type:
    let detectedOrigin: TransactionOriginType = 'RECEIPT';

    if (matchedPayment) {
      if (
        matchedPayment.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
        (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(matchedPayment.charityCategory as any)
      ) {
        detectedOrigin = 'EXPENSE';
      } else {
        detectedOrigin = 'CHARITY_PAYMENT';
      }
    } else if (matchedTransaction) {
      if (
        matchedTransaction.financialClassification === 'CHARITY_ASSISTANCE' ||
        matchedTransaction.type === 'Charity Disbursement' ||
        matchedTransaction.type === 'Charity Payment'
      ) {
        detectedOrigin = 'CHARITY_PAYMENT';
      } else if (
        matchedTransaction.financialClassification === 'ADMINISTRATIVE_EXPENSE' ||
        matchedTransaction.type === 'Administrative Expense'
      ) {
        detectedOrigin = 'EXPENSE';
      } else if (
        matchedTransaction.type === 'Member Handover' ||
        matchedTransaction.type === 'Cash Transfer' ||
        matchedTransaction.type === 'Transfer' ||
        matchedTransaction.type === 'Contribution Handover' ||
        (matchedTransaction.debitMemberId && matchedTransaction.creditMemberId)
      ) {
        detectedOrigin = 'HANDOVER_TRANSFER';
      } else {
        detectedOrigin = 'RECEIPT';
      }
    } else if (matchedReceipt) {
      detectedOrigin = 'RECEIPT';
    }

    setOriginType(detectedOrigin);

    // 2. Populate fields based on detected origin
    if (detectedOrigin === 'RECEIPT') {
      const r = matchedReceipt;
      const t = matchedTransaction;
      setDate(r?.receiptDate || t?.date || new Date().toISOString().slice(0, 10));
      setAmount(String(r?.amount || t?.amount || ''));
      setCurrency(r?.currency || t?.currency || settings.currency || 'AED');
      setExchangeRate(String(r?.exchangeRate || t?.exchangeRate || '1'));
      setPaymentMethod((r?.paymentMethod as PaymentMethod) || 'Cash');
      setReferenceNumber(r?.referenceNumber || t?.reference || '');
      setNotes(r?.notes || t?.purpose || '');
      setStatus(r?.status || (t?.status === 'voided' ? 'voided' : 'valid'));

      setReceiptMemberId(r?.memberId || t?.creditMemberId || t?.memberId || members[0]?.id || '');
      setReceiptPeriodMonth(r?.periodMonth || t?.contributionMonth || new Date().toISOString().slice(0, 7));
      setReceiptCashBankId(
        r?.cashBankAccountId ||
        (t?.debitMemberId ? `custodian_${t.debitMemberId}` : t?.debitAccountId) ||
        (members[0] ? `custodian_${members[0].id}` : '')
      );
      setReceiptCaseId(r?.caseId || t?.linkedCaseId || '');

      if (r?.supportingDocumentUrl || r?.supportingDocumentData) {
        setAttachment({
          name: r.supportingDocumentName || 'Receipt Document',
          url: r.supportingDocumentUrl,
          data: r.supportingDocumentData,
          type: r.supportingDocumentType,
          size: r.supportingDocumentSize,
        });
      } else {
        setAttachment(null);
      }
    } else if (detectedOrigin === 'HANDOVER_TRANSFER') {
      const t = matchedTransaction;
      setDate(t?.date || new Date().toISOString().slice(0, 10));
      setAmount(String(t?.amount || ''));
      setCurrency(t?.currency || settings.currency || 'AED');
      setExchangeRate(String(t?.exchangeRate || '1'));
      setReferenceNumber(t?.reference || t?.transactionNumber || '');
      setNotes(t?.notes || t?.description || '');
      setStatus(t?.status === 'voided' ? 'voided' : 'valid');

      setFromType(t?.creditEntityType === 'member' ? 'member' : 'account');
      setFromId(t?.creditMemberId || t?.creditAccountId || members[0]?.id || '');

      setToType(t?.debitEntityType === 'member' ? 'member' : 'account');
      setToId(t?.debitMemberId || t?.debitAccountId || (members[1]?.id || members[0]?.id || ''));

      setTransferCaseId(t?.linkedCaseId || '');
      setHandoverFundType(
        t?.linkedCaseId
          ? 'CHARITY_CASE'
          : t?.type === 'Contribution Handover'
          ? 'MONTHLY_CONTRIBUTION'
          : 'GENERAL_CHARITY'
      );
    } else if (detectedOrigin === 'CHARITY_PAYMENT') {
      const p = matchedPayment;
      const t = matchedTransaction;
      setDate(p?.paymentDate || t?.date || new Date().toISOString().slice(0, 10));
      setAmount(String(p?.amount || t?.amount || ''));
      setCurrency(p?.currency || t?.currency || settings.currency || 'AED');
      setExchangeRate(String(p?.exchangeRate || t?.exchangeRate || '1'));
      setPaymentMethod((p?.paymentMethod as PaymentMethod) || 'Cash');
      setReferenceNumber(p?.referenceNumber || p?.paymentNumber || t?.reference || '');
      setNotes(p?.notes || p?.description || t?.description || '');
      setStatus(p?.status === 'voided' || t?.status === 'voided' ? 'voided' : 'valid');

      setPayeeName(p?.payeeName || t?.toName || '');
      setPayeePhone(p?.mobileNumber || '');
      setPayeeAddress(p?.address || '');
      setPaymentCaseId(p?.caseId || t?.linkedCaseId || cases[0]?.id || '');
      setCharityCategory((p?.charityCategory as CharityCategory) || 'Medical Assistance');
      setPaymentDisbursingSourceId(
        p?.paidByMemberId
          ? `custodian_${p.paidByMemberId}`
          : p?.cashBankAccountId || (t?.creditMemberId ? `custodian_${t.creditMemberId}` : t?.creditAccountId) || ''
      );
      setPreparedBy(p?.preparedBy || '');
      setVerifiedBy(p?.verifiedBy || '');
      setApprovedBy(p?.approvedBy || settings.charityName || 'Board of Trustees');

      if (p?.supportingDocumentUrl || p?.supportingDocumentData) {
        setAttachment({
          name: p.supportingDocumentName || 'Payment Proof',
          url: p.supportingDocumentUrl,
          data: p.supportingDocumentData,
          type: p.supportingDocumentType,
          size: p.supportingDocumentSize,
        });
      } else {
        setAttachment(null);
      }
    } else if (detectedOrigin === 'EXPENSE') {
      const p = matchedPayment;
      const t = matchedTransaction;
      setDate(p?.paymentDate || t?.date || new Date().toISOString().slice(0, 10));
      setAmount(String(p?.amount || t?.amount || ''));
      setCurrency(p?.currency || t?.currency || settings.currency || 'AED');
      setExchangeRate(String(p?.exchangeRate || t?.exchangeRate || '1'));
      setPaymentMethod((p?.paymentMethod as PaymentMethod) || 'Cash');
      setReferenceNumber(p?.referenceNumber || p?.invoiceNumber || t?.reference || '');
      setNotes(p?.notes || p?.description || t?.description || '');
      setStatus(p?.status === 'voided' || t?.status === 'voided' ? 'voided' : 'valid');

      setPayeeName(p?.payeeName || t?.toName || '');
      setAdminCategory(p?.adminExpenseCategory || 'Printing & Stationery');
      setAdminExpenseAccountId(p?.chartOfAccountId || accounts.find((a) => a.code === '6010')?.id || accounts[0]?.id || '');
      setVendorInvoiceNumber(p?.invoiceNumber || '');
      setExpensePaidFromId(
        p?.paidByMemberId
          ? `custodian_${p.paidByMemberId}`
          : p?.cashBankAccountId || (t?.creditMemberId ? `custodian_${t.creditMemberId}` : t?.creditAccountId) || ''
      );
      setApprovedBy(p?.approvedBy || settings.charityName || 'Administrator');

      if (p?.supportingDocumentUrl || p?.supportingDocumentData) {
        setAttachment({
          name: p.supportingDocumentName || 'Expense Invoice',
          url: p.supportingDocumentUrl,
          data: p.supportingDocumentData,
          type: p.supportingDocumentType,
          size: p.supportingDocumentSize,
        });
      } else {
        setAttachment(null);
      }
    }
  }, [
    isOpen,
    transactionIdentifier,
    matchedReceipt,
    matchedTransaction,
    matchedPayment,
    members,
    cases,
    accounts,
    settings,
  ]);

  // Live conversion computation
  const numericAmount = parseFloat(amount) || 0;
  const numericRate = parseFloat(exchangeRate) || 1;
  const baseCurrencyAmount = useMemo(() => {
    if (currency === (settings.currency || 'AED')) {
      return numericAmount;
    }
    return Number((numericAmount * numericRate).toFixed(2));
  }, [numericAmount, numericRate, currency, settings.currency]);

  // Auto-fill exchange rate on currency change
  const handleCurrencyChange = (newCur: string) => {
    setCurrency(newCur);
    if (newCur === (settings.currency || 'AED')) {
      setExchangeRate('1');
    } else if (newCur === 'INR' && (settings.currency || 'AED') === 'AED') {
      // 1 INR ~ 0.04401 AED
      setExchangeRate('0.04401');
    } else if (newCur === 'USD' && (settings.currency || 'AED') === 'AED') {
      setExchangeRate('3.6725');
    } else {
      setExchangeRate('1');
    }
  };

  // Live Double-Entry Balancing Preview
  const doubleEntryPreview = useMemo(() => {
    if (numericAmount <= 0) return null;

    if (originType === 'RECEIPT') {
      const member = members.find((m) => m.id === receiptMemberId);
      const isCustodian = receiptCashBankId.startsWith('custodian_');
      const custodianMember = isCustodian
        ? members.find((m) => m.id === receiptCashBankId.replace('custodian_', ''))
        : null;
      const cashAcc = !isCustodian ? accounts.find((a) => a.id === receiptCashBankId) : null;
      const charityCase = cases.find((c) => c.id === receiptCaseId);

      const debitName = isCustodian
        ? `Cash in Hand - ${custodianMember?.fullName || 'Custodian'}`
        : cashAcc?.name || 'Cash Treasury';
      const debitCode = isCustodian ? '1010-CUST' : cashAcc?.code || '1010';

      const creditName = charityCase
        ? `Special Contribution (${charityCase.title})`
        : `Contribution Income (${member?.fullName || 'Member'})`;
      const creditCode = charityCase ? '4030' : '4010';

      return {
        debitAccount: `${debitCode} - ${debitName}`,
        creditAccount: `${creditCode} - ${creditName}`,
        amount: numericAmount,
        currency,
        baseAmount: baseCurrencyAmount,
        baseCurrency: settings.currency || 'AED',
      };
    }

    if (originType === 'HANDOVER_TRANSFER') {
      let fromName = 'Sender';
      let toName = 'Receiver';
      if (fromType === 'member') {
        fromName = `Cash in Hand - ${members.find((m) => m.id === fromId)?.fullName || 'Member'}`;
      } else {
        fromName = cashAccounts.find((a) => a.id === fromId)?.name || 'Account';
      }

      if (toType === 'member') {
        toName = `Cash in Hand - ${members.find((m) => m.id === toId)?.fullName || 'Member'}`;
      } else {
        toName = cashAccounts.find((a) => a.id === toId)?.name || 'Account';
      }

      return {
        debitAccount: `1010 - ${toName}`,
        creditAccount: `1010 - ${fromName}`,
        amount: numericAmount,
        currency,
        baseAmount: baseCurrencyAmount,
        baseCurrency: settings.currency || 'AED',
      };
    }

    if (originType === 'CHARITY_PAYMENT') {
      const charityCase = cases.find((c) => c.id === paymentCaseId);
      const isCustodian = paymentDisbursingSourceId.startsWith('custodian_');
      const disbursingMember = isCustodian
        ? members.find((m) => m.id === paymentDisbursingSourceId.replace('custodian_', ''))
        : null;
      const cashAcc = !isCustodian ? accounts.find((a) => a.id === paymentDisbursingSourceId) : null;

      const creditName = isCustodian
        ? `Cash in Hand - ${disbursingMember?.fullName || 'Custodian'}`
        : cashAcc?.name || 'Cash/Bank Account';

      return {
        debitAccount: `5010 - Charity Relief Aid: ${charityCategory} (${charityCase?.caseNumber || 'Case'})`,
        creditAccount: `1010 - ${creditName}`,
        amount: numericAmount,
        currency,
        baseAmount: baseCurrencyAmount,
        baseCurrency: settings.currency || 'AED',
      };
    }

    if (originType === 'EXPENSE') {
      const expAcc = accounts.find((a) => a.id === adminExpenseAccountId);
      const isCustodian = expensePaidFromId.startsWith('custodian_');
      const disbursingMember = isCustodian
        ? members.find((m) => m.id === expensePaidFromId.replace('custodian_', ''))
        : null;
      const cashAcc = !isCustodian ? accounts.find((a) => a.id === expensePaidFromId) : null;

      const creditName = isCustodian
        ? `Cash in Hand - ${disbursingMember?.fullName || 'Custodian'}`
        : cashAcc?.name || 'Cash/Bank Account';

      return {
        debitAccount: `${expAcc?.code || '6010'} - Administrative: ${adminCategory}`,
        creditAccount: `1010 - ${creditName}`,
        amount: numericAmount,
        currency,
        baseAmount: baseCurrencyAmount,
        baseCurrency: settings.currency || 'AED',
      };
    }

    return null;
  }, [
    originType,
    numericAmount,
    currency,
    baseCurrencyAmount,
    settings.currency,
    receiptMemberId,
    receiptCashBankId,
    receiptCaseId,
    fromType,
    fromId,
    toType,
    toId,
    paymentCaseId,
    charityCategory,
    paymentDisbursingSourceId,
    adminCategory,
    adminExpenseAccountId,
    expensePaidFromId,
    members,
    cases,
    accounts,
    cashAccounts,
  ]);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds maximum limit of 5MB.');
      return;
    }

    try {
      setLoading(true);
      const uploaded = await uploadDocument(file, 'attachments');
      setAttachment({
        name: uploaded.name,
        url: uploaded.url,
        data: uploaded.dataUrl,
        type: uploaded.type,
        size: uploaded.size,
      });
      setError(null);
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Form Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (originType === 'RECEIPT') {
        const targetReceiptId = matchedReceipt?.id || transactionIdentifier;
        if (!targetReceiptId) throw new Error('Receipt ID is missing.');

        await updateContributionReceipt(targetReceiptId, {
          memberId: receiptMemberId,
          amount: numericAmount,
          currency,
          exchangeRate: numericRate,
          baseCurrencyAmount,
          receiptDate: date,
          periodMonth: receiptPeriodMonth,
          contributionMonth: receiptPeriodMonth,
          cashBankAccountId: receiptCashBankId,
          caseId: receiptCaseId === '' ? undefined : receiptCaseId,
          paymentMethod,
          referenceNumber,
          notes,
          status: status as ReceiptStatus,
          supportingDocumentName: attachment?.name,
          supportingDocumentUrl: attachment?.url,
          supportingDocumentData: attachment?.data,
          supportingDocumentType: attachment?.type,
          supportingDocumentSize: attachment?.size,
        });
      } else if (originType === 'HANDOVER_TRANSFER') {
        const targetTxnId = matchedTransaction?.id || transactionIdentifier;
        if (!targetTxnId) throw new Error('Transaction ID is missing.');

        await updateHandoverTransfer(targetTxnId, {
          date,
          amount: numericAmount,
          currency,
          exchangeRate: numericRate,
          baseCurrencyAmount,
          fromType,
          fromId,
          toType,
          toId,
          caseId: transferCaseId || undefined,
          handoverFundType,
          referenceNumber,
          notes,
          status: status as 'valid' | 'voided',
        });
      } else if (originType === 'CHARITY_PAYMENT') {
        const targetPaymentId = matchedPayment?.id || transactionIdentifier;
        if (!targetPaymentId) throw new Error('Payment ID is missing.');

        const isCustodian = paymentDisbursingSourceId.startsWith('custodian_');
        const paidByMemberId = isCustodian
          ? paymentDisbursingSourceId.replace('custodian_', '')
          : undefined;

        await updateCharityPayment(targetPaymentId, {
          payeeName,
          mobileNumber: payeePhone,
          address: payeeAddress,
          paymentDate: date,
          amount: numericAmount,
          currency,
          exchangeRate: numericRate,
          baseCurrencyAmount,
          caseId: paymentCaseId,
          charityCategory,
          paymentMethod,
          paidByMemberId,
          cashBankAccountId: paymentDisbursingSourceId,
          referenceNumber,
          notes,
          description: `Charity Relief Aid (${charityCategory}) paid to ${payeeName}`,
          preparedBy,
          verifiedBy,
          approvedBy,
          status: status as 'valid' | 'voided',
          supportingDocumentName: attachment?.name,
          supportingDocumentUrl: attachment?.url,
          supportingDocumentData: attachment?.data,
          supportingDocumentType: attachment?.type,
          supportingDocumentSize: attachment?.size,
        });
      } else if (originType === 'EXPENSE') {
        const targetId = matchedPayment?.id || matchedTransaction?.id || transactionIdentifier;
        if (!targetId) throw new Error('Transaction or Expense ID is missing.');

        const isCustodian = expensePaidFromId.startsWith('custodian_');
        const paidByMemberId = isCustodian
          ? expensePaidFromId.replace('custodian_', '')
          : undefined;

        await updateAdminExpense(targetId, {
          payeeName,
          adminExpenseCategory: adminCategory,
          chartOfAccountId: adminExpenseAccountId,
          amount: numericAmount,
          currency,
          exchangeRate: numericRate,
          baseCurrencyAmount,
          paymentDate: date,
          paymentMethod,
          invoiceNumber: vendorInvoiceNumber,
          paidByMemberId,
          cashBankAccountId: expensePaidFromId,
          referenceNumber,
          notes,
          description: `Operating Expense: ${adminCategory} - ${payeeName}`,
          approvedBy,
          status: status as 'valid' | 'voided',
          supportingDocumentName: attachment?.name,
          supportingDocumentUrl: attachment?.url,
          supportingDocumentData: attachment?.data,
          supportingDocumentType: attachment?.type,
          supportingDocumentSize: attachment?.size,
        });
      }

      setSuccessToast('Transaction updated successfully and all accounting ledgers recalculated!');
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Error saving transaction edits:', err);
      setError(err.message || 'Failed to save transaction edits.');
    } finally {
      setLoading(false);
    }
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const selectedMember = useMemo(() => {
    return (
      members.find((m) => m.id === receiptMemberId) ||
      (matchedReceipt ? members.find((m) => m.id === matchedReceipt.memberId) : null)
    );
  }, [members, receiptMemberId, matchedReceipt]);

  const selectedCase = useMemo(() => {
    const cId = receiptCaseId || paymentCaseId || transferCaseId;
    return cases.find((c) => c.id === cId) || null;
  }, [cases, receiptCaseId, paymentCaseId, transferCaseId]);

  const selectedAccount = useMemo(() => {
    const aId = receiptCashBankId || paymentDisbursingSourceId || fromId;
    return accounts.find((a) => a.id === aId) || null;
  }, [accounts, receiptCashBankId, paymentDisbursingSourceId, fromId]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const docType =
        originType === 'RECEIPT'
          ? 'Receipt'
          : originType === 'CHARITY_PAYMENT'
          ? 'Disbursement_Voucher'
          : originType === 'EXPENSE'
          ? 'Expense_Voucher'
          : 'Transfer_Voucher';
      const cleanRef = String(displayRef || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportElementToPdf('edit-transaction-printable-voucher', `${docType}_${cleanRef}.pdf`, {
        title: `${docType.replace('_', ' ')} - ${displayRef}`,
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  const displayRef =
    matchedReceipt?.receiptNumber ||
    matchedTransaction?.transactionNumber ||
    matchedPayment?.paymentNumber ||
    transactionIdentifier;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-transaction-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl text-white shadow-sm ${
                originType === 'RECEIPT'
                  ? 'bg-emerald-600'
                  : originType === 'HANDOVER_TRANSFER'
                  ? 'bg-blue-600'
                  : originType === 'CHARITY_PAYMENT'
                  ? 'bg-purple-600'
                  : 'bg-amber-600'
              }`}
            >
              {originType === 'RECEIPT' && <ReceiptIcon className="w-5 h-5" />}
              {originType === 'HANDOVER_TRANSFER' && <ArrowLeftRight className="w-5 h-5" />}
              {originType === 'CHARITY_PAYMENT' && <HeartHandshake className="w-5 h-5" />}
              {originType === 'EXPENSE' && <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="edit-transaction-title" className="text-base font-bold text-slate-900">
                  {originType === 'RECEIPT' && 'Edit Member Contribution Receipt'}
                  {originType === 'HANDOVER_TRANSFER' && 'Edit Peer Handover / Internal Transfer'}
                  {originType === 'CHARITY_PAYMENT' && 'Edit Beneficiary Charity Payment Voucher'}
                  {originType === 'EXPENSE' && 'Edit Administrative Operating Expense'}
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                  {displayRef}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Modifications recalculate double-entry journals, custodian balances, and case progress in real time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Origin Type Switcher Tabs */}
        <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-slate-500 font-medium whitespace-nowrap mr-1">Classification:</span>
          <button
            type="button"
            onClick={() => setOriginType('RECEIPT')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              originType === 'RECEIPT'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ReceiptIcon className="w-3.5 h-3.5" />
            Contribution Receipt
          </button>
          <button
            type="button"
            onClick={() => setOriginType('HANDOVER_TRANSFER')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              originType === 'HANDOVER_TRANSFER'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Peer Handover
          </button>
          <button
            type="button"
            onClick={() => setOriginType('CHARITY_PAYMENT')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              originType === 'CHARITY_PAYMENT'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Charity Disbursement
          </button>
          <button
            type="button"
            onClick={() => setOriginType('EXPENSE')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              originType === 'EXPENSE'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Operating Expense
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Section: Type-Specific Fields */}
          {originType === 'RECEIPT' && (
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                <User className="w-4 h-4 text-emerald-700" />
                Member Contribution Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contributing Member *
                  </label>
                  <select
                    value={receiptMemberId}
                    onChange={(e) => setReceiptMemberId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.memberNumber} - {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contribution Month (Period) *
                  </label>
                  <input
                    type="month"
                    value={receiptPeriodMonth}
                    onChange={(e) => setReceiptPeriodMonth(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cash Custodian / Receiving Account *
                  </label>
                  <select
                    value={receiptCashBankId}
                    onChange={(e) => setReceiptCashBankId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <optgroup label="Member Cash Custodians">
                      {members.map((m) => (
                        <option key={`custodian_${m.id}`} value={`custodian_${m.id}`}>
                          Cash in Hand - {m.fullName} ({m.memberNumber})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Cash & Bank Accounts">
                      {cashAccounts.map((ca) => (
                        <option key={ca.id} value={ca.id}>
                          {ca.name} ({ca.type})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Charity Case Allocation
                  </label>
                  <select
                    value={receiptCaseId}
                    onChange={(e) => setReceiptCaseId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">General Fund (Monthly Contributions)</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {originType === 'HANDOVER_TRANSFER' && (
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950 uppercase tracking-wider">
                <ArrowLeftRight className="w-4 h-4 text-blue-700" />
                Transfer & Peer Handover Route
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source (From) *
                  </label>
                  <div className="flex gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setFromType('member')}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-md ${
                        fromType === 'member'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-slate-700'
                      }`}
                    >
                      Member Custodian
                    </button>
                    <button
                      type="button"
                      onClick={() => setFromType('account')}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-md ${
                        fromType === 'account'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-slate-700'
                      }`}
                    >
                      Bank/Cash Safe
                    </button>
                  </div>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {fromType === 'member'
                      ? members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.memberNumber} - {m.fullName}
                          </option>
                        ))
                      : cashAccounts.map((ca) => (
                          <option key={ca.id} value={ca.id}>
                            {ca.name}
                          </option>
                        ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination (To) *
                  </label>
                  <div className="flex gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setToType('member')}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-md ${
                        toType === 'member'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-slate-700'
                      }`}
                    >
                      Member Custodian
                    </button>
                    <button
                      type="button"
                      onClick={() => setToType('account')}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded-md ${
                        toType === 'account'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border text-slate-700'
                      }`}
                    >
                      Bank/Cash Safe
                    </button>
                  </div>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {toType === 'member'
                      ? members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.memberNumber} - {m.fullName}
                          </option>
                        ))
                      : cashAccounts.map((ca) => (
                          <option key={ca.id} value={ca.id}>
                            {ca.name}
                          </option>
                        ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Handover Fund Category
                  </label>
                  <select
                    value={handoverFundType}
                    onChange={(e) =>
                      setHandoverFundType(
                        e.target.value as 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER'
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="MONTHLY_CONTRIBUTION">Monthly Member Contributions Pool</option>
                    <option value="CHARITY_CASE">Specific Charity Case Collection</option>
                    <option value="GENERAL_CHARITY">General Charity Pool</option>
                    <option value="OTHER">Other / Treasury Float</option>
                  </select>
                </div>

                {handoverFundType === 'CHARITY_CASE' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Linked Charity Case *
                    </label>
                    <select
                      value={transferCaseId}
                      onChange={(e) => setTransferCaseId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select Case...</option>
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.caseNumber} - {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {originType === 'CHARITY_PAYMENT' && (
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-950 uppercase tracking-wider">
                <HeartHandshake className="w-4 h-4 text-purple-700" />
                Charity Relief Beneficiary Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Beneficiary / Payee Name *
                  </label>
                  <input
                    type="text"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    required
                    placeholder="Full legal name of beneficiary"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Beneficiary Contact / Phone
                  </label>
                  <input
                    type="text"
                    value={payeePhone}
                    onChange={(e) => setPayeePhone(e.target.value)}
                    placeholder="+971 50 ... or +91 98..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Allocated Charity Case *
                  </label>
                  <select
                    value={paymentCaseId}
                    onChange={(e) => setPaymentCaseId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relief Category *
                  </label>
                  <select
                    value={charityCategory}
                    onChange={(e) => setCharityCategory(e.target.value as CharityCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {CHARITY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Disbursing Custodian / Account *
                  </label>
                  <select
                    value={paymentDisbursingSourceId}
                    onChange={(e) => setPaymentDisbursingSourceId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <optgroup label="Member Holding Physical Cash">
                      {members.map((m) => (
                        <option key={`custodian_${m.id}`} value={`custodian_${m.id}`}>
                          Cash in Hand - {m.fullName}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Cash & Bank Accounts">
                      {cashAccounts.map((ca) => (
                        <option key={ca.id} value={ca.id}>
                          {ca.name} ({ca.type})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized Signatory / Approver
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="Board of Trustees / Administrator"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {originType === 'EXPENSE' && (
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
                <Tag className="w-4 h-4 text-amber-700" />
                Administrative Operating Expense Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor / Payee Name *
                  </label>
                  <input
                    type="text"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    required
                    placeholder="e.g. Al-Bayan Printing, Etisalat, Landlord"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Category *
                  </label>
                  <select
                    value={adminCategory}
                    onChange={(e) => {
                      setAdminCategory(e.target.value);
                      const defCode = getDefaultAdminExpenseAccountCode(e.target.value);
                      const acc = accounts.find((a) => a.code === defCode);
                      if (acc) setAdminExpenseAccountId(acc.id);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {ADMIN_EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GL Expense Account *
                  </label>
                  <select
                    value={adminExpenseAccountId}
                    onChange={(e) => setAdminExpenseAccountId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    {accounts
                      .filter((a) => a.type === 'Expense')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Invoice / Bill #
                  </label>
                  <input
                    type="text"
                    value={vendorInvoiceNumber}
                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                    placeholder="INV-2026-..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paid From Account / Custodian *
                  </label>
                  <select
                    value={expensePaidFromId}
                    onChange={(e) => setExpensePaidFromId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <optgroup label="Cash & Bank Accounts">
                      {cashAccounts.map((ca) => (
                        <option key={ca.id} value={ca.id}>
                          {ca.name} ({ca.type})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Member Custodians">
                      {members.map((m) => (
                        <option key={`custodian_${m.id}`} value={`custodian_${m.id}`}>
                          Cash in Hand - {m.fullName}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved By
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder="Manager / General Secretary"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section: Universal Financial Amounts & Rates */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <DollarSign className="w-4 h-4 text-slate-600" />
              Financial Values, Exchange Rate & Date
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-500 bg-white font-mono"
                >
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="INR">INR - Indian Rupee (₹)</option>
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="GBP">GBP - British Pound (£)</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-500 bg-white font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Exchange Rate ({currency} → {settings.currency || 'AED'})
                  </label>
                  {currency !== (settings.currency || 'AED') && (
                    <button
                      type="button"
                      onClick={() => {
                        const todayRate = currency === 'INR' ? (settings.exchangeRateInrToAed || 0.04401) : 1;
                        setExchangeRate(String(todayRate));
                      }}
                      className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      Update to current rate ({currency === 'INR' ? (settings.exchangeRateInrToAed || 0.04401) : 1})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.000001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={currency === (settings.currency || 'AED')}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-500 font-mono ${
                    currency === (settings.currency || 'AED')
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'bg-white'
                  }`}
                />
                {(() => {
                  const snap = matchedReceipt?.exchangeRateSnapshot || matchedTransaction?.exchangeRateSnapshot || matchedPayment?.exchangeRateSnapshot;
                  if (!snap || snap.fromCurrency === snap.toCurrency) return null;
                  return (
                    <span className="block mt-1 text-[10px] text-slate-500 font-mono">
                      Locked Rate: 1 {snap.fromCurrency} = {snap.rate} {snap.toCurrency} (As of {snap.asOfDate})
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Converted Equivalent Indicator */}
            {currency !== (settings.currency || 'AED') && numericAmount > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 text-xs text-cyan-900 font-medium">
                <span>
                  Converted Base Currency Value:
                </span>
                <span className="font-mono font-bold text-sm text-cyan-950">
                  ≈ {formatCurrency(baseCurrencyAmount, settings.currency || 'AED')}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other / UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Cheque Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. CHQ-89012, UPI-1234"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-slate-500 bg-white"
                >
                  <option value="valid">Valid / Received (Affects Balances)</option>
                  {originType === 'RECEIPT' && (
                    <>
                      <option value="pledged">Pledged / Announced (No Float Inflation)</option>
                      <option value="draft">Draft (Pending Verification)</option>
                    </>
                  )}
                  <option value="voided">Cancelled / Voided (Zero Effect)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description & Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes or audit remarks..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-slate-500 bg-white resize-none"
              />
            </div>
          </div>

          {/* Section: Live Double-Entry Balancing Card */}
          {doubleEntryPreview && (
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-inner space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Balanced Double-Entry Journal Audit Preview
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Dr = Cr Balanced
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Debit Leg (Dr)
                  </div>
                  <div className="font-medium text-slate-200 truncate mt-0.5">
                    {doubleEntryPreview.debitAccount}
                  </div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                    {formatCurrency(doubleEntryPreview.amount, doubleEntryPreview.currency)}
                    {doubleEntryPreview.currency !== doubleEntryPreview.baseCurrency && (
                      <span className="text-xs text-slate-400 font-normal ml-1.5">
                        (≈ {formatCurrency(doubleEntryPreview.baseAmount, doubleEntryPreview.baseCurrency)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Credit Leg (Cr)
                  </div>
                  <div className="font-medium text-slate-200 truncate mt-0.5">
                    {doubleEntryPreview.creditAccount}
                  </div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                    {formatCurrency(doubleEntryPreview.amount, doubleEntryPreview.currency)}
                    {doubleEntryPreview.currency !== doubleEntryPreview.baseCurrency && (
                      <span className="text-xs text-slate-400 font-normal ml-1.5">
                        (≈ {formatCurrency(doubleEntryPreview.baseAmount, doubleEntryPreview.baseCurrency)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Supporting Document Attachment */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-slate-500" />
                Supporting Document / Receipt Proof
              </label>
              {attachment && (
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="text-[11px] text-rose-600 hover:underline"
                >
                  Remove Attachment
                </button>
              )}
            </div>

            {attachment ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-2 text-xs truncate">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-800 truncate">{attachment.name}</span>
                  {attachment.size && (
                    <span className="text-[10px] text-slate-400">
                      ({(attachment.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
                {attachment.url && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-700 hover:underline font-semibold shrink-0 ml-2"
                  >
                    View File
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Upload Document / Image (max 5MB)</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-slate-400">PDF, JPG, PNG accepted</span>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Download clean formatted A4 PDF of this record"
            >
              {isDownloadingPdf ? (
                <div className="w-4 h-4 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-emerald-700" />
              )}
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save & Recalculate Ledgers</span>
            </button>
          </div>
        </div>

        {/* Off-screen A4 Printable Document for Clean Instant PDF Download */}
        <div
          id="edit-transaction-printable-voucher"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            backgroundColor: '#ffffff',
            zIndex: -100,
            padding: '36px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#0f172a',
          }}
        >
          {/* Organization Logo Watermark */}
          <DocumentLogoWatermark size="lg" />

          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={settings.logoUrl || '/logo.svg'}
                  alt="Logo"
                  className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shadow-2xs shrink-0"
                />
                <div>
                  <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                    {settings.charityName || 'UDYAVAR MUSLIM UNITY UAE'}
                  </h1>
                  <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                    {settings.tagline || 'Charity & Community Welfare Relief • ESTD 2008'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {settings.address || 'P.O. Box 2008, Dubai, United Arab Emirates'} • Tel: {settings.phone || '+971 50 123 4567'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Reg No: {settings.registrationNumber || 'UMU-REG-2008-01'} • Email: {settings.email || 'udyavarmuslimunityuae@gmail.com'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block rounded-xl bg-slate-100 px-3.5 py-2 text-right border border-slate-300">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {originType === 'RECEIPT' ? 'OFFICIAL RECEIPT #' : 'PAYMENT VOUCHER #'}
                  </div>
                  <div className="text-base font-mono font-extrabold text-slate-900">
                    {displayRef}
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-slate-600">
                  Date: <strong className="text-slate-900 font-mono">{date || new Date().toISOString().slice(0, 10)}</strong>
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Status: {status === 'voided' ? 'VOIDED' : 'VERIFIED & RECORDED'}
                </div>
              </div>
            </div>

            {/* Classification Title Banner */}
            <div className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-center text-white">
              <h2 className="text-xs font-bold uppercase tracking-wider font-display">
                {originType === 'RECEIPT'
                  ? settings.receiptTemplate?.headerSubtitle ||
                    (receiptCaseId ? 'SPECIAL CHARITY CONTRIBUTION RECEIPT' : 'OFFICIAL MEMBERSHIP DUES RECEIPT')
                  : originType === 'CHARITY_PAYMENT'
                  ? settings.voucherTemplate?.headerSubtitle || 'CHARITY ASSISTANCE RELIEF PAYMENT VOUCHER'
                  : originType === 'EXPENSE'
                  ? 'ADMINISTRATIVE OPERATING EXPENSE VOUCHER'
                  : 'PEER HANDOVER & INTERNAL CASH TRANSFER VOUCHER'}
              </h2>
            </div>
          </div>

          {/* Details Section with Aligned Paired Rows */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs pt-5 items-start">
            {originType === 'RECEIPT' ? (
              <>
                {/* Row 1 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Received From Contributor:</span>
                  <strong className="text-slate-900 text-sm block">
                    {selectedMember?.fullName || 'Registered Contributor'}
                  </strong>
                  <span className="font-mono text-[11px] text-emerald-800 font-bold">
                    ID: {selectedMember?.memberNumber || 'MEM-0001'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Settlement Method:</span>
                  <strong className="text-slate-800 text-xs block">{paymentMethod || 'Cash in Hand'}</strong>
                  <span className="text-[10px] text-slate-500">Method: Direct Settlement</span>
                </div>

                {/* Row 2 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Father's Name:</span>
                  <span className="text-slate-800 font-medium block">
                    {selectedMember?.fatherName || selectedMember?.fatherHusbandName || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Deposited Custody Account:</span>
                  <span className="font-semibold text-slate-800 block">
                    {selectedAccount?.name || 'Treasury Safe / Cash on Hand (1010)'}
                  </span>
                </div>

                {/* Row 3 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Origin / Permanent Address:</span>
                  <span className="text-slate-800 font-medium text-[11px] block">
                    {[
                      selectedMember?.homeAddress?.house || selectedMember?.homeCountryAddress?.houseBuilding,
                      selectedMember?.homeAddress?.village || selectedMember?.homeCountryAddress?.villageArea,
                      selectedMember?.homeAddress?.taluk || selectedMember?.homeCountryAddress?.taluk,
                      selectedMember?.homeAddress?.district || selectedMember?.homeCountryAddress?.district,
                      'Karnataka, India',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Karnataka, India'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Transaction Reference / Cheque #:</span>
                  <span className="font-mono text-slate-700 block">
                    {referenceNumber || 'N/A'}
                  </span>
                </div>

                {/* Row 4 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Contribution Period / Allocation:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[11px] inline-block mt-0.5">
                    {receiptPeriodMonth || date.slice(0, 7) || 'Monthly Pledge'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Audit Notes / Remarks:</span>
                  <span className="text-slate-700 italic block">{notes || 'Contribution recorded in good order.'}</span>
                </div>
              </>
            ) : originType === 'CHARITY_PAYMENT' ? (
              <>
                {/* Row 1 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Paid To Beneficiary / Recipient:</span>
                  <strong className="text-slate-900 text-sm block">{payeeName || 'Designated Beneficiary'}</strong>
                  <span className="text-[10px] text-slate-500">{payeePhone ? `Tel: ${payeePhone}` : 'Direct Relief Handover'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Settlement Method:</span>
                  <strong className="text-slate-800 text-xs block">{paymentMethod || 'Cash in Hand'}</strong>
                  <span className="text-[10px] text-slate-500">Method: Direct Disbursement</span>
                </div>

                {/* Row 2 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Assistance Category:</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-semibold text-[11px] inline-block mt-0.5">
                    {charityCategory}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Disbursed From Account:</span>
                  <span className="font-semibold text-slate-800 block">
                    {selectedAccount?.name || 'Treasury Safe / Cash on Hand (1010)'}
                  </span>
                </div>

                {/* Row 3 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Beneficiary Address / Location:</span>
                  <span className="text-slate-800 font-medium block">{payeeAddress || 'Udyavara, Karnataka, India'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Transaction Reference / Cheque #:</span>
                  <span className="font-mono text-slate-700 block">{referenceNumber || 'N/A'}</span>
                </div>

                {/* Row 4 */}
                <div>
                  {selectedCase ? (
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <span className="text-[9px] uppercase font-bold text-purple-800 block">
                        Designated Relief Case:
                      </span>
                      <span className="font-bold text-purple-950 text-xs block">
                        {selectedCase.caseNumber} — {selectedCase.title}
                      </span>
                      {selectedCase.beneficiaryName && (
                        <span className="text-[10px] text-purple-700 block mt-0.5">
                          Beneficiary: {selectedCase.beneficiaryName}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-[11px] text-slate-500 block uppercase font-medium">Designation:</span>
                      <span className="text-slate-700 text-xs">General Emergency Aid</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Audit Notes / Remarks:</span>
                  <span className="text-slate-700 italic block">{notes || 'Charity disbursement authorized in full.'}</span>
                </div>
              </>
            ) : originType === 'EXPENSE' ? (
              <>
                {/* Row 1 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Paid To Vendor / Officer:</span>
                  <strong className="text-slate-900 text-sm block">{payeeName || 'Operational Vendor / Staff'}</strong>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Settlement Method:</span>
                  <strong className="text-slate-800 text-xs block">{paymentMethod || 'Cash in Hand'}</strong>
                </div>

                {/* Row 2 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Operating Expense Category:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[11px] inline-block mt-0.5">
                    {adminCategory}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Disbursed From Account:</span>
                  <span className="font-semibold text-slate-800 block">
                    {selectedAccount?.name || 'Treasury Safe / Cash on Hand (1010)'}
                  </span>
                </div>

                {/* Row 3 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Audit Notes / Remarks:</span>
                  <span className="text-slate-700 italic block">{notes || 'Administrative expense approved.'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Transaction Reference:</span>
                  <span className="font-mono text-slate-700 block">{referenceNumber || 'N/A'}</span>
                </div>
              </>
            ) : (
              <>
                {/* Row 1 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Transferred From Custodian:</span>
                  <strong className="text-slate-900 text-sm block">{fromId || 'Custodian Sender'}</strong>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Transferred To Custodian:</span>
                  <strong className="text-slate-900 text-sm block">{toId || 'Custodian Receiver'}</strong>
                </div>

                {/* Row 2 */}
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Audit Notes / Transfer Purpose:</span>
                  <span className="text-slate-700 italic block">{notes || 'Internal physical float handover.'}</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-medium">Handover Reference:</span>
                  <span className="font-mono text-slate-700 block">{referenceNumber || 'N/A'}</span>
                </div>
              </>
            )}
          </div>

          {/* Amount Box */}
          <div className="my-5 rounded-2xl border-2 border-slate-900 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Amount Authorized &amp; Settled
                </span>
                <div className="text-xs text-slate-700 font-bold capitalize mt-0.5">
                  {numberToWords(Number(amount || 0), currency)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold font-display text-slate-900">
                  {formatCurrency(Number(amount || 0), currency)}
                </div>
                {currency !== settings.currency && Number(exchangeRate) > 0 && (
                  <div className="text-[11px] font-mono text-emerald-800 font-semibold">
                    ≈ {formatCurrency(Number(amount || 0) / Number(exchangeRate), settings.currency)} (Rate: {exchangeRate})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Thank You Note */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-semibold text-emerald-950">
            {originType === 'RECEIPT'
              ? settings.receiptTemplate?.thankYouMessage ||
                'Thank you for your generous contribution. May Allah accept and reward you abundantly.'
              : settings.voucherTemplate?.thankYouMessage ||
                'May Allah grant ease, swift relief, and accept all charitable services.'}
          </div>

          {/* Recipient Acknowledgment Section (For Payment Vouchers) */}
          {originType === 'CHARITY_PAYMENT' && (
            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                Beneficiary Acknowledgment &amp; Receipt Declaration
              </span>
              <p className="text-[11px] text-slate-700 italic">
                "{settings.voucherTemplate?.recipientAcknowledgmentText ||
                  'I hereby acknowledge receipt of the assistance amount stated above in full from Udyavar Muslim Unity UAE for the specified relief/medical purpose.'}"
              </p>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block">Beneficiary Name:</span>
                  <strong className="text-slate-900 text-xs">{payeeName || 'Beneficiary'}</strong>
                </div>
                <div className="text-right">
                  <div className="w-44 ml-auto border-b border-dashed border-slate-500 mb-1" />
                  <span className="text-[10px] font-bold text-slate-700">Beneficiary Signature / Thumbprint</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer: QR, Signatures, Stamp */}
          {(() => {
            const activeTpl = originType === 'RECEIPT' ? settings.receiptTemplate : settings.voucherTemplate;
            return (
              <div className="mt-6 pt-5 border-t border-slate-300">
                <div className="flex items-end justify-between gap-6">
                  {/* QR Code */}
                  {activeTpl?.showQrCode !== false && (
                    <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 p-2.5 rounded-xl shrink-0">
                      <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 shadow-2xs">
                        <QrCode className="w-10 h-10 text-slate-800" />
                      </div>
                      <div className="text-[9px] text-slate-500 space-y-0.5">
                        <span className="font-bold text-slate-800 block">QR VERIFIED</span>
                        <div>Doc: <span className="font-mono font-bold text-slate-900">{displayRef}</span></div>
                        <div>Audit: <span className="text-emerald-700 font-semibold">Valid &amp; Audited</span></div>
                      </div>
                    </div>
                  )}

                  {/* Signatures */}
                  {activeTpl?.showSignatureBlock !== false && (
                    <div className={`grid ${activeTpl?.showCustodianSignature !== false ? 'grid-cols-3' : 'grid-cols-2'} gap-3 flex-1 text-center`}>
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block">
                          {activeTpl?.preparedByTitle || (originType === 'RECEIPT' ? 'Prepared By (Finance)' : 'Disbursed By')}
                        </span>
                        <div className="h-6 flex items-end justify-center" />
                        <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] font-semibold text-slate-800">
                          Finance Officer
                        </div>
                      </div>

                      {activeTpl?.showCustodianSignature !== false && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block">
                            {activeTpl?.custodianTitle || 'Treasurer / Custodian'}
                          </span>
                          <div className="h-6 flex items-end justify-center" />
                          <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] font-semibold text-slate-800">
                            Abdul Rasheed
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block">
                          {activeTpl?.authorizedSignatoryTitle || 'Authorized Signatory'}
                        </span>
                        <div className="h-6 flex items-end justify-center" />
                        <div className="border-t border-dashed border-slate-400 pt-1 text-[11px] font-semibold text-slate-800">
                          President / Secretary
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Official Seal / Stamp */}
                  {activeTpl?.showStampArea !== false && (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-700/60 bg-emerald-50/40 flex flex-col items-center justify-center p-1 text-center shrink-0">
                      <span className="text-[7px] uppercase font-bold text-emerald-900 tracking-wider">Official Seal</span>
                      <span className="text-[6px] text-emerald-700 font-semibold">{settings.charityName || 'UMU UAE'}</span>
                      <span className="text-[6px] text-slate-400 font-mono mt-0.5">{new Date().getFullYear()}</span>
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
                  {activeTpl?.footerDisclaimer ||
                    'Official electronic document generated by Udyavar Muslim Unity UAE. Retain for charitable audits and financial records.'}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
