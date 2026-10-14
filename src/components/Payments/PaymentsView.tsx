import React, { useState, useMemo, useEffect } from 'react';
import {
  HeartHandshake,
  Search,
  Plus,
  FileDown,
  Download,
  Eye,
  Ban,
  X,
  Calendar,
  AlertCircle,
  FileText,
  Upload,
  UserCheck,
  CheckCircle2,
  Briefcase,
  Coffee,
  Pencil,
  QrCode,
  Wallet,
  Users,
  Check,
  HelpCircle,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { CharityPayment, CharityCategory, PaymentMethod } from '../../types';
import {
  CHARITY_CATEGORIES,
  ADMIN_EXPENSE_CATEGORIES,
  getDefaultAssistanceAccountCode,
  getDefaultAdminExpenseAccountCode,
} from '../../utils/defaults';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { numberToWords } from '../../utils/numberToWords';
import { uploadDocument } from '../../lib/storage';
import { TransactionLink, CaseLink, CustodianLink } from '../Common/ClickableEntity';
import {
  FinancialLedgerService,
  getHistoricalBaseAmount,
  getRecordExchangeRateSnapshot,
} from '../../services/financialLedgerService';

interface PaymentsViewProps {
  initialSelectedPaymentId?: string;
  isCreateOpen?: boolean;
  onCloseCreate?: () => void;
  initialDisbursementKind?: 'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE_EXPENSE';
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  initialSelectedPaymentId,
  isCreateOpen: parentIsCreateOpen,
  onCloseCreate: parentOnCloseCreate,
  initialDisbursementKind = 'CHARITY_ASSISTANCE',
}) => {
  const {
    payments,
    accounts,
    cashAccounts,
    settings,
    createPayment,
    voidPayment,
    cases,
    members,
    cashHoldings,
    receipts,
  } = useCharity();
  const { user, isAdmin } = useAuth();
  const { openTransactionEditor } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'voided'>('all');
  const [paymentKindFilter, setPaymentKindFilter] = useState<
    'all' | 'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE_EXPENSE'
  >('all');

  const [inspectPayment, setInspectPayment] = useState<CharityPayment | null>(() => {
    if (initialSelectedPaymentId) {
      return payments.find((p) => p.id === initialSelectedPaymentId) || null;
    }
    return null;
  });

  const [isLocalCreateOpen, setIsLocalCreateOpen] = useState(false);
  const isCreateOpen = Boolean(parentIsCreateOpen || isLocalCreateOpen);

  const handleCloseCreate = () => {
    setIsLocalCreateOpen(false);
    if (parentOnCloseCreate) parentOnCloseCreate();
  };

  // Void modal state
  const [voidTargetPayment, setVoidTargetPayment] = useState<CharityPayment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // Form State - Simplified & Plain Language
  const [formDisbursementKind, setFormDisbursementKind] = useState<
    'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE_EXPENSE'
  >(initialDisbursementKind);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  // Option A fields (Direct Charity Relief)
  const [formCaseId, setFormCaseId] = useState<string>('');
  const [formPayeeName, setFormPayeeName] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState<string>('AED');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [manualRateEdited, setManualRateEdited] = useState(false);
  const [formPaidByMemberId, setFormPaidByMemberId] = useState<string>('');
  const [formCashBankId, setFormCashBankId] = useState<string>('');
  const [formMethod, setFormMethod] = useState<PaymentMethod>('Cash');
  const [formMobile, setFormMobile] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDocName, setFormDocName] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Option B fields (General Expense)
  const [formGeneralExpenseType, setFormGeneralExpenseType] = useState<string>('Refreshments');
  const [formNotes, setFormNotes] = useState('');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formRefNumber, setFormRefNumber] = useState('');

  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; type?: string } | null>(
    null
  );
  const [formApprovedBy, setFormApprovedBy] = useState(user?.displayName || 'Charity Board');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseCur = settings.currency || 'AED';

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

  const formBaseEquivalent =
    formExchangeRate && formAmount > 0
      ? Math.round(formAmount * formExchangeRate * 100) / 100
      : formAmount;

  // Active Charity Cases
  const activeCases = useMemo(() => {
    return cases.filter((c) => c.status !== 'CANCELLED' && c.status !== 'COMPLETED');
  }, [cases]);

  // List of Custodians with their real-time cash-in-hand balances
  const custodiansList = useMemo(() => {
    const result = FinancialLedgerService.getCashCustodians(members, cashHoldings, payments, receipts, settings.currency || 'AED');
    const list = [...result.custodians];
    const existingIds = new Set(list.map((c) => c.memberId));
    members.forEach((m) => {
      if (!existingIds.has(m.id)) {
        list.push({
          memberId: m.id,
          memberNumber: m.memberNumber,
          memberName: m.fullName,
          phone: m.mobileNumber,
          cashInHand: m.cashBalances?.[settings.currency || 'AED'] || 0,
          cashInHandByCurrency: m.cashBalances || {},
          allocatedPurpose: 'Charity Custodian',
          collectionDate: '',
          status: 'ACTIVE',
          transactionsCount: 0,
        });
      }
    });
    return list;
  }, [members, cashHoldings, payments, receipts, settings.currency]);

  // Unified Make a Payment handler
  const handleOpenCreate = (
    kind: 'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE_EXPENSE' = 'CHARITY_ASSISTANCE'
  ) => {
    setFormDisbursementKind(kind);
    const firstActiveCase = activeCases[0] || cases[0];
    setFormCaseId(firstActiveCase?.id || '');
    setFormGeneralExpenseType('Refreshments');

    if (kind === 'CHARITY_ASSISTANCE') {
      setFormPayeeName(firstActiveCase?.beneficiaryName || '');
      setFormMobile(firstActiveCase?.beneficiaryMobile || '');
      setFormAmount(500);
      setFormNotes('');
    } else {
      setFormPayeeName('Cafeteria / Refreshments');
      setFormMobile('');
      setFormAmount(150);
      setFormNotes('Hospitality refreshments and tea for charity committee');
    }

    setFormAddress('');
    setFormInvoiceNumber('');
    setFormCurrency(settings.currency || 'AED');
    setFormExchangeRate(1);
    setManualRateEdited(false);
    setFormMethod('Cash');

    // Default to the first custodian who has cash in hand, or fallback
    const topCustodian = custodiansList.find((c) => c.cashInHand > 0) || custodiansList[0];
    if (topCustodian) {
      setFormPaidByMemberId(topCustodian.memberId);
    } else {
      setFormPaidByMemberId('');
    }

    setFormCashBankId(cashAccounts[0]?.id || accounts.find((a) => a.code === '1010')?.id || '');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormRefNumber('');
    setFormDocName('');
    setFormFile(null);
    setFormApprovedBy(user?.displayName || 'Charity Board');
    setFormError('');
    setIsLocalCreateOpen(true);
  };

  // When a charity case is selected from dropdown, prefill details intuitively
  const handleCaseSelect = (caseId: string) => {
    setFormCaseId(caseId);
    const selected = cases.find((c) => c.id === caseId);
    if (selected) {
      if (selected.beneficiaryName) {
        setFormPayeeName(selected.beneficiaryName);
      }
      if (selected.beneficiaryMobile) {
        setFormMobile(selected.beneficiaryMobile);
      }
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormFile(file);
      setFormDocName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formAmount <= 0) {
      setFormError('Please enter a payment amount greater than zero.');
      return;
    }

    const selectedCustodian = custodiansList.find((c) => c.memberId === formPaidByMemberId);
    const selectedCase = cases.find((c) => c.id === formCaseId);

    // Validation for Direct Charity Relief
    if (formDisbursementKind === 'CHARITY_ASSISTANCE') {
      if (!formCaseId) {
        setFormError('Please select which charity case this relief is for.');
        return;
      }
      if (!formPayeeName.trim()) {
        setFormError('Please enter the beneficiary or person receiving the money.');
        return;
      }
    } else {
      // Validation for General Expense
      if (!formGeneralExpenseType) {
        setFormError('Please select an expense type.');
        return;
      }
      if (!formPayeeName.trim()) {
        setFormPayeeName(formGeneralExpenseType);
      }
    }

    setIsSubmitting(true);
    try {
      let docPayload: {
        name?: string;
        url?: string;
        dataUrl?: string;
        type?: string;
        size?: number;
      } = {};

      if (formFile) {
        try {
          const uploaded = await uploadDocument(formFile, 'payments');
          docPayload = {
            name: uploaded.name,
            url: uploaded.url,
            dataUrl: uploaded.dataUrl,
            type: uploaded.type,
            size: uploaded.size,
          };
        } catch (upErr) {
          console.warn('Document processing fallback:', upErr);
        }
      }

      if (formDisbursementKind === 'CHARITY_ASSISTANCE') {
        const created = await createPayment({
          disbursementType: 'CHARITY_ASSISTANCE',
          caseId: formCaseId,
          payeeName: formPayeeName.trim(),
          mobileNumber: formMobile.trim(),
          address: formAddress.trim(),
          charityCategory: selectedCase?.category || 'Medical Assistance',
          amount: Number(formAmount),
          currency: formCurrency,
          exchangeRate: formCurrency !== baseCur ? formExchangeRate : 1,
          baseCurrencyAmount: formBaseEquivalent,
          paymentMethod: formMethod || 'Cash',
          cashBankAccountId: formCashBankId || cashAccounts[0]?.id || '',
          paidByType: selectedCustodian ? 'MEMBER_CUSTODIAN' : 'CHARITY_ACCOUNT',
          paidByMemberId: selectedCustodian?.memberId,
          paidByMemberName: selectedCustodian?.memberName,
          paidByMemberNumber: selectedCustodian?.memberNumber,
          paymentDate: formDate,
          referenceNumber: formRefNumber.trim(),
          description:
            formNotes.trim() ||
            `Charity relief aid for ${selectedCase?.title || 'Case'} handed to ${formPayeeName.trim()}`,
          supportingDocumentName: docPayload.name || formDocName,
          supportingDocumentUrl: docPayload.url || '',
          supportingDocumentData: docPayload.dataUrl || '',
          supportingDocumentType: docPayload.type || '',
          supportingDocumentSize: docPayload.size || 0,
          approvedBy: formApprovedBy.trim() || user?.displayName || 'Charity Board',
          notes: formNotes.trim(),
        });
        handleCloseCreate();
        setInspectPayment(created);
      } else {
        // Map General Expense type to default accounts in background
        const expenseTypeToCategory: Record<string, string> = {
          Refreshments: 'Refreshment & Meeting Hospitality',
          'Printing/Stationery': 'Printing & Stationery',
          Rent: 'Office Rent & Facilities',
          'Travel/Transport': 'Travel & Transportation',
          Other: 'Other Administrative Expenses',
        };

        const adminCategory =
          expenseTypeToCategory[formGeneralExpenseType] || formGeneralExpenseType || 'Printing & Stationery';

        const created = await createPayment({
          disbursementType: 'ADMINISTRATIVE_EXPENSE',
          adminExpenseCategory: adminCategory,
          payeeName: formPayeeName.trim() || adminCategory,
          invoiceNumber: formInvoiceNumber.trim(),
          amount: Number(formAmount),
          currency: formCurrency,
          exchangeRate: formCurrency !== baseCur ? formExchangeRate : 1,
          baseCurrencyAmount: formBaseEquivalent,
          paymentMethod: formMethod || 'Cash',
          cashBankAccountId: formCashBankId || cashAccounts[0]?.id || '',
          paidByType: selectedCustodian ? 'MEMBER_CUSTODIAN' : 'CHARITY_ACCOUNT',
          paidByMemberId: selectedCustodian?.memberId,
          paidByMemberName: selectedCustodian?.memberName,
          paidByMemberNumber: selectedCustodian?.memberNumber,
          paymentDate: formDate,
          referenceNumber: formRefNumber.trim(),
          description: formNotes.trim() || `${adminCategory} expense`,
          supportingDocumentName: docPayload.name || formDocName,
          supportingDocumentUrl: docPayload.url || '',
          supportingDocumentData: docPayload.dataUrl || '',
          supportingDocumentType: docPayload.type || '',
          supportingDocumentSize: docPayload.size || 0,
          approvedBy: formApprovedBy.trim() || user?.displayName || 'Charity Board',
          notes: formNotes.trim(),
        });
        handleCloseCreate();
        setInspectPayment(created);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTargetPayment) return;
    if (!voidReason.trim()) {
      alert('Please provide a valid reason for voiding this voucher.');
      return;
    }

    setIsVoiding(true);
    try {
      await voidPayment(voidTargetPayment.id, voidReason.trim());
      setVoidTargetPayment(null);
      setVoidReason('');
      if (inspectPayment?.id === voidTargetPayment.id) {
        setInspectPayment(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to void payment voucher.');
    } finally {
      setIsVoiding(false);
    }
  };

  const handleDownloadVoucherPdf = (p: CharityPayment) => {
    setInspectPayment(p);
    setTimeout(() => {
      triggerPrint('printable-payment-voucher', `Voucher_${p.paymentNumber}`);
    }, 250);
  };

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const isOperatingExpense =
        p.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
        (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(p.charityCategory as any);

      if (paymentKindFilter === 'ADMINISTRATIVE_EXPENSE' && !isOperatingExpense) return false;
      if (paymentKindFilter === 'CHARITY_ASSISTANCE' && isOperatingExpense) return false;

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesCat = categoryFilter === 'all' || p.charityCategory === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.paymentNumber.toLowerCase().includes(q) ||
        p.payeeName.toLowerCase().includes(q) ||
        (p.mobileNumber && p.mobileNumber.toLowerCase().includes(q)) ||
        (p.charityCategory && p.charityCategory.toLowerCase().includes(q)) ||
        (p.adminExpenseCategory && p.adminExpenseCategory.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
        (p.caseTitle && p.caseTitle.toLowerCase().includes(q)) ||
        (p.caseNumber && p.caseNumber.toLowerCase().includes(q)) ||
        (p.paidByMemberName && p.paidByMemberName.toLowerCase().includes(q));

      return matchesStatus && matchesCat && matchesSearch;
    });
  }, [payments, statusFilter, categoryFilter, searchQuery, paymentKindFilter]);

  const handleExportCsv = () => {
    const data = filteredPayments.map((p) => ({
      'Voucher Number': p.paymentNumber,
      Date: p.paymentDate,
      'Payee Name': p.payeeName,
      'Payment Type':
        p.disbursementType === 'ADMINISTRATIVE_EXPENSE' ? 'General Expense' : 'Direct Charity Relief',
      'Charity Case': p.caseTitle || p.caseNumber || 'N/A',
      Category: p.adminExpenseCategory || p.charityCategory,
      'Paid By (Custodian)': p.paidByMemberName || p.cashBankAccountName,
      Amount: p.amount,
      Currency: p.currency || settings.currency,
      'Base Amount (AED)': p.baseCurrencyAmount || p.amount,
      'Payment Method': p.paymentMethod,
      Reference: p.referenceNumber || '',
      Status: p.status === 'valid' ? 'Paid' : 'Voided',
      Description: p.description,
    }));
    exportToCsv('Charity_Payments_Register', data);
  };

  return (
    <div id="payments-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Payments & Disbursements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Record direct charity relief for cases and general expenses with simple, plain-language vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="payments-export-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            id="payments-print-list-btn"
            onClick={() => triggerPrint('payments-view', 'Charity_Payments_Register')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>

          {/* Unified Primary Button - Only Admin can disburse payments */}
          {isAdmin ? (
            <button
              id="create-payment-btn"
              onClick={() => handleOpenCreate('CHARITY_ASSISTANCE')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record New Payment / Disbursement</span>
            </button>
          ) : (
            <span
              title="Only Administrators can approve or disburse charity and operating funds"
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold cursor-not-allowed select-none"
            >
              <span>Disbursements (Admin Only)</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Kind Filter Tabs */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setPaymentKindFilter('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                paymentKindFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Disbursements
            </button>
            <button
              type="button"
              onClick={() => setPaymentKindFilter('CHARITY_ASSISTANCE')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                paymentKindFilter === 'CHARITY_ASSISTANCE'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Direct Charity Relief</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentKindFilter('ADMINISTRATIVE_EXPENSE')}
              className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                paymentKindFilter === 'ADMINISTRATIVE_EXPENSE'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>General Expenses</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="payment-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payee, voucher #, case, custodian..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="valid">Paid / Valid</option>
              <option value="voided">Voided Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Streamlined Payments Table Matching Contributions & Receipts Styling */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Voucher #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Payment Type / Case</th>
                <th className="py-3 px-4">Beneficiary / Payee</th>
                <th className="py-3 px-4">Paid By (Custodian)</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      No payments or disbursements recorded yet.
                    </p>
                    {user?.role !== 'viewer' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCreate('CHARITY_ASSISTANCE')}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Record First Payment</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isOperatingExpense =
                    p.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
                    (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(p.charityCategory as any);

                  return (
                    <tr
                      key={p.id}
                      id={`payment-row-${p.paymentNumber}`}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        p.status === 'voided' ? 'bg-rose-50/20 opacity-70' : ''
                      }`}
                    >
                      {/* 1. Voucher # */}
                      <td className="py-3 px-4 font-mono font-bold text-rose-800">
                        <TransactionLink
                          transactionId={p.id}
                          transactionNumber={p.paymentNumber}
                          originBreadcrumb={[{ label: 'Payments', tab: 'payments' }]}
                        />
                      </td>

                      {/* 2. Date */}
                      <td className="py-3 px-4 font-mono text-slate-600">{p.paymentDate}</td>

                      {/* 3. Payment Type / Case */}
                      <td className="py-3 px-4">
                        {!isOperatingExpense ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                              <HeartHandshake className="w-3 h-3 text-rose-500" />
                              <span>Direct Relief</span>
                            </span>
                            {p.caseId ? (
                              <div>
                                <CaseLink
                                  caseId={p.caseId}
                                  caseNumber={p.caseNumber || 'CASE'}
                                  caseTitle={p.caseTitle || p.charityCategory || 'Relief Case'}
                                  originBreadcrumb={[{ label: 'Payments', tab: 'payments' }]}
                                  className="font-semibold text-emerald-800 hover:text-emerald-950 inline-block text-xs"
                                />
                              </div>
                            ) : (
                              <div className="text-xs font-medium text-slate-800">
                                {p.charityCategory || 'Direct Charity Relief'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wide">
                              <Briefcase className="w-3 h-3 text-amber-600" />
                              <span>General Expense</span>
                            </span>
                            <div className="text-xs font-semibold text-slate-800">
                              {p.adminExpenseCategory || p.charityCategory || 'Operating Expense'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 4. Beneficiary / Payee */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{p.payeeName}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.mobileNumber ? (
                            p.mobileNumber
                          ) : p.invoiceNumber ? (
                            <span className="font-mono">Bill/Inv: {p.invoiceNumber}</span>
                          ) : p.description ? (
                            <span className="truncate max-w-[190px] inline-block">{p.description}</span>
                          ) : (
                            'No phone / invoice'
                          )}
                        </div>
                      </td>

                      {/* 5. Paid By (Custodian) */}
                      <td className="py-3 px-4">
                        {p.paidByMemberId ? (
                          <div>
                            <CustodianLink
                              custodianId={p.paidByMemberId}
                              custodianName={p.paidByMemberName || 'Cash Custodian'}
                              originBreadcrumb={[{ label: 'Payments', tab: 'payments' }]}
                              className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 hover:underline inline-block text-xs"
                            />
                          </div>
                        ) : (
                          <div className="font-medium text-slate-800">
                            {p.cashBankAccountName || 'Central Cash / Bank'}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {p.paymentMethod || 'Cash'}
                        </div>
                      </td>

                      {/* 6. Amount (with INR/AED indicator) */}
                      <td className="py-3 px-4 text-right font-bold text-rose-700 text-sm">
                        <div>
                          {formatCurrency(p.amount, p.currency || settings.currency)}
                        </div>
                        {p.currency && p.currency !== settings.currency && (
                          <div className="text-[10px] font-normal text-slate-500 font-mono">
                            ≈ {formatCurrency(p.baseCurrencyAmount || p.amount, settings.currency)}
                          </div>
                        )}
                      </td>

                      {/* 7. Status (Paid / Draft) */}
                      <td className="py-3 px-4 text-center">
                        {p.status === 'valid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider line-through">
                            Voided
                          </span>
                        )}
                      </td>

                      {/* 8. Actions (View, Download PDF, Edit) */}
                      <td className="py-3 px-4 text-right no-print">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`view-payment-${p.paymentNumber}`}
                            onClick={() => setInspectPayment(p)}
                            title="View Official Payment Voucher"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            id={`download-pdf-${p.paymentNumber}`}
                            onClick={() => handleDownloadVoucherPdf(p)}
                            title="Download Voucher PDF"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            id={`edit-payment-${p.paymentNumber}`}
                            type="button"
                            onClick={() => openTransactionEditor(p.id)}
                            title={`Edit Payment Voucher [${p.paymentNumber}]`}
                            className="p-1.5 rounded hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {user?.role === 'administrator' && p.status === 'valid' && (
                            <button
                              id={`void-payment-${p.paymentNumber}`}
                              onClick={() => {
                                setVoidTargetPayment(p);
                                setVoidReason('');
                              }}
                              title="Void Payment Voucher (Admin only)"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Printable Payment Voucher Modal */}
      {inspectPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Actions Bar (hidden in print) */}
            <div className="no-print p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Official Charity Payment Voucher Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="print-payment-modal-btn"
                  onClick={() =>
                    triggerPrint(
                      'printable-payment-voucher',
                      inspectPayment ? `Voucher_${inspectPayment.paymentNumber}` : 'Payment_Voucher'
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>Download PDF (A4)</span>
                </button>
                <button
                  onClick={() => setInspectPayment(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Layout */}
            <div
              id="printable-payment-voucher"
              className="printable-area flex-1 overflow-y-auto p-8 sm:p-10 bg-white font-sans text-slate-800"
            >
              {/* Header with Charity Logo and Details */}
              <div className="border-b-2 border-slate-800 pb-5 mb-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <img
                    src={settings.logoUrl || '/logo.svg'}
                    alt="Logo"
                    className="h-16 max-w-[200px] object-contain rounded-md"
                  />
                  <div>
                    <h2 className="text-xl font-bold font-brand text-slate-900 tracking-wide">
                      {settings.voucherTemplate?.headerTitle || settings.charityName}
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
                  <div
                    className={`inline-block px-3 py-1 border font-bold text-xs uppercase tracking-widest rounded mb-2 ${
                      inspectPayment.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
                      (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(
                        inspectPayment.charityCategory as any
                      )
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    {settings.voucherTemplate?.headerSubtitle ||
                      (inspectPayment.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
                      (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(
                        inspectPayment.charityCategory as any
                      )
                        ? 'General Expense Voucher'
                        : 'Charity Relief Voucher')}
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900">
                    {inspectPayment.paymentNumber}
                  </p>
                  <p className="text-xs text-slate-600">Date: {inspectPayment.paymentDate}</p>
                  {inspectPayment.status === 'voided' && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-xs uppercase rounded">
                      VOIDED
                    </span>
                  )}
                </div>
              </div>

              {/* Voucher Body Table */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      {inspectPayment.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
                      (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(
                        inspectPayment.charityCategory as any
                      )
                        ? 'Paid To (Vendor / Payee):'
                        : 'Paid To (Beneficiary):'}
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {inspectPayment.payeeName}
                    </p>
                    {inspectPayment.invoiceNumber && (
                      <p className="text-xs text-amber-900 font-semibold font-mono">
                        Invoice / Bill #: {inspectPayment.invoiceNumber}
                      </p>
                    )}
                    <p className="text-xs text-slate-600">
                      Mobile: {inspectPayment.mobileNumber || 'N/A'}
                    </p>
                    {inspectPayment.address && (
                      <p className="text-xs text-slate-500">Address: {inspectPayment.address}</p>
                    )}
                    {inspectPayment.caseId && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="text-xs text-slate-500 font-medium">Relief Case:</span>
                        <CaseLink
                          caseId={inspectPayment.caseId}
                          caseName={inspectPayment.caseTitle}
                          originBreadcrumb={[{ label: 'Payments', tab: 'payments' }]}
                          className="text-xs font-semibold text-emerald-700"
                        />
                      </div>
                    )}
                    {inspectPayment.paidByMemberId && (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-slate-500 font-medium">Paid by Custodian:</span>
                        <CustodianLink
                          custodianId={inspectPayment.paidByMemberId}
                          custodianName={inspectPayment.paidByMemberName}
                          originBreadcrumb={[{ label: 'Payments', tab: 'payments' }]}
                          className="text-xs font-semibold text-amber-900"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      {inspectPayment.disbursementType === 'ADMINISTRATIVE_EXPENSE' ||
                      (ADMIN_EXPENSE_CATEGORIES as readonly string[]).includes(
                        inspectPayment.charityCategory as any
                      )
                        ? 'Expense Category:'
                        : 'Charity Category:'}
                    </span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {inspectPayment.adminExpenseCategory || inspectPayment.charityCategory}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Disbursed via:{' '}
                      {inspectPayment.paidByMemberName
                        ? `Custodian (${inspectPayment.paidByMemberName})`
                        : inspectPayment.cashBankAccountName}{' '}
                      ({inspectPayment.paymentMethod})
                    </p>
                  </div>
                </div>

                {/* Amount Box */}
                <div className="p-4 rounded-lg bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-rose-800 uppercase font-semibold">
                      Amount Paid:
                    </span>
                    <p className="text-xs font-medium text-slate-700 italic mt-0.5">
                      {numberToWords(
                        inspectPayment.amount,
                        inspectPayment.currency || settings.currency
                      )}
                    </p>
                    {(() => {
                      const snap = getRecordExchangeRateSnapshot(inspectPayment, settings.currency);
                      const baseAmt = getHistoricalBaseAmount(inspectPayment, settings.currency);
                      if (snap.fromCurrency === snap.toCurrency) return null;
                      return (
                        <p className="text-[11px] text-rose-800 font-mono mt-1">
                          Exchange Rate: 1 {snap.fromCurrency} = {snap.rate} {snap.toCurrency} (Base
                          Eqv: {formatCurrency(baseAmt, snap.toCurrency)})
                          <span className="ml-1 text-[10px] text-slate-500 font-sans">
                            [Locked Snapshot: {snap.asOfDate}]
                          </span>
                        </p>
                      );
                    })()}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-display font-bold text-rose-700">
                      {formatCurrency(
                        inspectPayment.amount,
                        inspectPayment.currency || settings.currency
                      )}
                    </span>
                    {(() => {
                      const snap = getRecordExchangeRateSnapshot(inspectPayment, settings.currency);
                      const baseAmt = getHistoricalBaseAmount(inspectPayment, settings.currency);
                      if (snap.fromCurrency === snap.toCurrency) return null;
                      return (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          ≈ {formatCurrency(baseAmt, snap.toCurrency)}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Reason / Purpose Description */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-400 uppercase text-[10px] font-semibold block mb-1">
                    Description & Case Details:
                  </span>
                  <p className="text-slate-800 whitespace-pre-wrap font-medium">
                    {inspectPayment.description}
                  </p>
                </div>

                {inspectPayment.supportingDocumentName && (
                  <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-semibold block">
                          Attached Document: {inspectPayment.supportingDocumentName}
                        </span>
                        {inspectPayment.supportingDocumentSize ? (
                          <span className="text-[10px] text-blue-600">
                            {(inspectPayment.supportingDocumentSize / 1024).toFixed(1)} KB
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {(inspectPayment.supportingDocumentUrl ||
                      inspectPayment.supportingDocumentData) && (
                      <div className="flex items-center gap-2 no-print shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              name: inspectPayment.supportingDocumentName || 'Document',
                              url:
                                inspectPayment.supportingDocumentUrl ||
                                inspectPayment.supportingDocumentData ||
                                '',
                              type: inspectPayment.supportingDocumentType,
                            })
                          }
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Document</span>
                        </button>
                        <a
                          href={
                            inspectPayment.supportingDocumentUrl ||
                            inspectPayment.supportingDocumentData
                          }
                          download={inspectPayment.supportingDocumentName || 'document'}
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

                {inspectPayment.referenceNumber && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Payment Reference: </span>
                    {inspectPayment.referenceNumber}
                  </div>
                )}

                {inspectPayment.voidReason && (
                  <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    <span className="font-semibold">Void Reason: </span>
                    {inspectPayment.voidReason}
                  </div>
                )}

                {/* Thank-You / Du'a Message Banner */}
                {settings.voucherTemplate?.thankYouMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-950 text-center rounded-lg">
                    {settings.voucherTemplate.thankYouMessage}
                  </div>
                )}

                {/* Recipient Acknowledgment Section */}
                {settings.voucherTemplate?.showRecipientAcknowledgement !== false &&
                  inspectPayment.disbursementType !== 'ADMINISTRATIVE_EXPENSE' && (
                    <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2 mt-2">
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
                        "
                        {settings.voucherTemplate?.recipientAcknowledgmentText ||
                          'I hereby acknowledge receipt of the assistance amount stated above in full from Udyavar Muslim Unity UAE for the specified relief/medical purpose.'}
                        "
                      </p>
                      <div className="pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Recipient / Beneficiary:
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {inspectPayment.payeeName}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Date: {inspectPayment.paymentDate}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="w-44 ml-auto border-b border-dashed border-slate-500 mb-1" />
                          <span className="text-[10px] font-bold text-slate-700">
                            {settings.voucherTemplate?.recipientSignatureTitle ||
                              "Receiver's Signature / Thumbprint"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Signatures, QR Code & Stamp Block */}
              {(settings.voucherTemplate?.showSignatureBlock !== false ||
                (settings.voucherTemplate ? settings.voucherTemplate.showQrCode : true) ||
                settings.voucherTemplate?.showStampArea) && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    {/* QR Code */}
                    {(settings.voucherTemplate ? settings.voucherTemplate.showQrCode : true) && (
                      <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50/80 p-2 rounded-xl shrink-0">
                        <div className="w-14 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 shadow-2xs">
                          <QrCode className="w-10 h-10 text-slate-800" />
                        </div>
                        <div className="text-[9px] text-slate-500 space-y-0.5">
                          <span className="font-bold text-slate-800 block">QR VERIFIED</span>
                          <div>
                            Doc:{' '}
                            <span className="font-mono">{inspectPayment.paymentNumber}</span>
                          </div>
                          <div>
                            Audit: <span className="text-emerald-700 font-semibold">Valid</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Signature Block */}
                    {settings.voucherTemplate?.showSignatureBlock !== false && (
                      <div
                        className={`grid ${
                          (settings.voucherTemplate
                            ? settings.voucherTemplate.showCustodianSignature
                            : true)
                            ? 'grid-cols-3'
                            : 'grid-cols-2'
                        } gap-4 flex-1 text-center text-xs`}
                      >
                        <div className="space-y-4">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                            {settings.voucherTemplate?.preparedByTitle || 'Prepared By'}
                          </span>
                          <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                            {inspectPayment.createdBy || 'Staff'}
                          </div>
                        </div>

                        {(settings.voucherTemplate
                          ? settings.voucherTemplate.showCustodianSignature
                          : true) && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                              {settings.voucherTemplate?.custodianTitle ||
                                'Custodian / Approved By'}
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
                              {settings.signatoryName ||
                                inspectPayment.paidByMemberName ||
                                inspectPayment.approvedBy ||
                                'Cash Custodian'}
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
                            {settings.voucherTemplate?.authorizedSignatoryTitle ||
                              "Receiver's Signature"}
                          </span>
                          <div className="min-h-8 flex items-end justify-center">
                            <div className="h-5" />
                          </div>
                          <div className="border-t border-dashed border-slate-400 pt-1 text-xs font-semibold text-slate-800">
                            {inspectPayment.payeeName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Official Stamp */}
                    {settings.voucherTemplate?.showStampArea && (
                      <div className="shrink-0 flex items-center justify-center">
                        {settings.stampUrl ? (
                          <img
                            src={settings.stampUrl}
                            alt="Official Stamp"
                            className="w-20 h-20 object-contain rounded-full border border-slate-200 shadow-2xs bg-white p-0.5"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700/60 bg-slate-50/30 flex flex-col items-center justify-center p-1 text-center">
                            <span className="text-[7px] uppercase font-bold text-slate-900 tracking-wider">
                              Official Seal
                            </span>
                            <span className="text-[6px] text-slate-700 font-medium">
                              {settings.charityName}
                            </span>
                            <span className="text-[6px] text-slate-400 font-mono mt-0.5">
                              {new Date().getFullYear()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 text-center text-[11px] text-slate-400 border-t border-slate-100 pt-2 italic">
                {settings.voucherTemplate?.footerDisclaimer ||
                  `Charity Assistance Disbursement Voucher • ${settings.charityName}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Payment Voucher Modal */}
      {voidTargetPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Void Voucher {voidTargetPayment.paymentNumber}?
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Voiding this payment will cancel the voucher, refund{' '}
              {formatCurrency(voidTargetPayment.amount, voidTargetPayment.currency || settings.currency)}{' '}
              back to the source custodian/account, and maintain an audit record.
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
                placeholder="e.g. Assistance canceled, incorrect amount disbursed..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidTargetPayment(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={handleConfirmVoid}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isVoiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beginner-Friendly Unified "Record New Payment" Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            id="payment-create-modal"
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-rose-600" />
                  <span>Record New Payment / Disbursement</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record a charity case payout or general operating expense with automatic ledger entry.
                </p>
              </div>
              <button
                onClick={handleCloseCreate}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2-Choice Toggle at the Very Top (Requirement 1) */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-xl">
                {/* [Option A] Direct Charity Relief */}
                <button
                  type="button"
                  id="toggle-charity-relief"
                  onClick={() => {
                    setFormDisbursementKind('CHARITY_ASSISTANCE');
                    setFormError('');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all cursor-pointer ${
                    formDisbursementKind === 'CHARITY_ASSISTANCE'
                      ? 'bg-white text-slate-900 shadow-xs border border-rose-200 ring-2 ring-rose-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      formDisbursementKind === 'CHARITY_ASSISTANCE'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <span>Direct Charity Relief</span>
                      {formDisbursementKind === 'CHARITY_ASSISTANCE' && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Paying a patient, medical bill, accident case, or needy person
                    </div>
                  </div>
                </button>

                {/* [Option B] General Expense */}
                <button
                  type="button"
                  id="toggle-general-expense"
                  onClick={() => {
                    setFormDisbursementKind('ADMINISTRATIVE_EXPENSE');
                    setFormError('');
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all cursor-pointer ${
                    formDisbursementKind === 'ADMINISTRATIVE_EXPENSE'
                      ? 'bg-white text-slate-900 shadow-xs border border-amber-200 ring-2 ring-amber-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      formDisbursementKind === 'ADMINISTRATIVE_EXPENSE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <span>General Expense</span>
                      {formDisbursementKind === 'ADMINISTRATIVE_EXPENSE' && (
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Tea/refreshments, office supplies, printing, transport, hall rent
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Beginner-Friendly Form Fields */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* OPTION A: DIRECT CHARITY RELIEF (5 Essential Fields)        */}
              {/* ------------------------------------------------------------- */}
              {formDisbursementKind === 'CHARITY_ASSISTANCE' && (
                <div className="space-y-4">
                  {/* Field 1: Which Charity Case? */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      1. Which Charity Case? <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      id="input-relief-case"
                      value={formCaseId}
                      onChange={(e) => handleCaseSelect(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white font-medium text-slate-800"
                    >
                      <option value="" disabled>
                        -- Select Active Charity Case --
                      </option>
                      {activeCases.map((c) => {
                        const remaining = Math.max(0, c.approvedAmount - c.disbursedAmount);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.caseNumber} - {c.title} ({c.category || 'Charity Aid'}) • Needs:{' '}
                            {formatCurrency(remaining, c.currency || settings.currency)}
                          </option>
                        );
                      })}
                    </select>
                    {activeCases.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        No active cases found. You can add cases from the Cases tab first.
                      </p>
                    )}
                  </div>

                  {/* Field 2: Beneficiary / Person Receiving Money */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      2. Beneficiary / Person Receiving Money <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      id="input-relief-beneficiary"
                      value={formPayeeName}
                      onChange={(e) => setFormPayeeName(e.target.value)}
                      placeholder="e.g. Abdul Rasheed (Patient), Anwar Khan, City Hospital, or Pharmacy"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>Name of patient, family member, or institution receiving payment.</span>
                      {formMobile ? <span className="font-mono text-slate-600">Tel: {formMobile}</span> : null}
                    </div>
                  </div>

                  {/* Field 3: Amount & Currency */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        3. Amount & Currency <span className="text-rose-500">*</span>
                      </label>
                      <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setFormCurrency('AED');
                            setManualRateEdited(false);
                          }}
                          className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                            formCurrency === 'AED'
                              ? 'bg-rose-600 text-white shadow-2xs'
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
                          }}
                          className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                            formCurrency === 'INR'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          INR (₹)
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        id="input-relief-amount"
                        value={formAmount || ''}
                        onChange={(e) => setFormAmount(Number(e.target.value))}
                        placeholder="Enter amount to pay"
                        className="w-full px-3 py-2 text-sm sm:text-base font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {formCurrency}
                      </span>
                    </div>

                    {formCurrency !== baseCur && (
                      <div className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-rose-900">Base Conversion:</span>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Locked Rate: 1 {formCurrency} = {formExchangeRate} {baseCur}
                          </p>
                        </div>
                        <span className="font-bold font-mono text-rose-700 text-sm">
                          ≈ {formatCurrency(formBaseEquivalent, baseCur)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Field 4: Paid By (Which Custodian Handed the Cash?) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      4. Paid By (Which Custodian Handed the Cash?) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      id="input-relief-custodian"
                      value={formPaidByMemberId}
                      onChange={(e) => setFormPaidByMemberId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Select Member Custodian --</option>
                      {custodiansList.map((c) => (
                        <option key={c.memberId} value={c.memberId}>
                          {c.memberName} ({c.memberNumber}) • Holds:{' '}
                          {formatCurrency(c.cashInHand, settings.currency)} in cash
                        </option>
                      ))}
                      <option value="CENTRAL_CASH">
                        Main Charity Cash / Bank ({cashAccounts[0]?.name || 'Central Account'})
                      </option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cash will be deducted directly from this custodian's held balance.
                    </p>
                  </div>

                  {/* Field 5: Payment Date & Proof */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        5. Payment Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        id="input-relief-date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Proof / Receipt Upload <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 transition-colors">
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Choose File</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={handleDocumentUpload}
                          />
                        </label>
                        <input
                          type="text"
                          readOnly
                          placeholder="No file chosen"
                          value={formDocName}
                          className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600 truncate"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* OPTION B: GENERAL EXPENSE (4 Simple Fields)                  */}
              {/* ------------------------------------------------------------- */}
              {formDisbursementKind === 'ADMINISTRATIVE_EXPENSE' && (
                <div className="space-y-4">
                  {/* Field 1: Expense Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      1. Expense Type <span className="text-amber-600">*</span>
                    </label>
                    <select
                      required
                      id="input-expense-type"
                      value={formGeneralExpenseType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormGeneralExpenseType(val);
                        if (!formPayeeName || formPayeeName === formGeneralExpenseType) {
                          setFormPayeeName(val);
                        }
                      }}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white font-medium text-slate-800"
                    >
                      <option value="Refreshments">Refreshments (Tea, snacks, committee meetings)</option>
                      <option value="Printing/Stationery">
                        Printing/Stationery (Paper, office supplies, voucher books)
                      </option>
                      <option value="Rent">Rent (Office rent, meeting hall, venue)</option>
                      <option value="Travel/Transport">Travel/Transport (Taxi, delivery, fuel)</option>
                      <option value="Other">Other (Miscellaneous operating expenses)</option>
                    </select>
                  </div>

                  {/* Field 2: Amount & Currency */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        2. Amount & Currency <span className="text-amber-600">*</span>
                      </label>
                      <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setFormCurrency('AED');
                            setManualRateEdited(false);
                          }}
                          className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                            formCurrency === 'AED'
                              ? 'bg-amber-600 text-white shadow-2xs'
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
                          }}
                          className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                            formCurrency === 'INR'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          INR (₹)
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        id="input-expense-amount"
                        value={formAmount || ''}
                        onChange={(e) => setFormAmount(Number(e.target.value))}
                        placeholder="Enter amount paid"
                        className="w-full px-3 py-2 text-sm sm:text-base font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {formCurrency}
                      </span>
                    </div>

                    {formCurrency !== baseCur && (
                      <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-amber-900">Base Conversion:</span>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Locked Rate: 1 {formCurrency} = {formExchangeRate} {baseCur}
                          </p>
                        </div>
                        <span className="font-bold font-mono text-amber-800 text-sm">
                          ≈ {formatCurrency(formBaseEquivalent, baseCur)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Field 3: Paid By (Custodian) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      3. Paid By (Custodian) <span className="text-amber-600">*</span>
                    </label>
                    <select
                      required
                      id="input-expense-custodian"
                      value={formPaidByMemberId}
                      onChange={(e) => setFormPaidByMemberId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Who paid for this expense? --</option>
                      {custodiansList.map((c) => (
                        <option key={c.memberId} value={c.memberId}>
                          {c.memberName} ({c.memberNumber}) • Holds:{' '}
                          {formatCurrency(c.cashInHand, settings.currency)} in cash
                        </option>
                      ))}
                      <option value="CENTRAL_CASH">
                        Main Charity Cash / Bank ({cashAccounts[0]?.name || 'Central Account'})
                      </option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Select who paid out of pocket or from charity cash float.
                    </p>
                  </div>

                  {/* Field 4: Date & Notes */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Payment Date <span className="text-amber-600">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          id="input-expense-date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Vendor / Store Name <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={formPayeeName}
                          onChange={(e) => setFormPayeeName(e.target.value)}
                          placeholder="e.g. Al-Manar Stationery, Cafeteria"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Notes & Description <span className="text-amber-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        id="input-expense-notes"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Brief note on what this was for (e.g. Monthly committee meeting tea and refreshments, voucher booklet printing)"
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Friendly Plain-Language Summary Box (Zero Accounting Jargon) */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-slate-900">Automatic Balance & Case Tracking:</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {formDisbursementKind === 'CHARITY_ASSISTANCE' ? (
                      <>
                        This payout will deduct{' '}
                        <strong className="text-slate-900">
                          {formatCurrency(formAmount || 0, formCurrency)}
                        </strong>{' '}
                        directly from the selected custodian's balance and update the selected
                        Charity Case progress tracker in real time.
                      </>
                    ) : (
                      <>
                        This expense will be deducted from the selected custodian or cash float and
                        automatically classified under{' '}
                        <strong className="text-slate-900">{formGeneralExpenseType}</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="submit-payment-btn"
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors ${
                    formDisbursementKind === 'CHARITY_ASSISTANCE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isSubmitting ? 'Recording...' : 'Confirm & Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800 truncate max-w-md">
                  {previewDoc.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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
