import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  formatContributionMonthShort,
  formatMonthsBreakdown,
  formatMonthsRangePill,
} from '../../services/financialLedgerService';

interface MultiMonthSelectorProps {
  selectedMonths: string[]; // YYYY-MM array
  onChange: (months: string[]) => void;
  paidMonths?: string[]; // YYYY-MM array of already paid months for this member
  currency?: string;
  ratePerMonth?: number; // e.g. 20 for AED
  currentAmount?: number; // Current value in amount input to show voluntary breakdown
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MultiMonthSelector: React.FC<MultiMonthSelectorProps> = ({
  selectedMonths,
  onChange,
  paidMonths = [],
  currency = 'AED',
  ratePerMonth = 20,
  currentAmount,
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-indexed
  const currentMonthStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;

  const [activeYear, setActiveYear] = useState<number>(() => {
    if (selectedMonths.length > 0) {
      return parseInt(selectedMonths[0].split('-')[0], 10) || currentYear;
    }
    return currentYear;
  });

  const [selectionMode, setSelectionMode] = useState<'grid' | 'range'>('grid');

  // Set of paid months for quick lookup
  const paidSet = useMemo(() => new Set(paidMonths), [paidMonths]);

  // Set of selected months
  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);

  // Find the first unpaid month of active or current year
  const getFirstUnpaidMonth = (): string => {
    for (let m = 1; m <= 12; m++) {
      const mStr = `${activeYear}-${String(m).padStart(2, '0')}`;
      if (!paidSet.has(mStr)) return mStr;
    }
    // If all paid in activeYear, try next year
    return `${activeYear + 1}-01`;
  };

  // Helper to add N months starting from a given month
  const generateConsecutiveMonths = (startMonthStr: string, count: number): string[] => {
    const [yStr, mStr] = startMonthStr.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);

    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return result;
  };

  // Helper to toggle a single month
  const toggleMonth = (monthStr: string) => {
    let next: string[];
    if (selectedSet.has(monthStr)) {
      next = selectedMonths.filter((m) => m !== monthStr);
    } else {
      next = [...selectedMonths, monthStr].sort();
    }
    onChange(next);
  };

  // Quick Shortcuts Handlers
  const handleAddMonthsShortcut = (count: number) => {
    let startMonth = '';

    if (selectedMonths.length > 0) {
      // Find latest selected month and add subsequent months, or reset from earliest
      if (count === 1) {
        // Add one more after the last selected
        const lastSelected = selectedMonths[selectedMonths.length - 1];
        const [yStr, mStr] = lastSelected.split('-');
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) + 1;
        if (m > 12) {
          m = 1;
          y++;
        }
        const nextMonth = `${y}-${String(m).padStart(2, '0')}`;
        if (!selectedSet.has(nextMonth)) {
          onChange([...selectedMonths, nextMonth].sort());
          return;
        }
      }
      startMonth = selectedMonths[0];
    } else {
      startMonth = getFirstUnpaidMonth();
    }

    const months = generateConsecutiveMonths(startMonth, count);
    onChange(months);
  };

  // Range Picker state
  const [rangeFrom, setRangeFrom] = useState<string>(() => {
    return selectedMonths[0] || currentMonthStr;
  });
  const [rangeTo, setRangeTo] = useState<string>(() => {
    return selectedMonths[selectedMonths.length - 1] || currentMonthStr;
  });

  const handleApplyRange = (fromStr: string, toStr: string) => {
    if (!fromStr || !toStr) return;
    if (fromStr > toStr) {
      // Swap if reversed
      const temp = fromStr;
      fromStr = toStr;
      toStr = temp;
    }

    const [fromY, fromM] = fromStr.split('-').map(Number);
    const [toY, toM] = toStr.split('-').map(Number);

    const list: string[] = [];
    let curY = fromY;
    let curM = fromM;

    while (curY < toY || (curY === toY && curM <= toM)) {
      list.push(`${curY}-${String(curM).padStart(2, '0')}`);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    onChange(list);
  };

  // Calculation summaries
  const monthsCount = selectedMonths.length;
  const baseCalculatedTotal = monthsCount * ratePerMonth;
  const enteredAmount = typeof currentAmount === 'number' && !isNaN(currentAmount) ? currentAmount : baseCalculatedTotal;
  const voluntaryExtra = enteredAmount > baseCalculatedTotal ? enteredAmount - baseCalculatedTotal : 0;

  // Formatted currency helper
  const formatAmt = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="sm:col-span-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
      {/* Header with Label and Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Contribution Month / Multi-Month Coverage</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-500 block">
            Select one or more consecutive months. Dues auto-calculate at {formatAmt(ratePerMonth)}/month.
          </span>
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto">
          <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 text-[11px] font-medium shadow-inner">
            <button
              type="button"
              onClick={() => setSelectionMode('grid')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectionMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12-Month Matrix
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode('range')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                selectionMode === 'range'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Period Range (From - To)
            </button>
          </div>
        </div>
      </div>

      {/* Quick Shortcut Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
          Quick Shortcuts:
        </span>
        <button
          type="button"
          onClick={() => handleAddMonthsShortcut(1)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold border border-slate-200 hover:border-emerald-300 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3 text-emerald-600" />
          <span>+1 Month</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddMonthsShortcut(3)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold border border-slate-200 hover:border-emerald-300 shadow-2xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-emerald-600" />
          <span>+3 Months (Quarter)</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddMonthsShortcut(6)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold border border-slate-200 hover:border-emerald-300 shadow-2xs transition-colors cursor-pointer"
        >
          <Layers className="w-3 h-3 text-emerald-600" />
          <span>+6 Months (Half Year)</span>
        </button>

        <button
          type="button"
          onClick={() => handleAddMonthsShortcut(12)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold border border-slate-200 hover:border-emerald-300 shadow-2xs transition-colors cursor-pointer"
        >
          <Calendar className="w-3 h-3 text-emerald-600" />
          <span>+1 Year (12 Months)</span>
        </button>

        {selectedMonths.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-medium border border-transparent hover:border-rose-200 transition-colors ml-auto cursor-pointer"
            title="Clear Selected Months"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Mode 1: 12-Month Matrix Grid */}
      {selectionMode === 'grid' && (
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveYear((y) => y - 1)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-xs text-slate-900 px-2 font-mono">
                {activeYear}
              </span>
              <button
                type="button"
                onClick={() => setActiveYear((y) => y + 1)}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Selected
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block" /> Paid
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300 inline-block" /> Due / Available
              </span>
            </div>
          </div>

          {/* 12 Months Grid (4x3 on mobile, 6x2 or 12x1 on desktop) */}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
            {MONTH_NAMES.map((name, idx) => {
              const monthStr = `${activeYear}-${String(idx + 1).padStart(2, '0')}`;
              const isSelected = selectedSet.has(monthStr);
              const isPaid = paidSet.has(monthStr);
              const isCurrent = monthStr === currentMonthStr;

              return (
                <button
                  key={monthStr}
                  type="button"
                  onClick={() => toggleMonth(monthStr)}
                  className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                      : isPaid
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  } ${isCurrent && !isSelected ? 'ring-1 ring-amber-400' : ''}`}
                >
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : ''}`}>
                    {name}
                  </span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {isSelected ? (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    ) : isPaid ? (
                      <span className="text-[9px] font-semibold text-emerald-700 uppercase">Paid</span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-400 uppercase">Due</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode 2: Period Range (From - To) */}
      {selectionMode === 'range' && (
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                From Month:
              </label>
              <input
                type="month"
                value={rangeFrom}
                onChange={(e) => {
                  setRangeFrom(e.target.value);
                  handleApplyRange(e.target.value, rangeTo);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                To Month:
              </label>
              <input
                type="month"
                value={rangeTo}
                onChange={(e) => {
                  setRangeTo(e.target.value);
                  handleApplyRange(rangeFrom, e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleApplyRange(rangeFrom, rangeTo)}
            className="w-full py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Apply Period Range</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Months Summary Pill & Dynamic Breakdown */}
      {monthsCount > 0 ? (
        <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 p-3 text-emerald-950 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-xs sm:text-sm">
                {formatMonthsRangePill(selectedMonths)}
              </span>
            </div>
            <div className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900">
              Total Rate: {formatAmt(baseCalculatedTotal)}
            </div>
          </div>

          {/* Selected month chips with ✕ remove button */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {selectedMonths.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900 text-[11px] font-medium shadow-2xs"
              >
                <span>{formatContributionMonthShort(m)}</span>
                <button
                  type="button"
                  onClick={() => toggleMonth(m)}
                  className="text-slate-400 hover:text-rose-600 rounded cursor-pointer ml-0.5"
                  title={`Remove ${formatContributionMonthShort(m)}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {/* Voluntary extra amount notice if user has typed a higher amount */}
          {voluntaryExtra > 0 && (
            <div className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60 flex items-center justify-between">
              <span>
                Base Dues ({monthsCount} × {formatAmt(ratePerMonth)}): <strong>{formatAmt(baseCalculatedTotal)}</strong>
              </span>
              <span className="font-semibold text-emerald-900">
                + Voluntary Addition: <strong>{formatAmt(voluntaryExtra)}</strong> (Entered: {formatAmt(enteredAmount)})
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-900 text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>
            No contribution months selected. Please click a shortcut button above or select months in the matrix.
          </span>
        </div>
      )}
    </div>
  );
};
