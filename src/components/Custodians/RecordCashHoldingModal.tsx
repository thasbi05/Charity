import React, { useState } from 'react';
import { X, Wallet, User, Calendar, Tag, HeartHandshake, FileText, CheckCircle2 } from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { CashHoldingCategory } from '../../types';

interface RecordCashHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMemberId?: string;
}

const CATEGORIES: { value: CashHoldingCategory; label: string }[] = [
  { value: 'Monthly Contribution', label: 'Monthly Contributions Pool' },
  { value: 'Marriage Support', label: 'Marriage / Wedding Support' },
  { value: 'Medical Emergency', label: 'Medical Emergency Assistance' },
  { value: 'General Charity Pool', label: 'General Charity Pool / Friday Box' },
  { value: 'Education Aid', label: 'Education / Student Fees' },
  { value: 'Food & Grocery Aid', label: 'Food & Grocery Ration' },
  { value: 'Other', label: 'Other Special Relief' },
];

export const RecordCashHoldingModal: React.FC<RecordCashHoldingModalProps> = ({
  isOpen,
  onClose,
  defaultMemberId,
}) => {
  const { members, cases, settings, addCashHolding } = useCharity();

  const today = new Date().toISOString().slice(0, 10);
  const [memberId, setMemberId] = useState<string>(defaultMemberId || (members[0]?.id || ''));
  const [customMemberName, setCustomMemberName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<CashHoldingCategory>('Monthly Contribution');
  const [caseId, setCaseId] = useState<string>('');
  const [caseNote, setCaseNote] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedMember = members.find((m) => m.id === memberId);
  const selectedCase = cases.find((c) => c.id === caseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid cash amount greater than zero.');
      return;
    }

    const memberName = selectedMember
      ? selectedMember.fullName
      : customMemberName.trim() || 'Anonymous Member';

    if (!memberName) {
      setError('Please select or specify the member custodian holding this cash.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addCashHolding({
        memberId: selectedMember ? selectedMember.id : `mem_ext_${Date.now()}`,
        memberName,
        memberNumber: selectedMember?.memberNumber || undefined,
        amount: parsedAmount,
        currency: settings.currency || 'AED',
        category,
        caseId: selectedCase ? selectedCase.id : undefined,
        caseNumber: selectedCase?.caseNumber || undefined,
        caseTitle: selectedCase?.title || undefined,
        caseNote: caseNote.trim() || (selectedCase ? selectedCase.title : category),
        status: 'HELD',
        date,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record cash holding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Member Cash in Hand</h2>
              <p className="text-xs text-slate-400">
                Log physical cash received or held by a member custodian
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {/* Member Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Cash Custodian (Member) *</span>
            </label>
            {members.length > 0 ? (
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.memberNumber}) • {m.mobileNumber || 'No phone'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customMemberName}
                onChange={(e) => setCustomMemberName(e.target.value)}
                placeholder="Enter member or custodian name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            )}
          </div>

          {/* Amount & Date in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                <span>Cash Amount ({settings.currency || 'AED'}) *</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-3 pr-14 py-2 text-sm font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {settings.currency || 'AED'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Collection / Handover Date *</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Category / Fund Classification *</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                const val = e.target.value as CashHoldingCategory;
                setCategory(val);
                if (!caseNote) {
                  if (val === 'Monthly Contribution') setCaseNote('Monthly Contributions Pool');
                  if (val === 'Marriage Support') setCaseNote('Wedding Aid for Brother A');
                  if (val === 'Medical Emergency') setCaseNote('Medical Emergency Relief');
                  if (val === 'General Charity Pool') setCaseNote('General Charity Cash Box');
                }
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Link to Charity Case (Optional) */}
          {cases.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-slate-400" />
                <span>Link to Specific Charity Case (Optional)</span>
              </label>
              <select
                value={caseId}
                onChange={(e) => {
                  const cId = e.target.value;
                  setCaseId(cId);
                  const matched = cases.find((c) => c.id === cId);
                  if (matched && !caseNote) {
                    setCaseNote(matched.title);
                  }
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">-- No specific case (General Pool) --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} • {c.title} ({c.currency} {c.collectedAmount}/{c.approvedAmount || c.requestedAmount})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Purpose / Case Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Allocated Purpose / Case Note</span>
            </label>
            <input
              type="text"
              value={caseNote}
              onChange={(e) => setCaseNote(e.target.value)}
              placeholder="e.g. Wedding Aid for Brother A, Monthly Contributions Pool, Medical Aid for Brother B"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Provides immediate context for why this custodian is holding the funds.
            </p>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Additional Custody Notes / Location
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash collected at Friday gathering, scheduled for bank deposit on Sunday."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
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
              <span>{isSubmitting ? 'Recording...' : 'Record Cash Holding'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
