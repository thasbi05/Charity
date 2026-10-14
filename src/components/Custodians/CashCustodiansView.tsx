import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Users,
  Search,
  Filter,
  PlusCircle,
  Download,
  FileDown,
  CheckCircle2,
  Calendar,
  Building,
  HeartHandshake,
  ArrowUpDown,
  Tag,
  AlertCircle,
  Clock,
  Trash2,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  FileText,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useNavigation } from '../../context/NavigationContext';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { convertToBaseCurrency, isReceiptValid } from '../../services/financialLedgerService';
import { CashHolding, CashHoldingStatus, CashHoldingCategory } from '../../types';
import { RecordCashHoldingModal } from './RecordCashHoldingModal';
import { SettleCashHoldingModal } from './SettleCashHoldingModal';
import { MemberLink, CaseLink, TransactionLink } from '../Common/ClickableEntity';
import { DocumentLogoWatermark } from '../Common/DocumentLogoWatermark';

export const CashCustodiansView: React.FC = () => {
  const { cashHoldings, members, receipts, transactions, settings, deleteCashHolding } = useCharity();
  const { selectedMemberId, selectedCustodianId, closeDrilldown, openCustodianLedger } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CashHoldingStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ledger' | 'by-member'>('ledger');
  const [custodianSubTab, setCustodianSubTab] = useState<'movements' | 'holdings'>('movements');

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedHoldingForSettle, setSelectedHoldingForSettle] = useState<CashHolding | null>(null);

  // Check if a specific custodian is selected for drilldown
  const activeCustodianId = selectedCustodianId || selectedMemberId;
  const activeCustodian = useMemo(() => {
    if (!activeCustodianId) return null;
    return members.find((m) => m.id === activeCustodianId || m.memberNumber === activeCustodianId) || null;
  }, [activeCustodianId, members]);

  // Complete unified list of cash holdings (Strictly eliminating phantom record and duplicates)
  const allHoldings = useMemo(() => {
    // 1. Filter out phantom record "holding_1790333624218_w7s6"
    const rawFiltered = cashHoldings.filter(
      (h) => h.id !== 'holding_1790333624218_w7s6'
    );

    // 2. Eliminate standalone holding records that duplicate an official issued receipt
    const nonDuplicateHoldings = rawFiltered.filter((h) => {
      if (h.id.startsWith('holding_')) {
        const cur = (h.currency || 'AED').toUpperCase();
        const duplicatesReceipt = receipts.some(
          (r) =>
            isReceiptValid(r.status) &&
            (r.custodianMemberId === h.memberId ||
              (r as any).custodianId === h.memberId ||
              r.cashBankAccountId === `custodian_${h.memberId}` ||
              (r.cashBankAccountName && r.cashBankAccountName.includes(h.memberName))) &&
            (h.receiptId === r.id ||
              h.receiptNumber === r.receiptNumber ||
              (r.amount === h.amount && (r.currency || 'AED').toUpperCase() === cur))
        );
        if (duplicatesReceipt) return false;
      }
      return true;
    });

    const memberHoldingTotals = new Map<string, number>();
    nonDuplicateHoldings
      .filter((h) => h.status === 'HELD')
      .forEach((h) => {
        const key = `${h.memberId}_${(h.currency || 'AED').toUpperCase()}`;
        const current = memberHoldingTotals.get(key) || 0;
        memberHoldingTotals.set(key, current + (h.amount || 0));
      });

    const unified: CashHolding[] = [...nonDuplicateHoldings];

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
          const recentTxn = transactions.find(
            (t) => (t.debitMemberId === m.id || t.creditMemberId === m.id) && t.status === 'valid'
          );

          unified.unshift({
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

    return unified;
  }, [cashHoldings, members, receipts, transactions]);

  // Filtered cash holdings
  const filteredHoldings = useMemo(() => {
    return allHoldings.filter((h) => {
      if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && h.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const memberMatch = h.memberName.toLowerCase().includes(q);
        const noteMatch = (h.caseNote || '').toLowerCase().includes(q);
        const caseMatch = (h.caseTitle || '').toLowerCase().includes(q);
        const numMatch = (h.memberNumber || '').toLowerCase().includes(q);
        if (!memberMatch && !noteMatch && !caseMatch && !numMatch) return false;
      }

      return true;
    });
  }, [allHoldings, statusFilter, categoryFilter, searchQuery]);

  // Aggregate Metrics with strict multi-currency conversion
  const activeHoldings = useMemo(() => {
    return allHoldings.filter((h) => h.status === 'HELD');
  }, [allHoldings]);

  // Strict currency-aware calculation: Never add numbers with different currency codes directly!
  const { totalHeldBaseAED, holdingsByCurrency, multiCurrencyText, hasForeignCurrency } = useMemo(() => {
    const baseCur = settings.currency || 'AED';
    const curMap: Record<string, number> = {};
    let totalBase = 0;

    activeHoldings.forEach((h) => {
      const cur = (h.currency || baseCur).toUpperCase();
      const amt = h.amount || 0;
      curMap[cur] = Number(((curMap[cur] || 0) + amt).toFixed(2));
      const rate = cur === 'INR' ? 0.04401 : 1;
      const baseAmt = convertToBaseCurrency(amt, cur, rate, baseCur);
      totalBase += baseAmt;
    });

    const parts = Object.entries(curMap)
      .filter(([_, amt]) => amt > 0)
      .map(([cur, amt]) => formatCurrency(amt, cur));

    return {
      totalHeldBaseAED: Number(totalBase.toFixed(2)),
      holdingsByCurrency: curMap,
      multiCurrencyText: parts.length > 0 ? parts.join(' | ') : formatCurrency(0, baseCur),
      hasForeignCurrency: Object.keys(curMap).some((cur) => cur !== baseCur && curMap[cur] > 0),
    };
  }, [activeHoldings, settings.currency]);

  const uniqueActiveCustodians = useMemo(() => {
    const set = new Set(activeHoldings.map((h) => h.memberId));
    return set.size;
  }, [activeHoldings]);

  const totalSettledCash = useMemo(() => {
    const baseCur = settings.currency || 'AED';
    return allHoldings
      .filter((h) => h.status !== 'HELD')
      .reduce((sum, h) => {
        const cur = (h.currency || baseCur).toUpperCase();
        const rate = cur === 'INR' ? 0.04401 : 1;
        return sum + convertToBaseCurrency(h.amount || 0, cur, rate, baseCur);
      }, 0);
  }, [allHoldings, settings.currency]);

  // Group by Member for "By Member" tab
  const memberGroups = useMemo(() => {
    const baseCur = settings.currency || 'AED';
    const map = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        memberNumber?: string;
        totalHeldBase: number;
        heldByCurrency: Record<string, number>;
        totalSettledBase: number;
        settledByCurrency: Record<string, number>;
        holdings: CashHolding[];
      }
    >();

    allHoldings.forEach((h) => {
      if (!map.has(h.memberId)) {
        map.set(h.memberId, {
          memberId: h.memberId,
          memberName: h.memberName,
          memberNumber: h.memberNumber,
          totalHeldBase: 0,
          heldByCurrency: {},
          totalSettledBase: 0,
          settledByCurrency: {},
          holdings: [],
        });
      }
      const entry = map.get(h.memberId)!;
      entry.holdings.push(h);

      const cur = (h.currency || baseCur).toUpperCase();
      const rate = cur === 'INR' ? 0.04401 : 1;
      const baseAmt = convertToBaseCurrency(h.amount || 0, cur, rate, baseCur);

      if (h.status === 'HELD') {
        entry.totalHeldBase += baseAmt;
        entry.heldByCurrency[cur] = (entry.heldByCurrency[cur] || 0) + (h.amount || 0);
      } else {
        entry.totalSettledBase += baseAmt;
        entry.settledByCurrency[cur] = (entry.settledByCurrency[cur] || 0) + (h.amount || 0);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalHeldBase - a.totalHeldBase);
  }, [allHoldings, settings.currency]);

  // Export to CSV with distinct original and converted amounts
  const handleExport = () => {
    const baseCur = settings.currency || 'AED';
    const rows = filteredHoldings.map((h) => {
      const cur = (h.currency || baseCur).toUpperCase();
      const rate = cur === 'INR' ? 0.04401 : 1;
      const baseAmt = convertToBaseCurrency(h.amount || 0, cur, rate, baseCur);
      return {
        Date: h.date,
        Member: h.memberName,
        'Member #': h.memberNumber || '',
        'Original Amount': h.amount,
        'Original Currency': cur,
        'Converted (AED)': baseAmt,
        Category: h.category,
        'Allocated Purpose / Case': h.caseNote || '',
        Case: h.caseTitle || '',
        Status: h.status,
        'Settled Date': h.settledDate || '',
        'Settlement Type': h.settlementType || '',
        'Destination Account': h.destinationAccountName || '',
        Notes: h.notes || '',
      };
    });
    exportToCsv('member_cash_custodians_ledger', rows);
  };

  const handleDelete = async (id: string, memberName: string) => {
    if (confirm(`Are you sure you want to remove this cash holding record for ${memberName}?`)) {
      await deleteCashHolding(id);
    }
  };

  // Dedicated Custodian Cash Ledger drill-down: Dashboard -> Cash Custodians -> [Custodian Name] -> Cash Ledger
  if (activeCustodian) {
    const custodianHoldings = allHoldings.filter(
      (h) => h.memberId === activeCustodian.id || h.memberNumber === activeCustodian.memberNumber
    );
    const activeHeldLots = custodianHoldings.filter((h) => h.status === 'HELD');
    const settledLots = custodianHoldings.filter((h) => h.status !== 'HELD');

    const baseCur = settings.currency || 'AED';
    let totalCashInHandBase = 0;
    const activeLotsByCurrency: Record<string, number> = {};
    activeHeldLots.forEach((h) => {
      const cur = (h.currency || baseCur).toUpperCase();
      const rate = cur === 'INR' ? 0.04401 : 1;
      totalCashInHandBase += convertToBaseCurrency(h.amount || 0, cur, rate, baseCur);
      activeLotsByCurrency[cur] = (activeLotsByCurrency[cur] || 0) + (h.amount || 0);
    });

    let totalSettledBase = 0;
    settledLots.forEach((h) => {
      const cur = (h.currency || baseCur).toUpperCase();
      const rate = cur === 'INR' ? 0.04401 : 1;
      totalSettledBase += convertToBaseCurrency(h.amount || 0, cur, rate, baseCur);
    });

    const activeLotsOriginalFormatted = Object.entries(activeLotsByCurrency)
      .filter(([_, amt]) => amt > 0)
      .map(([cur, amt]) => formatCurrency(amt, cur))
      .join(' | ');
    const hasActiveForeignCurrency = Object.keys(activeLotsByCurrency).some(
      (c) => c !== baseCur && activeLotsByCurrency[c] > 0
    );

    // Compute related transactions (inward collections, bank deposits, relief paid from cash)
    const custodianTxns = transactions
      .filter(
        (t) =>
          (t.debitMemberId === activeCustodian.id || t.creditMemberId === activeCustodian.id) &&
          t.status === 'valid'
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Compute running balance
    let running = 0;
    const movementsWithBalance = [...custodianTxns]
      .reverse()
      .map((t) => {
        const isDebit = t.debitMemberId === activeCustodian.id;
        const isCredit = t.creditMemberId === activeCustodian.id;
        const inflow = isDebit ? t.amount : 0;
        const outflow = isCredit ? t.amount : 0;
        running = running + inflow - outflow;
        return {
          ...t,
          inflow,
          outflow,
          balance: running,
        };
      })
      .reverse();

    return (
      <div id="custodian-ledger-drilldown" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto relative printable-content">
        <DocumentLogoWatermark size="lg" />
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={closeDrilldown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Back to All Cash Custodians</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold font-display text-lg shadow-2xs">
                <Wallet className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
                    CASH CUSTODIAN LEDGER — {activeCustodian.fullName.toUpperCase()}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Physical Float
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Member Number: <strong className="text-slate-700 font-mono">{activeCustodian.memberNumber}</strong> • Phone:{' '}
                  <span className="text-slate-700 font-mono">{activeCustodian.phone || 'N/A'}</span> • Status:{' '}
                  <span className="text-emerald-700 font-semibold">Active Authorized Custodian</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => triggerPrint('custodian-ledger-drilldown', `Custody_Drilldown_${activeCustodian.memberNumber || activeCustodian.fullName}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Download Custodian Ledger PDF"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => {
                const rows = custodianTxns.map((t) => ({
                  Date: t.date,
                  'Voucher Number': t.transactionNumber || t.id,
                  Description: t.description,
                  'Fund / Case': t.linkedCaseTitle || t.handoverFundType || 'General Pool',
                  Debit: t.debitMemberId === activeCustodian.id ? t.amount : 0,
                  Credit: t.creditMemberId === activeCustodian.id ? t.amount : 0,
                }));
                exportToCsv(`cash_custodian_ledger_${activeCustodian.memberNumber}`, rows);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Cash Holding</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-amber-200/90 bg-linear-to-br from-amber-50/40 to-white shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Cash Currently in Custody
              </span>
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-display text-amber-600">
              {formatCurrency(totalCashInHandBase, settings.currency || 'AED')}
            </div>
            {hasActiveForeignCurrency ? (
              <p className="text-xs font-mono font-bold text-amber-800 mt-1">
                Float: {activeLotsOriginalFormatted}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                Physical cash awaiting member handover or direct disbursement
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Holding Lots
              </span>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-display text-slate-900">
              {activeHeldLots.length} {activeHeldLots.length === 1 ? 'Batch' : 'Batches'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Individual collection events in hand
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Settled & Handed Over
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-display text-emerald-700">
              {formatCurrency(totalSettledBase, settings.currency || 'AED')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deposited to official bank or beneficiaries
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Collections Handled
              </span>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <ArrowUpDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-display text-slate-900">
              {formatCurrency(totalCashInHandBase + totalSettledBase, settings.currency || 'AED')}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cumulative lifetime collections
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCustodianSubTab('movements')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                custodianSubTab === 'movements'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Cash Ledger Movements ({movementsWithBalance.length})
            </button>
            <button
              onClick={() => setCustodianSubTab('holdings')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                custodianSubTab === 'holdings'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Active Holding Lots ({activeHeldLots.length})
            </button>
          </div>

          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Collection Batch</span>
          </button>
        </div>

        {/* Sub-tab Content */}
        {custodianSubTab === 'movements' ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cash Movements & Running Float</h3>
                <p className="text-xs text-slate-500">Every cash collection received into custody and every handover/payout disbursed</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Voucher #</th>
                    <th className="py-3 px-4">Type / Cause</th>
                    <th className="py-3 px-4">Description / Reference</th>
                    <th className="py-3 px-4 text-right text-emerald-700">Cash Received (+)</th>
                    <th className="py-3 px-4 text-right text-rose-700">Handed Over / Paid (-)</th>
                    <th className="py-3 px-4 text-right text-amber-900 font-bold">Float Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movementsWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">No direct cash movements recorded for this custodian yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Use "Record Cash Holding" to log physical cash collected.</p>
                      </td>
                    </tr>
                  ) : (
                    movementsWithBalance.map((m) => (
                      <tr key={m.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{m.date}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <TransactionLink transactionId={m.id} transactionNumber={m.transactionNumber} showIcon />
                        </td>
                        <td className="py-3 px-4">
                          {m.linkedCaseId ? (
                            <CaseLink caseId={m.linkedCaseId} caseTitle={m.linkedCaseTitle} showIcon />
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {m.handoverFundType || 'General Charity'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={m.description}>
                          {m.description || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                          {m.inflow > 0 ? `+${formatCurrency(m.inflow, settings.currency || 'AED')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-rose-600">
                          {m.outflow > 0 ? `-${formatCurrency(m.outflow, settings.currency || 'AED')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          {formatCurrency(m.balance, settings.currency || 'AED')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Collection Batches in Hand</h3>
                <p className="text-xs text-slate-500">Individual collection lots held by {activeCustodian.fullName}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Case / Purpose</th>
                    <th className="py-3 px-4">Source / Donor</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">ORIGINAL AMOUNT</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">CONVERTED ({settings.currency || 'AED'})</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {custodianHoldings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-300 mb-2" />
                        <p className="font-semibold">No holding lots for this custodian.</p>
                      </td>
                    </tr>
                  ) : (
                    custodianHoldings.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{h.date}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {h.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {h.caseId ? (
                            <CaseLink caseId={h.caseId} caseTitle={h.caseTitle} caseNumber={h.caseNumber} showIcon />
                          ) : (
                            <span className="text-slate-700">{h.caseNote || 'General Collection'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {h.donorMemberId ? (
                            <MemberLink memberId={h.donorMemberId} memberName={h.donorMemberName} />
                          ) : (
                            h.donorMemberName || '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                          {formatCurrency(h.amount, h.currency || settings.currency || 'AED')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(
                            convertToBaseCurrency(
                              h.amount,
                              h.currency || settings.currency || 'AED',
                              ((h.currency || '').toUpperCase() === 'INR' ? 0.04401 : 1),
                              settings.currency || 'AED'
                            ),
                            settings.currency || 'AED'
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {h.status === 'HELD' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              IN HAND
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              SETTLED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {h.status === 'HELD' ? (
                            <button
                              onClick={() => setSelectedHoldingForSettle(h)}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                            >
                              Settle / Hand Over
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Reconciled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Record Cash Holding Modal */}
        <RecordCashHoldingModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          defaultMemberId={activeCustodian.id}
        />

        {/* Settle Cash Holding Modal */}
        <SettleCashHoldingModal
          isOpen={!!selectedHoldingForSettle}
          onClose={() => setSelectedHoldingForSettle(null)}
          holding={selectedHoldingForSettle}
        />
      </div>
    );
  }

  return (
    <div id="cash-custodians-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto relative printable-content">
      <DocumentLogoWatermark size="lg" />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
              Member Cash-in-Hand / Custodians
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              Cash Float Control
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Track physical cash in custody of committee members & volunteers (e.g. monthly dues pool, wedding aid, medical emergencies) and ensure prompt member handover or direct beneficiary disbursement.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => triggerPrint('cash-custodians-view', 'Cash_Custodians_Summary')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Download Custodians PDF Report"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            id="custodians-record-btn"
            onClick={() => setIsRecordModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Cash in Hand</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash Held */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Cash in Hand
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-display text-amber-600">
            {formatCurrency(totalHeldBaseAED, settings.currency || 'AED')}
          </div>
          {hasForeignCurrency ? (
            <div className="text-xs font-bold text-amber-800 font-mono mt-1">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                {multiCurrencyText}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Across {activeHoldings.length} active collection batches
            </p>
          )}
        </div>

        {/* Active Custodians */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Custodians
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-display text-slate-900">
            {uniqueActiveCustodians} Members
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Holding physical charity funds
          </p>
        </div>

        {/* Total Settled & Banked */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Settled to Bank / Payout
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-display text-emerald-700">
            {formatCurrency(totalSettledCash, settings.currency || 'AED')}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cleared & reconciled into accounts
          </p>
        </div>

        {/* Compliance / Prompt Handover */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Policy Reminder
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
            All cash collected should be deposited into the official bank account or handed to beneficiaries within <strong className="text-slate-900 font-bold">48 to 72 hours</strong>.
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Full Cash Ledger ({cashHoldings.length})
            </button>
            <button
              onClick={() => setActiveTab('by-member')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'by-member'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Breakdown by Custodian ({memberGroups.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member, case, note..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter Badges (only relevant for ledger) */}
        {activeTab === 'ledger' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">
              Status:
            </span>
            {(['ALL', 'HELD', 'DEPOSITED_TO_BANK', 'DISBURSED_TO_BENEFICIARY'] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All Records'
                    : st === 'HELD'
                    ? `Held in Hand (${activeHoldings.length})`
                    : st === 'DEPOSITED_TO_BANK'
                    ? 'Banked'
                    : 'Disbursed'}
                </button>
              )
            )}

            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider ml-3 mr-1">
              Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300 bg-white"
            >
              <option value="ALL">All Categories</option>
              <option value="Monthly Contribution">Monthly Contribution</option>
              <option value="Marriage Support">Marriage Support</option>
              <option value="Medical Emergency">Medical Emergency</option>
              <option value="General Charity Pool">General Charity Pool</option>
              <option value="Education Aid">Education Aid</option>
              <option value="Food & Grocery Aid">Food & Grocery Aid</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Content: Ledger Tab vs By-Member Tab */}
      {activeTab === 'ledger' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Member Custodian</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">ORIGINAL AMOUNT</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">CONVERTED ({settings.currency || 'AED'})</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Allocated Purpose / Case</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Settlement Details</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No cash holdings found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredHoldings.map((h) => {
                    const isHeld = h.status === 'HELD';
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {h.date}
                        </td>

                        {/* Custodian */}
                        <td className="py-3 px-4">
                          <MemberLink
                            memberId={h.memberId}
                            memberName={h.memberName}
                            memberNumber={h.memberNumber}
                            focusTab="cash"
                            originBreadcrumb={[
                              { label: 'Cash Custodians', tab: 'custodians' },
                            ]}
                            className="font-bold text-slate-900 text-xs"
                          />
                          <div className="text-[11px] text-slate-400 font-mono">
                            {h.memberNumber || 'Custodian'}
                          </div>
                        </td>

                        {/* Original Amount */}
                        <td className="py-3 px-4 text-right font-display font-bold text-sm whitespace-nowrap">
                          <MemberLink
                            memberId={h.memberId}
                            focusTab="cash"
                            originBreadcrumb={[
                              { label: 'Cash Custodians', tab: 'custodians' },
                            ]}
                            className={isHeld ? 'text-amber-600 hover:underline' : 'text-slate-700 hover:underline'}
                          >
                            {formatCurrency(h.amount, h.currency || settings.currency || 'AED')}
                          </MemberLink>
                        </td>

                        {/* Converted (AED) */}
                        <td className="py-3 px-4 text-right font-mono text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(
                            convertToBaseCurrency(
                              h.amount,
                              h.currency || settings.currency || 'AED',
                              ((h.currency || '').toUpperCase() === 'INR' ? 0.04401 : 1),
                              settings.currency || 'AED'
                            ),
                            settings.currency || 'AED'
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {h.category}
                          </span>
                        </td>

                        {/* Purpose / Case */}
                        <td className="py-3 px-4">
                          {h.caseId ? (
                            <CaseLink
                              caseId={h.caseId}
                              caseTitle={h.caseTitle || h.caseNote || 'Charity Case'}
                              caseNumber={h.caseNumber}
                              originBreadcrumb={[
                                { label: 'Cash Custodians', tab: 'custodians' },
                              ]}
                              className="font-medium text-slate-800 text-xs"
                            />
                          ) : (
                            <div className="font-medium text-slate-800 text-xs">
                              {h.caseNote || h.category}
                            </div>
                          )}
                          {h.caseTitle && h.caseTitle !== h.caseNote && (
                            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                              <HeartHandshake className="w-3 h-3" />
                              <span>{h.caseTitle}</span>
                            </div>
                          )}
                          {h.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5 max-w-xs truncate">
                              {h.notes}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isHeld ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Held in Hand
                            </span>
                          ) : h.status === 'DEPOSITED_TO_BANK' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Building className="w-3 h-3 text-emerald-600" />
                              Bank Deposit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <HeartHandshake className="w-3 h-3 text-blue-600" />
                              Disbursed
                            </span>
                          )}
                        </td>

                        {/* Settlement Details */}
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          {h.settledDate ? (
                            <div>
                              <div className="font-medium text-slate-800">
                                {h.settledDate}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {h.destinationAccountName || h.settlementType || 'Settled'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pending deposit</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isHeld ? (
                              <button
                                onClick={() => setSelectedHoldingForSettle(h)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Settle</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Reconciled
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(h.id, h.memberName)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Breakdown by Member Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberGroups.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              No custodians recorded yet.
            </div>
          ) : (
            memberGroups.map((group) => {
              const activeCount = group.holdings.filter((h) => h.status === 'HELD').length;
              return (
                <div
                  key={group.memberId}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <MemberLink
                          memberId={group.memberId}
                          memberName={group.memberName}
                          memberNumber={group.memberNumber}
                          focusTab="cash"
                          originBreadcrumb={[
                            { label: 'Cash Custodians', tab: 'custodians' },
                          ]}
                          className="text-sm font-bold text-slate-900"
                        />
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {group.memberNumber || 'Member Custodian'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Current Cash Held
                        </span>
                        <span
                          className={`text-lg font-bold font-display ${
                            group.totalHeldBase > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(group.totalHeldBase, settings.currency || 'AED')}
                        </span>
                        {Object.keys(group.heldByCurrency).some((c) => c !== (settings.currency || 'AED') && (group.heldByCurrency[c] || 0) > 0) && (
                          <span className="block text-[11px] font-mono font-bold text-amber-800">
                            {Object.entries(group.heldByCurrency)
                              .filter(([_, amt]) => (amt as number) > 0)
                              .map(([c, amt]) => formatCurrency(amt as number, c))
                              .join(' | ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Holdings items summary */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Allocated Purposes ({group.holdings.length})
                      </p>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {group.holdings.map((h) => (
                          <div
                            key={h.id}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              {h.caseId ? (
                                <CaseLink
                                  caseId={h.caseId}
                                  caseTitle={h.caseTitle || h.caseNote || h.category}
                                  originBreadcrumb={[{ label: 'Cash Custodians', tab: 'custodians' }]}
                                  className="font-semibold text-slate-800 truncate block hover:text-emerald-700"
                                />
                              ) : (
                                <p className="font-semibold text-slate-800 truncate">
                                  {h.caseNote || h.category}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400">{h.date}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`font-bold font-display ${
                                  h.status === 'HELD' ? 'text-amber-600' : 'text-slate-400'
                                }`}
                              >
                                {formatCurrency(h.amount, h.currency || 'AED')}
                              </span>
                              {h.status === 'HELD' ? (
                                <button
                                  onClick={() => setSelectedHoldingForSettle(h)}
                                  className="block text-[10px] font-bold text-emerald-700 hover:underline mt-0.5"
                                >
                                  Settle Now
                                </button>
                              ) : (
                                <span className="block text-[10px] text-slate-400">Settled</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Historical Cleared:{' '}
                      <strong className="text-slate-700 font-bold">
                        {formatCurrency(group.totalSettledBase, settings.currency || 'AED')}
                      </strong>
                    </span>
                    {activeCount > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {activeCount} Pending Handover
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Record Cash Holding Modal */}
      <RecordCashHoldingModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
      />

      {/* Settle Cash Holding Modal */}
      <SettleCashHoldingModal
        isOpen={!!selectedHoldingForSettle}
        onClose={() => setSelectedHoldingForSettle(null)}
        holding={selectedHoldingForSettle}
      />
    </div>
  );
};
