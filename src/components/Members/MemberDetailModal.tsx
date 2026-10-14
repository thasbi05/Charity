import React, { useState } from 'react';
import {
  X,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  FileDown,
  PlusCircle,
  Clock,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import { Member, Receipt } from '../../types';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { formatCurrency } from '../../utils/numbering';
import { PrintableVoucherModal } from '../Vouchers/PrintableVoucherModal';
import { UnifiedAddTransactionModal } from '../Transactions/UnifiedAddTransactionModal';
import { MemberLedgerTable } from '../Ledgers/MemberLedgerTable';
import { getCountryFlag } from '../../utils/countries';

interface MemberDetailModalProps {
  member: Member | null;
  onClose: () => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ member, onClose }) => {
  const { receipts, transactions, settings } = useCharity();
  const { isAdmin } = useAuth();
  const { navigateToTab } = useNavigation();
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<Receipt | null>(null);
  const [showAddContribution, setShowAddContribution] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'RECEIPTS' | 'DUES'>('LEDGER');
  const [historyTab, setHistoryTab] = useState<'ALL' | 'MONTHLY' | 'SPECIAL'>('ALL');

  if (!member) return null;

  // Filter member receipts
  const memberReceipts = receipts.filter((r) => r.memberId === member.id);
  const monthlyReceipts = memberReceipts.filter(
    (r) => r.contributionType === 'MONTHLY_CONTRIBUTION' || !r.contributionType
  );
  const specialReceipts = memberReceipts.filter(
    (r) => r.contributionType === 'SPECIAL_CONTRIBUTION'
  );

  const displayedReceipts =
    historyTab === 'MONTHLY'
      ? monthlyReceipts
      : historyTab === 'SPECIAL'
      ? specialReceipts
      : memberReceipts;

  const totalMonthlyContributed = monthlyReceipts
    .filter((r) => r.status === 'valid')
    .reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0);

  const totalSpecialContributed = specialReceipts
    .filter((r) => r.status === 'valid')
    .reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0);

  const totalContributed = totalMonthlyContributed + totalSpecialContributed;

  // Dues status: compute months since joining up to current month (March 2026)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  // Check paid months for this member
  const paidMonthsSet = new Set(
    monthlyReceipts
      .filter((r) => r.status === 'valid' && r.periodMonth)
      .map((r) => r.periodMonth)
  );

  const yearMonths = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${currentYear}-${m}`;
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-sm overflow-hidden border border-slate-200 shrink-0">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  member.fullName.charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{member.fullName}</h2>
                  <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {member.memberNumber}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      member.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Father's Name: {member.fatherName || member.fatherHusbandName || 'N/A'} • Joined: {member.joinDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  id="btn-member-grant-user-login"
                  onClick={() => {
                    sessionStorage.setItem('invite_target_member_id', member.id);
                    onClose();
                    navigateToTab('users');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Invite / Grant System Login to this Member (Members Only)"
                >
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Grant User Login</span>
                </button>
              )}
              <button
                onClick={() => setShowAddContribution(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Post Contribution
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto p-6 space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Contributions Paid
                </span>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">
                  {formatCurrency(totalContributed, settings.currency)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {memberReceipts.filter((r) => r.status === 'valid').length} valid receipt vouchers
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  Monthly Dues Cumulative
                </span>
                <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                  {formatCurrency(totalMonthlyContributed, settings.currency)}
                </div>
                <div className="mt-1 text-xs text-emerald-600">
                  Committed: {formatCurrency(member.monthlyContributionAmount, settings.currency)} / month
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
                  Special Case Donations
                </span>
                <div className="mt-1 text-2xl font-extrabold text-blue-700">
                  {formatCurrency(totalSpecialContributed, settings.currency)}
                </div>
                <div className="mt-1 text-xs text-blue-600">
                  Restricted purpose contributions
                </div>
              </div>
            </div>

            {/* DUAL ADDRESS STRUCTURE SPECIFICATION */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Structured Addresses (Local Residence & Home Country)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local Address (e.g. UAE) */}
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-800">Local Address (Residence)</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 text-[10px] flex items-center gap-1">
                      <span>{getCountryFlag(member.localAddress?.country)}</span>
                      <span>{member.localAddress?.country || 'UAE'}</span>
                    </span>
                  </div>
                  {member.localAddress ? (
                    <div className="space-y-1 text-slate-600">
                      <div>Building / Villa: <strong>{member.localAddress.buildingVilla || member.localAddress.building || '—'}</strong></div>
                      <div>Flat / Unit: <strong>{member.localAddress.flatRoom || member.localAddress.flat || '—'}</strong></div>
                      <div>Area / Street: <strong>{[member.localAddress.street, member.localAddress.area].filter(Boolean).join(', ') || '—'}</strong></div>
                      <div>City / Emirate: <strong>{[member.localAddress.city, member.localAddress.emirateState || member.localAddress.stateOrEmirate].filter(Boolean).join(', ') || '—'}</strong></div>
                      <div>Phone: <strong>{member.localAddress.localPhone || member.localAddress.phone || member.mobileNumber}</strong></div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {member.address || 'Address details on file.'}
                    </div>
                  )}
                </div>

                {/* Home Country Address (e.g. Karnataka, India) */}
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-bold text-slate-800">Home Country Address</span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800 text-[10px] flex items-center gap-1">
                      <span>🇮🇳</span>
                      <span>{member.homeAddress?.state || member.homeCountryAddress?.stateProvince || 'Karnataka'}, India</span>
                    </span>
                  </div>
                  {(member.homeAddress || member.homeCountryAddress) ? (
                    <div className="space-y-1 text-slate-600">
                      <div>House / Compound: <strong>{member.homeAddress?.house || member.homeCountryAddress?.houseBuilding || member.homeCountryAddress?.building || '—'}</strong></div>
                      <div>Street / Landmark: <strong>{member.homeAddress?.street || member.homeCountryAddress?.street || '—'}</strong></div>
                      <div>Village / Area: <strong>{member.homeAddress?.village || member.homeCountryAddress?.villageArea || member.homeCountryAddress?.area || '—'}</strong></div>
                      <div>Taluk / Town: <strong>{member.homeAddress?.taluk || member.homeCountryAddress?.taluk || member.homeCountryAddress?.city || '—'}</strong></div>
                      <div>District: <strong>{member.homeAddress?.district || member.homeCountryAddress?.district || '—'}</strong></div>
                      <div>State: <strong>{member.homeAddress?.state || member.homeCountryAddress?.stateProvince || 'Karnataka'}</strong></div>
                      <div>PIN Code: <strong>{member.homeAddress?.pincode || member.homeCountryAddress?.postalCode || member.homeCountryAddress?.postalCodeOrPoBox || '—'}</strong></div>
                      <div>Country: <strong>🇮🇳 {member.homeAddress?.country || member.homeCountryAddress?.country || 'India'}</strong></div>
                      {member.homeCountryAddress?.homePhone && (
                        <div>Home Phone: <strong>{member.homeCountryAddress.homePhone}</strong></div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">
                      Home country address not registered.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('LEDGER')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'LEDGER'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Financial & Cash Ledger</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('RECEIPTS')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'RECEIPTS'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Receipts & Invoices ({memberReceipts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DUES')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'DUES'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Dues Matrix</span>
              </button>
            </div>

            {/* TAB 1: FINANCIAL & CASH LEDGER */}
            {activeTab === 'LEDGER' && (
              <div className="pt-1">
                <MemberLedgerTable
                  member={member}
                  transactions={transactions}
                  receipts={receipts}
                  currency={settings.currency}
                  onOpenReceipt={(rId) => {
                    const found = receipts.find((r) => r.id === rId);
                    if (found) setSelectedReceiptForPrint(found);
                  }}
                />
              </div>
            )}

            {/* TAB 2: MONTHLY DUES MATRIX FOR CURRENT YEAR */}
            {activeTab === 'DUES' && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  {currentYear} Monthly Dues Compliance Track
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mt-3">
                  {yearMonths.map((ym) => {
                    const isPaid = paidMonthsSet.has(ym);
                    const monthNum = parseInt(ym.slice(5), 10);
                    const isFuture = monthNum > currentMonth;
                    const monthName = new Date(2026, monthNum - 1, 1).toLocaleString('default', { month: 'short' });

                    return (
                      <div
                        key={ym}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center ${
                          isPaid
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : isFuture
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-amber-300 bg-amber-50 text-amber-900'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{monthName}</span>
                        <span className="text-[9px] uppercase font-semibold mt-0.5">
                          {isPaid ? 'PAID' : isFuture ? 'UPCOMING' : 'DUE'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: SEGREGATED CONTRIBUTION RECEIPT HISTORY */}
            {activeTab === 'RECEIPTS' && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Contribution Receipt History</h3>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setHistoryTab('ALL')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        historyTab === 'ALL'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({memberReceipts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryTab('MONTHLY')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        historyTab === 'MONTHLY'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly Dues ({monthlyReceipts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryTab('SPECIAL')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        historyTab === 'SPECIAL'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Special Donations ({specialReceipts.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 text-left">Receipt #</th>
                      <th className="px-3.5 py-2.5 text-left">Date</th>
                      <th className="px-3.5 py-2.5 text-left">Classification</th>
                      <th className="px-3.5 py-2.5 text-left">Period / Case</th>
                      <th className="px-3.5 py-2.5 text-left">Method</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No contribution receipts posted for this filter.
                        </td>
                      </tr>
                    ) : (
                      displayedReceipts.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="px-3.5 py-2.5 font-mono font-medium text-slate-900">
                            {r.receiptNumber}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">{r.receiptDate}</td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`inline-flex rounded px-2 py-0.5 font-medium ${
                                r.contributionType === 'SPECIAL_CONTRIBUTION'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {r.contributionType === 'SPECIAL_CONTRIBUTION'
                                ? 'Special Case'
                                : 'Monthly Dues'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700 font-medium">
                            {r.contributionType === 'SPECIAL_CONTRIBUTION'
                              ? r.caseTitle || r.caseNumber || 'Designated Case'
                              : r.periodMonth || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">{r.paymentMethod}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(r.amount, r.currency)}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                r.status === 'valid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              onClick={() => setSelectedReceiptForPrint(r)}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              title="Download Receipt Voucher PDF"
                            >
                              <FileDown className="h-3 w-3 text-emerald-600" />
                              Voucher
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Receipt Voucher Modal */}
      {selectedReceiptForPrint && (
        <PrintableVoucherModal
          type="Receipt"
          data={selectedReceiptForPrint}
          onClose={() => setSelectedReceiptForPrint(null)}
        />
      )}

      {/* Unified Add Transaction Modal with pre-selected member */}
      {showAddContribution && (
        <UnifiedAddTransactionModal
          isOpen={showAddContribution}
          onClose={() => setShowAddContribution(false)}
          defaultClassification="MONTHLY_CONTRIBUTION"
          preselectedMemberId={member.id}
        />
      )}
    </>
  );
};
