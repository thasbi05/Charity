import React, { useState, useMemo, useEffect } from 'react';
import {
  ReceiptText,
  Search,
  Plus,
  FileDown,
  Download,
  Eye,
  Edit,
  Ban,
  X,
  Calendar,
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  Upload,
  HeartHandshake,
  Wallet,
  ArrowRightLeft,
  QrCode,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { Receipt, PaymentMethod, ReceiptStatus } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { numberToWords } from '../../utils/numberToWords';
import { uploadDocument } from '../../lib/storage';
import { MemberLink, TransactionLink, CaseLink } from '../Common/ClickableEntity';
import { MultiMonthSelector } from './MultiMonthSelector';
import {
  formatContributionMonth,
  formatContributionMonthShort,
  formatMonthsBreakdown,
  getHistoricalBaseAmount,
  getRecordExchangeRateSnapshot,
} from '../../services/financialLedgerService';

export function getReceiptStatusBadge(status?: string | null) {
  const s = (status || 'valid').toLowerCase().trim();
  if (s === 'pledged' || s.includes('pledged') || s.includes('announced')) {
    return {
      label: 'Pledged / Announced',
      status: 'pledged' as ReceiptStatus,
      className: 'bg-amber-50 text-amber-800 border border-amber-300 font-semibold',
    };
  }
  if (s === 'draft' || s.includes('draft')) {
    return {
      label: 'Draft',
      status: 'draft' as ReceiptStatus,
      className: 'bg-slate-100 text-slate-700 border border-slate-300 font-semibold',
    };
  }
  if (s === 'void' || s === 'voided' || s === 'cancelled' || s.includes('void') || s.includes('cancel')) {
    return {
      label: 'Cancelled / Void',
      status: 'voided' as ReceiptStatus,
      className: 'bg-rose-50 text-rose-700 border border-rose-300 line-through font-semibold',
    };
  }
  return {
    label: 'Received / Valid',
    status: 'valid' as ReceiptStatus,
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold',
  };
}

interface ReceiptsViewProps {
  initialSelectedReceiptId?: string;
  isCreateOpen?: boolean;
  onCloseCreate?: () => void;
  preselectedMemberId?: string;
  initialMemberIdForReceipt?: string;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  initialSelectedReceiptId,
  isCreateOpen: parentIsCreateOpen,
  onCloseCreate: parentOnCloseCreate,
  preselectedMemberId,
  initialMemberIdForReceipt,
}) => {
  const { receipts, members, accounts, cashAccounts, cases, settings, createReceipt, updateReceipt, voidReceipt } =
    useCharity();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'pledged' | 'draft' | 'voided'>('all');

  const [inspectReceipt, setInspectReceipt] = useState<Receipt | null>(() => {
    if (initialSelectedReceiptId) {
      return receipts.find((r) => r.id === initialSelectedReceiptId) || null;
    }
    return null;
  });

  const [isLocalCreateOpen, setIsLocalCreateOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [isRateUpdatedToCurrent, setIsRateUpdatedToCurrent] = useState(false);
  const isCreateOpen = Boolean(parentIsCreateOpen || isLocalCreateOpen);

  const handleCloseCreate = () => {
    setIsLocalCreateOpen(false);
    setEditingReceipt(null);
    setIsRateUpdatedToCurrent(false);
    if (parentOnCloseCreate) parentOnCloseCreate();
  };

  // Void modal state
  const [voidTargetReceipt, setVoidTargetReceipt] = useState<Receipt | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Form State
  const [formStatus, setFormStatus] = useState<ReceiptStatus>('valid');
  const [formMemberId, setFormMemberId] = useState<string>(
    initialMemberIdForReceipt || preselectedMemberId || ''
  );
  const [formCaseId, setFormCaseId] = useState<string>('');
  const [formPeriodMonth, setFormPeriodMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [formSelectedMonths, setFormSelectedMonths] = useState<string[]>(() => [
    new Date().toISOString().slice(0, 7),
  ]);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState<string>('AED');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [manualRateEdited, setManualRateEdited] = useState(false);
  const [formMethod, setFormMethod] = useState<PaymentMethod>('Cash');
  const [formCashBankId, setFormCashBankId] = useState<string>('');
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formDocName, setFormDocName] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; type?: string } | null>(null);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseCur = settings.currency || 'AED';

  // Live global exchange rate from settings (for newly created receipts or explicit admin update)
  const currentGlobalSettingRate = useMemo(() => {
    if (formCurrency === baseCur) return 1;
    if (formCurrency === 'INR' && baseCur === 'AED') return settings.exchangeRateInrToAed || 0.04401;
    if (formCurrency === 'AED' && baseCur === 'INR') return settings.exchangeRateAedToInr || 22.72;
    return 1;
  }, [formCurrency, baseCur, settings.exchangeRateInrToAed, settings.exchangeRateAedToInr]);

  // Current selected member object
  const currentMemberObj = useMemo(
    () => members.find((m) => m.id === formMemberId),
    [members, formMemberId]
  );

  // Standard monthly contribution base rate: AED 20 per month (or member default)
  const baseMonthlyRateAED = currentMemberObj?.monthlyContributionAmount || 20;

  // Rate per month in form currency
  const ratePerMonth = useMemo(() => {
    if (formCurrency === 'INR') {
      const rate = formExchangeRate || 0.0441;
      return Math.round(baseMonthlyRateAED / rate);
    }
    return baseMonthlyRateAED;
  }, [formCurrency, formExchangeRate, baseMonthlyRateAED]);

  // Set of paid months for currently selected member (for showing Paid badges in multi-month matrix)
  const memberPaidMonths = useMemo(() => {
    if (!formMemberId) return [];
    const set = new Set<string>();
    receipts.forEach((r) => {
      if (r.memberId !== formMemberId || r.status !== 'valid') return;
      if (editingReceipt && r.id === editingReceipt.id) return;
      if (r.contributionMonths && Array.isArray(r.contributionMonths)) {
        r.contributionMonths.forEach((m) => set.add(m));
      }
      if (r.periodMonth) set.add(r.periodMonth);
      if (r.contributionMonth) set.add(r.contributionMonth);
    });
    return Array.from(set).sort();
  }, [formMemberId, receipts, editingReceipt]);

  // Handle multi-month change with auto-calculation: (Number of Months × Rate)
  const handleMonthsChange = (newMonths: string[]) => {
    setFormSelectedMonths(newMonths);
    if (newMonths.length > 0) {
      setFormPeriodMonth(newMonths[0]);
      const calculatedAmt = newMonths.length * ratePerMonth;
      setFormAmount(calculatedAmt);
    } else {
      setFormPeriodMonth('');
      setFormAmount(0);
    }
  };

  // Synchronize exchange rate when currency changes
  useEffect(() => {
    if (formCurrency === baseCur) {
      setFormExchangeRate(1);
      setManualRateEdited(false);
      return;
    }

    if (!manualRateEdited) {
      if (formCurrency === 'INR' && baseCur === 'AED') {
        setFormExchangeRate(0.0441);
      } else if (formCurrency === 'AED' && baseCur === 'INR') {
        setFormExchangeRate(22.68);
      } else {
        setFormExchangeRate(1);
      }
    }
  }, [formCurrency, baseCur, manualRateEdited]);

  const formBaseEquivalent = formExchangeRate && formAmount > 0
    ? Math.round(formAmount * formExchangeRate * 100) / 100
    : formAmount;

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFormError('Supporting document file size must be under 10MB.');
        return;
      }
      setFormDocName(file.name);
      setFormFile(file);
    }
  };

  // Filter income accounts (4000s)
  const incomeAccounts = useMemo(() => {
    return accounts.filter((a) => a.type === 'Income' && a.isActive);
  }, [accounts]);

  // Adapt cash/bank accounts based on selected currency
  const adaptedCashAccounts = useMemo(() => {
    if (formCurrency === 'INR') {
      return [...cashAccounts].sort((a, b) => {
        const aIsINR = a.currency === 'INR' || a.name.toLowerCase().includes('inr') || a.name.toLowerCase().includes('india');
        const bIsINR = b.currency === 'INR' || b.name.toLowerCase().includes('inr') || b.name.toLowerCase().includes('india');
        if (aIsINR && !bIsINR) return -1;
        if (!aIsINR && bIsINR) return 1;
        return 0;
      });
    }
    return [...cashAccounts].sort((a, b) => {
      const aIsINR = a.currency === 'INR' || a.name.toLowerCase().includes('inr');
      const bIsINR = b.currency === 'INR' || b.name.toLowerCase().includes('inr');
      if (!aIsINR && bIsINR) return -1;
      if (aIsINR && !bIsINR) return 1;
      return 0;
    });
  }, [cashAccounts, formCurrency]);

  const selectedCustodian = useMemo(() => {
    if (formCashBankId.startsWith('custodian_')) {
      const cId = formCashBankId.replace('custodian_', '');
      return members.find((m) => m.id === cId) || null;
    }
    return null;
  }, [formCashBankId, members]);

  const selectedCase = useMemo(() => {
    return formCaseId ? cases.find((c) => c.id === formCaseId) || null : null;
  }, [formCaseId, cases]);

  const depositAccountLabel = selectedCustodian
    ? `Cash in Hand - ${selectedCustodian.fullName} (${selectedCustodian.memberNumber})`
    : (cashAccounts.find((c) => c.id === formCashBankId)?.name || 'Selected Cash/Bank Account');

  const creditAccountLabel = selectedCase
    ? `Restricted Charity Fund - Case ${selectedCase.caseNumber} (${selectedCase.title})`
    : (incomeAccounts.find((a) => a.id === formAccountId)?.name || 'Member Contributions');

  const formCurrencySymbol = formCurrency === 'INR' ? '₹' : (formCurrency === 'AED' ? 'AED' : formCurrency);

  const handleCaseChange = (caseId: string) => {
    setFormCaseId(caseId);
    if (caseId) {
      const restrictedAcc = incomeAccounts.find((a) => a.code === '4030') || accounts.find((a) => a.code === '4030');
      if (restrictedAcc) {
        setFormAccountId(restrictedAcc.id);
      }
      const c = cases.find((item) => item.id === caseId);
      if (c && c.currency === 'INR') {
        setFormCurrency('INR');
        if (!manualRateEdited) {
          setFormExchangeRate(c.exchangeRate || 0.0441);
        }
      }
    } else {
      const generalAcc = incomeAccounts.find((a) => a.code === '4010') || accounts.find((a) => a.code === '4010');
      if (generalAcc) {
        setFormAccountId(generalAcc.id);
      }
    }
  };

  // Synchronize form when opened from parent (e.g. shortcut, overdue banner, member quick action)
  useEffect(() => {
    const activeMemberId = initialMemberIdForReceipt || preselectedMemberId;
    if (isCreateOpen) {
      const targetMember = activeMemberId
        ? members.find((m) => m.id === activeMemberId)
        : members[0];

      if (targetMember) {
        setFormMemberId(targetMember.id);
        setFormAmount(targetMember.monthlyContributionAmount || 100);
      }
      const defaultIncome = accounts.find((a) => a.code === '4010') || incomeAccounts[0];
      if (defaultIncome && !formAccountId) {
        setFormAccountId(defaultIncome.id);
      }
      if (cashAccounts.length > 0 && !formCashBankId) {
        setFormCashBankId(cashAccounts[0].id);
      }
    }
  }, [isCreateOpen, initialMemberIdForReceipt, preselectedMemberId, members, accounts, cashAccounts, incomeAccounts]);

  // When member changes, pre-fill unpaid months and recalculate amount
  const handleMemberChange = (mId: string) => {
    setFormMemberId(mId);
    const targetMember = members.find((mem) => mem.id === mId);
    if (targetMember && !formCaseId) {
      // Find first unpaid month in current year
      const paid = new Set<string>();
      receipts.forEach((r) => {
        if (r.memberId === mId && r.status === 'valid') {
          if (r.contributionMonths && Array.isArray(r.contributionMonths)) {
            r.contributionMonths.forEach((m) => paid.add(m));
          }
          if (r.periodMonth) paid.add(r.periodMonth);
          if (r.contributionMonth) paid.add(r.contributionMonth);
        }
      });
      const curYear = new Date().getFullYear();
      let firstUnpaid = `${curYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      for (let m = 1; m <= 12; m++) {
        const mStr = `${curYear}-${String(m).padStart(2, '0')}`;
        if (!paid.has(mStr)) {
          firstUnpaid = mStr;
          break;
        }
      }
      const initialMonths = [firstUnpaid];
      setFormSelectedMonths(initialMonths);
      setFormPeriodMonth(firstUnpaid);
      const memberRate = formCurrency === 'INR'
        ? Math.round((targetMember.monthlyContributionAmount || 20) / (formExchangeRate || 0.0441))
        : (targetMember.monthlyContributionAmount || 20);
      setFormAmount(memberRate);
    }
  };

  const handleOpenCreate = (mId?: string) => {
    setEditingReceipt(null);
    const targetMember = mId ? members.find((m) => m.id === mId) : members[0];
    const defaultIncome = accounts.find((a) => a.code === '4010') || incomeAccounts[0];
    const defaultCash = cashAccounts[0];

    const curYear = new Date().getFullYear();
    const curMonthStr = `${curYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Find first unpaid month for this member
    const paid = new Set<string>();
    if (targetMember) {
      receipts.forEach((r) => {
        if (r.memberId === targetMember.id && r.status === 'valid') {
          if (r.contributionMonths && Array.isArray(r.contributionMonths)) {
            r.contributionMonths.forEach((m) => paid.add(m));
          }
          if (r.periodMonth) paid.add(r.periodMonth);
          if (r.contributionMonth) paid.add(r.contributionMonth);
        }
      });
    }

    let defaultMonth = curMonthStr;
    for (let m = 1; m <= 12; m++) {
      const mStr = `${curYear}-${String(m).padStart(2, '0')}`;
      if (!paid.has(mStr)) {
        defaultMonth = mStr;
        break;
      }
    }

    setFormStatus('valid');
    setFormMemberId(targetMember?.id || '');
    setFormCaseId('');
    setFormSelectedMonths([defaultMonth]);
    setFormPeriodMonth(defaultMonth);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAccountId(defaultIncome?.id || '');
    setFormAmount(targetMember?.monthlyContributionAmount || 20);
    setFormCurrency(settings.currency || 'AED');
    setFormExchangeRate(1);
    setManualRateEdited(false);
    setIsRateUpdatedToCurrent(false);
    setFormMethod('Cash');
    setFormCashBankId(defaultCash?.id || '');
    setFormRefNumber('');
    setFormDocName('');
    setFormFile(null);
    setFormNotes('');
    setFormError('');
    setIsLocalCreateOpen(true);
  };

  const handleOpenEdit = (r: Receipt) => {
    setEditingReceipt(r);
    setIsRateUpdatedToCurrent(false);
    setFormMemberId(r.memberId);
    setFormCaseId(r.caseId || '');
    const rMonths = r.contributionMonths && r.contributionMonths.length > 0
      ? r.contributionMonths
      : [r.periodMonth || r.contributionMonth || r.receiptDate.slice(0, 7)];
    setFormSelectedMonths(rMonths);
    setFormPeriodMonth(rMonths[0]);
    setFormDate(r.receiptDate);
    setFormAccountId(r.contributionAccountId || '');
    setFormAmount(r.amount);
    setFormCurrency(r.currency || settings.currency || 'AED');
    const initialRate = r.exchangeRateSnapshot?.rate || r.exchangeRate || 1;
    setFormExchangeRate(initialRate);
    setManualRateEdited(false);
    setFormMethod(r.paymentMethod || 'Cash');
    setFormCashBankId(r.cashBankAccountId || '');
    setFormRefNumber(r.referenceNumber || '');
    setFormDocName(r.supportingDocumentName || '');
    setFormFile(null);
    setFormNotes(r.notes || '');
    const badge = getReceiptStatusBadge(r.status);
    setFormStatus(badge.status);
    setFormError('');
    setIsLocalCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formMemberId) {
      setFormError('Please select a member.');
      return;
    }
    if (!formCashBankId) {
      setFormError('Please select the receiving Cash/Bank account.');
      return;
    }
    if (formAmount <= 0) {
      setFormError('Receipt amount must be greater than zero.');
      return;
    }

    const isSpecial = Boolean(formCaseId && formCaseId !== 'general');
    const monthsToProcess = (!isSpecial && formSelectedMonths.length > 0)
      ? formSelectedMonths
      : [formPeriodMonth || formDate.slice(0, 7)];

    if (!isSpecial && monthsToProcess.length === 0) {
      setFormError('Please select at least one contribution month.');
      return;
    }

    const monthsCount = monthsToProcess.length;
    const monthsSummary = monthsCount > 1
      ? `${monthsCount} Months: ${monthsToProcess.map((m) => formatContributionMonthShort(m)).join(', ')}`
      : formatContributionMonth(monthsToProcess[0]);

    const targetMember = members.find((m) => m.id === formMemberId);
    const selectedCaseObj = formCaseId ? cases.find((c) => c.id === formCaseId) : undefined;

    const dynamicBreakdownDesc = isSpecial
      ? (selectedCaseObj ? selectedCaseObj.title : formNotes.trim() || undefined)
      : `Monthly Contribution (${monthsSummary}) - ${targetMember ? targetMember.fullName : 'Member'}`;

    const dynamicNotes = formNotes.trim()
      ? `${formNotes.trim()} (Covered: ${monthsSummary})`
      : dynamicBreakdownDesc;

    setIsSubmitting(true);
    try {
      let docPayload: { name?: string; url?: string; dataUrl?: string; type?: string; size?: number } = {};
      if (formFile) {
        try {
          const uploaded = await uploadDocument(formFile, 'receipts');
          docPayload = {
            name: uploaded.name,
            url: uploaded.url,
            dataUrl: uploaded.dataUrl,
            type: uploaded.type,
            size: uploaded.size,
          };
        } catch (upErr) {
          console.warn('Receipt document processing fallback:', upErr);
        }
      }

      const rateToUse = formCurrency !== baseCur ? formExchangeRate : 1;

      if (editingReceipt) {
        const snapshotToUse = formCurrency === baseCur
          ? { fromCurrency: baseCur, toCurrency: baseCur, rate: 1, asOfDate: formDate }
          : (isRateUpdatedToCurrent || !editingReceipt.exchangeRateSnapshot
              ? { fromCurrency: formCurrency, toCurrency: baseCur, rate: rateToUse, asOfDate: formDate }
              : editingReceipt.exchangeRateSnapshot);

        await updateReceipt(editingReceipt.id, {
          receiptDate: formDate,
          memberId: formMemberId,
          memberName: targetMember ? targetMember.fullName : editingReceipt.memberName,
          memberNumber: targetMember ? targetMember.memberNumber : editingReceipt.memberNumber,
          caseId: isSpecial ? formCaseId : undefined,
          caseNumber: selectedCaseObj ? selectedCaseObj.caseNumber : undefined,
          caseTitle: selectedCaseObj ? selectedCaseObj.title : undefined,
          contributionType: isSpecial ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
          periodMonth: monthsToProcess[0],
          contributionMonth: monthsToProcess[0],
          contributionMonths: isSpecial ? undefined : monthsToProcess,
          monthsCount: isSpecial ? 1 : monthsCount,
          purpose: isSpecial ? selectedCaseObj?.title : dynamicBreakdownDesc,
          contributionAccountId: formAccountId || editingReceipt.contributionAccountId,
          contributionAccountName: creditAccountLabel,
          amount: Number(formAmount),
          currency: formCurrency,
          exchangeRate: rateToUse,
          exchangeRateSnapshot: snapshotToUse,
          baseAmount: formBaseEquivalent,
          baseCurrency: baseCur,
          baseCurrencyAmount: formBaseEquivalent,
          paymentMethod: formMethod,
          cashBankAccountId: formCashBankId,
          cashBankAccountName: depositAccountLabel,
          referenceNumber: formRefNumber.trim(),
          supportingDocumentName: docPayload.name || formDocName,
          supportingDocumentUrl: docPayload.url || editingReceipt.supportingDocumentUrl,
          supportingDocumentData: docPayload.dataUrl || editingReceipt.supportingDocumentData,
          supportingDocumentType: docPayload.type || editingReceipt.supportingDocumentType,
          supportingDocumentSize: docPayload.size || editingReceipt.supportingDocumentSize,
          notes: dynamicNotes,
          status: formStatus,
        });
        handleCloseCreate();
        return;
      }

      const snapshotToUse = {
        fromCurrency: formCurrency,
        toCurrency: baseCur,
        rate: rateToUse,
        asOfDate: formDate,
      };

      const created = await createReceipt({
        receiptDate: formDate,
        memberId: formMemberId,
        caseId: isSpecial ? formCaseId : undefined,
        contributionType: isSpecial ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
        periodMonth: monthsToProcess[0],
        contributionMonth: monthsToProcess[0],
        contributionMonths: isSpecial ? undefined : monthsToProcess,
        monthsCount: isSpecial ? 1 : monthsCount,
        purpose: isSpecial ? selectedCase?.title : dynamicBreakdownDesc,
        contributionAccountId:
          formAccountId ||
          (isSpecial ? accounts.find((a) => a.code === '4030')?.id : incomeAccounts[0]?.id) ||
          accounts[0]?.id,
        amount: Number(formAmount),
        currency: formCurrency,
        exchangeRate: rateToUse,
        exchangeRateSnapshot: snapshotToUse,
        baseAmount: formBaseEquivalent,
        baseCurrency: baseCur,
        baseCurrencyAmount: formBaseEquivalent,
        paymentMethod: formMethod,
        cashBankAccountId: formCashBankId,
        referenceNumber: formRefNumber.trim(),
        supportingDocumentName: docPayload.name || formDocName,
        supportingDocumentUrl: docPayload.url || '',
        supportingDocumentData: docPayload.dataUrl || '',
        supportingDocumentType: docPayload.type || '',
        supportingDocumentSize: docPayload.size || 0,
        notes: dynamicNotes,
        status: formStatus,
      });
      handleCloseCreate();
      setInspectReceipt(created);
    } catch (err: any) {
      setFormError(err.message || 'Failed to process receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTargetReceipt) return;
    if (!voidReason.trim()) {
      alert('Please provide a valid reason for voiding this receipt.');
      return;
    }

    setIsVoiding(true);
    try {
      await voidReceipt(voidTargetReceipt.id, voidReason.trim());
      setVoidTargetReceipt(null);
      setVoidReason('');
      if (inspectReceipt?.id === voidTargetReceipt.id) {
        setInspectReceipt(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to void receipt.');
    } finally {
      setIsVoiding(false);
    }
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        const badge = getReceiptStatusBadge(r.status);
        matchesStatus = badge.status === statusFilter;
      }
      const matchesMethod = methodFilter === 'all' || r.paymentMethod === methodFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.receiptNumber.toLowerCase().includes(q) ||
        r.memberName.toLowerCase().includes(q) ||
        r.memberNumber.toLowerCase().includes(q) ||
        (r.caseTitle && r.caseTitle.toLowerCase().includes(q)) ||
        (r.caseNumber && r.caseNumber.toLowerCase().includes(q)) ||
        (r.purpose && r.purpose.toLowerCase().includes(q)) ||
        (r.cashBankAccountName && r.cashBankAccountName.toLowerCase().includes(q)) ||
        (r.referenceNumber && r.referenceNumber.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      return matchesStatus && matchesMethod && matchesSearch;
    });
  }, [receipts, statusFilter, methodFilter, searchQuery]);

  const handlePrintReceipt = (r: Receipt) => {
    setInspectReceipt(r);
    setTimeout(() => {
      triggerPrint('printable-receipt', `Receipt_${r.receiptNumber}`);
    }, 250);
  };

  const handleExportCsv = () => {
    const data = filteredReceipts.map((r) => ({
      'Receipt Number': r.receiptNumber,
      Date: r.receiptDate,
      'Member Number': r.memberNumber,
      'Member Name': r.memberName,
      Amount: r.amount,
      'Payment Method': r.paymentMethod,
      'Receiving Account': r.cashBankAccountName,
      'Contribution Account': r.contributionAccountName,
      Reference: r.referenceNumber || '',
      Status: r.status,
      'Void Reason': r.voidReason || '',
      'Created By': r.createdBy,
      Notes: r.notes || '',
    }));
    exportToCsv('Charity_Receipts_Register', data);
  };

  return (
    <div id="receipts-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Contributions & Member Receipts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue auto-numbered official receipts, track regular member contributions, and maintain audited records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="receipts-export-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            id="receipts-print-list-btn"
            onClick={() => triggerPrint('receipts-view', 'Charity_Receipts_Register')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download PDF</span>
          </button>

          {user?.role !== 'viewer' && (
            <button
              id="create-receipt-btn"
              onClick={() => handleOpenCreate()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Receipt</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="receipt-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt #, member, reference..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          {/* Method Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Method:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Online">Online</option>
              <option value="Other">Other</option>
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
              <option value="all">All Statuses</option>
              <option value="valid">Received / Valid</option>
              <option value="pledged">Pledged / Announced</option>
              <option value="draft">Draft</option>
              <option value="voided">Cancelled / Void</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Contributor</th>
                <th className="py-3 px-4">Charity Case / Allocation</th>
                <th className="py-3 px-4">Holding Custodian / Account</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ReceiptText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">No receipts found matching your criteria.</p>
                    {user?.role !== 'viewer' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCreate()}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Issue First Receipt</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr
                    key={r.id}
                    id={`receipt-row-${r.receiptNumber}`}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      r.status === 'voided' ? 'bg-rose-50/20 opacity-70' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                      <TransactionLink
                        transactionId={r.id}
                        transactionNumber={r.receiptNumber}
                        originBreadcrumb={[{ label: 'Receipts', tab: 'receipts' }]}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{r.receiptDate}</td>
                    <td className="py-3 px-4">
                      <MemberLink
                        memberId={r.memberId}
                        memberName={r.memberName}
                        memberNumber={r.memberNumber}
                        originBreadcrumb={[{ label: 'Receipts', tab: 'receipts' }]}
                        className="font-semibold text-slate-900 hover:text-emerald-700 block"
                      />
                      <div className="text-[11px] text-slate-400 font-mono">{r.memberNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      {r.caseId ? (
                        <div>
                          <CaseLink
                            caseId={r.caseId}
                            caseNumber={r.caseNumber || 'CASE'}
                            caseTitle={r.caseTitle || r.purpose || 'Charity Case'}
                            originBreadcrumb={[{ label: 'Receipts', tab: 'receipts' }]}
                            className="font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1"
                          />
                          {r.purpose && r.purpose !== r.caseTitle && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{r.purpose}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {r.contributionMonths && r.contributionMonths.length > 1
                              ? `${r.contributionMonths.length} Months (${r.contributionMonths.map((m) => formatContributionMonthShort(m)).join(', ')})`
                              : formatContributionMonth(r.contributionMonths?.[0] || r.contributionMonth || r.periodMonth || 'Monthly Dues')}
                          </span>
                          {r.notes && !r.notes.startsWith('Monthly Contribution') && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[160px] mt-0.5">{r.notes}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {r.custodianMemberName || (r.cashBankAccountName && r.cashBankAccountName.startsWith('Cash in Hand')) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <Wallet className="w-3.5 h-3.5 shrink-0" />
                            <span>Held by {r.custodianMemberName || r.cashBankAccountName?.replace('Cash in Hand - ', '')}</span>
                          </span>
                        ) : (
                          <span>{r.cashBankAccountName}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.paymentMethod} {r.referenceNumber ? `• Ref: ${r.referenceNumber}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                      <div>
                        {formatCurrency(r.amount, r.currency || settings.currency)}
                      </div>
                      {r.currency && r.currency !== settings.currency && (
                        <div className="text-[10px] font-normal text-slate-500 font-mono">
                          ≈ {formatCurrency(r.baseCurrencyAmount || r.amount, settings.currency)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(() => {
                        const badge = getReceiptStatusBadge(r.status);
                        return (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          id={`view-receipt-${r.receiptNumber}`}
                          onClick={() => setInspectReceipt(r)}
                          title="View Official Receipt"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          id={`print-receipt-${r.receiptNumber}`}
                          onClick={() => handlePrintReceipt(r)}
                          title="Download Receipt PDF"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          <FileDown className="w-4 h-4 text-emerald-600" />
                        </button>

                        {user?.role !== 'viewer' && (
                          <button
                            id={`edit-receipt-${r.receiptNumber}`}
                            onClick={() => handleOpenEdit(r)}
                            title="Edit Receipt Details & Lifecycle Status"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {user?.role === 'administrator' && r.status !== 'voided' && (
                          <button
                            id={`void-receipt-${r.receiptNumber}`}
                            onClick={() => {
                              setVoidTargetReceipt(r);
                              setVoidReason('');
                            }}
                            title="Void Receipt (Admin only)"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
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

      {/* Official Printable Receipt Modal (Section 6) */}
      {inspectReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Actions Bar (hidden when printing) */}
            <div className="no-print p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Official Charity Receipt Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="print-receipt-modal-btn"
                  onClick={() => triggerPrint('printable-receipt', inspectReceipt ? `Receipt_${inspectReceipt.receiptNumber}` : 'Official_Receipt')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF (A4)</span>
                </button>
                <button
                  onClick={() => setInspectReceipt(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Layout (Section 6) */}
            <div
              id="printable-receipt"
              className="printable-area flex-1 overflow-y-auto p-8 sm:p-10 bg-white font-sans text-slate-800"
            >
              {/* Header with Charity Logo and Details */}
              <div className="border-b-2 border-emerald-700 pb-5 mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <img
                    src={settings.logoUrl || '/logo.svg'}
                    alt="Logo"
                    className="h-16 max-w-[200px] object-contain rounded-md"
                  />
                  <div>
                    <h2 className="text-xl font-bold font-brand text-emerald-950 tracking-wide">
                      {settings.receiptTemplate?.headerTitle || settings.charityName}
                    </h2>
                    {settings.tagline && (
                      <p className="text-[11px] text-emerald-800 font-medium">
                        {settings.tagline}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 mt-0.5">
                      {settings.address}
                      {settings.city && `, ${settings.city}`}
                      {settings.country && `, ${settings.country}`}
                    </p>
                    <p className="text-xs text-slate-600">
                      Phone: {settings.phone} • Email: {settings.email}
                    </p>
                    {settings.registrationNumber && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Reg No: {settings.registrationNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs uppercase tracking-widest rounded mb-2">
                    {settings.receiptTemplate?.headerSubtitle || 'Official Receipt'}
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900">
                    {inspectReceipt.receiptNumber}
                  </p>
                  <p className="text-xs text-slate-600">Date: {inspectReceipt.receiptDate}</p>
                  {(() => {
                    const badge = getReceiptStatusBadge(inspectReceipt.status);
                    return (
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${badge.className}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Receipt Body Table */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Received With Thanks From:
                    </span>
                    <MemberLink
                      memberId={inspectReceipt.memberId}
                      memberName={inspectReceipt.memberName}
                      memberNumber={inspectReceipt.memberNumber}
                      originBreadcrumb={[{ label: 'Receipts', tab: 'receipts' }]}
                      className="font-bold text-slate-900 text-sm mt-0.5 hover:text-emerald-700 block"
                    />
                    <p className="text-xs font-mono text-emerald-800">
                      Member ID: {inspectReceipt.memberNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Contribution Purpose / Account:
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {inspectReceipt.contributionAccountName}
                    </p>
                    <p className="text-xs text-slate-600">
                      Method: {inspectReceipt.paymentMethod}
                    </p>
                  </div>
                </div>

                {/* Multi-Month / Contribution Period Coverage Banner */}
                {inspectReceipt.contributionMonths && inspectReceipt.contributionMonths.length > 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        Monthly Contribution Coverage ({inspectReceipt.contributionMonths.length} Months):
                      </span>
                      <span className="font-semibold">
                        {formatMonthsBreakdown(inspectReceipt.contributionMonths)}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-200/80 text-emerald-900 font-mono text-[11px] font-bold shrink-0">
                      {inspectReceipt.contributionMonths.length} Months Paid
                    </span>
                  </div>
                ) : (inspectReceipt.contributionMonth || inspectReceipt.periodMonth) ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 flex items-center justify-between">
                    <span className="text-slate-500">Contribution Period:</span>
                    <span className="font-bold text-slate-900">
                      {formatContributionMonth(inspectReceipt.contributionMonth || inspectReceipt.periodMonth)}
                    </span>
                  </div>
                ) : null}

                {/* Amount Box */}
                <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-800 uppercase font-semibold">
                      Amount Received:
                    </span>
                    <p className="text-xs font-medium text-slate-700 italic mt-0.5">
                      {numberToWords(inspectReceipt.amount, inspectReceipt.currency || settings.currency)}
                    </p>
                    {(() => {
                      const snap = getRecordExchangeRateSnapshot(inspectReceipt, settings.currency);
                      const baseAmt = getHistoricalBaseAmount(inspectReceipt, settings.currency);
                      if (snap.fromCurrency === snap.toCurrency) return null;
                      return (
                        <p className="text-[11px] text-emerald-800 font-mono mt-1">
                          Exchange Rate: 1 {snap.fromCurrency} = {snap.rate} {snap.toCurrency} (Base Eqv: {formatCurrency(baseAmt, snap.toCurrency)})
                          <span className="ml-1 text-[10px] text-slate-500 font-sans">
                            [Locked Snapshot: {snap.asOfDate}]
                          </span>
                        </p>
                      );
                    })()}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-display font-bold text-emerald-800">
                      {formatCurrency(inspectReceipt.amount, inspectReceipt.currency || settings.currency)}
                    </span>
                    {(() => {
                      const snap = getRecordExchangeRateSnapshot(inspectReceipt, settings.currency);
                      const baseAmt = getHistoricalBaseAmount(inspectReceipt, settings.currency);
                      if (snap.fromCurrency === snap.toCurrency) return null;
                      return (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          ≈ {formatCurrency(baseAmt, snap.toCurrency)}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Additional details */}
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">
                      Receiving Account / Cash Custodian:
                    </span>
                    <p className="font-medium text-slate-800">{inspectReceipt.cashBankAccountName}</p>
                    {(inspectReceipt.custodianMemberName || (inspectReceipt.cashBankAccountName && inspectReceipt.cashBankAccountName.startsWith('Cash in Hand'))) && (
                      <p className="text-[11px] text-emerald-800 font-bold mt-1 inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 inline" />
                        <span>Held by Custodian: {inspectReceipt.custodianMemberName || inspectReceipt.cashBankAccountName?.replace('Cash in Hand - ', '')}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-semibold">
                      Payment Reference:
                    </span>
                    <p className="font-medium text-slate-800">
                      {inspectReceipt.referenceNumber || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Linked Charity Case Banner */}
                {(inspectReceipt.caseTitle || inspectReceipt.caseId) && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-950">
                    <div className="flex items-center gap-2 min-w-0">
                      <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-amber-700 block">
                          Allocated to Charity Case
                        </span>
                        <span className="font-semibold block truncate">
                          {inspectReceipt.caseTitle || 'Special Cause Allocation'}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 font-mono text-[10px] font-bold shrink-0">
                      Restricted Cause
                    </span>
                  </div>
                )}

                {inspectReceipt.notes && (
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Remarks: </span>
                    {inspectReceipt.notes}
                  </div>
                )}

                {/* Supporting Document / Deposit Slip */}
                {(inspectReceipt.supportingDocumentName ||
                  inspectReceipt.supportingDocumentUrl ||
                  inspectReceipt.supportingDocumentData) && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3 text-xs text-blue-950">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold block truncate">
                          Deposit / Transfer Slip: {inspectReceipt.supportingDocumentName || 'Attached Document'}
                        </span>
                        {inspectReceipt.supportingDocumentSize ? (
                          <span className="text-[10px] text-blue-600">
                            {(inspectReceipt.supportingDocumentSize / 1024).toFixed(1)} KB
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {(inspectReceipt.supportingDocumentUrl || inspectReceipt.supportingDocumentData) && (
                      <div className="flex items-center gap-2 no-print shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              name: inspectReceipt.supportingDocumentName || 'Receipt Document',
                              url:
                                inspectReceipt.supportingDocumentUrl ||
                                inspectReceipt.supportingDocumentData ||
                                '',
                              type: inspectReceipt.supportingDocumentType,
                            })
                          }
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Document</span>
                        </button>
                        <a
                          href={
                            inspectReceipt.supportingDocumentUrl ||
                            inspectReceipt.supportingDocumentData
                          }
                          download={inspectReceipt.supportingDocumentName || 'receipt-attachment'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 border border-blue-300 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {inspectReceipt.voidReason && (
                  <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    <span className="font-semibold">Void Reason: </span>
                    {inspectReceipt.voidReason}
                  </div>
                )}
                {/* Thank-You Message Banner */}
                {(settings.receiptTemplate?.thankYouMessage || settings.footerText) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-950 text-center rounded-lg">
                    {settings.receiptTemplate?.thankYouMessage || settings.footerText}
                  </div>
                )}

                {/* Terms and conditions */}
                {settings.receiptTemplate?.termsAndConditions && (
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600">
                    <strong className="text-slate-800 block mb-0.5">Terms & Conditions:</strong>
                    {settings.receiptTemplate.termsAndConditions}
                  </div>
                )}
              </div>

              {/* Signatures, QR Code & Stamp Block */}
              {(settings.receiptTemplate?.showSignatureBlock !== false || (settings.receiptTemplate ? settings.receiptTemplate.showQrCode : true) || settings.receiptTemplate?.showStampArea) && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row items-end justify-between gap-6">
                    {/* QR Code */}
                    {(settings.receiptTemplate ? settings.receiptTemplate.showQrCode : true) && (
                      <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50/80 p-2 rounded-xl shrink-0">
                        <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 shadow-2xs">
                          <QrCode className="w-10 h-10 text-slate-800" />
                        </div>
                        <div className="text-[9px] text-slate-500 space-y-0.5">
                          <span className="font-bold text-slate-800 block">QR VERIFIED</span>
                          <div>Doc: <span className="font-mono">{inspectReceipt.receiptNumber}</span></div>
                          <div>Audit: <span className="text-emerald-700 font-semibold">Valid</span></div>
                        </div>
                      </div>
                    )}

                    {/* Signature Block */}
                    {settings.receiptTemplate?.showSignatureBlock !== false && (
                      <div className={`grid ${(settings.receiptTemplate ? settings.receiptTemplate.showCustodianSignature : true) ? 'grid-cols-3' : 'grid-cols-2'} gap-4 flex-1 text-center text-xs`}>
                        <div className="space-y-2">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                            {settings.receiptTemplate?.preparedByTitle || 'Issued By'}
                          </span>
                          <div className="min-h-8 flex items-end justify-center">
                            <div className="h-5" />
                          </div>
                          <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                            {inspectReceipt.createdBy}
                          </div>
                        </div>

                        {(settings.receiptTemplate ? settings.receiptTemplate.showCustodianSignature : true) && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                              {settings.receiptTemplate?.custodianTitle || 'Custodian / Trustee'}
                            </span>
                            <div className="min-h-8 flex items-end justify-center">
                              {settings.signatureUrl ? (
                                <img
                                  src={settings.signatureUrl}
                                  alt="Authorized Signature"
                                  className="max-h-8 max-w-[100px] object-contain mx-auto"
                                />
                              ) : (
                                <div className="h-5" />
                              )}
                            </div>
                            <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                              {settings.signatoryName || inspectReceipt.custodianMemberName || 'Cash Custodian'}
                              {settings.signatoryDesignation && (
                                <span className="block text-[8px] text-slate-500 font-normal">
                                  {settings.signatoryDesignation}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                            {settings.receiptTemplate?.authorizedSignatoryTitle || 'Authorized Signatory'}
                          </span>
                          <div className="min-h-8 flex items-end justify-center">
                            <div className="h-5" />
                          </div>
                          <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                            Chairman / Auditor
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Official Stamp */}
                    {settings.receiptTemplate?.showStampArea && (
                      <div className="shrink-0 flex items-center justify-center">
                        {settings.stampUrl ? (
                          <img
                            src={settings.stampUrl}
                            alt="Official Stamp"
                            className="w-20 h-20 object-contain rounded-full border border-slate-200 shadow-2xs bg-white p-0.5"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-700/60 bg-emerald-50/30 flex flex-col items-center justify-center p-1 text-center">
                            <span className="text-[7px] uppercase font-bold text-emerald-900 tracking-wider">Official Seal</span>
                            <span className="text-[6px] text-emerald-700 font-medium">{settings.charityName}</span>
                            <span className="text-[6px] text-slate-400 font-mono mt-0.5">{new Date().getFullYear()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-2 italic">
                {settings.receiptTemplate?.footerDisclaimer || 'Thank you for your generous charity contribution!'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Receipt Confirmation Modal */}
      {voidTargetReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Void Receipt {voidTargetReceipt.receiptNumber}?
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Voiding this receipt will mark it invalid, roll back the member's contribution balance,
              deduct the funds from {voidTargetReceipt.cashBankAccountName}, and audit this action.
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
                placeholder="e.g. Member entered wrong amount, duplicate payment entry..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidTargetReceipt(null)}
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

      {/* Create New Receipt Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            id="receipt-create-modal"
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-emerald-600" />
                <span>{editingReceipt ? `Edit Contribution Receipt - ${editingReceipt.receiptNumber}` : 'Issue Member Contribution Receipt'}</span>
              </h2>
              <button onClick={handleCloseCreate} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lifecycle Status */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Lifecycle Status <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: 'valid' as ReceiptStatus, label: 'Received / Valid', desc: 'Cash in Custody & Ledger Updated' },
                      { val: 'pledged' as ReceiptStatus, label: 'Pledged / Announced', desc: 'Committed, Not Yet Handed Over' },
                      { val: 'draft' as ReceiptStatus, label: 'Draft', desc: 'Saved for Verification' },
                      ...(editingReceipt ? [{ val: 'voided' as ReceiptStatus, label: 'Cancelled / Void', desc: 'Invalidated & Reversed' }] : []),
                    ].map((st) => (
                      <button
                        key={st.val}
                        type="button"
                        onClick={() => setFormStatus(st.val)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          formStatus === st.val
                            ? st.val === 'valid'
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                              : st.val === 'pledged'
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                              : st.val === 'voided'
                              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 font-bold'
                              : 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 text-slate-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">{st.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">{st.desc}</div>
                      </button>
                    ))}
                  </div>
                  {formStatus !== 'valid' && (
                    <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>
                        Receipts marked as &ldquo;{formStatus === 'pledged' ? 'Pledged / Announced' : formStatus === 'draft' ? 'Draft' : 'Cancelled / Void'}&rdquo; will not inflate member cash in custody or balance sheets until marked &ldquo;Received / Valid&rdquo;.
                      </span>
                    </p>
                  )}
                </div>

                {/* Member Selector */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Charity Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    id="input-receipt-member"
                    value={formMemberId}
                    onChange={(e) => handleMemberChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.memberNumber} - {m.fullName} ({m.mobileNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Allocate to Charity Case (Optional / Specific Cause) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-emerald-600" />
                      <span>Allocate to Charity Case (Optional / Specific Cause)</span>
                    </label>
                    {formCaseId && (
                      <button
                        type="button"
                        onClick={() => handleCaseChange('')}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Clear Allocation
                      </button>
                    )}
                  </div>
                  <select
                    id="input-receipt-case"
                    value={formCaseId}
                    onChange={(e) => handleCaseChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">General Fund / Unrestricted (Monthly Membership Pledges)</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title} — Beneficiary: {c.beneficiaryName} (Goal: {formatCurrency(c.approvedAmount || c.targetAmount || 0, c.currency || settings.currency)} | Raised: {formatCurrency(c.collectedAmount || 0, c.currency || settings.currency)})
                      </option>
                    ))}
                  </select>

                  {selectedCase && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-700" />
                          <span>Case Progress Tracker: {selectedCase.caseNumber} - {selectedCase.title}</span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-200/80 font-bold text-amber-900">
                          {selectedCase.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-amber-800">
                        <span>Beneficiary: <strong>{selectedCase.beneficiaryName}</strong></span>
                        <span>
                          Raised: <strong>{formatCurrency(selectedCase.collectedAmount || 0, selectedCase.currency || settings.currency)}</strong> of {formatCurrency(selectedCase.approvedAmount || selectedCase.targetAmount || 0, selectedCase.currency || settings.currency)}
                        </span>
                      </div>
                      <div className="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-600 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((selectedCase.collectedAmount || 0) / ((selectedCase.approvedAmount || selectedCase.targetAmount) || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-amber-700 italic pt-0.5">
                        * When submitted, this contribution will be credited directly towards this case's progress and recorded under Restricted Donations & Charity Cases.
                      </p>
                    </div>
                  )}
                </div>

                {/* Receipt Date */}
                <div className={selectedCase ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    id="input-receipt-date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {selectedCase ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contribution Month / Period
                    </label>
                    <input
                      type="month"
                      id="input-receipt-period-month"
                      value={formPeriodMonth}
                      onChange={(e) => setFormPeriodMonth(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <MultiMonthSelector
                      selectedMonths={formSelectedMonths}
                      onChange={handleMonthsChange}
                      paidMonths={memberPaidMonths}
                      currency={formCurrency}
                      ratePerMonth={ratePerMonth}
                      currentAmount={formAmount}
                    />
                  </div>
                )}

                {/* Currency Selection & Exchange Rate */}
                <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block">
                        Transaction Currency <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Select AED (د.إ) for standard UAE treasury or INR (₹) for Indian accounts & field collections
                      </span>
                    </div>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-xs shadow-inner">
                      <button
                        type="button"
                        onClick={() => {
                          setFormCurrency('AED');
                          setManualRateEdited(false);
                          setFormExchangeRate(1);
                          const aedAcc = cashAccounts.find(c => c.currency !== 'INR' && !c.name.toLowerCase().includes('inr')) || cashAccounts[0];
                          if (aedAcc && formCashBankId.toLowerCase().includes('inr')) {
                            setFormCashBankId(aedAcc.id);
                          }
                          if (!formCaseId && formSelectedMonths.length > 0) {
                            setFormAmount(formSelectedMonths.length * baseMonthlyRateAED);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                          formCurrency === 'AED'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        AED (د.إ)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormCurrency('INR');
                          setManualRateEdited(false);
                          setFormExchangeRate(0.0441);
                          const inrAcc = cashAccounts.find(c => c.currency === 'INR' || c.name.toLowerCase().includes('inr') || c.name.toLowerCase().includes('india'));
                          if (inrAcc) {
                            setFormCashBankId(inrAcc.id);
                          }
                          if (!formCaseId && formSelectedMonths.length > 0) {
                            const inrRate = Math.round(baseMonthlyRateAED / 0.0441);
                            setFormAmount(formSelectedMonths.length * inrRate);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                          formCurrency === 'INR'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        INR (₹)
                      </button>
                    </div>
                  </div>

                  {formCurrency !== baseCur && (
                    <div className="pt-2 border-t border-slate-200 space-y-2.5">
                      {editingReceipt && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                          <div>
                            <span className="font-bold text-amber-900 block">Historical Exchange Rate Locked:</span>
                            <span className="text-[11px] text-amber-800 font-mono">
                              1 {formCurrency} = {editingReceipt.exchangeRateSnapshot?.rate || editingReceipt.exchangeRate || 1} {baseCur}
                              <span className="ml-1 text-slate-500 font-sans">
                                (As of {editingReceipt.exchangeRateSnapshot?.asOfDate || editingReceipt.receiptDate})
                              </span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isRateUpdatedToCurrent) {
                                const origRate = editingReceipt.exchangeRateSnapshot?.rate || editingReceipt.exchangeRate || 1;
                                setFormExchangeRate(origRate);
                                setIsRateUpdatedToCurrent(false);
                              } else {
                                setFormExchangeRate(currentGlobalSettingRate);
                                setIsRateUpdatedToCurrent(true);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                              isRateUpdatedToCurrent
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            {isRateUpdatedToCurrent
                              ? 'Revert to Locked Creation Rate'
                              : `Update to Current Rate (1 ${formCurrency} = ${currentGlobalSettingRate} ${baseCur})`}
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Exchange Rate (1 {formCurrency} = ? {baseCur})
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            required
                            value={formExchangeRate}
                            onChange={(e) => {
                              setManualRateEdited(true);
                              setFormExchangeRate(Number(e.target.value));
                              if (editingReceipt) setIsRateUpdatedToCurrent(true);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-mono"
                          />
                        </div>
                        <div className="flex flex-col justify-end">
                          <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                            <span className="font-semibold">Base Equivalent: </span>
                            <span className="font-mono font-bold">
                              {formatCurrency(formBaseEquivalent, baseCur)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>{formCurrency === 'INR' ? 'Amount (INR)' : `Amount (${formCurrency})`}</span>
                      <span className="text-rose-500">*</span>
                      {!selectedCase && formSelectedMonths.length > 0 && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 font-semibold px-1.5 py-0.5 rounded font-sans">
                          Auto: {formSelectedMonths.length} mo × {formCurrency === 'INR' ? '₹' : 'AED '} {ratePerMonth}
                        </span>
                      )}
                    </label>
                    {formCurrency !== baseCur && (
                      <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                        ≈ {formatCurrency(formBaseEquivalent, baseCur)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold text-xs">
                      {formCurrencySymbol}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      id="input-receipt-amount"
                      value={formAmount || ''}
                      onChange={(e) => setFormAmount(Number(e.target.value))}
                      placeholder={formCurrency === 'INR' ? "e.g. 5000" : "e.g. 60"}
                      className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold font-mono"
                    />
                  </div>
                  {!selectedCase && formSelectedMonths.length > 0 && formAmount > (formSelectedMonths.length * ratePerMonth) && (
                    <p className="text-[11px] text-emerald-700 font-medium mt-1">
                      Includes +{formCurrency === 'INR' ? '₹ ' : 'AED '}{(formAmount - (formSelectedMonths.length * ratePerMonth)).toFixed(2)} voluntary extra contribution.
                    </p>
                  )}
                </div>

                {/* Contribution Account */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contribution Account (Income) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="input-receipt-account"
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    {incomeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Receiving Cash / Bank Account */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deposit Into (Cash / Bank) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    id="input-receipt-cashbank"
                    value={formCashBankId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCashBankId(val);
                      if (val.startsWith('custodian_')) {
                        setFormMethod('Cash');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <optgroup label={formCurrency === 'INR' ? "INR Cash & Bank Accounts (Prioritized)" : "Treasury & Bank Accounts"}>
                      {adaptedCashAccounts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.currency ? `(${c.currency})` : ''} — Balance: {formatCurrency(c.currentBalance, c.currency || settings.currency)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Member Cash Custodians / Field Collectors (Physical Cash Float)">
                      {members.map((m) => (
                        <option key={`custodian_${m.id}`} value={`custodian_${m.id}`}>
                          Cash in Hand — {m.fullName} ({m.memberNumber})
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {selectedCustodian && (
                    <div className="mt-1.5 p-2 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Cash collected in hand by <strong>{selectedCustodian.fullName}</strong>. Automatically debited to their custodian float ledger.
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    id="input-receipt-method"
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction / Cheque Ref #
                  </label>
                  <input
                    type="text"
                    id="input-receipt-ref"
                    value={formRefNumber}
                    onChange={(e) => setFormRefNumber(e.target.value)}
                    placeholder="e.g. TRF-987654 or CHQ-001"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Supporting Document (Bank Slip / Cheque Copy / Deposit Receipt) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supporting Document (Deposit Slip / Transfer Proof / Cheque Copy)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 shrink-0">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Select File</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleDocumentUpload}
                      />
                    </label>
                    <input
                      type="text"
                      readOnly
                      placeholder="No file chosen (optional)"
                      value={formDocName}
                      className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                    />
                    {formFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormFile(null);
                          setFormDocName('');
                        }}
                        className="px-2 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                        title="Remove attached file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remarks / Purpose
                  </label>
                  <textarea
                    rows={2}
                    id="input-receipt-notes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Monthly contribution for March 2026..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Accounting Preview Info */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
                  <span>Real-Time Double-Entry Ledger Impact:</span>
                </div>
                <div className="space-y-1 text-slate-700 font-sans">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Debit (Asset Increase): </span>
                      <span>{depositAccountLabel}</span>
                    </div>
                    <div className="font-mono font-bold text-emerald-800 shrink-0 ml-2">
                      +{formCurrencySymbol} {Number(formAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {formCurrency !== baseCur && (
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (≈ {baseCur} {Number(formBaseEquivalent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900">Credit (Income Recognized): </span>
                      <span>{creditAccountLabel}</span>
                    </div>
                    <div className="font-mono font-bold text-emerald-800 shrink-0 ml-2">
                      +{formCurrencySymbol} {Number(formAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {formCurrency !== baseCur && (
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (≈ {baseCur} {Number(formBaseEquivalent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium italic pt-1 border-t border-emerald-200/60 flex items-center justify-between">
                  <span>✓ Balanced double-entry transaction record.</span>
                  {selectedCase && (
                    <span className="text-amber-800 font-semibold font-mono text-[10px]">
                      Tracked under Case #{selectedCase.caseNumber}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {editingReceipt && (
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(editingReceipt)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
                      title="Download clean formatted A4 PDF for this receipt"
                    >
                      <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Download PDF</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    id="submit-receipt-btn"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting
                      ? (editingReceipt ? 'Updating...' : 'Issuing...')
                      : (editingReceipt ? 'Update Receipt' : 'Generate & Issue Receipt')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="font-bold text-sm text-slate-900 truncate">
                  {previewDoc.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
              {previewDoc.url.startsWith('data:image/') ||
              previewDoc.url.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.name}
                  className="max-h-[70vh] max-w-full object-contain rounded shadow-xs"
                />
              ) : previewDoc.url.startsWith('data:application/pdf') ||
                previewDoc.url.match(/\.pdf($|\?)/i) ? (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  className="w-full h-[70vh] border-0 rounded"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl shadow-xs border border-slate-200 max-w-md">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-800 mb-1">{previewDoc.name}</p>
                  <p className="text-[11px] text-slate-500 mb-4">
                    This file format cannot be rendered directly in-browser.
                  </p>
                  <a
                    href={previewDoc.url}
                    download={previewDoc.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
