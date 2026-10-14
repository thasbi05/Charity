import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  Clock,
  PlusCircle,
  Download,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { MemberLink } from '../Common/ClickableEntity';

interface MonthlyContributionMatrixProps {
  onOpenCreateReceiptForMember: (memberId: string) => void;
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

export const MonthlyContributionMatrix: React.FC<MonthlyContributionMatrixProps> = ({
  onOpenCreateReceiptForMember,
}) => {
  const { members, receipts, settings } = useCharity();

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0-indexed

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<number | 'all'>(currentMonthIdx);

  // Active members
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  // Map of member payments by year and month: key `${memberId}-${monthIdx}` -> total amount paid
  const paymentsMap = useMemo(() => {
    const map = new Map<string, number>();

    receipts.forEach((r) => {
      if (r.status !== 'valid' || !r.receiptDate) return;
      const [yStr, mStr] = r.receiptDate.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;

      if (y === selectedYear) {
        const key = `${r.memberId}-${m}`;
        map.set(key, (map.get(key) || 0) + (r.amount || 0));
      }
    });

    return map;
  }, [receipts, selectedYear]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeMembers.filter((m) => {
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.mobileNumber.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterMonth !== 'all') {
        // Can filter to only show pending for this month if user wants
        // but default is list all with status indicators
      }
      return true;
    });
  }, [activeMembers, searchQuery, filterMonth]);

  // Current month stats
  const currentMonthPaidCount = useMemo(() => {
    return activeMembers.filter((m) => {
      const paid = paymentsMap.get(`${m.id}-${currentMonthIdx}`) || 0;
      return paid >= (m.monthlyContributionAmount || 0);
    }).length;
  }, [activeMembers, paymentsMap, currentMonthIdx]);

  const currentMonthPendingCount = activeMembers.length - currentMonthPaidCount;

  const handleExportCsv = () => {
    const rows = filteredMembers.map((m) => {
      const row: Record<string, any> = {
        'Member Number': m.memberNumber,
        'Member Name': m.fullName,
        'Monthly Pledge': m.monthlyContributionAmount,
      };

      MONTH_NAMES.forEach((month, idx) => {
        const paid = paymentsMap.get(`${m.id}-${idx}`) || 0;
        row[month] = paid > 0 ? `Paid (${paid})` : 'Pending';
      });

      return row;
    });
    exportToCsv(`Member_Monthly_Contributions_${selectedYear}`, rows);
  };

  return (
    <div id="monthly-matrix-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Member Monthly Contributions Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track monthly regular contribution status across all {activeMembers.length} active members for fiscal year {selectedYear}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => setSelectedYear((prev) => prev - 1)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded"
              title="Previous Year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs text-slate-800 px-2">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear((prev) => prev + 1)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded"
              title="Next Year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => triggerPrint('monthly-matrix-view', `Monthly_Contributions_${selectedYear}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Statistics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase">
              {MONTH_NAMES[currentMonthIdx]} {selectedYear} Paid
            </span>
            <p className="text-xl font-bold font-display text-emerald-700">
              {currentMonthPaidCount} Members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase">
              {MONTH_NAMES[currentMonthIdx]} {selectedYear} Pending
            </span>
            <p className="text-xl font-bold font-display text-amber-600">
              {currentMonthPendingCount} Members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase">
              Collection Rate
            </span>
            <p className="text-xl font-bold font-display text-blue-700">
              {activeMembers.length > 0
                ? Math.round((currentMonthPaidCount / activeMembers.length) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member name or number..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Paid
          </span>
          <span className="flex items-center gap-1 text-amber-700 font-medium ml-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending
          </span>
        </div>
      </div>

      {/* 12-Month Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-100/75 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-44 sticky left-0 bg-slate-100 shadow-xs">
                  Member
                </th>
                <th className="py-3 px-2 text-right">Pledge</th>
                {MONTH_NAMES.map((m, idx) => (
                  <th
                    key={m}
                    className={`py-3 px-2 text-center ${
                      idx === currentMonthIdx && selectedYear === currentYear
                        ? 'bg-emerald-100/70 text-emerald-900 font-bold'
                        : ''
                    }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="py-3 px-3 text-center no-print">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    No active members match your search.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const currentMonthPaid = (paymentsMap.get(`${m.id}-${currentMonthIdx}`) || 0) >= (m.monthlyContributionAmount || 0);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Member Col */}
                      <td className="py-2.5 px-3 sticky left-0 bg-white shadow-xs">
                        <MemberLink
                          memberId={m.id}
                          memberName={m.fullName}
                          memberNumber={m.memberNumber}
                          originBreadcrumb={[
                            { label: 'Monthly Matrix', tab: 'monthly-status' },
                          ]}
                          className="font-semibold text-slate-900 truncate max-w-[170px] text-xs"
                        />
                        <div className="text-[10px] font-mono text-emerald-800">
                          {m.memberNumber}
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-slate-700">
                        {formatCurrency(m.monthlyContributionAmount, settings.currency)}
                      </td>

                      {/* 12 Month Check Indicators */}
                      {MONTH_NAMES.map((monthName, idx) => {
                        const paidAmount = paymentsMap.get(`${m.id}-${idx}`) || 0;
                        const isPledgePaid = paidAmount >= (m.monthlyContributionAmount || 0);
                        const isCurrentMonth = idx === currentMonthIdx && selectedYear === currentYear;

                        return (
                          <td
                            key={monthName}
                            className={`py-2.5 px-2 text-center ${
                              isCurrentMonth ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            {isPledgePaid ? (
                              <span
                                title={`Paid: ${formatCurrency(paidAmount, settings.currency)}`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            ) : paidAmount > 0 ? (
                              <span
                                title={`Partial: ${formatCurrency(paidAmount, settings.currency)}`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]"
                              >
                                ½
                              </span>
                            ) : (
                              <span
                                title="Pending"
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-300 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Quick Action Button for this member */}
                      <td className="py-2.5 px-3 text-center no-print">
                        <button
                          id={`record-contrib-${m.memberNumber}`}
                          onClick={() => onOpenCreateReceiptForMember(m.id)}
                          title={`Record contribution for ${m.fullName}`}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                            currentMonthPaid
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                          }`}
                        >
                          {currentMonthPaid ? '+ Extra' : 'Collect'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
