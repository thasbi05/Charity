import React, { useState, useMemo } from 'react';
import {
  User,
  Phone,
  Calendar,
  DollarSign,
  Download,
  FileDown,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  HeartHandshake,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  Building,
  Info,
  X,
  Eye,
  Pencil,
} from 'lucide-react';
import { Member, Transaction, Receipt, CharityPayment, CharityCase, CashHolding } from '../../types';
import { FinancialLedgerService } from '../../services/financialLedgerService';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { MemberLink, CaseLink, TransactionLink, CustodianLink } from '../Common/ClickableEntity';
import { useCharity } from '../../context/CharityContext';
import { useNavigation } from '../../context/NavigationContext';
import { BreadcrumbsBar } from '../Navigation/BreadcrumbsBar';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

interface MemberLedgerTableProps {
  member: Member;
  transactions?: Transaction[];
  receipts?: Receipt[];
  currency?: string;
  onOpenReceipt?: (receiptId: string) => void;
  showBreadcrumbs?: boolean;
}

export const MemberLedgerTable: React.FC<MemberLedgerTableProps> = ({
  member,
  transactions: propTxns,
  receipts: propReceipts,
  currency = 'AED',
  onOpenReceipt,
  showBreadcrumbs = false,
}) => {
  const {
    transactions: contextTxns,
    receipts: contextReceipts,
    payments,
    cases,
    cashHoldings,
    settings,
  } = useCharity();
  const { memberLedgerFocusTab, openTransactionEditor } = useNavigation();

  const allTxns = propTxns || contextTxns;
  const allReceipts = propReceipts || contextReceipts;
  const activeCurrency = currency || settings.currency || 'AED';

  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDrilldownModalOpen, setIsDrilldownModalOpen] = useState<boolean>(false);

  // Calculate detailed financial stats using single source of truth
  const stats = useMemo(() => {
    return FinancialLedgerService.getMemberFinancials(
      member,
      allTxns,
      allReceipts,
      payments,
      cases,
      cashHoldings
    );
  }, [member, allTxns, allReceipts, payments, cases, cashHoldings]);

  // Extract available contribution months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    stats.ledgerRows.forEach((row) => {
      if (row.contributionMonth && row.contributionMonth !== 'N/A') {
        set.add(row.contributionMonth);
      }
    });
    return Array.from(set).sort().reverse();
  }, [stats.ledgerRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return stats.ledgerRows.filter((row) => {
      if (filterMonth !== 'all' && row.contributionMonth !== filterMonth) {
        return false;
      }
      if (filterType !== 'all') {
        if (filterType === 'CONTRIBUTION' && row.transactionType !== 'Member Contribution') return false;
        if (filterType === 'TRANSFER' && row.transactionType !== 'Cash Transfer') return false;
        if (filterType === 'DISBURSEMENT' && row.transactionType !== 'Charity Disbursement') return false;
      }
      if (filterCurrency !== 'all') {
        const rowCur = (row.currency || 'AED').toUpperCase();
        if (filterCurrency === 'INR' && rowCur !== 'INR') return false;
        if (filterCurrency === 'AED' && rowCur !== 'AED') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (row.transactionNumber && row.transactionNumber.toLowerCase().includes(q)) ||
          (row.description && row.description.toLowerCase().includes(q)) ||
          (row.charityCaseName && row.charityCaseName.toLowerCase().includes(q)) ||
          (row.from && row.from.toLowerCase().includes(q)) ||
          (row.to && row.to.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [stats.ledgerRows, filterMonth, filterType, filterCurrency, searchQuery]);

  const handleExport = () => {
    const exportData = filteredRows.map((row) => ({
      Date: row.date,
      'Contribution Month': row.contributionMonthFormatted || row.contributionMonth,
      'Transaction ID': row.transactionNumber,
      'Transaction Type': row.transactionType,
      Description: row.description,
      'Charity Case': row.charityCaseName || 'N/A',
      From: row.from,
      To: row.to,
      Debit: row.debit,
      Credit: row.credit,
      Amount: row.amount,
      'Running Balance': row.runningBalance,
      Status: row.status,
    }));
    exportToCsv(
      `MEMBER_LEDGER_${stats.memberNumber}_${stats.memberName.replace(/\s+/g, '_')}`,
      exportData
    );
  };

  const cashBreakdown = stats.cashBreakdown;
  const hasCashBreakdown =
    Boolean(cashBreakdown) ||
    stats.cashCurrentlyHeld > 0 ||
    stats.transfersReceived > 0;

  return (
    <div id="member-ledger-container" className="space-y-6 printable-content relative">
      <DocumentLogoWatermark size="lg" />
      {showBreadcrumbs && <BreadcrumbsBar />}

      {/* Main Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold font-display text-lg shadow-sm shrink-0 overflow-hidden border border-slate-200">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={stats.memberName}
                  className="w-full h-full object-cover"
                />
              ) : (
                stats.memberName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                  MEMBER LEDGER — {stats.memberName.toUpperCase()}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {stats.memberNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    member.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {member.status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Audited financial summary, contribution ledger, and cash custody breakdown.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={() => triggerPrint('member-ledger-container', `Statement_${stats.memberName.replace(/\s+/g, '_')}_${stats.memberNumber}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Section 1: Member Details */}
        <div className="pt-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>MEMBER DETAILS</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Member ID
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                {stats.memberNumber}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Full Name
              </span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate" title={stats.memberName}>
                {stats.memberName}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Father's Name
              </span>
              <span className="text-xs font-medium text-slate-800 mt-0.5 block truncate" title={stats.fatherName || 'Not specified'}>
                {stats.fatherName || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Contact
              </span>
              <span className="text-xs font-medium text-slate-800 mt-0.5 block truncate" title={stats.contact || '—'}>
                {stats.contact || '—'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Monthly Pledge
              </span>
              <span className="text-xs font-bold text-emerald-800 mt-0.5 block">
                {formatCurrency(stats.monthlyPledge, activeCurrency)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Status
              </span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block capitalize">
                {member.status || 'Active'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100 col-span-2 sm:col-span-3 lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <span className="text-[10px] font-semibold text-sky-800 uppercase tracking-wider block">
                  Origin / Home Country Address (Karnataka, India)
                </span>
                <span className="text-xs text-slate-800 font-medium mt-0.5 block">
                  {[
                    member.homeAddress?.house || member.homeCountryAddress?.houseBuilding || member.homeCountryAddress?.building,
                    member.homeAddress?.street || member.homeCountryAddress?.street,
                    member.homeAddress?.village || member.homeCountryAddress?.villageArea || member.homeCountryAddress?.area,
                    member.homeAddress?.taluk || member.homeCountryAddress?.taluk || member.homeCountryAddress?.city,
                    member.homeAddress?.district || member.homeCountryAddress?.district,
                    member.homeAddress?.state || member.homeCountryAddress?.stateProvince || 'Karnataka',
                    (member.homeAddress?.pincode || member.homeCountryAddress?.postalCode) ? `PIN: ${member.homeAddress?.pincode || member.homeCountryAddress?.postalCode}` : null,
                  ].filter(Boolean).join(', ') || 'Home address on record'}
                </span>
              </div>
              <span className="self-start sm:self-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-200 shrink-0">
                🇮🇳 Karnataka, India
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Financial Summary */}
        <div className="pt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span>FINANCIAL SUMMARY</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Total Contributions
              </span>
              <div className="text-base font-bold font-display text-emerald-950 mt-0.5">
                {formatCurrency(stats.totalContributions, activeCurrency)}
              </div>
              <span className="text-[10px] text-emerald-700">Lifetime verified</span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200">
              <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider block">
                Transfers Received
              </span>
              <div className="text-base font-bold font-display text-blue-950 mt-0.5 truncate" title={stats.transfersReceivedOriginalFormatted || formatCurrency(stats.transfersReceived, activeCurrency)}>
                {stats.hasTransfersReceivedForeign && stats.transfersReceivedOriginalFormatted
                  ? stats.transfersReceivedOriginalFormatted
                  : formatCurrency(stats.transfersReceived, activeCurrency)}
              </div>
              <span className="text-[10px] text-blue-700">
                {stats.hasTransfersReceivedForeign ? 'Converted at exchange rate' : 'Cash handed to member'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200">
              <span className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider block">
                Transfers Sent
              </span>
              <div className="text-base font-bold font-display text-indigo-950 mt-0.5 truncate" title={stats.transfersSentOriginalFormatted || formatCurrency(stats.transfersSent, activeCurrency)}>
                {stats.hasTransfersSentForeign && stats.transfersSentOriginalFormatted
                  ? stats.transfersSentOriginalFormatted
                  : formatCurrency(stats.transfersSent, activeCurrency)}
              </div>
              <span className="text-[10px] text-indigo-700">
                {stats.hasTransfersSentForeign ? 'Converted at exchange rate' : 'Handed over to others'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200">
              <span className="text-[10px] font-semibold text-purple-800 uppercase tracking-wider block">
                Charity Payments
              </span>
              <div className="text-base font-bold font-display text-purple-950 mt-0.5">
                {formatCurrency(stats.charityPayments, activeCurrency)}
              </div>
              <span className="text-[10px] text-purple-700">Disbursed to cases</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300">
              <span className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider block flex items-center justify-between">
                <span>Current Cash in Hand</span>
                {stats.cashCurrentlyHeld > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-bold">
                    CUSTODY
                  </span>
                )}
              </span>
              <div className="text-base font-bold font-display text-amber-950 mt-0.5">
                {formatCurrency(stats.cashCurrentlyHeld, activeCurrency)}
              </div>
              <span className="text-[10px] text-amber-700">Physical cash held</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 border border-slate-300">
              <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider block">
                Current Balance
              </span>
              <div className="text-base font-bold font-display text-slate-900 mt-0.5">
                {formatCurrency(stats.currentBalance, activeCurrency)}
              </div>
              <span className="text-[10px] text-slate-500">Net physical balance</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: CASH IN HAND BREAKDOWN (Dedicated Section per User Requirement 4) */}
      {hasCashBreakdown && (
        <div
          id="cash-in-hand-breakdown"
          className="bg-amber-50/40 border-2 border-amber-200/90 rounded-2xl p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-950 font-display tracking-tight uppercase">
                  CASH IN HAND BREAKDOWN
                </h2>
                <p className="text-xs text-amber-800">
                  Detailed source tracing and disposition of physical charity cash held by {stats.memberName}.
                </p>
              </div>
            </div>

            <div className="px-3 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold">
              Custodian Balance: <strong className="font-mono text-sm">{formatCurrency(stats.cashCurrentlyHeld, activeCurrency)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Received Card (Interactive Drill-Down) */}
            <div
              onClick={() => setIsDrilldownModalOpen(true)}
              className="p-3.5 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer shadow-2xs group relative"
              title="Click to view full itemized receipts breakdown"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Received
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 group-hover:bg-amber-100 px-1.5 py-0.5 rounded transition-colors">
                  <Eye className="w-3 h-3 text-amber-700" />
                  Itemized ({cashBreakdown?.receivedItems?.length || 0})
                </span>
              </div>

              <div className="text-lg font-bold font-display text-slate-900 mt-1">
                {cashBreakdown?.receivedOriginalFormatted || formatCurrency(cashBreakdown?.received || stats.transfersReceived || stats.cashCurrentlyHeld, activeCurrency)}
              </div>
              {cashBreakdown?.hasForeignCurrency && (
                <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                  ≈ {formatCurrency(cashBreakdown.received, activeCurrency)}
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">From (Sender):</span>
                  {cashBreakdown?.receivedFrom ? (
                    <MemberLink
                      memberId={cashBreakdown.receivedFrom.memberId || 'mem_001'}
                      memberName={cashBreakdown.receivedFrom.memberName}
                      className="font-bold text-emerald-800 text-[11px]"
                    />
                  ) : (
                    <span className="font-semibold text-slate-700 text-[11px]">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">For Purpose:</span>
                  {cashBreakdown?.allocatedCase ? (
                    <CaseLink
                      caseId={cashBreakdown.allocatedCase.caseId}
                      caseTitle={cashBreakdown.allocatedCase.caseTitle}
                      caseNumber={cashBreakdown.allocatedCase.caseNumber}
                      className="font-bold text-purple-900 text-[11px] truncate max-w-[140px]"
                    />
                  ) : (
                    <span
                      className="font-semibold text-slate-700 text-[11px] truncate max-w-[140px]"
                      title={cashBreakdown?.receivedItems?.[0]?.purpose || 'General Charity Pool'}
                    >
                      {cashBreakdown?.receivedItems?.[0]?.purpose || 'General Charity Pool'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Paid / Disbursed Card */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Disbursed to Beneficiary
              </span>
              <div className="text-lg font-bold font-display text-rose-700 mt-1">
                {formatCurrency(cashBreakdown?.paid || stats.charityPayments, activeCurrency)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                {stats.charityPayments > 0 ? (
                  <span>Disbursed directly against hospital / beneficiary vouchers</span>
                ) : (
                  <span>Pending distribution to beneficiary</span>
                )}
              </div>
            </div>

            {/* Returned & Deposited */}
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Returned / Deposited to Bank
              </span>
              <div className="text-lg font-bold font-display text-blue-700 mt-1">
                {formatCurrency((cashBreakdown?.returned || 0) + (cashBreakdown?.deposited || 0), activeCurrency)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>Returned to Safe:</span>
                  <strong>{formatCurrency(cashBreakdown?.returned || 0, activeCurrency)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bank Deposited:</span>
                  <strong>{formatCurrency(cashBreakdown?.deposited || 0, activeCurrency)}</strong>
                </div>
              </div>
            </div>

            {/* Current Cash Held */}
            <div className="p-3.5 rounded-xl bg-amber-100/70 border border-amber-300 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                Current Cash Held
              </span>
              <div className="text-xl font-bold font-display text-amber-950 mt-1">
                {formatCurrency(stats.cashCurrentlyHeld, activeCurrency)}
              </div>
              {cashBreakdown?.hasForeignCurrency && (
                <div className="text-[11px] font-mono text-amber-900 font-semibold mt-0.5">
                  ({cashBreakdown.receivedOriginalFormatted})
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-amber-200 text-[11px] text-amber-900 font-medium">
                Physical funds in custodian's possession verified on balance sheet.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Filter:</span>
          </div>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Contribution Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Transaction Types</option>
            <option value="CONTRIBUTION">Member Contributions</option>
            <option value="TRANSFER">Internal Transfers & Handovers</option>
            <option value="DISBURSEMENT">Charity Aid Disbursements</option>
          </select>

          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="all">All Currencies</option>
            <option value="AED">AED (Dirhams) Only</option>
            <option value="INR">INR (₹ Rupees) Only</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search txn, case, party..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Section 5: MEMBER TRANSACTION LEDGER (Exact Columns per User Requirement 2) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-display uppercase tracking-tight">
              MEMBER TRANSACTION LEDGER
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredRows.length} verified accounting entries for {stats.memberName}.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Currency: <strong className="text-slate-800">{activeCurrency}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                <th className="py-3 px-3 whitespace-nowrap">Contribution Month</th>
                <th className="py-3 px-3 whitespace-nowrap">Transaction ID</th>
                <th className="py-3 px-3 whitespace-nowrap">Transaction Type</th>
                <th className="py-3 px-3.5">Description</th>
                <th className="py-3 px-3">Charity Case</th>
                <th className="py-3 px-3">From</th>
                <th className="py-3 px-3">To</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Debit</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Credit</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Amount</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Running Balance</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    No transaction entries found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isVoid = row.status === 'voided';
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoid ? 'opacity-50 bg-rose-50/30 line-through' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap font-medium">
                        {row.date}
                      </td>

                      {/* Contribution Month */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.contributionMonth && row.contributionMonth !== 'N/A' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-semibold text-[10px]">
                            {row.contributionMonthFormatted || row.contributionMonth}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Transaction ID (Clickable) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <TransactionLink
                          transactionId={row.transactionId || row.id}
                          transactionNumber={row.transactionNumber}
                          showIcon={true}
                        />
                      </td>

                      {/* Transaction Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.transactionType === 'Member Contribution' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                            Contribution
                          </span>
                        ) : row.transactionType === 'Cash Transfer' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            Transfer
                          </span>
                        ) : row.transactionType === 'Charity Disbursement' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <HeartHandshake className="w-3 h-3 text-purple-600" />
                            Disbursement
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {row.transactionType}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3.5 text-slate-800 font-medium max-w-[220px] truncate" title={row.description}>
                        {row.description}
                      </td>

                      {/* Charity Case (Clickable) */}
                      <td className="py-3 px-3 max-w-[170px] truncate">
                        {row.charityCaseId || row.charityCaseName ? (
                          <CaseLink
                            caseId={row.charityCaseId || ''}
                            caseTitle={row.charityCaseName || 'Charity Case'}
                            caseNumber={row.charityCaseNumber}
                            showIcon={true}
                            className="text-[11px]"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* From (Clickable) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.fromId && row.fromId !== member.id ? (
                          <MemberLink
                            memberId={row.fromId}
                            memberName={row.from}
                            className="text-[11px]"
                          />
                        ) : (
                          <span className="text-slate-700 font-medium">{row.from}</span>
                        )}
                      </td>

                      {/* To (Clickable) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.toId && row.toId !== member.id ? (
                          <MemberLink
                            memberId={row.toId}
                            memberName={row.to}
                            className="text-[11px]"
                          />
                        ) : (
                          <span className="text-slate-700 font-medium">{row.to}</span>
                        )}
                      </td>

                      {/* Debit */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {row.debit > 0 ? (
                          <div>
                            <span className="text-rose-600 font-bold">
                              {formatCurrency(row.debit, row.currency || activeCurrency)}
                            </span>
                            {row.currency && row.currency !== activeCurrency && (
                              <div className="text-[10px] text-slate-400 font-sans">
                                ≈ {formatCurrency(row.baseDebit || (row.debit * (row.exchangeRate || 1)), activeCurrency)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">0.00</span>
                        )}
                      </td>

                      {/* Credit */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {row.credit > 0 ? (
                          <div>
                            <span className="text-emerald-600 font-bold">
                              {formatCurrency(row.credit, row.currency || activeCurrency)}
                            </span>
                            {row.currency && row.currency !== activeCurrency && (
                              <div className="text-[10px] text-slate-400 font-sans">
                                ≈ {formatCurrency(row.baseCredit || (row.credit * (row.exchangeRate || 1)), activeCurrency)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">0.00</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-display font-bold text-slate-900 whitespace-nowrap">
                        <div>
                          {formatCurrency(row.amount, row.currency || activeCurrency)}
                        </div>
                        {row.currency && row.currency !== activeCurrency && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            ≈ {formatCurrency(row.baseCurrencyAmount || (row.amount * (row.exchangeRate || 1)), activeCurrency)}
                          </div>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            row.runningBalance > 0
                              ? 'bg-amber-100 text-amber-900'
                              : 'text-slate-600'
                          }`}
                        >
                          {formatCurrency(row.runningBalance, activeCurrency)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isVoid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            VOID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            VERIFIED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTransactionEditor(row.transactionId || row.id || row.transactionNumber)}
                          title={`Edit Transaction [${row.transactionNumber || row.id}]`}
                          className="px-2 py-1 rounded-md hover:bg-cyan-50 text-slate-500 hover:text-cyan-700 transition-colors inline-flex items-center gap-1 text-xs border border-slate-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium hidden sm:inline">Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={10} className="py-3.5 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Physical Cash in Hand Held by {stats.memberName}:
                  </td>
                  <td colSpan={4} className="py-3.5 px-4 text-right font-mono text-base text-amber-800 font-bold">
                    {formatCurrency(stats.cashCurrentlyHeld, activeCurrency)}
                    {cashBreakdown?.hasForeignCurrency && (
                      <span className="block text-xs font-normal text-slate-500">
                        Float: {cashBreakdown.receivedOriginalFormatted}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Itemized Cash In Hand Drill-Down Modal */}
      {isDrilldownModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-slate-900">
                    Physical Cash Collection Drill-Down — {stats.memberName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Itemized receipt log and peer cash custody held by {stats.memberNumber} for charity cases.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrilldownModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-6 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total Items Received
                </span>
                <div className="text-xl font-bold font-display text-slate-900 mt-1">
                  {cashBreakdown?.receivedItems?.length || 0} Collections
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                  Original Currency Float
                </span>
                <div className="text-xl font-bold font-display text-amber-950 mt-1">
                  {cashBreakdown?.receivedOriginalFormatted || formatCurrency(0, activeCurrency)}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                  Converted Base Value (AED)
                </span>
                <div className="text-xl font-bold font-display text-emerald-700 mt-1">
                  {formatCurrency(cashBreakdown?.received || 0, activeCurrency)}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-y-auto flex-1 p-6">
              {(!cashBreakdown?.receivedItems || cashBreakdown.receivedItems.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No individual cash collection items recorded for this custodian.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">Ref / Receipt #</th>
                        <th className="py-3 px-3 whitespace-nowrap">Date</th>
                        <th className="py-3 px-3">Contributor (Donor)</th>
                        <th className="py-3 px-3">Purpose & Charity Case</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Original Amount</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Converted (AED)</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashBreakdown.receivedItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3.5 font-mono whitespace-nowrap">
                            <div className="flex flex-col">
                              {item.receiptNumber && (
                                <span className="font-bold text-emerald-800 text-[11px]">
                                  {item.receiptNumber}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">
                                {item.transactionNumber}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {item.contributorId ? (
                              <MemberLink
                                memberId={item.contributorId}
                                memberName={item.contributorName}
                                className="font-bold text-slate-800 text-xs"
                              />
                            ) : (
                              <span className="font-bold text-slate-800">{item.contributorName}</span>
                            )}
                            {item.contributorNumber && (
                              <span className="block text-[10px] font-mono text-slate-400">
                                {item.contributorNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[200px]">
                            {item.caseTitle ? (
                              <div>
                                <CaseLink
                                  caseId={item.caseId || ''}
                                  caseTitle={item.caseTitle}
                                  caseNumber={item.caseNumber}
                                  showIcon={true}
                                  className="font-bold text-purple-900 text-xs truncate"
                                />
                                {item.purpose && item.purpose !== item.caseTitle && (
                                  <span className="block text-[10px] text-slate-500 truncate">
                                    {item.purpose}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-700 font-medium">{item.purpose}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(item.originalAmount, item.originalCurrency)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatCurrency(item.baseAmount, activeCurrency)}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {item.status || 'Received / Valid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <tr>
                        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-slate-600">
                          Total Received in Custody:
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-900 font-bold">
                          {cashBreakdown.receivedOriginalFormatted}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                          {formatCurrency(cashBreakdown.received, activeCurrency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Verified against physical cash ledger & receipts registry
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerPrint('member-ledger-container', `Statement_${stats.memberName.replace(/\s+/g, '_')}_${stats.memberNumber}`)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                  Download PDF
                </button>
                <button
                  onClick={() => setIsDrilldownModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
