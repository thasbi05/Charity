import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Receipt,
  Phone,
  ArrowRight,
  CheckCircle2,
  Users,
  Coins,
  Calendar,
  X,
  Sparkles,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';
import { Member } from '../../types';
import { MemberLink } from '../Common/ClickableEntity';

interface OverdueContributionsBannerProps {
  onOpenReceiptForMember: (memberId: string) => void;
  onNavigateToMatrix: () => void;
}

interface OverdueMemberDetail {
  member: Member;
  monthlyAmount: number;
  paidThisMonth: number;
  overdueMonthsCount: number;
  totalOverdueAmount: number;
  overdueMonthNames: string[];
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const OverdueContributionsBanner: React.FC<OverdueContributionsBannerProps> = ({
  onOpenReceiptForMember,
  onNavigateToMatrix,
}) => {
  const { members, receipts, settings } = useCharity();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-indexed
  const currentMonthName = MONTH_NAMES[currentMonthIdx];

  // Map receipts for current year: `${memberId}-${monthIdx}` -> total amount
  const paymentsMap = useMemo(() => {
    const map = new Map<string, number>();

    receipts.forEach((r) => {
      if (r.status !== 'valid' || !r.receiptDate) return;
      const [yStr, mStr] = r.receiptDate.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;

      if (y === currentYear) {
        const key = `${r.memberId}-${m}`;
        map.set(key, (map.get(key) || 0) + (r.amount || 0));
      }
    });

    return map;
  }, [receipts, currentYear]);

  // Active members overdue calculation
  const { overdueList, totalOverdueAmount, activeCount, paidThisMonthCount } = useMemo(() => {
    const active = members.filter((m) => m.status === 'active');
    const overdue: OverdueMemberDetail[] = [];
    let sumOverdue = 0;
    let paidCount = 0;

    active.forEach((m) => {
      const monthlyAmount = m.monthlyContributionAmount || 100;
      const paidThisMonth = paymentsMap.get(`${m.id}-${currentMonthIdx}`) || 0;

      if (paidThisMonth >= monthlyAmount) {
        paidCount++;
      }

      // Check all months up to current month in the current year
      const overdueMonths: string[] = [];
      let memberOverdue = 0;

      for (let month = 0; month <= currentMonthIdx; month++) {
        const paidForMonth = paymentsMap.get(`${m.id}-${month}`) || 0;
        if (paidForMonth < monthlyAmount) {
          overdueMonths.push(MONTH_NAMES[month]);
          memberOverdue += monthlyAmount - paidForMonth;
        }
      }

      if (overdueMonths.length > 0) {
        overdue.push({
          member: m,
          monthlyAmount,
          paidThisMonth,
          overdueMonthsCount: overdueMonths.length,
          totalOverdueAmount: memberOverdue,
          overdueMonthNames: overdueMonths,
        });
        sumOverdue += memberOverdue;
      }
    });

    // Sort by largest overdue amount, then most overdue months
    overdue.sort((a, b) => b.totalOverdueAmount - a.totalOverdueAmount);

    return {
      overdueList: overdue,
      totalOverdueAmount: sumOverdue,
      activeCount: active.length,
      paidThisMonthCount: paidCount,
    };
  }, [members, paymentsMap, currentMonthIdx]);

  const collectionRate =
    activeCount > 0 ? Math.round((paidThisMonthCount / activeCount) * 100) : 100;

  // If no active members yet or no data
  if (activeCount === 0) return null;

  // If all members are paid and up to date
  if (overdueList.length === 0) {
    return (
      <div
        id="dashboard-overdue-banner-all-clear"
        className="rounded-xl border border-emerald-200 bg-linear-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 text-emerald-900 shadow-2xs flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold flex items-center gap-2 text-emerald-950">
              <span>All Monthly Contributions Up to Date</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900">
                100% Collected
              </span>
            </h4>
            <p className="text-[11px] sm:text-xs text-emerald-700 mt-0.5">
              All {activeCount} active members have paid their scheduled pledges for {currentMonthName} {currentYear}.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToMatrix}
          className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-white/80 hover:bg-white border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span>View Matrix</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // If dismissed into compact notification badge
  if (isDismissed) {
    return (
      <div
        id="dashboard-overdue-pill-reminder"
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs animate-fadeIn"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
          </span>
          <span className="font-bold text-amber-950">
            {overdueList.length} Members Overdue:
          </span>
          <span className="text-amber-800 truncate">
            {formatCurrency(totalOverdueAmount, settings.currency)} pending for {currentMonthName} {currentYear}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsDismissed(false)}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2"
          >
            Show Details
          </button>
          <button
            onClick={onNavigateToMatrix}
            className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-2xs"
          >
            Open Matrix
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="dashboard-overdue-banner"
      className="rounded-xl border border-amber-200/90 bg-linear-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 shadow-2xs overflow-hidden transition-all"
    >
      {/* Primary Banner Header */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {/* Visual Pulsing Notification Badge */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 tracking-tight">
                Attention Required: {overdueList.length} Members with Overdue Contributions
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                {formatCurrency(totalOverdueAmount, settings.currency)} Due
              </span>
            </div>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              {overdueList.length} of {activeCount} active members have pending regular contributions for {currentMonthName} {currentYear}. Prompt collections sustain scheduled emergency relief and community support programs.
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="inline-flex items-center gap-1.5 text-slate-700 bg-white/70 px-2.5 py-1 rounded-md border border-amber-200/60 font-medium">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  <strong>{paidThisMonthCount}</strong> / {activeCount} Paid ({collectionRate}%)
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 text-slate-700 bg-white/70 px-2.5 py-1 rounded-md border border-amber-200/60 font-medium">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Pending: <strong>{formatCurrency(totalOverdueAmount, settings.currency)}</strong>
                </span>
              </div>

              {/* Progress bar */}
              <div className="hidden sm:flex items-center gap-2 min-w-36">
                <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(collectionRate, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-600">{collectionRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
          <button
            id="overdue-banner-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <span>{isExpanded ? 'Hide Overdue List' : `Review List (${overdueList.length})`}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          <button
            id="overdue-banner-matrix-btn"
            onClick={onNavigateToMatrix}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <span>Full Contribution Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            id="overdue-banner-dismiss-btn"
            onClick={() => setIsDismissed(true)}
            title="Minimize to reminder bar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Overdue Members Quick Collection List */}
      {isExpanded && (
        <div className="border-t border-amber-200/80 bg-white/90 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <span>Overdue Active Contributors</span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                Sorted by highest amount
              </span>
            </h4>
            <span className="text-xs text-slate-500">
              Click <strong>"Collect Receipt"</strong> to issue an instant receipt pre-filled with their pledge amount.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {overdueList.map(({ member, monthlyAmount, overdueMonthsCount, totalOverdueAmount, overdueMonthNames }) => (
              <div
                key={member.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-amber-300 shadow-2xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <MemberLink
                        memberId={member.id}
                        memberName={member.fullName}
                        memberNumber={member.memberNumber}
                        originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                        className="text-xs font-bold text-slate-900 truncate hover:text-amber-700 block"
                      />
                      <p className="text-[11px] text-slate-500 font-mono">
                        {member.memberNumber} • {member.mobileNumber || 'No phone'}
                      </p>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        overdueMonthsCount > 1
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {overdueMonthsCount} {overdueMonthsCount === 1 ? 'Month' : 'Months'} Due
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Months Unpaid:
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700">
                        {overdueMonthNames.slice(-3).join(', ')}
                        {overdueMonthNames.length > 3 && ` +${overdueMonthNames.length - 3}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Total Due:
                      </span>
                      <span className="text-xs font-bold text-rose-600">
                        {formatCurrency(totalOverdueAmount, settings.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    Pledge: {formatCurrency(monthlyAmount, settings.currency)}/mo
                  </span>
                  <button
                    onClick={() => onOpenReceiptForMember(member.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <Receipt className="w-3 h-3" />
                    <span>Collect Receipt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Tip: Press <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-semibold text-slate-700">Ctrl+N</kbd> anywhere to quickly record a new contribution receipt.
            </span>
            <button
              onClick={onNavigateToMatrix}
              className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 self-end"
            >
              <span>View Full 12-Month Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
