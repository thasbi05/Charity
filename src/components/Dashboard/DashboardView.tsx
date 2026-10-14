import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  Receipt,
  HeartHandshake,
  Calendar,
  AlertCircle,
  PlusCircle,
  Sparkles,
  Briefcase,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Coins,
  X,
  ArrowRight,
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';
import { FinancialLedgerService, convertToBaseCurrency, isReceiptValid } from '../../services/financialLedgerService';
import { NavTab } from '../Sidebar';
import { MemberCashHoldingsWidget } from './MemberCashHoldingsWidget';
import { MemberLink, CaseLink, TransactionLink } from '../Common/ClickableEntity';
import { AiDiagnosticWidget } from '../Common/AiDiagnosticWidget';
import { DiagnosticBanner } from '../Financial/DiagnosticBanner';

interface DashboardViewProps {
  onNavigate: (tab: NavTab, recordId?: string) => void;
  openCreateReceipt?: (memberId?: string) => void;
  openCreatePayment?: () => void;
  onOpenCreateReceipt?: (memberId?: string) => void;
  onOpenCreatePayment?: () => void;
  onSelectReceipt?: (id: string) => void;
  onSelectPayment?: (id: string) => void;
}

const CATEGORY_COLORS = [
  '#059669', // Emerald
  '#2563eb', // Blue
  '#dc2626', // Red
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4b5563', // Slate
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  openCreateReceipt,
  openCreatePayment,
  onOpenCreateReceipt,
  onOpenCreatePayment,
  onSelectReceipt,
  onSelectPayment,
}) => {
  const handleOpenReceipt = (memberId?: string) => {
    if (typeof openCreateReceipt === 'function') openCreateReceipt(memberId);
    if (typeof onOpenCreateReceipt === 'function') onOpenCreateReceipt(memberId);
  };

  const handleOpenPayment = () => {
    if (typeof openCreatePayment === 'function') openCreatePayment();
    if (typeof onOpenCreatePayment === 'function') onOpenCreatePayment();
  };
  const { openTransactionEditor } = useNavigation();
  const {
    members,
    receipts,
    payments,
    cashAccounts,
    transactions,
    cases = [],
    cashHoldings = [],
    settings,
    seedDemoData,
    loading,
  } = useCharity();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Valid (non-voided, non-draft, non-pledged) receipts and payments
  const validReceipts = useMemo(() => receipts.filter((r) => isReceiptValid(r.status)), [receipts]);
  const validPayments = useMemo(() => payments.filter((p) => p.status === 'valid'), [payments]);

  // Balance Sheet computed from Single Source of Truth
  const balanceSheet = useMemo(() => {
    return FinancialLedgerService.getBalanceSheet(
      members,
      cases,
      cashAccounts,
      transactions,
      validReceipts,
      validPayments,
      cashHoldings
    );
  }, [members, cases, cashAccounts, transactions, validReceipts, validPayments, cashHoldings]);

  // Total summary figures
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === 'active').length;

  const totalContributions = useMemo(
    () => balanceSheet.kpis.totalMemberContributions,
    [balanceSheet]
  );

  const totalCharityPayments = useMemo(
    () => balanceSheet.kpis.totalCharityPayments,
    [balanceSheet]
  );

  const currentCashBalance = useMemo(
    () => balanceSheet.totalAssets.total,
    [balanceSheet]
  );

  // Total contributions by currency
  const totalContributionsSplit = useMemo(() => {
    const map: Record<string, number> = {};
    validReceipts.forEach((r) => {
      const cur = (r.currency || settings.currency || 'AED').toUpperCase();
      map[cur] = Number(((map[cur] || 0) + (r.amount || 0)).toFixed(2));
    });
    return map;
  }, [validReceipts, settings.currency]);

  // Total payments by currency
  const totalPaymentsSplit = useMemo(() => {
    const map: Record<string, number> = {};
    validPayments.forEach((p) => {
      const cur = (p.currency || settings.currency || 'AED').toUpperCase();
      map[cur] = Number(((map[cur] || 0) + (p.amount || 0)).toFixed(2));
    });
    return map;
  }, [validPayments, settings.currency]);

  // This month contributions with currency conversion
  const thisMonthContributions = useMemo(() => {
    return validReceipts
      .filter((r) => {
        const mKey = (r.contributionMonth || r.periodMonth || r.receiptDate || '').slice(0, 7);
        return mKey === currentMonthPrefix;
      })
      .reduce((sum, r) => {
        const baseAmt = r.baseCurrencyAmount || convertToBaseCurrency(r.amount || 0, r.currency, r.exchangeRate, settings.currency || 'AED');
        return sum + baseAmt;
      }, 0);
  }, [validReceipts, currentMonthPrefix, settings.currency]);

  // This month contributions split by currency
  const thisMonthContributionsSplit = useMemo(() => {
    const map: Record<string, number> = {};
    validReceipts
      .filter((r) => {
        const mKey = (r.contributionMonth || r.periodMonth || r.receiptDate || '').slice(0, 7);
        return mKey === currentMonthPrefix;
      })
      .forEach((r) => {
        const cur = (r.currency || settings.currency || 'AED').toUpperCase();
        map[cur] = Number(((map[cur] || 0) + (r.amount || 0)).toFixed(2));
      });
    return map;
  }, [validReceipts, currentMonthPrefix, settings.currency]);

  // This month payments with currency conversion
  const thisMonthPayments = useMemo(() => {
    return validPayments
      .filter((p) => (p.paymentDate || '').startsWith(currentMonthPrefix))
      .reduce((sum, p) => {
        const baseAmt = p.baseCurrencyAmount || convertToBaseCurrency(p.amount || 0, p.currency, p.exchangeRate, settings.currency || 'AED');
        return sum + baseAmt;
      }, 0);
  }, [validPayments, currentMonthPrefix, settings.currency]);

  // This month payments split by currency
  const thisMonthPaymentsSplit = useMemo(() => {
    const map: Record<string, number> = {};
    validPayments
      .filter((p) => (p.paymentDate || '').startsWith(currentMonthPrefix))
      .forEach((p) => {
        const cur = (p.currency || settings.currency || 'AED').toUpperCase();
        map[cur] = Number(((map[cur] || 0) + (p.amount || 0)).toFixed(2));
      });
    return map;
  }, [validPayments, currentMonthPrefix, settings.currency]);

  // Total member INR custody cash held
  const totalMemberInrCash = useMemo(() => {
    const fromHoldings = cashHoldings
      .filter((h) => h.status === 'HELD' && h.currency === 'INR' && h.id !== 'holding_1790333624218_w7s6')
      .reduce((sum, h) => sum + (h.amount || 0), 0);
    const fromMembers = members.reduce((sum, m) => sum + (m.cashBalances?.['INR'] || 0), 0);
    const fromBalanceSheet = balanceSheet.totalAssets.cashHeldByCurrency?.['INR'] || 0;
    return Math.max(fromHoldings, fromMembers, fromBalanceSheet);
  }, [cashHoldings, members, balanceSheet]);

  // Total member AED custody cash held
  const totalMemberAedCash = useMemo(() => {
    const fromHoldings = cashHoldings
      .filter((h) => h.status === 'HELD' && (h.currency === 'AED' || !h.currency) && h.id !== 'holding_1790333624218_w7s6')
      .reduce((sum, h) => sum + (h.amount || 0), 0);
    const fromMembers = members.reduce((sum, m) => sum + (m.cashBalances?.['AED'] || 0), 0);
    const fromBalanceSheet = balanceSheet.totalAssets.cashHeldByCurrency?.['AED'] || 0;
    return Math.max(fromHoldings, fromMembers, fromBalanceSheet);
  }, [cashHoldings, members, balanceSheet]);

  // Monthly breakdown for charts using FinancialLedgerService (Chronological Contribution Months)
  const monthlyChartData = useMemo(() => {
    const fullYear = FinancialLedgerService.getMonthlyChartData(
      validReceipts,
      validPayments,
      currentYear
    );
    // Display up to current month (or all if currentMonth is 0)
    return fullYear.slice(0, Math.max(1, currentMonth + 1));
  }, [validReceipts, validPayments, currentYear, currentMonth]);

  // Charity assistance category breakdown
  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    validPayments.forEach((p) => {
      const cat = p.charityCategory || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (p.amount || 0);
    });

    return Object.entries(catMap).map(([name, value]) => ({ name, value }));
  }, [validPayments]);

  // Recent transactions (last 6)
  const recentTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);

  // Recent receipts (last 5)
  const recentReceipts = useMemo(() => validReceipts.slice(0, 5), [validReceipts]);

  // Members who haven't contributed this month
  const pendingMembers = useMemo(() => {
    const paidMemberIds = new Set(
      validReceipts
        .filter((r) => r.receiptDate?.startsWith(currentMonthPrefix))
        .map((r) => r.memberId)
    );
    return members.filter((m) => m.status === 'active' && !paidMemberIds.has(m.id));
  }, [members, validReceipts, currentMonthPrefix]);

  // Overdue Monthly Contributions Banner state & computation
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
  const [isOverdueDismissed, setIsOverdueDismissed] = useState(false);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthIdx = now.getMonth();
  const currentMonthName = MONTH_NAMES[currentMonthIdx];

  const { overdueList, totalOverdueAmount, activeCount, paidThisMonthCount, collectionRate } = useMemo(() => {
    const active = members.filter((m) => m.status === 'active');
    if (active.length === 0) {
      return { overdueList: [], totalOverdueAmount: 0, activeCount: 0, paidThisMonthCount: 0, collectionRate: 100 };
    }

    const paymentsMap = new Map<string, number>();
    validReceipts.forEach((r) => {
      if (!isReceiptValid(r.status) || !r.receiptDate) return;
      const [yStr, mStr] = r.receiptDate.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      if (y === currentYear) {
        const key = `${r.memberId}-${m}`;
        paymentsMap.set(key, (paymentsMap.get(key) || 0) + (r.amount || 0));
      }
    });

    const overdue: Array<{
      member: (typeof members)[0];
      monthlyAmount: number;
      paidThisMonth: number;
      overdueMonthsCount: number;
      totalOverdueAmount: number;
      overdueMonthNames: string[];
    }> = [];

    let sumOverdue = 0;
    let paidCount = 0;

    active.forEach((m) => {
      const monthlyAmount = m.monthlyContributionAmount || 100;
      const paidThisMonth = paymentsMap.get(`${m.id}-${currentMonthIdx}`) || 0;

      if (paidThisMonth >= monthlyAmount) {
        paidCount++;
      }

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

    overdue.sort((a, b) => b.totalOverdueAmount - a.totalOverdueAmount);
    const rate = active.length > 0 ? Math.round((paidCount / active.length) * 100) : 100;

    return {
      overdueList: overdue,
      totalOverdueAmount: sumOverdue,
      activeCount: active.length,
      paidThisMonthCount: paidCount,
      collectionRate: rate,
    };
  }, [members, validReceipts, currentYear, currentMonthIdx]);

  return (
    <div id="dashboard-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Financial &amp; Charity Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-brand font-bold text-emerald-950">{settings.charityName}</span>
            {settings.tagline && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">{settings.tagline}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {totalMembers === 0 && (
            <button
              id="dashboard-seed-btn"
              onClick={() => seedDemoData()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Load 20 Demo Members</span>
            </button>
          )}

          <button
            id="dashboard-record-receipt-btn"
            onClick={handleOpenReceipt}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Receipt</span>
          </button>

          <button
            id="dashboard-record-payment-btn"
            onClick={handleOpenPayment}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <HeartHandshake className="w-4 h-4 text-rose-400" />
            <span>Charity Payment</span>
          </button>

          <button
            id="dashboard-record-expense-btn"
            onClick={() => onNavigate('payments')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Enter operating expenses like Refreshment, Printing, Stationery, etc."
          >
            <Briefcase className="w-4 h-4 text-amber-200" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Visual Notification Indicator Banner for Overdue Monthly Contributions */}
      {activeCount > 0 && overdueList.length === 0 && (
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
            onClick={() => onNavigate('monthly-status')}
            className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-white/80 hover:bg-white border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeCount > 0 && overdueList.length > 0 && isOverdueDismissed && (
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
              onClick={() => setIsOverdueDismissed(false)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
            >
              Show Details
            </button>
            <button
              onClick={() => onNavigate('monthly-status')}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-2xs cursor-pointer"
            >
              Open Matrix
            </button>
          </div>
        </div>
      )}

      {activeCount > 0 && overdueList.length > 0 && !isOverdueDismissed && (
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
                onClick={() => setIsOverdueExpanded(!isOverdueExpanded)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              >
                <span>{isOverdueExpanded ? 'Hide Overdue List' : `Review List (${overdueList.length})`}</span>
                {isOverdueExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              <button
                id="overdue-banner-matrix-btn"
                onClick={() => onNavigate('monthly-status')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>Full Contribution Matrix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                id="overdue-banner-dismiss-btn"
                onClick={() => setIsOverdueDismissed(true)}
                title="Minimize to reminder bar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded Overdue Members Quick Collection List */}
          {isOverdueExpanded && (
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
                {overdueList.map(({ member, monthlyAmount, overdueMonthsCount, totalOverdueAmount: memberDue, overdueMonthNames }) => (
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
                            {formatCurrency(memberDue, settings.currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">
                        Pledge: {formatCurrency(monthlyAmount, settings.currency)}/mo
                      </span>
                      <button
                        onClick={() => handleOpenReceipt(member.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
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
                  onClick={() => onNavigate('monthly-status')}
                  className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 self-end cursor-pointer"
                >
                  <span>View Full 12-Month Matrix</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Metric Cards (Section 3 & 23) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total & Active Members */}
        <div
          id="kpi-total-members"
          onClick={() => onNavigate('members')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Members
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-display text-slate-900">
            {totalMembers}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <UserCheck className="w-3.5 h-3.5" />
              <span>{activeMembers} Active contributors</span>
            </div>
            {pendingMembers.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>{pendingMembers.length} Overdue</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Current Cash & Bank Balance */}
        <div
          id="kpi-current-balance"
          onClick={() => onNavigate('cash-bank')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cash & Bank Balance
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-2xl font-bold font-display text-emerald-700 truncate">
              {formatCurrency(currentCashBalance, settings.currency)}
            </div>
            {(totalMemberInrCash > 0 || totalMemberAedCash > 0) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 font-mono" title="Multi-Currency Custody Breakdown">
                AED {totalMemberAedCash.toFixed(2)} | ₹{totalMemberInrCash.toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between gap-2 flex-wrap">
            <span>Bank/Safe: {formatCurrency(balanceSheet.totalAssets.bankBalance + balanceSheet.totalAssets.otherCashAssets, settings.currency)}</span>
            {balanceSheet.totalAssets.cashHeldByMembers > 0 ? (
              <span
                className="font-semibold text-emerald-700"
                title={`Custodians: AED ${totalMemberAedCash.toFixed(2)} & ₹${totalMemberInrCash.toLocaleString()}`}
              >
                Custodians: {formatCurrency(balanceSheet.totalAssets.cashHeldByMembers, settings.currency)}
                {totalMemberInrCash > 0 && ` (₹${totalMemberInrCash.toLocaleString()})`}
              </span>
            ) : null}
          </div>
        </div>

        {/* Card 3: Total Contributions */}
        <div
          id="kpi-total-contributions"
          onClick={() => onNavigate('receipts')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Contributions
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-2xl font-bold font-display text-slate-900 truncate">
              {formatCurrency(totalContributions, settings.currency)}
            </div>
            {totalContributionsSplit['INR'] && totalContributionsSplit['INR'] > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200 font-mono" title="Multi-Currency Breakdown">
                AED {(totalContributionsSplit['AED'] || 0).toFixed(2)} | ₹{(totalContributionsSplit['INR'] || 0).toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span>{validReceipts.length} receipts issued</span>
            {totalContributionsSplit['INR'] && totalContributionsSplit['INR'] > 0 && (
              <span className="text-[10px] text-slate-400">Includes INR Field Pledges</span>
            )}
          </div>
        </div>

        {/* Card 4: Total Charity Payments */}
        <div
          id="kpi-total-payments"
          onClick={() => onNavigate('payments')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Charity Given
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-2xl font-bold font-display text-rose-600 truncate">
              {formatCurrency(totalCharityPayments, settings.currency)}
            </div>
            {totalPaymentsSplit['INR'] && totalPaymentsSplit['INR'] > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-200 font-mono">
                AED {(totalPaymentsSplit['AED'] || 0).toFixed(2)} | ₹{(totalPaymentsSplit['INR'] || 0).toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {validPayments.length} assistance vouchers
          </div>
        </div>
      </div>

      {/* Secondary Row: This Month Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900 text-white p-5 rounded-xl shadow-xs">
        <div className="border-b sm:border-b-0 sm:border-r border-slate-800 pb-3 sm:pb-0 sm:pr-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            This Month Contributions
          </p>
          <div className="flex items-baseline gap-2 flex-wrap mt-1">
            <p className="text-xl font-bold font-display text-emerald-400">
              {formatCurrency(thisMonthContributions, settings.currency)}
            </p>
            {thisMonthContributionsSplit['INR'] && thisMonthContributionsSplit['INR'] > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 font-mono">
                AED {(thisMonthContributionsSplit['AED'] || 0).toFixed(2)} | ₹{(thisMonthContributionsSplit['INR'] || 0).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {validReceipts.filter((r) => (r.contributionMonth || r.periodMonth || r.receiptDate || '').slice(0, 7) === currentMonthPrefix).length} payments recorded
          </p>
        </div>

        <div className="border-b sm:border-b-0 sm:border-r border-slate-800 py-3 sm:py-0 sm:px-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            This Month Charity Aid
          </p>
          <div className="flex items-baseline gap-2 flex-wrap mt-1">
            <p className="text-xl font-bold font-display text-rose-400">
              {formatCurrency(thisMonthPayments, settings.currency)}
            </p>
            {thisMonthPaymentsSplit['INR'] && thisMonthPaymentsSplit['INR'] > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/70 font-mono">
                AED {(thisMonthPaymentsSplit['AED'] || 0).toFixed(2)} | ₹{(thisMonthPaymentsSplit['INR'] || 0).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct assistance to needy people
          </p>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Net Surplus This Month
          </p>
          <p
            className={`text-xl font-bold font-display mt-1 ${
              thisMonthContributions >= thisMonthPayments ? 'text-blue-400' : 'text-amber-400'
            }`}
          >
            {formatCurrency(thisMonthContributions - thisMonthPayments, settings.currency)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Available for additional welfare
          </p>
        </div>
      </div>

      {/* Member Cash-in-Hand / Cash Custodians Widget */}
      <MemberCashHoldingsWidget onNavigateToCustodians={() => onNavigate('custodians')} />

      {/* Dashboard Charts (Section 3: Monthly Contributions, Payments, Assistance by Category) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Monthly Trend (Contributions vs Payments) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Contributions vs Charity Payments
              </h2>
              <p className="text-xs text-slate-500">
                Fiscal year {currentYear} comparative monthly cash flow
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" /> Contributions
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" /> Payments
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value), settings.currency)]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Bar dataKey="Contributions" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Payments" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Assistance by Category Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Charity Assistance by Category
            </h2>
            <p className="text-xs text-slate-500">
              Breakdown of funds distributed to needy causes
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[220px]">
            {categoryChartData.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">
                <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>No charity payments recorded yet.</p>
              </div>
            ) : (
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val), settings.currency)]}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: 'none',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Legend */}
          {categoryChartData.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
              {categoryChartData.slice(0, 6).map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="truncate text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two Columns: Recent Receipts & Pending Monthly Contributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Receipts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Recent Member Receipts</span>
              </h2>
            </div>
            <button
              onClick={() => onNavigate('receipts')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentReceipts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No receipts recorded yet. Click "Record Receipt" to create one.
              </div>
            ) : (
              recentReceipts.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <MemberLink
                      memberId={r.memberId}
                      memberName={r.memberName}
                      originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                      className="text-xs font-bold text-slate-800 truncate"
                    />
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <TransactionLink
                        transactionId={r.id}
                        transactionNumber={r.receiptNumber}
                        originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                      />
                      <span>•</span>
                      <span>{r.receiptDate}</span>
                      <span>•</span>
                      <span>{r.paymentMethod}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-600">
                      +{formatCurrency(r.amount, settings.currency)}
                    </span>
                    <p className="text-[10px] text-slate-400">{r.cashBankAccountName}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Pending Member Contributions (This Month) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Pending Contributions ({pendingMembers.length})</span>
              </h2>
            </div>
            <button
              onClick={() => onNavigate('monthly-status')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Full Status Sheet
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {pendingMembers.length === 0 ? (
              <div className="p-8 text-center text-emerald-700 text-xs">
                All active members have contributed for this month!
              </div>
            ) : (
              pendingMembers.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <MemberLink
                      memberId={m.id}
                      memberName={m.fullName}
                      memberNumber={m.memberNumber}
                      originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                      className="text-xs font-bold text-slate-800 truncate"
                    />
                    <p className="text-[11px] text-slate-500">
                      {m.memberNumber} • {m.mobileNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-700">
                      {formatCurrency(m.monthlyContributionAmount, settings.currency)}
                    </span>
                    <button
                      onClick={() => handleOpenReceipt(m.id)}
                      className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200 cursor-pointer"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Double-Entry Journal Transactions (Section 11) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>Recent Double-Entry Accounting Transactions</span>
            </h2>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-semibold text-purple-700 hover:text-purple-800"
          >
            Open Central Ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">TXN #</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Debit Account</th>
                <th className="py-2.5 px-4">Credit Account</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No transactions posted yet.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{t.date}</td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                      <TransactionLink
                        transactionId={t.id}
                        transactionNumber={t.transactionNumber}
                        showIcon={true}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          t.type === 'Contribution'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.type === 'Charity Payment'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-xs truncate text-slate-700">
                      {t.description}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {t.debitEntityType === 'member' && (t.debitMemberId || t.debitMemberName) && (
                        <div className="mb-0.5">
                          <MemberLink
                            memberId={t.debitMemberId || ''}
                            memberName={t.debitMemberName}
                            memberNumber={t.debitMemberNumber}
                            originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                            className="text-[10px] font-semibold text-emerald-800 hover:underline"
                          />
                        </div>
                      )}
                      <div>
                        <span className="font-mono text-slate-400 mr-1">{t.debitAccountCode}</span>
                        {t.debitAccountName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {t.creditEntityType === 'member' && (t.creditMemberId || t.creditMemberName) && (
                        <div className="mb-0.5">
                          <MemberLink
                            memberId={t.creditMemberId || ''}
                            memberName={t.creditMemberName}
                            memberNumber={t.creditMemberNumber}
                            originBreadcrumb={[{ label: 'Dashboard', tab: 'dashboard' }]}
                            className="text-[10px] font-semibold text-amber-800 hover:underline"
                          />
                        </div>
                      )}
                      <div>
                        <span className="font-mono text-slate-400 mr-1">{t.creditAccountCode}</span>
                        {t.creditAccountName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                      {formatCurrency(t.amount, settings.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t.status === 'valid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700 line-through'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openTransactionEditor(t.id)}
                        title={`Edit Transaction [${t.transactionNumber}]`}
                        className="p-1 rounded hover:bg-cyan-50 text-slate-500 hover:text-cyan-700 transition-colors inline-flex items-center gap-1 text-xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium hidden sm:inline">Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
