import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Users,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Building,
  HeartHandshake,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { formatCurrency } from '../../utils/numbering';
import { convertToBaseCurrency, isReceiptValid, isReceiptHeldByMember } from '../../services/financialLedgerService';
import { CashHolding } from '../../types';
import { RecordCashHoldingModal } from '../Custodians/RecordCashHoldingModal';
import { SettleCashHoldingModal } from '../Custodians/SettleCashHoldingModal';
import { MemberLink, CaseLink } from '../Common/ClickableEntity';

interface MemberCashHoldingsWidgetProps {
  onNavigateToCustodians: () => void;
}

export const MemberCashHoldingsWidget: React.FC<MemberCashHoldingsWidgetProps> = ({
  onNavigateToCustodians,
}) => {
  const { cashHoldings, members, receipts, transactions, settings } = useCharity();

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedHoldingForSettle, setSelectedHoldingForSettle] = useState<CashHolding | null>(null);

  const baseCur = settings.currency || 'AED';

  // Unified active holdings combining explicit CashHolding records and positive member cash balances
  const {
    activeHoldings,
    allDisplayHoldings,
    totalCashHeld,
    totalAedCashHeld,
    totalInrCashHeld,
    uniqueCustodiansCount,
  } = useMemo(() => {
    const rawActive = cashHoldings.filter(
      (h) => h.status === 'HELD' && h.id !== 'holding_1790333624218_w7s6'
    );
    const nonDuplicateActive = rawActive.filter((h) => {
      if (h.id.startsWith('holding_')) {
        const cur = (h.currency || baseCur).toUpperCase();
        const duplicatesReceipt = receipts.some(
          (r) =>
            isReceiptValid(r.status) &&
            (r.custodianMemberId === h.memberId ||
              (r as any).custodianId === h.memberId ||
              r.cashBankAccountId === `custodian_${h.memberId}` ||
              (r.cashBankAccountName && r.cashBankAccountName.includes(h.memberName))) &&
            (h.receiptId === r.id ||
              h.receiptNumber === r.receiptNumber ||
              (r.amount === h.amount && (r.currency || baseCur).toUpperCase() === cur))
        );
        if (duplicatesReceipt) return false;
      }
      return true;
    });

    const memberHoldingTotals = new Map<string, number>();

    nonDuplicateActive.forEach((h) => {
      const key = `${h.memberId}_${(h.currency || baseCur).toUpperCase()}`;
      const current = memberHoldingTotals.get(key) || 0;
      memberHoldingTotals.set(key, current + (h.amount || 0));
    });

    const unifiedActive: CashHolding[] = [...nonDuplicateActive];

    // Check each member's positive cashBalances
    members.forEach((m) => {
      if (!m.cashBalances) return;
      Object.entries(m.cashBalances).forEach(([cur, bal]) => {
        const numBal = Number(bal) || 0;
        if (numBal <= 0) return;

        const curUpper = cur.toUpperCase();
        const key = `${m.id}_${curUpper}`;
        const heldRecorded = memberHoldingTotals.get(key) || 0;
        if (heldRecorded < numBal) {
          const diff = Number((numBal - heldRecorded).toFixed(2));
          // Find most recent transaction involving this member receiving cash
          const recentTxn = transactions.find(
            (t) => (t.debitMemberId === m.id || t.creditMemberId === m.id) && t.status === 'valid'
          );

          unifiedActive.push({
            id: `synthesized_${m.id}_${cur}`,
            charityId: m.charityId,
            memberId: m.id,
            memberName: m.fullName,
            memberNumber: m.memberNumber,
            amount: diff,
            currency: cur,
            category: recentTxn?.linkedCaseTitle
              ? 'Charity Case'
              : recentTxn?.handoverFundType === 'MONTHLY_CONTRIBUTION'
              ? 'Monthly Contribution'
              : 'General Charity Pool',
            caseId: recentTxn?.linkedCaseId,
            caseNumber: recentTxn?.linkedCaseNumber,
            caseTitle: recentTxn?.linkedCaseTitle,
            caseNote: recentTxn?.linkedCaseTitle
              ? `Case: ${recentTxn.linkedCaseNumber ? recentTxn.linkedCaseNumber + ' - ' : ''}${recentTxn.linkedCaseTitle}`
              : recentTxn?.description || 'Cash in Member Custody',
            donorMemberId: recentTxn?.creditMemberId,
            donorMemberName: recentTxn?.creditMemberName,
            status: 'HELD',
            date: recentTxn?.date || new Date().toISOString().slice(0, 10),
            notes: recentTxn?.description,
            createdAt: recentTxn?.createdAt || new Date().toISOString(),
            createdBy: 'system',
            updatedAt: new Date().toISOString(),
            updatedBy: 'system',
          });
          memberHoldingTotals.set(key, heldRecorded + diff);
        }
      });
    });

    // Also check receipts where member is custodian
    receipts.forEach((r) => {
      if (!isReceiptValid(r.status)) return;
      const targetMember = members.find((m) => isReceiptHeldByMember(r, m));
      if (!targetMember) return;
      const cur = (r.currency || baseCur).toUpperCase();
      // Check if already represented in unifiedActive
      const alreadyHasHolding = unifiedActive.some(
        (h) => h.receiptId === r.id || (h.receiptNumber && h.receiptNumber === r.receiptNumber)
      );
      if (!alreadyHasHolding) {
        unifiedActive.push({
          id: `rcpt_holding_${r.id}`,
          charityId: targetMember.charityId,
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          memberNumber: targetMember.memberNumber,
          receiptId: r.id,
          receiptNumber: r.receiptNumber,
          amount: r.amount,
          currency: cur,
          category: r.caseId ? 'Charity Case' : 'Monthly Contribution',
          caseId: r.caseId,
          caseNumber: r.caseNumber,
          caseTitle: r.caseTitle || r.purpose,
          caseNote: r.caseTitle ? `Case: ${r.caseNumber ? r.caseNumber + ' - ' : ''}${r.caseTitle}` : r.purpose || 'Cash in Member Custody',
          donorMemberId: r.memberId,
          donorMemberName: r.memberName,
          status: 'HELD',
          date: r.receiptDate,
          notes: r.notes,
          createdAt: r.createdAt || new Date().toISOString(),
          createdBy: 'system',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
      }
    });

    // Calculate currency-aware totals from unified active holdings
    const holdingsByCurrency: Record<string, number> = {};
    let totalHeldBase = 0;

    unifiedActive.forEach((h) => {
      const cur = (h.currency || baseCur).toUpperCase();
      const amt = h.amount || 0;
      holdingsByCurrency[cur] = Number(((holdingsByCurrency[cur] || 0) + amt).toFixed(2));
      const baseAmt = convertToBaseCurrency(amt, cur, 0.04401, baseCur);
      totalHeldBase += baseAmt;
    });

    const uniqueCustodians = new Set(unifiedActive.map((h) => h.memberId)).size;

    // Combine active holdings first, followed by settled holdings
    const settled = cashHoldings.filter((h) => h.status !== 'HELD');
    const combined = [...unifiedActive, ...settled];

    return {
      activeHoldings: unifiedActive,
      allDisplayHoldings: combined.slice(0, 8),
      totalCashHeld: totalHeldBase,
      totalAedCashHeld: holdingsByCurrency['AED'] || 0,
      totalInrCashHeld: holdingsByCurrency['INR'] || 0,
      holdingsByCurrency,
      uniqueCustodiansCount: uniqueCustodians,
    };
  }, [cashHoldings, members, receipts, transactions, baseCur]);

  return (
    <>
      <div
        id="widget-member-cash-holdings"
        className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Member Cash-in-Hand / Cash Custodians
                </h2>
                {activeHoldings.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {activeHoldings.length} Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical funds collected by members prior to peer handover or direct beneficiary disbursement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Cash Holding</span>
            </button>
            <button
              onClick={onNavigateToCustodians}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Highlight KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-900 text-white p-4">
          <div className="px-3 py-2 sm:py-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Cash Held by Members
            </p>
            <div className="flex items-baseline gap-2 flex-wrap mt-1">
              <p className="text-2xl font-bold font-display text-amber-400">
                {formatCurrency(totalCashHeld, settings.currency || 'AED')}
              </p>
              {totalInrCashHeld > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80 font-mono">
                  TOTAL MEMBER INR CASH: {formatCurrency(totalInrCashHeld, 'INR')}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Available liquid cash outside bank</span>
              {totalInrCashHeld > 0 && totalAedCashHeld > 0 && (
                <span className="text-slate-300 font-mono text-[10px]">
                  (AED {totalAedCashHeld.toFixed(2)} | ₹{totalInrCashHeld.toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div className="px-3 py-2 sm:py-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Number of Members Holding Cash
            </p>
            <p className="text-2xl font-bold font-display text-white mt-1">
              {uniqueCustodiansCount} <span className="text-sm font-normal text-slate-400">Custodians</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Authorized volunteers & team leads
            </p>
          </div>

          <div className="px-3 py-2 sm:py-0 flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pending Settlement Action
              </p>
              <p className="text-sm font-semibold text-slate-200 mt-1">
                {activeHoldings.length === 0
                  ? 'All cash handed over & accounted for'
                  : `${activeHoldings.length} holding${activeHoldings.length > 1 ? 's' : ''} awaiting handover / payout`}
              </p>
            </div>
            {activeHoldings.length > 0 && (
              <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Prompt settlement recommended
              </span>
            )}
          </div>
        </div>

        {/* Quick Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Member / Custodian</th>
                <th className="py-2.5 px-4 text-right">Cash in Hand</th>
                <th className="py-2.5 px-4">Allocated Purpose / Case</th>
                <th className="py-2.5 px-4">Collection Date</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allDisplayHoldings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No cash holdings recorded yet.{' '}
                    <button
                      onClick={() => setIsRecordModalOpen(true)}
                      className="text-emerald-600 font-semibold hover:underline ml-1"
                    >
                      Record first custodian cash
                    </button>
                  </td>
                </tr>
              ) : (
                allDisplayHoldings.map((h) => {
                  const isHeld = h.status === 'HELD';
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Member Name */}
                      <td className="py-3 px-4">
                        <MemberLink
                          memberId={h.memberId}
                          memberName={h.memberName}
                          memberNumber={h.memberNumber}
                          focusTab="cash"
                          originBreadcrumb={[
                            { label: 'Dashboard', tab: 'dashboard' },
                            { label: 'Cash Custodians' },
                          ]}
                          className="font-bold text-slate-900 text-xs"
                        />
                        <div className="text-[11px] text-slate-400">
                          {h.memberNumber || 'Custodian'}
                        </div>
                      </td>

                      {/* Cash in Hand */}
                      <td className="py-3 px-4 text-right font-display font-bold text-sm">
                        <MemberLink
                          memberId={h.memberId}
                          focusTab="cash"
                          originBreadcrumb={[
                            { label: 'Dashboard', tab: 'dashboard' },
                            { label: 'Cash Custodians' },
                          ]}
                          className={isHeld ? 'text-amber-600 hover:underline' : 'text-slate-600 hover:underline'}
                        >
                          {formatCurrency(h.amount, h.currency || settings.currency || 'AED')}
                        </MemberLink>
                      </td>

                      {/* Allocated Purpose / Case */}
                      <td className="py-3 px-4">
                        {h.caseId ? (
                          <CaseLink
                            caseId={h.caseId}
                            caseTitle={h.caseTitle || h.caseNote || 'Charity Case'}
                            caseNumber={h.caseNumber}
                            originBreadcrumb={[
                              { label: 'Dashboard', tab: 'dashboard' },
                              { label: 'Cash Custodians' },
                            ]}
                            className="font-medium text-slate-800 text-xs"
                          />
                        ) : (
                          <div className="font-medium text-slate-800 text-xs">
                            {h.caseNote || h.category}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {h.category}
                          </span>
                          {h.caseTitle && h.caseTitle !== h.caseNote && (
                            <span className="text-[10px] text-emerald-700 truncate max-w-[140px]">
                              • {h.caseTitle}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Collection Date */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {h.date}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isHeld ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Held in Hand
                          </span>
                        ) : h.status === 'DEPOSITED_TO_BANK' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Building className="w-3 h-3 text-emerald-600" />
                            Deposited to Bank
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            <HeartHandshake className="w-3 h-3 text-blue-600" />
                            Disbursed
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isHeld ? (
                          <button
                            id={`btn-settle-${h.id}`}
                            onClick={() => setSelectedHoldingForSettle(h)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Settle / Hand Over</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Settled ({h.settledDate || 'Done'})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Link */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onNavigateToCustodians}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            <span>Open Cash Custodians Ledger & Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Record Cash Intake Modal */}
      <RecordCashHoldingModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
      />

      {/* Settle / Handover Modal */}
      <SettleCashHoldingModal
        isOpen={!!selectedHoldingForSettle}
        onClose={() => setSelectedHoldingForSettle(null)}
        holding={selectedHoldingForSettle}
      />
    </>
  );
};
