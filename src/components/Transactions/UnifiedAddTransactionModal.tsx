import React, { useState, useMemo } from 'react';
import {
  X,
  PlusCircle,
  Calendar,
  User,
  CreditCard,
  Building,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  HeartHandshake,
  DollarSign,
  TrendingDown,
  Briefcase,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { FinancialTransactionClassification } from '../../types';
import {
  CHARITY_CATEGORIES,
  ADMIN_EXPENSE_CATEGORIES,
  getDefaultAssistanceAccountCode,
  getDefaultAdminExpenseAccountCode,
} from '../../utils/defaults';
import { formatCurrency } from '../../utils/numbering';

interface UnifiedAddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassification?: FinancialTransactionClassification;
  preselectedMemberId?: string;
  preselectedCaseId?: string;
}

export const UnifiedAddTransactionModal: React.FC<UnifiedAddTransactionModalProps> = ({
  isOpen,
  onClose,
  defaultClassification = 'MONTHLY_CONTRIBUTION',
  preselectedMemberId,
  preselectedCaseId,
}) => {
  const {
    members,
    cases,
    accounts,
    cashAccounts,
    receipts,
    settings,
    recordMonthlyContribution,
    recordSpecialContribution,
    recordCharityAssistance,
    recordAdminExpense,
  } = useCharity();

  const [classification, setClassification] =
    useState<FinancialTransactionClassification>(defaultClassification);

  // Common fields
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(settings.currency || 'AED');
  const [exchangeRate, setExchangeRate] = useState<string>('1.0');
  const [paymentMethod, setPaymentMethod] = useState<any>('Cash');
  const [cashBankAccountId, setCashBankAccountId] = useState<string>(() => cashAccounts[0]?.id || '');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Classification specific fields
  // 1. Monthly Contribution
  const [memberId, setMemberId] = useState<string>(() => preselectedMemberId || members[0]?.id || '');
  const [periodMonth, setPeriodMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // 2. Special Contribution & 3. Charity Assistance
  const [caseId, setCaseId] = useState<string>(() => preselectedCaseId || cases[0]?.id || '');

  // 3. Charity Assistance
  const [payeeName, setPayeeName] = useState<string>('');
  const [payeePhone, setPayeePhone] = useState<string>('');
  const [payeeAddress, setPayeeAddress] = useState<string>('');
  const [charityCategory, setCharityCategory] = useState<any>('Medical Assistance');
  const [approvedBy, setApprovedBy] = useState<string>('Charity Chairman');
  const [preparedBy, setPreparedBy] = useState<string>('Finance Officer');
  const [verifiedBy, setVerifiedBy] = useState<string>('Internal Auditor');

  // 4. Admin Expense
  const [adminCategory, setAdminCategory] = useState<string>('Rent & Facility');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [expenseAccountId, setExpenseAccountId] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Selected member helper
  const selectedMember = members.find((m) => m.id === memberId);
  // Selected case helper
  const selectedCase = cases.find((c) => c.id === caseId);
  // Selected cash account helper
  const selectedCashAcc = cashAccounts.find((c) => c.id === cashBankAccountId) || cashAccounts[0];

  // Auto-fill member monthly amount when member changes in monthly contribution
  const handleMemberChange = (id: string) => {
    setMemberId(id);
    const m = members.find((item) => item.id === id);
    if (m && classification === 'MONTHLY_CONTRIBUTION' && !amount) {
      setAmount(String(m.monthlyContributionAmount || 100));
    }
  };

  // Real-time Double-Entry Preview Calculation
  const doubleEntryPreview = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    const rate = parseFloat(exchangeRate) || 1;
    const baseAmount = Number((numAmount * rate).toFixed(2));

    if (classification === 'MONTHLY_CONTRIBUTION') {
      const debitAccount = selectedCashAcc ? selectedCashAcc.name : 'Cash in Hand (1000)';
      const creditAccount = 'Member Contributions Income (4010)';
      return {
        debitAccount,
        creditAccount,
        debitCode: selectedCashAcc?.accountCode || '1000',
        creditCode: '4010',
        amount: numAmount,
        baseAmount,
        isBalanced: true,
      };
    } else if (classification === 'SPECIAL_CONTRIBUTION') {
      const debitAccount = selectedCashAcc ? selectedCashAcc.name : 'Cash in Hand (1000)';
      const creditAccount = `Restricted Donations - Case ${selectedCase?.caseNumber || 'Designated'} (4030)`;
      return {
        debitAccount,
        creditAccount,
        debitCode: selectedCashAcc?.accountCode || '1000',
        creditCode: '4030',
        amount: numAmount,
        baseAmount,
        isBalanced: true,
      };
    } else if (classification === 'CHARITY_ASSISTANCE') {
      const code = getDefaultAssistanceAccountCode(charityCategory);
      const acc = accounts.find((a) => a.code === code);
      const debitAccount = acc ? `${acc.name} (${acc.code})` : `Charity Aid - ${charityCategory} (${code})`;
      const creditAccount = selectedCashAcc ? selectedCashAcc.name : 'Bank / Cash';
      return {
        debitAccount,
        creditAccount,
        debitCode: code,
        creditCode: selectedCashAcc?.accountCode || '1010',
        amount: numAmount,
        baseAmount,
        isBalanced: true,
      };
    } else {
      // ADMINISTRATIVE_EXPENSE
      const code = getDefaultAdminExpenseAccountCode(adminCategory);
      const acc = accounts.find((a) => a.code === code);
      const debitAccount = acc ? `${acc.name} (${acc.code})` : `Operating Expense - ${adminCategory} (${code})`;
      const creditAccount = selectedCashAcc ? selectedCashAcc.name : 'Bank / Cash';
      return {
        debitAccount,
        creditAccount,
        debitCode: code,
        creditCode: selectedCashAcc?.accountCode || '1010',
        amount: numAmount,
        baseAmount,
        isBalanced: true,
      };
    }
  }, [classification, amount, exchangeRate, selectedCashAcc, selectedCase, charityCategory, adminCategory, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount greater than zero.');
      return;
    }

    const rate = parseFloat(exchangeRate) || 1;

    try {
      setSubmitting(true);

      if (classification === 'MONTHLY_CONTRIBUTION') {
        if (!memberId) throw new Error('Please select a member.');
        if (!periodMonth) throw new Error('Please select a period month.');

        // Duplicate check
        const isDuplicate = receipts.some(
          (r) =>
            r.status === 'valid' &&
            r.memberId === memberId &&
            r.contributionType === 'MONTHLY_CONTRIBUTION' &&
            r.periodMonth === periodMonth
        );
        if (isDuplicate) {
          throw new Error(`A contribution for member ${selectedMember?.fullName} has already been posted for ${periodMonth}.`);
        }

        await recordMonthlyContribution({
          memberId,
          periodMonth,
          amount: numAmount,
          currency,
          exchangeRate: rate,
          paymentMethod,
          cashBankAccountId: selectedCashAcc.id,
          receiptDate: date,
          referenceNumber,
          notes,
        });

        setFormSuccess(`Successfully posted monthly contribution for ${periodMonth}!`);
      } else if (classification === 'SPECIAL_CONTRIBUTION') {
        if (!memberId) throw new Error('Please select a donor member.');
        if (!caseId) throw new Error('Please select a restricted charity case.');

        await recordSpecialContribution({
          memberId,
          caseId,
          amount: numAmount,
          currency,
          exchangeRate: rate,
          paymentMethod,
          cashBankAccountId: selectedCashAcc.id,
          receiptDate: date,
          referenceNumber,
          notes,
        });

        setFormSuccess(`Successfully recorded restricted donation to Case ${selectedCase?.caseNumber}!`);
      } else if (classification === 'CHARITY_ASSISTANCE') {
        if (!caseId) throw new Error('Please select an approved charity case.');
        if (!payeeName.trim()) throw new Error('Beneficiary or hospital payee name is required.');

        // Budget check
        if (selectedCase) {
          const remainingBudget = selectedCase.approvedAmount - selectedCase.disbursedAmount;
          if (numAmount * rate > remainingBudget + 0.01) {
            throw new Error(
              `Requested payment of ${formatCurrency(numAmount * rate, settings.currency)} exceeds remaining approved budget of ${formatCurrency(remainingBudget, settings.currency)}.`
            );
          }
        }

        const targetAssistanceCode = getDefaultAssistanceAccountCode(charityCategory);
        const resolvedAssistanceId = expenseAccountId || accounts.find((a) => a.code === targetAssistanceCode)?.id;

        await recordCharityAssistance({
          caseId,
          payeeName,
          payeePhone,
          payeeAddress,
          amount: numAmount,
          currency,
          exchangeRate: rate,
          paymentMethod,
          cashBankAccountId: selectedCashAcc.id,
          charityCategory,
          expenseAccountId: resolvedAssistanceId,
          paymentDate: date,
          referenceNumber,
          description: notes || `Relief assistance for Case ${selectedCase?.caseNumber}: ${selectedCase?.title}`,
          approvedBy,
          preparedBy,
          verifiedBy,
          notes,
        });

        setFormSuccess(`Successfully issued assistance payment voucher for ${selectedCase?.caseNumber}!`);
      } else {
        // ADMINISTRATIVE_EXPENSE
        if (!payeeName.trim()) throw new Error('Vendor or payee name is required.');

        const targetAdminCode = getDefaultAdminExpenseAccountCode(adminCategory);
        const resolvedAdminId = expenseAccountId || accounts.find((a) => a.code === targetAdminCode)?.id;

        await recordAdminExpense({
          payeeName,
          adminCategory,
          expenseAccountId: resolvedAdminId,
          amount: numAmount,
          currency,
          exchangeRate: rate,
          paymentMethod,
          cashBankAccountId: selectedCashAcc.id,
          invoiceNumber,
          paymentDate: date,
          referenceNumber,
          description: notes || `Operational expense: ${adminCategory} - ${payeeName}`,
          approvedBy,
          preparedBy,
          verifiedBy,
          notes,
        });

        setFormSuccess(`Successfully posted operating expense voucher for ${adminCategory}!`);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while posting transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              Post Financial Transaction
            </h2>
            <p className="text-xs text-slate-500">
              Strict 4-way separation with automated double-entry ledger verification
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 4 Strict Invariant Transaction Selectors */}
        <div className="border-b border-slate-200 bg-slate-100/50 p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Select Immutable Financial Classification
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* 1. Monthly Contribution */}
            <button
              type="button"
              onClick={() => setClassification('MONTHLY_CONTRIBUTION')}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                classification === 'MONTHLY_CONTRIBUTION'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className={`h-4 w-4 ${classification === 'MONTHLY_CONTRIBUTION' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Monthly Dues</span>
              </div>
              <span className="text-[11px] text-slate-500 leading-tight">
                Regular recurring member contributions
              </span>
            </button>

            {/* 2. Special Contribution */}
            <button
              type="button"
              onClick={() => setClassification('SPECIAL_CONTRIBUTION')}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                classification === 'SPECIAL_CONTRIBUTION'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <HeartHandshake className={`h-4 w-4 ${classification === 'SPECIAL_CONTRIBUTION' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Special Donation</span>
              </div>
              <span className="text-[11px] text-slate-500 leading-tight">
                Designated restricted case donations
              </span>
            </button>

            {/* 3. Charity Assistance */}
            <button
              type="button"
              onClick={() => setClassification('CHARITY_ASSISTANCE')}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                classification === 'CHARITY_ASSISTANCE'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 shadow-sm ring-2 ring-blue-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className={`h-4 w-4 ${classification === 'CHARITY_ASSISTANCE' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Charity Assistance</span>
              </div>
              <span className="text-[11px] text-slate-500 leading-tight">
                Direct welfare relief for beneficiaries
              </span>
            </button>

            {/* 4. Administrative Expense */}
            <button
              type="button"
              onClick={() => setClassification('ADMINISTRATIVE_EXPENSE')}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                classification === 'ADMINISTRATIVE_EXPENSE'
                  ? 'border-purple-600 bg-purple-50 text-purple-950 shadow-sm ring-2 ring-purple-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className={`h-4 w-4 ${classification === 'ADMINISTRATIVE_EXPENSE' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">Admin Expense</span>
              </div>
              <span className="text-[11px] text-slate-500 leading-tight">
                Operating overhead (Rent, IT, Utilities)
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* DYNAMIC FORM FIELDS ACCORDING TO CLASSIFICATION */}

          {/* 1. MONTHLY CONTRIBUTION FORM */}
          {classification === 'MONTHLY_CONTRIBUTION' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Contributing Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={memberId}
                    onChange={(e) => handleMemberChange(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Active Member --</option>
                    {members
                      .filter((m) => m.status === 'active')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.memberNumber} — {m.fullName} (Dues: {m.monthlyContributionAmount})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contribution Period Month <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="month"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                  </input>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    The specific month this regular dues payment covers
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. SPECIAL CONTRIBUTION FORM */}
          {classification === 'SPECIAL_CONTRIBUTION' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Donor Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.memberNumber} — {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Charity Case (Restricted Fund) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={caseId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setCaseId(selectedId);
                      const c = cases.find((item) => item.id === selectedId);
                      if (c && c.currency) {
                        setCurrency(c.currency);
                        const baseCur = settings.currency || 'AED';
                        if (c.currency === baseCur) {
                          setExchangeRate('1.0');
                        } else if (c.currency === 'INR' && baseCur === 'AED') {
                          setExchangeRate(String(c.exchangeRate || 0.0441));
                        }
                      }
                    }}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Approved Case --</option>
                    {cases
                      .filter((c) => c.status !== 'CLOSED' && c.status !== 'DISBURSED')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.caseNumber} — {c.title} (Collected: {formatCurrency(c.collectedAmount, c.currency)}/{formatCurrency(c.approvedAmount, c.currency)})
                        </option>
                      ))}
                  </select>
                  {selectedCase && (
                    <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
                      <span>Beneficiary: <strong>{selectedCase.beneficiaryName}</strong></span>
                      <span>Target: <strong>{formatCurrency(selectedCase.approvedAmount, selectedCase.currency)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. CHARITY ASSISTANCE FORM */}
          {classification === 'CHARITY_ASSISTANCE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Linked Charity Case <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={caseId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setCaseId(selectedId);
                      const c = cases.find((item) => item.id === selectedId);
                      if (c) {
                        if (c.currency) {
                          setCurrency(c.currency);
                          const baseCur = settings.currency || 'AED';
                          if (c.currency === baseCur) {
                            setExchangeRate('1.0');
                          } else if (c.currency === 'INR' && baseCur === 'AED') {
                            setExchangeRate(String(c.exchangeRate || 0.0441));
                          }
                        }
                        setPayeeName(c.hospitalOrVendor || c.beneficiaryName);
                        setCharityCategory(
                          c.caseType === 'Medical' ? 'Medical Assistance' :
                          c.caseType === 'House Maintenance' ? 'House Maintenance' :
                          c.caseType === 'Wedding' ? 'Wedding Assistance' :
                          c.caseType === 'Education' ? 'Education' : 'Medical Assistance'
                        );
                      }
                    }}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Case --</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} — {c.title} (Disbursed: {formatCurrency(c.disbursedAmount, c.currency)}/{formatCurrency(c.approvedAmount, c.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Charity Assistance Category
                  </label>
                  <select
                    value={charityCategory}
                    onChange={(e) => setCharityCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    {CHARITY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payee Name (Hospital / Beneficiary / Contractor) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="e.g. Dubai Hospital / Fatima Begum"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payee Phone Number
                  </label>
                  <input
                    type="text"
                    value={payeePhone}
                    onChange={(e) => setPayeePhone(e.target.value)}
                    placeholder="+971 50 ..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Approved By Sign-off <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. ADMINISTRATIVE EXPENSE FORM */}
          {classification === 'ADMINISTRATIVE_EXPENSE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Operating Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adminCategory}
                    onChange={(e) => setAdminCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                  >
                    {ADMIN_EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payee / Vendor Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="e.g. Al-Barsha Real Estate / Du Telecom"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vendor Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-981"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* COMMON FINANCIAL SETTLEMENT & MULTI-CURRENCY FIELDS */}
          <div className="pt-2 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white pl-3 pr-8 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-bold text-slate-400">
                    {currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => {
                    const newCur = e.target.value;
                    setCurrency(newCur);
                    const baseCur = settings.currency || 'AED';
                    if (newCur === baseCur) {
                      setExchangeRate('1.0');
                    } else if (newCur === 'INR' && baseCur === 'AED') {
                      setExchangeRate('0.0441');
                    } else if (newCur === 'AED' && baseCur === 'INR') {
                      setExchangeRate('22.68');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Exchange Rate ({currency} &rarr; {settings.currency || 'AED'})
                  </label>
                  {currency === (settings.currency || 'AED') && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Fixed 1:1
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.0001"
                  value={currency === (settings.currency || 'AED') ? '1.0' : exchangeRate}
                  disabled={currency === (settings.currency || 'AED')}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none ${
                    currency === (settings.currency || 'AED')
                      ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500 font-mono'
                      : 'bg-white border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Settlement Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Settlement Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cash / Bank Account
                </label>
                <select
                  value={cashBankAccountId}
                  onChange={(e) => setCashBankAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  {cashAccounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatCurrency(c.currentBalance, settings.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reference / Cheque #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional reference"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Particulars / Narrative Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Description for audit and receipt voucher"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* REAL-TIME DOUBLE-ENTRY JOURNAL PREVIEW */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Layers className="h-4 w-4 text-emerald-600" />
                Double-Entry Balanced Journal Preview (Debit == Credit)
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="h-3 w-3" />
                Verified Balanced
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Account Code</th>
                    <th className="px-3 py-2 text-right">Debit ({currency})</th>
                    <th className="px-3 py-2 text-right">Credit ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {doubleEntryPreview.debitAccount}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {doubleEntryPreview.debitCode}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(doubleEntryPreview.amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {doubleEntryPreview.creditAccount}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {doubleEntryPreview.creditCode}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-300">—</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(doubleEntryPreview.amount, currency)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-left">
                      Total Balanced Journal
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {formatCurrency(doubleEntryPreview.amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {formatCurrency(doubleEntryPreview.amount, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {exchangeRate !== '1' && exchangeRate !== '1.0' && (
              <div className="mt-2 text-right text-[11px] text-slate-500">
                Normalized Base ({settings.currency}): <strong>{formatCurrency(doubleEntryPreview.baseAmount, settings.currency)}</strong>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Posting Journal...' : 'Confirm & Post to Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
