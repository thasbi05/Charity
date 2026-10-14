import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  HeartHandshake,
  CheckCircle2,
  Calendar,
  Wallet,
  FileCheck,
  AlertCircle,
  ArrowRightLeft,
  Scale,
  Building,
  UserCheck,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { CashHolding, Member } from '../../types';
import { formatCurrency } from '../../utils/numbering';

interface SettleCashHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: CashHolding | null;
}

export const SettleCashHoldingModal: React.FC<SettleCashHoldingModalProps> = ({
  isOpen,
  onClose,
  holding,
}) => {
  const { members, cases, settings, settleCashHolding } = useCharity();

  const today = new Date().toISOString().slice(0, 10);
  const sourceCurrency = holding?.currency || settings.currency || 'AED';

  // Settlement Method: 2 Core Options
  const [settlementType, setSettlementType] = useState<
    'HANDOVER_TO_MEMBER' | 'BENEFICIARY_DISBURSEMENT'
  >('HANDOVER_TO_MEMBER');

  // Amount state (supports partial or full settlement)
  const [settleAmount, setSettleAmount] = useState<string>('');

  // Option 1: Hand Over to Another Member / Custodian
  const eligibleReceivingMembers = useMemo(() => {
    if (!holding) return [];
    return members.filter((m) => m.id !== holding.memberId && m.status === 'active');
  }, [members, holding]);

  const [receivingTarget, setReceivingTarget] = useState<string>('main_treasury');

  // Option 2: Direct Beneficiary Disbursement
  const activeCases = useMemo(() => {
    return cases.filter((c) => c.status !== 'CLOSED');
  }, [cases]);

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('');
  const [voucherReference, setVoucherReference] = useState<string>('');

  // General fields
  const [settlementDate, setSettlementDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form whenever holding changes or modal opens
  useEffect(() => {
    if (holding) {
      setSettleAmount(String(holding.amount));
      setError(null);
      setSettlementDate(today);
      setNotes('');

      // If holding has a case linked, default to that case for beneficiary disbursement
      if (holding.caseId) {
        setSelectedCaseId(holding.caseId);
        const linkedCase = cases.find((c) => c.id === holding.caseId);
        setPayeeName(linkedCase?.beneficiaryName || '');
      } else if (activeCases.length > 0) {
        setSelectedCaseId(activeCases[0].id);
        setPayeeName(activeCases[0].beneficiaryName || '');
      }

      // Default receiving target for Option 1
      if (eligibleReceivingMembers.length > 0) {
        setReceivingTarget(eligibleReceivingMembers[0].id);
      } else {
        setReceivingTarget('main_treasury');
      }

      // Generate a voucher reference
      const vNum = `VCHR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      setVoucherReference(vNum);
    }
  }, [holding, isOpen, today, cases, activeCases, eligibleReceivingMembers]);

  // Handle case change
  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
    const targetCase = cases.find((c) => c.id === caseId);
    if (targetCase?.beneficiaryName) {
      setPayeeName(targetCase.beneficiaryName);
    }
  };

  // Determine destination entity and currency conversion for Option 1
  const destinationDetails = useMemo(() => {
    if (!holding) return null;

    if (receivingTarget === 'main_treasury') {
      const destCurrency = 'AED';
      const isDiff = sourceCurrency !== destCurrency;
      const rate = isDiff
        ? sourceCurrency === 'INR'
          ? settings.exchangeRateInrToAed || 0.0440123
          : settings.exchangeRateAedToInr || 22.72
        : 1;
      const numAmt = parseFloat(settleAmount) || 0;
      const convertedAmt = Number((numAmt * rate).toFixed(2));

      return {
        type: 'account' as const,
        name: 'Main Treasury Safe (Central Cash Box)',
        currency: destCurrency,
        isDifferentCurrency: isDiff,
        exchangeRate: rate,
        convertedAmount: convertedAmt,
        targetMember: null,
      };
    }

    const targetMember = members.find((m) => m.id === receivingTarget);
    if (!targetMember) return null;

    // Detect target member's operating currency
    const holdsInr = (targetMember.cashBalances?.['INR'] || 0) > 0;
    const holdsAed = (targetMember.cashBalances?.['AED'] || 0) > 0;
    const isIndia = targetMember.homeCountryAddress?.country?.toLowerCase() === 'india';
    const destCurrency = holdsInr && !holdsAed ? 'INR' : isIndia ? 'INR' : 'AED';

    const isDiff = sourceCurrency !== destCurrency;
    let rate = 1;
    if (isDiff) {
      if (sourceCurrency === 'AED' && destCurrency === 'INR') {
        rate = settings.exchangeRateAedToInr || 22.72;
      } else if (sourceCurrency === 'INR' && destCurrency === 'AED') {
        rate = settings.exchangeRateInrToAed || 0.0440123;
      }
    }

    const numAmt = parseFloat(settleAmount) || 0;
    const convertedAmt = Number((numAmt * rate).toFixed(2));

    return {
      type: 'member' as const,
      name: `${targetMember.fullName} (${targetMember.memberNumber})`,
      currency: destCurrency,
      isDifferentCurrency: isDiff,
      exchangeRate: rate,
      convertedAmount: convertedAmt,
      targetMember,
    };
  }, [holding, receivingTarget, sourceCurrency, settleAmount, members, settings]);

  if (!isOpen || !holding) return null;

  const parsedAmount = parseFloat(settleAmount) || 0;
  const isPartial = parsedAmount > 0 && parsedAmount < holding.amount - 0.005;
  const remainingFloat = Math.max(0, Number((holding.amount - parsedAmount).toFixed(2)));

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (parsedAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (parsedAmount > holding.amount + 0.001) {
      setError(
        `Amount cannot exceed total custody float of ${formatCurrency(
          holding.amount,
          sourceCurrency
        )}.`
      );
      return;
    }

    if (settlementType === 'HANDOVER_TO_MEMBER' && !receivingTarget) {
      setError('Please select a receiving custodian or main treasury safe.');
      return;
    }

    if (settlementType === 'BENEFICIARY_DISBURSEMENT') {
      if (!selectedCaseId) {
        setError('Please select an active charity case for this disbursement.');
        return;
      }
      if (!payeeName.trim()) {
        setError('Please enter the beneficiary or payee name.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (settlementType === 'HANDOVER_TO_MEMBER') {
        const isTreasury = receivingTarget === 'main_treasury';
        await settleCashHolding(holding.id, {
          settlementType: 'HANDOVER_TO_MEMBER',
          amount: parsedAmount,
          settlementDate,
          notes: notes.trim() || undefined,
          destinationType: isTreasury ? 'account' : 'member',
          destinationAccountId: isTreasury ? 'main_treasury' : undefined,
          destinationAccountName: isTreasury
            ? 'Cash on Hand (Main Treasury Safe)'
            : destinationDetails?.targetMember?.fullName,
          destinationMemberId: !isTreasury ? receivingTarget : undefined,
          destinationMemberName: !isTreasury
            ? destinationDetails?.targetMember?.fullName
            : undefined,
          destinationCurrency: destinationDetails?.currency,
          exchangeRate: destinationDetails?.exchangeRate,
          destinationAmount: destinationDetails?.convertedAmount,
          voucherReference: notes.trim() || `HANDOVER-${holding.memberNumber || 'CUST'}`,
        });
      } else {
        await settleCashHolding(holding.id, {
          settlementType: 'BENEFICIARY_DISBURSEMENT',
          amount: parsedAmount,
          settlementDate,
          notes: notes.trim() || undefined,
          caseId: selectedCase?.id,
          caseNumber: selectedCase?.caseNumber,
          caseTitle: selectedCase?.title,
          payeeName: payeeName.trim(),
          voucherReference: voucherReference.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to settle cash holding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Settle / Hand Over Cash</h2>
              <p className="text-xs text-slate-400">
                Peer-to-peer custodian handover or direct case disbursement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Custody Summary Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cash Custodian
                </span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {holding.memberName} {holding.memberNumber ? `(${holding.memberNumber})` : ''}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {holding.caseNote || holding.category}
                </p>
                {holding.caseTitle && holding.caseTitle !== holding.caseNote && (
                  <p className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1 font-semibold">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>Case: {holding.caseTitle}</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Amount in Custody
                </span>
                <p className="text-lg font-bold font-display text-emerald-700 mt-0.5">
                  {formatCurrency(holding.amount, sourceCurrency)}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Held since {holding.date}
                </span>
              </div>
            </div>
          </div>

          {/* Settlement Method Selection: Strictly 2 Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Settlement & Handover Method *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Peer-to-Peer Handover */}
              <button
                type="button"
                onClick={() => setSettlementType('HANDOVER_TO_MEMBER')}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  settlementType === 'HANDOVER_TO_MEMBER'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold">Hand Over to Member / Safe</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Transfer custody to another member or main treasury safe
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-semibold text-emerald-700">
                  <span>Peer-to-Peer Transfer</span>
                  <span>Debits recipient, credits source</span>
                </div>
              </button>

              {/* Option 2: Direct Beneficiary Disbursement */}
              <button
                type="button"
                onClick={() => setSettlementType('BENEFICIARY_DISBURSEMENT')}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  settlementType === 'BENEFICIARY_DISBURSEMENT'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <HeartHandshake className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold">Direct Beneficiary Disbursement</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Pay physical cash directly to patient, hospital, or needy case
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-semibold text-rose-700">
                  <span>Direct Charity Aid</span>
                  <span>Issues verified payout voucher</span>
                </div>
              </button>
            </div>
          </div>

          {/* Amount to Settle / Hand Over */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Amount to Settle / Hand Over ({sourceCurrency}) *
              </label>
              <button
                type="button"
                onClick={() => setSettleAmount(String(holding.amount))}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Full Balance ({formatCurrency(holding.amount, sourceCurrency)})
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={holding.amount}
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                {sourceCurrency}
              </span>
            </div>
            {isPartial && (
              <p className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
                Partial Handover: {formatCurrency(remainingFloat, sourceCurrency)} will remain in{' '}
                {holding.memberName}'s custody.
              </p>
            )}
          </div>

          {/* Option 1 Fields: Select Receiving Custodian / Member */}
          {settlementType === 'HANDOVER_TO_MEMBER' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Select Receiving Custodian / Member *</span>
                </label>
                <select
                  value={receivingTarget}
                  onChange={(e) => setReceivingTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                >
                  <optgroup label="Main Treasury & Safe Box">
                    <option value="main_treasury">
                      Main Treasury Safe (AED) • Central Office Cash Box
                    </option>
                  </optgroup>
                  <optgroup label="Authorized Custodians / Members">
                    {eligibleReceivingMembers.map((m: Member) => {
                      const cur = m.cashBalances?.['INR'] ? 'INR' : 'AED';
                      return (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.memberNumber}) • Operating: {cur}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Recipient's custody balance will automatically be debited upon confirmation.
                </p>
              </div>

              {/* Currency Conversion Preview Card if Different Currencies */}
              {destinationDetails && destinationDetails.isDifferentCurrency ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Exchange Rate Conversion Preview</span>
                    </div>
                    <span className="font-mono text-[11px]">
                      1 {sourceCurrency} = {destinationDetails.exchangeRate} {destinationDetails.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-slate-700">
                    <span>Source Handover:</span>
                    <span className="font-bold">{formatCurrency(parsedAmount, sourceCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-800 font-semibold">
                    <span>Recipient Receives:</span>
                    <span className="text-sm font-bold font-display text-emerald-700">
                      {formatCurrency(destinationDetails.convertedAmount, destinationDetails.currency)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-600 italic">
                    Recipient will be credited with {destinationDetails.currency}{' '}
                    {destinationDetails.convertedAmount.toFixed(2)} in their physical float.
                  </p>
                </div>
              ) : (
                destinationDetails && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Direct 1:1 Cash Handover</span>
                    <span className="font-semibold text-slate-800">
                      Same Currency ({sourceCurrency})
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {/* Option 2 Fields: Direct Beneficiary Disbursement */}
          {settlementType === 'BENEFICIARY_DISBURSEMENT' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
                  <span>Select Charity Case *</span>
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                >
                  <option value="" disabled>
                    -- Select Charity Case --
                  </option>
                  {activeCases.map((c) => {
                    const remaining = Math.max(0, c.approvedAmount - (c.disbursedAmount || 0));
                    return (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} - {c.title} ({c.currency} • Approved:{' '}
                        {formatCurrency(c.approvedAmount, c.currency)} | Remaining:{' '}
                        {formatCurrency(remaining, c.currency)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedCase && (
                <div className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Case: {selectedCase.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">
                      {selectedCase.caseType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span>Approved Aid: {formatCurrency(selectedCase.approvedAmount, selectedCase.currency)}</span>
                    <span>
                      Remaining Budget:{' '}
                      <strong className="text-emerald-700">
                        {formatCurrency(
                          Math.max(0, selectedCase.approvedAmount - (selectedCase.disbursedAmount || 0)),
                          selectedCase.currency
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Beneficiary / Payee Name *
                </label>
                <input
                  type="text"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Tariq Mansoor (or pharmacy / hospital vendor)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Disbursement Receipt / Voucher Reference
                </label>
                <input
                  type="text"
                  value={voucherReference}
                  onChange={(e) => setVoucherReference(e.target.value)}
                  placeholder="e.g. VCHR-2026-00012, Hospital Cash Receipt #8912"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p>
                  Custodian {holding.memberName} confirmed physical cash payment of{' '}
                  <span className="font-bold">{formatCurrency(parsedAmount, sourceCurrency)}</span> directly
                  to {payeeName || 'the beneficiary'}. Case disbursed progress will be automatically updated.
                </p>
              </div>
            </div>
          )}

          {/* Settlement Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Settlement / Handover Date *</span>
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              required
            />
          </div>

          {/* Notes & Reference */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Handover Memo / Reference Note</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handover envelope note, signed recipient voucher, or meeting memo"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Confirming...' : 'Confirm Handover & Settle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
