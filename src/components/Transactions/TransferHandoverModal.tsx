import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  User,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowRight,
  Layers,
  HeartHandshake,
  Users,
  Coins,
  Sparkles,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';

interface TransferHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFromType?: 'member' | 'account';
  defaultFromId?: string;
  defaultToType?: 'member' | 'account';
  defaultToId?: string;
  defaultCurrency?: string;
  onSuccess?: () => void;
  initialSenderMemberId?: string;
}

type HandoverFundCategory = 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY';

export const TransferHandoverModal: React.FC<TransferHandoverModalProps> = ({
  isOpen,
  onClose,
  defaultFromType = 'member',
  defaultFromId = '',
  defaultToType = 'member',
  defaultToId = '',
  defaultCurrency = 'AED',
  onSuccess,
  initialSenderMemberId,
}) => {
  const { members, cashAccounts, cases, cashHoldings, settings, createTransferOrHandover } = useCharity();

  const effectiveFromType = initialSenderMemberId ? 'member' : defaultFromType;
  const effectiveFromId = initialSenderMemberId || defaultFromId;

  const [fromType, setFromType] = useState<'member' | 'account'>(effectiveFromType);
  const [fromId, setFromId] = useState<string>(effectiveFromId);

  const [toType, setToType] = useState<'member' | 'account'>(defaultToType);
  const [toId, setToId] = useState<string>(defaultToId);

  // Handover Fund Category & Case Link
  const [handoverCategory, setHandoverCategory] = useState<HandoverFundCategory>('MONTHLY_CONTRIBUTION');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [amount, setAmount] = useState<number | ''>('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [manualRateEdited, setManualRateEdited] = useState(false);

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeFromType = initialSenderMemberId ? 'member' : defaultFromType;
      const activeFromId = initialSenderMemberId || defaultFromId || (activeFromType === 'member' ? (members[0]?.id || '') : (cashAccounts[0]?.id || ''));
      setFromType(activeFromType);
      setFromId(activeFromId);
      setToType(defaultToType);
      setToId(defaultToId || (defaultToType === 'member' ? (members.find((m) => m.id !== activeFromId)?.id || members[0]?.id || '') : (cashAccounts[0]?.id || '')));
      setCurrency(defaultCurrency);
      setAmount('');
      setNotes('');
      setError(null);
      setManualRateEdited(false);
      setDate(new Date().toISOString().slice(0, 10));
      setHandoverCategory('MONTHLY_CONTRIBUTION');
      setSelectedCaseId('');
    }
  }, [isOpen, defaultFromType, defaultFromId, defaultToType, defaultToId, defaultCurrency, initialSenderMemberId, members, cashAccounts]);

  // Adjust default exchange rate when currency changes
  useEffect(() => {
    const baseCur = settings.currency || 'AED';
    // If currency matches base currency (e.g. AED to AED), always strictly fix rate to 1
    if (currency === baseCur) {
      setExchangeRate(1);
      setManualRateEdited(false);
      return;
    }

    if (!manualRateEdited) {
      if (currency === 'INR' && baseCur === 'AED') {
        // Approx 1 INR = ~0.044 AED (1 AED = ~22.70 INR)
        setExchangeRate(0.0441);
      } else if (currency === 'AED' && baseCur === 'INR') {
        setExchangeRate(22.68);
      } else {
        setExchangeRate(1);
      }
    }
  }, [currency, settings.currency, manualRateEdited]);

  if (!isOpen) return null;

  const baseCur = settings.currency || 'AED';
  const numericAmount = typeof amount === 'number' ? amount : 0;
  const baseEquivalent = exchangeRate && numericAmount > 0
    ? Math.round(numericAmount * exchangeRate * 100) / 100
    : numericAmount;

  // Selected entities details
  const selectedFromMember = fromType === 'member' ? members.find((m) => m.id === fromId) : null;
  const selectedFromAccount = fromType === 'account' ? cashAccounts.find((c) => c.id === fromId) : null;

  const selectedToMember = toType === 'member' ? members.find((m) => m.id === toId) : null;
  const selectedToAccount = toType === 'account' ? cashAccounts.find((c) => c.id === toId) : null;

  const fromMemberBalanceInCur = selectedFromMember?.cashBalances?.[currency] || 0;
  const toMemberBalanceInCur = selectedToMember?.cashBalances?.[currency] || 0;

  const isSameEntity = fromType === toType && fromId === toId && fromId !== '';

  // Selected case details
  const selectedCase = selectedCaseId ? cases.find((c) => c.id === selectedCaseId) : null;
  const caseTarget = selectedCase ? (selectedCase.approvedAmount || selectedCase.requestedAmount || 0) : 0;
  const caseCollected = selectedCase ? (selectedCase.collectedAmount || 0) : 0;
  const caseRemaining = Math.max(0, caseTarget - caseCollected);

  // Cash holdings held by the from-member
  const fromMemberHoldings = fromType === 'member'
    ? cashHoldings.filter((h) => h.memberId === fromId && h.status === 'HELD')
    : [];
  const fromMemberMonthlyHoldingTotal = fromMemberHoldings
    .filter((h) => h.category === 'Monthly Contribution')
    .reduce((sum, h) => sum + (h.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromId) {
      setError('Please select the transfer source (Credit / Transferred by).');
      return;
    }
    if (!toId) {
      setError('Please select the transfer recipient (Debit / Received by).');
      return;
    }
    if (isSameEntity) {
      setError('Source and recipient cannot be the same entity.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (handoverCategory === 'CHARITY_CASE' && !selectedCaseId) {
      setError('Please select the registered charity case for this handover amount.');
      return;
    }

    setSubmitting(true);
    try {
      const chosenCase = handoverCategory === 'CHARITY_CASE' ? cases.find((c) => c.id === selectedCaseId) : undefined;

      await createTransferOrHandover({
        date,
        currency,
        amount: numericAmount,
        exchangeRate: currency !== baseCur ? exchangeRate : 1,
        baseCurrencyAmount: baseEquivalent,
        fromType,
        fromId,
        toType,
        toId,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        handoverFundType: handoverCategory,
        caseId: chosenCase?.id,
        caseNumber: chosenCase?.caseNumber,
        caseTitle: chosenCase?.title,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Transfer failed:', err);
      setError(err?.message || 'Failed to record transfer or cash handover.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <ArrowRightLeft className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Cash Handover & Internal Transfer
              </h2>
              <p className="text-xs text-emerald-100/90">
                Record peer-to-peer member cash handovers, deposits, or internal bank transfers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Validation Error: </span>
                {error}
              </div>
            </div>
          )}

          {/* Quick Scenario Preset Helper */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Transfer Workflow Mode
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFromType('member');
                  setToType('member');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  fromType === 'member' && toType === 'member'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Member → Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromType('member');
                  setToType('account');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  fromType === 'member' && toType === 'account'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Member → Bank
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromType('account');
                  setToType('member');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  fromType === 'account' && toType === 'member'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Bank → Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromType('account');
                  setToType('account');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  fromType === 'account' && toType === 'account'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Bank → Bank
              </button>
            </div>
          </div>

          {/* From & To Entity Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FROM: Source (Credit / Transferred By) */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  From / Credit (Transferred By)
                </span>
                {/* Type Toggle */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setFromType('member');
                      if (members.length > 0) setFromId(members[0].id);
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      fromType === 'member' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromType('account');
                      if (cashAccounts.length > 0) setFromId(cashAccounts[0].id);
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      fromType === 'account' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Bank/Cash
                  </button>
                </div>
              </div>

              {fromType === 'member' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Member Custodian
                  </label>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => {
                      const curBal = m.cashBalances?.[currency] || 0;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.memberNumber} - {m.fullName} (Holds: {formatCurrency(curBal, currency)})
                        </option>
                      );
                    })}
                  </select>
                  {selectedFromMember && (
                    <div className="space-y-2 mt-2">
                      <div className="text-[11px] text-slate-600 flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-md">
                        <span>Total holding in {currency}:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(fromMemberBalanceInCur, currency)}
                        </span>
                      </div>

                      {fromType === 'member' && toType === 'member' && fromMemberBalanceInCur < (numericAmount || 1) ? (
                        <div className="p-2.5 bg-cyan-50/90 border border-cyan-200 rounded-lg text-[11px] text-cyan-950 leading-snug space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-cyan-900">
                            <span>🤝 Member Contribution Handover</span>
                          </div>
                          <p>
                            {selectedFromMember.fullName} is handing over new contribution funds directly to custodian <strong>{selectedToMember?.fullName || 'the recipient'}</strong>.
                          </p>
                          <p className="text-[10px] text-cyan-800">
                            • <strong>{selectedFromMember.fullName}</strong> will be credited for the contribution (NO negative cash balance).<br />
                            • <strong>{selectedToMember?.fullName || 'Recipient'}</strong> will hold the cash in hand for {handoverCategory === 'CHARITY_CASE' ? 'the selected case' : 'the charity'}.
                          </p>
                        </div>
                      ) : fromMemberBalanceInCur <= 0 ? (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-snug">
                          <strong>Note:</strong> {selectedFromMember.fullName} is currently holding 0 {currency} charity cash in hand.
                        </div>
                      ) : null}

                      {fromMemberHoldings.length > 0 && (
                        <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                            <span>Recorded Handover Allocations:</span>
                            <span className="text-[10px] text-amber-700">Click to autofill</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {fromMemberHoldings.map((h) => (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => {
                                  if (h.caseId) {
                                    setHandoverCategory('CHARITY_CASE');
                                    setSelectedCaseId(h.caseId);
                                  } else if (h.category === 'Monthly Contribution') {
                                    setHandoverCategory('MONTHLY_CONTRIBUTION');
                                  } else {
                                    setHandoverCategory('GENERAL_CHARITY');
                                  }
                                  setAmount(h.amount);
                                  if (h.currency) {
                                    setCurrency(h.currency);
                                    setManualRateEdited(false);
                                  }
                                }}
                                className="px-2 py-1 text-[10px] sm:text-[11px] rounded bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100/60 text-slate-800 font-medium transition-all text-left flex items-center gap-1 shadow-2xs"
                              >
                                <span>{h.caseTitle ? `🩺 ${h.caseTitle}` : `🪙 ${h.category}`}</span>
                                <strong className="text-amber-900 font-bold ml-1">
                                  {formatCurrency(h.amount, h.currency || currency)}
                                </strong>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Bank or Cash Box
                  </label>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Account --</option>
                    {cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.currentBalance, baseCur)})
                      </option>
                    ))}
                  </select>
                  {selectedFromAccount && (
                    <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-md">
                      <span>Available Balance ({baseCur}):</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(selectedFromAccount.currentBalance, baseCur)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TO: Destination (Debit / Received By) */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  To / Debit (Received By)
                </span>
                {/* Type Toggle */}
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setToType('member');
                      const altMem = members.find((m) => m.id !== fromId) || members[0];
                      if (altMem) setToId(altMem.id);
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      toType === 'member' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToType('account');
                      const altAcc = cashAccounts.find((c) => c.id !== fromId) || cashAccounts[0];
                      if (altAcc) setToId(altAcc.id);
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      toType === 'account' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Bank/Cash
                  </button>
                </div>
              </div>

              {toType === 'member' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Member Recipient
                  </label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => {
                      const curBal = m.cashBalances?.[currency] || 0;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.memberNumber} - {m.fullName} (Holds: {formatCurrency(curBal, currency)})
                        </option>
                      );
                    })}
                  </select>
                  {selectedToMember && (
                    <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-md">
                      <span>Currently holding in {currency}:</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(toMemberBalanceInCur, currency)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select Bank or Cash Box
                  </label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Choose Account --</option>
                    {cashAccounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatCurrency(c.currentBalance, baseCur)})
                      </option>
                    ))}
                  </select>
                  {selectedToAccount && (
                    <div className="mt-2 text-[11px] text-slate-600 flex items-center justify-between px-2 py-1 bg-white border border-slate-200 rounded-md">
                      <span>Current Balance ({baseCur}):</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(selectedToAccount.currentBalance, baseCur)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Handover Amount Classification: Which amount is this? Members' monthly contribution or Charity case? */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Handover Amount Purpose: Which amount is this? <strong className="text-rose-600">*</strong></span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Designate source fund
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Members' Monthly Contribution */}
              <button
                type="button"
                onClick={() => setHandoverCategory('MONTHLY_CONTRIBUTION')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  handoverCategory === 'MONTHLY_CONTRIBUTION'
                    ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className={`w-4 h-4 ${handoverCategory === 'MONTHLY_CONTRIBUTION' ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${handoverCategory === 'MONTHLY_CONTRIBUTION' ? 'text-emerald-950' : 'text-slate-800'}`}>
                    Members' Monthly Contribution
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Monthly subscription & membership dues collected from members
                </p>
                {handoverCategory === 'MONTHLY_CONTRIBUTION' && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>

              {/* Option 2: Charity Case */}
              <button
                type="button"
                onClick={() => {
                  setHandoverCategory('CHARITY_CASE');
                  if (!selectedCaseId && cases.length > 0) {
                    setSelectedCaseId(cases[0].id);
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  handoverCategory === 'CHARITY_CASE'
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <HeartHandshake className={`w-4 h-4 ${handoverCategory === 'CHARITY_CASE' ? 'text-amber-700' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${handoverCategory === 'CHARITY_CASE' ? 'text-amber-950' : 'text-slate-800'}`}>
                    Charity Case
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Registered case amount for which case
                </p>
                {handoverCategory === 'CHARITY_CASE' && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-600" />
                )}
              </button>

              {/* Option 3: General Charity / Other */}
              <button
                type="button"
                onClick={() => setHandoverCategory('GENERAL_CHARITY')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  handoverCategory === 'GENERAL_CHARITY'
                    ? 'bg-teal-50 border-teal-500 shadow-xs ring-2 ring-teal-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Coins className={`w-4 h-4 ${handoverCategory === 'GENERAL_CHARITY' ? 'text-teal-700' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${handoverCategory === 'GENERAL_CHARITY' ? 'text-teal-950' : 'text-slate-800'}`}>
                    General Charity / Other
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  General charity pool, Friday donation, or miscellaneous funds
                </p>
                {handoverCategory === 'GENERAL_CHARITY' && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-teal-600" />
                )}
              </button>
            </div>

            {/* If Charity Case is selected: Show "registered case amount for which case" */}
            {handoverCategory === 'CHARITY_CASE' && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3">
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HeartHandshake className="w-4 h-4 text-amber-700" />
                      <span>Registered case amount for which case: <strong className="text-rose-600">*</strong></span>
                    </span>
                    <span className="text-[11px] text-amber-800 font-normal">
                      {cases.length} registered case{cases.length === 1 ? '' : 's'} available
                    </span>
                  </label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedCaseId(cid);
                      const cs = cases.find((c) => c.id === cid);
                      if (cs) {
                        const rem = Math.max(0, (cs.approvedAmount || cs.requestedAmount || 0) - (cs.collectedAmount || 0));
                        if (!amount && rem > 0) {
                          setAmount(rem);
                        }
                      }
                    }}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white font-medium text-slate-900"
                  >
                    <option value="">-- Choose Registered Case --</option>
                    {cases.map((c) => {
                      const target = c.approvedAmount || c.requestedAmount || 0;
                      const collected = c.collectedAmount || 0;
                      const rem = Math.max(0, target - collected);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.caseNumber} • {c.title} ({c.caseType}) - Target: {formatCurrency(target, c.currency)} | Collected: {formatCurrency(collected, c.currency)} | Rem: {formatCurrency(rem, c.currency)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Case Summary Card */}
                {selectedCase && (
                  <div className="bg-white rounded-lg p-3 border border-amber-200 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                          {selectedCase.caseNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                          {selectedCase.title}
                        </h4>
                        <p className="text-slate-600 text-[11px]">
                          Beneficiary: <strong className="text-slate-900">{selectedCase.beneficiaryName}</strong> • Type: <strong className="text-slate-800">{selectedCase.caseType}</strong>
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        {selectedCase.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-[10px] text-slate-500 block">Target Approved</span>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(caseTarget, selectedCase.currency)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-[10px] text-slate-500 block">Collected So Far</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(caseCollected, selectedCase.currency)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded">
                        <span className="text-[10px] text-slate-500 block">Remaining Needed</span>
                        <span className="font-bold text-amber-700">
                          {formatCurrency(caseRemaining, selectedCase.currency)}
                        </span>
                      </div>
                    </div>

                    {caseRemaining > 0 && (
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Need this exact remaining balance?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAmount(caseRemaining);
                            if (selectedCase.currency) {
                              setCurrency(selectedCase.currency);
                              setManualRateEdited(false);
                            }
                          }}
                          className="text-amber-900 hover:text-amber-950 font-bold bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                        >
                          Set Amount to Remaining ({formatCurrency(caseRemaining, selectedCase.currency)})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* If Monthly Contribution is selected */}
            {handoverCategory === 'MONTHLY_CONTRIBUTION' && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Designated for <strong>Members' Monthly Membership Contribution Pool</strong>.
                  </span>
                </div>
                {fromMemberMonthlyHoldingTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(fromMemberMonthlyHoldingTotal)}
                    className="text-emerald-900 bg-emerald-200/80 hover:bg-emerald-200 px-2.5 py-1 rounded-md font-bold text-[11px] transition-colors"
                  >
                    Use Full Held Monthly ({formatCurrency(fromMemberMonthlyHoldingTotal, currency)})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Amount & Currency Selection */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Mandatory Currency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['AED', 'INR'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCurrency(c);
                        setManualRateEdited(false);
                      }}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                        currency === c
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount ({currency}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-12 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Exchange Rate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Exchange Rate ({currency} &rarr; {baseCur})
                  </label>
                  {currency === baseCur && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Fixed 1:1
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.0001"
                  min="0.00001"
                  value={currency === baseCur ? 1 : exchangeRate}
                  disabled={currency === baseCur}
                  onChange={(e) => {
                    if (currency !== baseCur) {
                      setExchangeRate(parseFloat(e.target.value) || 1);
                      setManualRateEdited(true);
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 ${
                    currency === baseCur
                      ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500 font-mono font-medium'
                      : 'border-slate-300'
                  }`}
                />
                {currency === baseCur && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Exchange rate is strictly 1:1 for identical currencies ({currency} to {baseCur}).
                  </p>
                )}
              </div>
            </div>

            {/* Base Currency Conversion Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-emerald-900">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Base Equivalent ({baseCur}):{' '}
                  <strong className="text-emerald-950 font-bold">
                    {formatCurrency(baseEquivalent, baseCur)}
                  </strong>
                </span>
              </div>
              {currency !== baseCur && (
                <span className="text-[11px] text-emerald-700">
                  Rate applied: 1 {currency} = {exchangeRate} {baseCur}
                </span>
              )}
            </div>
          </div>

          {/* Date, Ref, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer / Handover Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ref / Voucher # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. HND-2026-001 or Slip #89"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transfer Purpose / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash collected during weekly drive handed over for vault safekeeping"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isSameEntity}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Record Handover / Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
