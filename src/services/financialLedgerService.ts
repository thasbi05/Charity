/**
 * Single Source of Truth for Charity Financial Accounting & Ledgers.
 * 
 * Provides unified, reconciled calculations for:
 * - Member Contributions & Member Ledgers
 * - Member Cash-in-Hand / Cash Custodians
 * - Charity Cases & Charity Case Ledgers
 * - Balance Sheet (Summary, Member Balances, Case Balances, Drill-down)
 * - Monthly Contribution Charts & Reports
 * 
 * Accounting Invariants:
 * 1. Internal cash transfers NEVER count as income or expense.
 * 2. Contribution Month and Payment Date are distinct fields.
 * 3. Member Cash-in-Hand represents physical cash custody (never negative debt).
 * 4. All screens read from this single source of truth.
 */

import {
  Member,
  CharityCase,
  Transaction,
  Receipt,
  CharityPayment,
  CashAccount,
  CashHolding,
  ExchangeRateSnapshot,
} from '../types';
import { formatCurrency } from '../utils/numbering';

export interface MemberLedgerRow {
  id: string;
  date: string;
  contributionMonth: string;
  contributionMonthFormatted: string;
  transactionId: string;
  transactionNumber: string;
  transactionType:
    | 'Member Contribution'
    | 'Cash Transfer'
    | 'Charity Disbursement'
    | 'Bank Deposit'
    | 'Cash Return'
    | 'Adjustment';
  charityCaseId?: string;
  charityCaseName?: string;
  charityCaseNumber?: string;
  description: string;
  from: string;
  fromId?: string;
  to: string;
  toId?: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  baseCurrencyAmount?: number;
  debit: number; // Cash Outflow from member custody
  credit: number; // Contribution Credit / Cash Inflow to member custody
  baseDebit?: number;
  baseCredit?: number;
  runningBalance: number; // Physical cash held / net position
  paymentMethod: string;
  reference: string;
  status: 'valid' | 'voided';
  notes?: string;
  rawTxn?: Transaction;
  rawReceipt?: Receipt;
  rawPayment?: CharityPayment;
}

export interface CustodianReceivedItem {
  id: string;
  transactionNumber: string;
  receiptNumber?: string;
  date: string;
  contributorId: string;
  contributorNumber?: string;
  contributorName: string;
  purpose: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  baseAmount: number;
  status: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CashInHandBreakdown {
  received: number; // Converted base amount (AED)
  receivedOriginalFormatted: string; // e.g. "₹ 4,000.00" or "AED 0.00 | ₹ 4,000.00"
  receivedByCurrency: Record<string, number>;
  hasForeignCurrency: boolean;
  receivedItems: CustodianReceivedItem[];
  receivedFrom?: { memberId?: string; memberName: string; memberNumber?: string };
  allocatedCase?: { caseId?: string; caseTitle: string; caseNumber?: string };
  paid: number;
  returned: number;
  deposited: number;
  currentCashHeld: number;
  notes?: string;
}

export interface MemberFinancialStats {
  memberId: string;
  memberNumber: string;
  memberName: string;
  fatherName?: string;
  contact?: string;
  localAddress?: string;
  homeCountryAddress?: string;
  bloodGroup?: string;
  monthlyPledge: number;
  totalContributions: number;
  currentMonthContribution: number;
  contributionsByMonth: Record<string, number>;
  transfersReceived: number;
  transfersSent: number;
  transfersSentOriginalFormatted?: string;
  transfersReceivedOriginalFormatted?: string;
  hasTransfersSentForeign?: boolean;
  hasTransfersReceivedForeign?: boolean;
  charityContributions: number;
  charityPayments: number;
  adjustments: number;
  cashCurrentlyHeld: number; // Physical cash in hand
  cashBalancesByCurrency?: Record<string, number>;
  currentBalance: number; // Cash held
  transactionsCount: number;
  lastTransactionDate?: string;
  cashBreakdown?: CashInHandBreakdown;
  ledgerRows: MemberLedgerRow[];
}

export interface CaseLedgerRow {
  id: string;
  date: string;
  transactionNumber: string;
  contributionMonth: string;
  contributionMonthFormatted: string;
  transactionType: 'Member Contribution' | 'Cash Transfer' | 'Charity Disbursement' | 'Adjustment' | 'Bank Deposit' | 'Cash Return';
  memberId?: string;
  memberName?: string;
  custodianId?: string;
  custodianName?: string;
  from: string;
  to: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  baseAmount?: number;
  baseDebit?: number;
  baseCredit?: number;
  debit: number; // Disbursement from case fund
  credit: number; // Inflow / Contribution to case fund
  runningBalance: number; // Cumulative case balance
  paymentReference: string;
  notes?: string;
  status: 'valid' | 'voided';
  rawTxn?: Transaction;
  rawReceipt?: Receipt;
  rawPayment?: CharityPayment;
}

export interface CaseFinancialStats {
  caseId: string;
  caseNumber: string;
  caseName: string;
  beneficiary: string;
  beneficiaryPhone?: string;
  purpose: string;
  category: string;
  createdDate: string;
  targetAmount: number;
  status: string;
  openingBalance: number;
  totalFundsReceived: number;
  totalContributions: number;
  totalCashTransfers: number;
  totalDisbursed: number;
  remainingBalance: number;
  transactionsCount: number;
  ledgerRows: CaseLedgerRow[];
}

export interface CashCustodianItem {
  memberId: string;
  memberNumber: string;
  memberName: string;
  phone?: string;
  cashInHand: number;
  cashInHandByCurrency?: Record<string, number>;
  allocatedPurpose: string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  collectionDate: string;
  status: 'ACTIVE' | 'SETTLED';
  transactionsCount: number;
}

export interface BalanceSheetData {
  totalAssets: {
    bankBalance: number;
    cashHeldByMembers: number;
    cashAvailableForCases: number;
    otherCashAssets: number;
    total: number;
    cashByCurrency?: Record<string, number>;
    cashHeldByCurrency?: Record<string, number>;
  };
  totalLiabilities: {
    pendingMemberRefunds: number;
    pendingCharityCommitments: number;
    otherOutstandingAmounts: number;
    total: number;
  };
  netBalance: number;
  kpis: {
    totalMemberContributions: number;
    totalCharityPayments: number;
    totalCashHeldByMembers: number;
    totalCashInBank: number;
    totalOutstandingCaseBalance: number;
    totalActiveCasesCount: number;
    contributionsByCurrency?: Record<string, number>;
    charityPaymentsByCurrency?: Record<string, number>;
  };
  memberBalances: MemberFinancialStats[];
  caseBalances: CaseFinancialStats[];
}

/**
 * Standard Multi-Currency to Base Currency Converter
 * Converts amounts in foreign currencies (e.g. INR) to base currency (e.g. AED)
 */
export function convertToBaseCurrency(
  amount: number,
  currency?: string,
  exchangeRate?: number,
  baseCurrency = 'AED'
): number {
  const num = Number(amount) || 0;
  if (num === 0) return 0;
  const cur = (currency || baseCurrency).toUpperCase();
  const base = baseCurrency.toUpperCase();
  if (cur === base) return num;

  if (exchangeRate && exchangeRate > 0) {
    return Number((num * exchangeRate).toFixed(2));
  }
  // Standard conversion rates: 2,000 INR = 88.02 AED (rate = 0.04401)
  if (cur === 'INR' && base === 'AED') {
    return Number((num * 0.04401).toFixed(2));
  }
  if (cur === 'AED' && base === 'INR') {
    return Number((num * 22.72).toFixed(2));
  }
  return num;
}

/**
 * Historical Conversion Retrieval Function
 * Reads the permanent locked historical base equivalent (baseAmount / baseCurrencyAmount)
 * or evaluates using the permanent locked exchangeRateSnapshot.
 * Never allows floating or recalculation when today's global setting rate changes.
 */
export function getHistoricalBaseAmount(
  record?: {
    amount?: number;
    currency?: string;
    baseAmount?: number;
    baseCurrencyAmount?: number;
    exchangeRate?: number;
    exchangeRateSnapshot?: ExchangeRateSnapshot;
  } | null,
  defaultBaseCurrency = 'AED'
): number {
  if (!record) return 0;
  // 1. Highest precedence: Stored immutable baseAmount
  if (record.baseAmount != null && !isNaN(Number(record.baseAmount)) && Number(record.baseAmount) > 0) {
    return Number(record.baseAmount);
  }
  // 2. Synonymous baseCurrencyAmount
  if (record.baseCurrencyAmount != null && !isNaN(Number(record.baseCurrencyAmount)) && Number(record.baseCurrencyAmount) > 0) {
    return Number(record.baseCurrencyAmount);
  }
  const amt = Number(record.amount) || 0;
  if (amt === 0) return 0;
  const cur = (record.currency || defaultBaseCurrency).toUpperCase();
  const base = defaultBaseCurrency.toUpperCase();
  if (cur === base) return amt;

  // 3. Locked exchangeRateSnapshot
  if (record.exchangeRateSnapshot && record.exchangeRateSnapshot.rate > 0) {
    return Number((amt * record.exchangeRateSnapshot.rate).toFixed(2));
  }
  // 4. Stored exchangeRate on record
  if (record.exchangeRate && record.exchangeRate > 0) {
    return Number((amt * record.exchangeRate).toFixed(2));
  }
  // 5. Fallback
  return convertToBaseCurrency(amt, cur, record.exchangeRate, base);
}

/**
 * Historical Conversion Snapshot Retrieval Function
 * Retrieves the permanently locked exchange rate snapshot for any record.
 * If record was created before snapshots, derives an exact deterministic snapshot
 * from the record's creation date and stored rate so it remains permanent.
 */
export function getRecordExchangeRateSnapshot(
  record?: {
    amount?: number;
    currency?: string;
    baseAmount?: number;
    baseCurrencyAmount?: number;
    exchangeRate?: number;
    exchangeRateSnapshot?: ExchangeRateSnapshot;
    receiptDate?: string;
    paymentDate?: string;
    date?: string;
    createdAt?: string;
  } | null,
  defaultBaseCurrency = 'AED',
  fallbackRate?: number
): ExchangeRateSnapshot {
  const cur = (record?.currency || defaultBaseCurrency).toUpperCase();
  const base = defaultBaseCurrency.toUpperCase();
  const dateStr =
    record?.exchangeRateSnapshot?.asOfDate ||
    record?.receiptDate ||
    record?.paymentDate ||
    record?.date ||
    record?.createdAt?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  // If already locked in document:
  if (record?.exchangeRateSnapshot && record.exchangeRateSnapshot.rate > 0) {
    return {
      fromCurrency: record.exchangeRateSnapshot.fromCurrency || cur,
      toCurrency: record.exchangeRateSnapshot.toCurrency || base,
      rate: Number(record.exchangeRateSnapshot.rate),
      asOfDate: record.exchangeRateSnapshot.asOfDate || dateStr,
    };
  }

  // Derive locked rate from record
  let rate = record?.exchangeRate || fallbackRate;
  if (!rate || rate <= 0) {
    if (cur === base) {
      rate = 1;
    } else if (cur === 'INR' && base === 'AED') {
      rate = 0.04401;
    } else if (cur === 'AED' && base === 'INR') {
      rate = 22.72;
    } else {
      rate = 1;
    }
  }

  return {
    fromCurrency: cur,
    toCurrency: base,
    rate: Number(rate),
    asOfDate: dateStr,
  };
}

/**
 * Checks if a receipt is active and valid (not draft, pledged, or voided/cancelled)
 */
export function isReceiptValid(status?: string): boolean {
  return status === 'valid' || status === 'received';
}

/**
 * Checks if a receipt's physical cash is held by a given member custodian
 */
export function isReceiptHeldByMember(r: Receipt, member: Member): boolean {
  if (!member) return false;
  if (r.custodianMemberId && (r.custodianMemberId === member.id || r.custodianMemberId === member.memberNumber || r.custodianMemberId === `custodian_${member.id}`)) return true;
  const memNameLower = (member.fullName || '').toLowerCase().trim();
  const memNumLower = (member.memberNumber || '').toLowerCase().trim();

  if (r.custodianMemberName) {
    const custLower = r.custodianMemberName.toLowerCase();
    if (memNameLower && (custLower.includes(memNameLower) || memNameLower.includes(custLower))) return true;
    if (memNumLower && custLower.includes(memNumLower)) return true;
  }
  if (r.cashBankAccountId) {
    if (r.cashBankAccountId === member.id || r.cashBankAccountId === `custodian_${member.id}`) return true;
    if (r.cashBankAccountId === member.memberNumber) return true;
  }
  if (r.cashBankAccountName) {
    const nameLower = r.cashBankAccountName.toLowerCase();
    if (memNameLower && (nameLower.includes(memNameLower) || memNameLower.includes(nameLower))) return true;
    if (memNumLower && nameLower.includes(memNumLower)) return true;
  }
  return false;
}

// Helper: format YYYY-MM to "September 2026"
export function formatContributionMonth(monthStr?: string): string {
  if (!monthStr) return '';
  const trimmed = monthStr.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((m) => formatContributionMonthShort(m.trim()))
      .join(', ');
  }
  if (trimmed.includes(' to ')) {
    const [from, to] = trimmed.split(' to ');
    return `${formatContributionMonthShort(from)} – ${formatContributionMonthShort(to)}`;
  }
  return trimmed;
}

// Helper: format YYYY-MM to "Sep 2026"
export function formatContributionMonthShort(monthStr?: string): string {
  if (!monthStr) return '';
  const trimmed = monthStr.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [year, month] = trimmed.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((m) => formatContributionMonthShort(m.trim()))
      .join(', ');
  }
  if (trimmed.includes(' to ')) {
    const [from, to] = trimmed.split(' to ');
    return `${formatContributionMonthShort(from)} – ${formatContributionMonthShort(to)}`;
  }
  return trimmed;
}

export function formatMonthsBreakdown(months: string[]): string {
  if (!months || months.length === 0) return '';
  if (months.length === 1) return formatContributionMonth(months[0]);
  const sorted = [...months].sort();
  return `${sorted.length} Months: ${sorted.map(m => formatContributionMonthShort(m)).join(', ')}`;
}

export function formatMonthsRangePill(months: string[]): string {
  if (!months || months.length === 0) return '';
  if (months.length === 1) return `${formatContributionMonthShort(months[0])} (1 Month)`;
  const sorted = [...months].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${sorted.length} Months Selected (${formatContributionMonthShort(first)} - ${formatContributionMonthShort(last)})`;
}

// Helper: Normalize any date or month string into "YYYY-MM"
export function normalizeContributionMonthKey(val?: string, fallbackDate?: string): string {
  if (val && /^\d{4}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  if (val && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim().slice(0, 7);
  }
  if (fallbackDate && fallbackDate.length >= 7) {
    return fallbackDate.slice(0, 7);
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export class FinancialLedgerService {
  /**
   * Resolve human-friendly transaction classification
   */
  static getStandardTransactionType(txn: Transaction): MemberLedgerRow['transactionType'] {
    if (txn.type === 'Cash Transfer' || txn.type === 'Transfer' || txn.type === 'Member Handover') {
      return 'Cash Transfer';
    }
    if (txn.type === 'Contribution Handover') {
      return 'Cash Transfer';
    }
    if (
      txn.type === 'Charity Payment' ||
      txn.type === 'Charity Disbursement' ||
      txn.financialClassification === 'CHARITY_ASSISTANCE'
    ) {
      return 'Charity Disbursement';
    }
    if (txn.type === 'Bank Deposit') {
      return 'Bank Deposit';
    }
    if (txn.type === 'Cash Return') {
      return 'Cash Return';
    }
    if (txn.type === 'Adjustment') {
      return 'Adjustment';
    }
    return 'Member Contribution';
  }

  /**
   * Calculate detailed financial stats and chronological ledger for a specific Member
   */
  static getMemberFinancials(
    member: Member,
    allTransactions: Transaction[],
    allReceipts: Receipt[],
    allPayments: CharityPayment[],
    allCases: CharityCase[],
    allCashHoldings: CashHolding[] = []
  ): MemberFinancialStats {
    const memberId = member.id;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Gather all valid receipts for this member
    const memberReceipts = allReceipts.filter(
      (r) => r.memberId === memberId && isReceiptValid(r.status)
    );

    // 2. Gather all transactions that involve this member directly
    // (as contributor, sender, receiver, custodian, or disbursing payer)
    const relevantTxns = allTransactions.filter((t) => {
      if (t.status !== 'valid') return false;
      const isSender = t.creditMemberId === memberId || (t.creditEntityType === 'member' && t.creditAccountId === memberId);
      const isReceiver = t.debitMemberId === memberId || (t.debitEntityType === 'member' && t.debitAccountId === memberId);
      const isLinkedReceipt = memberReceipts.some((r) => r.id === t.linkedReceiptId || r.receiptNumber === t.reference);
      return isSender || isReceiver || isLinkedReceipt;
    });

    // 3. Build chronological member ledger rows
    // Sort ascending by date & time to calculate proper running balance
    const sortedTxns = [...relevantTxns].sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    // Track running totals
    let runningCash = 0;
    let totalContributions = 0;
    let currentMonthContribution = 0;
    const contributionsByMonth: Record<string, number> = {};
    let transfersReceivedBase = 0;
    let transfersSentBase = 0;
    const transfersSentByCur: Record<string, number> = {};
    const transfersReceivedByCur: Record<string, number> = {};
    let charityContributions = 0;
    let charityPayments = 0;
    let adjustments = 0;
    let lastDate: string | undefined = undefined;

    // First pass: accumulate contributions directly from receipts to guarantee zero omissions
    memberReceipts.forEach((r) => {
      const baseAmt = getHistoricalBaseAmount(r, 'AED');
      totalContributions += baseAmt;
      const mKey = normalizeContributionMonthKey(r.contributionMonth || r.periodMonth, r.receiptDate);
      contributionsByMonth[mKey] = (contributionsByMonth[mKey] || 0) + baseAmt;
      if (mKey === currentMonthKey) {
        currentMonthContribution += baseAmt;
      }
      if (r.contributionType === 'SPECIAL_CONTRIBUTION' || r.caseId) {
        charityContributions += baseAmt;
      }
    });

    // Construct ledger rows
    const ledgerRows: MemberLedgerRow[] = [];

    // Helper to resolve case info comprehensively (by ID, number, title, description, or purpose)
    const resolveCaseForRecord = (
      caseId?: string,
      caseTitle?: string,
      caseNumber?: string,
      desc?: string,
      purp?: string,
      receipt?: Receipt
    ): { caseId?: string; caseTitle?: string; caseNumber?: string } | undefined => {
      // 1. Explicitly ignore General Fund & Monthly Contributions - these are general charitable pool funds, NOT charity cases
      const isGeneralFundOrMonthly =
        receipt?.contributionType === 'MONTHLY_CONTRIBUTION' ||
        (receipt?.purpose && (receipt.purpose.toLowerCase().includes('general fund') || receipt.purpose.toLowerCase().includes('monthly contribution'))) ||
        (purp && (purp.toLowerCase().includes('general fund') || purp.toLowerCase().includes('monthly contribution'))) ||
        (desc && (desc.toLowerCase().includes('general fund') || desc.toLowerCase().includes('monthly contribution')));

      if (isGeneralFundOrMonthly) {
        if (!caseId && !receipt?.caseId) {
          return undefined;
        }
      }

      const cId = caseId || receipt?.caseId;
      if (cId && cId !== 'general' && cId !== 'none' && cId !== '') {
        const found = allCases.find((c) => c.id === cId || c.caseNumber === cId);
        if (found) return { caseId: found.id, caseTitle: found.title, caseNumber: found.caseNumber };
      }
      const cNum = caseNumber || receipt?.caseNumber;
      if (cNum) {
        const cNumLower = cNum.toLowerCase();
        const found = allCases.find((c) => c.caseNumber && c.caseNumber.toLowerCase() === cNumLower);
        if (found) return { caseId: found.id, caseTitle: found.title, caseNumber: found.caseNumber };
      }
      const cTitle = caseTitle || receipt?.caseTitle;
      if (cTitle && !cTitle.toLowerCase().includes('general fund') && !cTitle.toLowerCase().includes('monthly contribution')) {
        const cTitleLower = cTitle.toLowerCase();
        const found = allCases.find((c) => c.title && c.title.toLowerCase() === cTitleLower);
        if (found) return { caseId: found.id, caseTitle: found.title, caseNumber: found.caseNumber };
        return { caseId: cId, caseTitle: cTitle, caseNumber: cNum };
      }

      // If this is a general fund or monthly contribution, do NOT fuzzy match against cases
      if (isGeneralFundOrMonthly) return undefined;

      const text = `${desc || ''} ${purp || ''} ${receipt?.purpose || ''} ${receipt?.notes || ''}`.toLowerCase();
      if (text.trim() && !text.includes('general fund') && !text.includes('monthly contribution')) {
        const found = allCases.find((c) => {
          if (c.title && text.includes(c.title.toLowerCase())) return true;
          if (c.caseNumber && text.includes(c.caseNumber.toLowerCase())) return true;
          return false;
        });
        if (found) return { caseId: found.id, caseTitle: found.title, caseNumber: found.caseNumber };
      }
      return undefined;
    };

    // Tracking sets for deduplication
    const handledReceiptIds = new Set<string>();
    const handledTxnIds = new Set<string>();

    // Pre-match receipts to existing transactions to ensure clean 1-to-1 representation
    memberReceipts.forEach((r) => {
      const match = sortedTxns.find((t) => {
        if (handledTxnIds.has(t.id)) return false;
        if (t.linkedReceiptId && t.linkedReceiptId === r.id) return true;
        if (t.reference && r.receiptNumber && (t.reference === r.receiptNumber || t.reference.includes(r.receiptNumber))) return true;
        if (r.transactionId && (r.transactionId === t.id || r.transactionId === t.transactionNumber)) return true;
        if (
          t.date === r.receiptDate &&
          Math.abs((t.amount || 0) - (r.amount || 0)) < 0.01 &&
          (t.currency || 'AED').toUpperCase() === (r.currency || 'AED').toUpperCase() &&
          (t.creditMemberId === memberId || t.memberId === memberId)
        ) {
          return true;
        }
        return false;
      });
      if (match) {
        handledReceiptIds.add(r.id);
        if (r.receiptNumber) handledReceiptIds.add(r.receiptNumber);
      }
    });

    sortedTxns.forEach((txn) => {
      if (handledTxnIds.has(txn.id)) return;

      const isSender = txn.creditMemberId === memberId || (txn.creditEntityType === 'member' && txn.creditAccountId === memberId);
      const isReceiver = txn.debitMemberId === memberId || (txn.debitEntityType === 'member' && txn.debitAccountId === memberId);

      let standardType = this.getStandardTransactionType(txn);

      // Search allReceipts to find linked receipt even if another member contributed
      const linkedReceipt = allReceipts.find(
        (r) =>
          r.id === txn.linkedReceiptId ||
          (r.receiptNumber && txn.reference && (txn.reference === r.receiptNumber || txn.reference.includes(r.receiptNumber))) ||
          (r.transactionId && (r.transactionId === txn.id || r.transactionId === txn.transactionNumber)) ||
          (r.memberId === memberId && r.receiptDate === txn.date && Math.abs((r.amount || 0) - (txn.amount || 0)) < 0.01 && (r.currency || 'AED').toUpperCase() === (txn.currency || 'AED').toUpperCase())
      );

      if (linkedReceipt) {
        handledReceiptIds.add(linkedReceipt.id);
        if (linkedReceipt.receiptNumber) handledReceiptIds.add(linkedReceipt.receiptNumber);
      }

      // Check if this transaction is a contribution handover
      const isContributionHandoverTxn =
        txn.isContributionHandover ||
        txn.type === 'Contribution Handover' ||
        txn.handoverFundType === 'MONTHLY_CONTRIBUTION' ||
        txn.handoverFundType === 'CHARITY_CASE' ||
        Boolean(linkedReceipt && isSender);

      if (isContributionHandoverTxn && standardType === 'Cash Transfer') {
        standardType = 'Member Contribution';
      }

      const cur = txn.currency || linkedReceipt?.currency || 'AED';
      const snap = getRecordExchangeRateSnapshot(txn, 'AED', linkedReceipt?.exchangeRate);
      const rate = snap.rate;
      const amt = txn.amount || linkedReceipt?.amount || 0;
      const baseAmt = getHistoricalBaseAmount(txn, 'AED') || getHistoricalBaseAmount(linkedReceipt, 'AED');

      let debit = 0;
      let credit = 0;
      let baseDebit = 0;
      let baseCredit = 0;

      const monthsArr = linkedReceipt?.contributionMonths || (txn.contributionMonths && Array.isArray(txn.contributionMonths) ? txn.contributionMonths : undefined);
      const mKey = monthsArr && monthsArr.length > 0
        ? monthsArr.join(', ')
        : normalizeContributionMonthKey(
            linkedReceipt?.contributionMonth || linkedReceipt?.periodMonth || txn.contributionMonth || txn.date,
            txn.date
          );
      const mFormatted = monthsArr && monthsArr.length > 0
        ? (monthsArr.length > 1
            ? `${monthsArr.length} Months (${monthsArr.map((m) => formatContributionMonthShort(m)).join(', ')})`
            : formatContributionMonth(monthsArr[0]))
        : formatContributionMonth(mKey);

      const resolvedCase = resolveCaseForRecord(
        txn.linkedCaseId || linkedReceipt?.caseId,
        txn.linkedCaseTitle || linkedReceipt?.caseTitle,
        txn.linkedCaseNumber || linkedReceipt?.caseNumber,
        txn.description || linkedReceipt?.notes,
        txn.purpose || linkedReceipt?.purpose,
        linkedReceipt
      );

      if (standardType === 'Member Contribution') {
        // Double-entry record for member: Member contributions are credits
        credit = amt;
        baseCredit = baseAmt;
        debit = 0;
        baseDebit = 0;
        if (isReceiver && !isSender) {
          runningCash += baseAmt;
        }
      } else if (standardType === 'Cash Transfer') {
        if (isSender && !isReceiver) {
          // Converted base amount (AED) for Transfers Sent
          transfersSentBase += baseAmt;
          transfersSentByCur[cur] = (transfersSentByCur[cur] || 0) + amt;
          debit = amt;
          baseDebit = baseAmt;
          credit = 0;
          baseCredit = 0;
          runningCash = Math.max(0, runningCash - baseAmt);
        } else if (isReceiver && !isSender) {
          // Converted base amount (AED) for Transfers Received
          transfersReceivedBase += baseAmt;
          transfersReceivedByCur[cur] = (transfersReceivedByCur[cur] || 0) + amt;
          credit = amt;
          baseCredit = baseAmt;
          debit = 0;
          baseDebit = 0;
          runningCash += baseAmt;
        } else {
          credit = amt;
          baseCredit = baseAmt;
          debit = 0;
          baseDebit = 0;
        }
      } else if (standardType === 'Charity Disbursement') {
        if (isSender || isReceiver) {
          charityPayments += baseAmt;
          debit = amt;
          baseDebit = baseAmt;
          credit = 0;
          baseCredit = 0;
          runningCash = Math.max(0, runningCash - baseAmt);
        }
      } else if (standardType === 'Bank Deposit') {
        debit = amt;
        baseDebit = baseAmt;
        credit = 0;
        baseCredit = 0;
        runningCash = Math.max(0, runningCash - baseAmt);
      } else if (standardType === 'Cash Return') {
        debit = amt;
        baseDebit = baseAmt;
        credit = 0;
        baseCredit = 0;
        runningCash = Math.max(0, runningCash - baseAmt);
      } else if (standardType === 'Adjustment') {
        adjustments += baseAmt;
        if (isReceiver) {
          credit = amt;
          baseCredit = baseAmt;
          runningCash += baseAmt;
        } else {
          debit = amt;
          baseDebit = baseAmt;
          runningCash = Math.max(0, runningCash - baseAmt);
        }
      }

      lastDate = txn.date || lastDate;
      handledTxnIds.add(txn.id);

      ledgerRows.push({
        id: txn.id,
        date: txn.date,
        contributionMonth: mKey,
        contributionMonthFormatted: mFormatted,
        transactionId: txn.id,
        transactionNumber: txn.transactionNumber || txn.id,
        transactionType: standardType,
        charityCaseId: resolvedCase?.caseId,
        charityCaseName: resolvedCase?.caseTitle,
        charityCaseNumber: resolvedCase?.caseNumber,
        description: txn.description,
        from: txn.creditAccountName || txn.creditMemberName || member.fullName,
        fromId: txn.creditMemberId || txn.creditAccountId,
        to: txn.debitAccountName || txn.debitMemberName || 'Charity Fund',
        toId: txn.debitMemberId || txn.debitAccountId,
        amount: amt,
        currency: cur,
        exchangeRate: rate,
        baseCurrencyAmount: baseAmt,
        debit,
        credit,
        baseDebit,
        baseCredit,
        runningBalance: 0, // Calculated accurately below in chronological order
        paymentMethod: txn.reference ? 'Bank Transfer' : 'Cash',
        reference: txn.reference || txn.transactionNumber || '',
        status: txn.status === 'valid' ? 'valid' : 'voided',
        notes: txn.description,
        rawTxn: txn,
        rawReceipt: linkedReceipt,
      });
    });

    // Add any receipts that weren't captured in transaction table
    memberReceipts.forEach((r) => {
      if (!handledReceiptIds.has(r.id) && !handledReceiptIds.has(r.receiptNumber)) {
        const monthsArr = r.contributionMonths && Array.isArray(r.contributionMonths) ? r.contributionMonths : undefined;
        const mKey = monthsArr && monthsArr.length > 0
          ? monthsArr.join(', ')
          : normalizeContributionMonthKey(r.contributionMonth || r.periodMonth, r.receiptDate);
        const mFormatted = monthsArr && monthsArr.length > 0
          ? (monthsArr.length > 1
              ? `${monthsArr.length} Months (${monthsArr.map((m) => formatContributionMonthShort(m)).join(', ')})`
              : formatContributionMonth(monthsArr[0]))
          : formatContributionMonth(mKey);

        const resolvedCase = resolveCaseForRecord(r.caseId, r.caseTitle, r.caseNumber, r.notes, r.purpose, r);
        const cur = r.currency || 'AED';
        const snap = getRecordExchangeRateSnapshot(r, 'AED');
        const rate = snap.rate;
        const baseAmt = getHistoricalBaseAmount(r, 'AED');

        ledgerRows.push({
          id: r.id,
          date: r.receiptDate,
          contributionMonth: mKey,
          contributionMonthFormatted: mFormatted,
          transactionId: r.transactionId || r.id,
          transactionNumber: r.receiptNumber,
          transactionType: 'Member Contribution',
          charityCaseId: resolvedCase?.caseId,
          charityCaseName: resolvedCase?.caseTitle,
          charityCaseNumber: resolvedCase?.caseNumber,
          description: `Contribution: ${r.memberName} - ${r.contributionAccountName || 'General Fund'}`,
          from: r.memberName,
          fromId: member.id,
          to: r.cashBankAccountName || 'Charity Treasury',
          amount: r.amount,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyAmount: baseAmt,
          debit: 0,
          credit: r.amount,
          baseDebit: 0,
          baseCredit: baseAmt,
          runningBalance: 0, // Calculated accurately below
          paymentMethod: r.paymentMethod || 'Cash',
          reference: r.receiptNumber,
          status: r.status === 'valid' ? 'valid' : 'voided',
          notes: r.notes,
          rawReceipt: r,
        });
      }
    });

    // Real-time mathematical running balance calculation (Previous Balance + Credits - Debits)
    // 1. Sort chronological ascending (earliest first)
    ledgerRows.sort((a, b) => {
      const cmpDate = (a.date || '').localeCompare(b.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.id || '').localeCompare(b.id || '');
    });

    // 2. Accumulate running balance mathematically
    let cumulativeBalance = 0;
    for (const row of ledgerRows) {
      if (row.status !== 'voided') {
        const rowCredit = row.baseCredit !== undefined ? row.baseCredit : (row.credit * (row.exchangeRate || 1));
        const rowDebit = row.baseDebit !== undefined ? row.baseDebit : (row.debit * (row.exchangeRate || 1));
        cumulativeBalance = Number((cumulativeBalance + rowCredit - rowDebit).toFixed(2));
      }
      row.runningBalance = cumulativeBalance;
    }

    // 3. Sort final rows descending for user display (newest first)
    ledgerRows.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (b.id || '').localeCompare(a.id || '');
    });

    // Calculate actual physical cash in hand:
    // Convert each currency balance to base currency (e.g. INR -> AED)
    let memberBaseStoredCash = 0;
    const memberBalancesByCur: Record<string, number> = {};
    if (member.cashBalances) {
      Object.entries(member.cashBalances).forEach(([cur, b]) => {
        const val = Number(b) || 0;
        if (val > 0) {
          memberBalancesByCur[cur] = val;
          memberBaseStoredCash += convertToBaseCurrency(val, cur, 0.04401, 'AED');
        }
      });
    }

    const cashCurrentlyHeld = Math.max(0, Number(Math.max(runningCash, memberBaseStoredCash).toFixed(2)));

    // Full Address strings
    const localAddr = member.localAddress
      ? [
          member.localAddress.flatRoom || member.localAddress.flat,
          member.localAddress.buildingVilla || member.localAddress.building,
          member.localAddress.street || member.localAddress.area,
          member.localAddress.emirateState || member.localAddress.stateOrEmirate,
          member.localAddress.country,
        ]
          .filter(Boolean)
          .join(', ')
      : member.address;

    const homeAddr = member.homeCountryAddress
      ? [
          member.homeCountryAddress.houseBuilding,
          member.homeCountryAddress.villageArea,
          member.homeCountryAddress.city,
          member.homeCountryAddress.district,
          member.homeCountryAddress.stateProvince,
          member.homeCountryAddress.country,
        ]
          .filter(Boolean)
          .join(', ')
      : undefined;

    // Calculate Cash In Hand Breakdown with Multi-Currency & Itemized Drill-Down
    // Derive records STRICTLY by joining official receipts (receipt.custodianMemberId === member.id || receipt.custodianId === member.id)
    const memberHoldings = allCashHoldings.filter(
      (h) => h.memberId === member.id && h.id !== 'holding_1790333624218_w7s6'
    );
    const receivedItems: CustodianReceivedItem[] = [];
    const seenItemKeys = new Set<string>();

    // 1. Valid official receipts assigning cash to this custodian (PRIMARY SOURCE OF TRUTH)
    allReceipts.forEach((r) => {
      if (!isReceiptValid(r.status)) return;
      const isAssignedCustodian =
        r.custodianMemberId === member.id ||
        (r as any).custodianId === member.id ||
        r.cashBankAccountId === `custodian_${member.id}` ||
        (r.cashBankAccountName && r.cashBankAccountName.includes(member.fullName)) ||
        (r.cashBankAccountName && r.cashBankAccountName.includes(member.memberNumber));

      if (!isAssignedCustodian) return;

      const key = `rcpt_${r.id}`;
      if (seenItemKeys.has(key)) return;
      seenItemKeys.add(key);

      const resolvedCase = resolveCaseForRecord(r.caseId, r.caseTitle, r.caseNumber, r.notes, r.purpose, r);
      const cur = (r.currency || 'AED').toUpperCase();
      const snap = getRecordExchangeRateSnapshot(r, 'AED');
      const rate = snap.rate;
      const linkedTxn = allTransactions.find(
        (t) => t.id === r.transactionId || t.linkedReceiptId === r.id || t.reference === r.receiptNumber
      );
      // Use latest/updated amount from transaction if greater
      const verifiedAmt = linkedTxn?.amount && linkedTxn.amount > (r.amount || 0) ? linkedTxn.amount : (r.amount || 0);
      const baseAmt = (linkedTxn && getHistoricalBaseAmount(linkedTxn, 'AED')) || getHistoricalBaseAmount(r, 'AED');

      receivedItems.push({
        id: r.id,
        transactionNumber: linkedTxn?.transactionNumber || r.transactionId || r.receiptNumber,
        receiptNumber: r.receiptNumber,
        date: r.receiptDate,
        contributorId: r.memberId,
        contributorNumber: r.memberNumber,
        contributorName: r.memberName,
        purpose: r.purpose || resolvedCase?.caseTitle || r.contributionAccountName || 'Designated Charity Case',
        caseId: resolvedCase?.caseId,
        caseNumber: resolvedCase?.caseNumber,
        caseTitle: resolvedCase?.caseTitle,
        originalAmount: verifiedAmt,
        originalCurrency: cur,
        exchangeRate: rate,
        baseAmount: baseAmt,
        status: 'Received / Valid',
        paymentMethod: r.paymentMethod || 'Cash',
        notes: r.notes,
      });
    });

    // 2. Transactions where member is receiver/custodian (only unreceipted handovers)
    allTransactions.forEach((txn) => {
      if (txn.status !== 'valid') return;
      const isCustodianReceiver =
        txn.debitMemberId === member.id ||
        txn.custodianId === member.id ||
        (txn.toName && txn.toName.includes(member.fullName));

      if (!isCustodianReceiver) return;

      const alreadyCaptured = receivedItems.some(
        (item) =>
          item.id === txn.id ||
          item.transactionNumber === txn.transactionNumber ||
          item.transactionNumber === txn.id ||
          (txn.linkedReceiptId && item.id === txn.linkedReceiptId) ||
          (txn.reference && item.receiptNumber === txn.reference) ||
          allReceipts.some(
            (r) =>
              (r.transactionId === txn.id || r.id === txn.linkedReceiptId || r.receiptNumber === txn.reference) &&
              item.id === r.id
          )
      );
      if (alreadyCaptured) return;

      const key = `txn_${txn.id}`;
      if (seenItemKeys.has(key)) return;
      seenItemKeys.add(key);

      const resolvedCase = resolveCaseForRecord(
        txn.linkedCaseId,
        txn.linkedCaseTitle,
        txn.linkedCaseNumber,
        txn.description,
        txn.purpose
      );
      const cur = (txn.currency || 'AED').toUpperCase();
      const snap = getRecordExchangeRateSnapshot(txn, 'AED');
      const rate = snap.rate;
      const baseAmt = getHistoricalBaseAmount(txn, 'AED');

      receivedItems.push({
        id: txn.id,
        transactionNumber: txn.transactionNumber || txn.id,
        receiptNumber: txn.reference && txn.reference.startsWith('RCPT-') ? txn.reference : undefined,
        date: txn.date,
        contributorId: txn.creditMemberId || '',
        contributorNumber: txn.creditMemberNumber,
        contributorName: txn.creditMemberName || txn.fromName || 'Donor Member',
        purpose: txn.purpose || resolvedCase?.caseTitle || txn.description || 'Contribution Handover',
        caseId: resolvedCase?.caseId,
        caseNumber: resolvedCase?.caseNumber,
        caseTitle: resolvedCase?.caseTitle,
        originalAmount: txn.amount,
        originalCurrency: cur,
        exchangeRate: rate,
        baseAmount: baseAmt,
        status: 'Received / Valid',
        paymentMethod: txn.paymentMethod || 'Cash',
        notes: txn.description,
      });
    });

    // 3. Cash holdings: NEVER append phantom record ("holding_1790333624218_w7s6") or standalone "holding_*" entries that duplicate an already issued receipt
    memberHoldings.forEach((h) => {
      if (h.status !== 'HELD') return;
      // Eliminate phantom record
      if (h.id === 'holding_1790333624218_w7s6') return;

      const cur = (h.currency || 'AED').toUpperCase();

      // Check if already captured by official receipt or transaction
      const alreadyCaptured = receivedItems.some(
        (item) =>
          (h.receiptId && item.id === h.receiptId) ||
          (h.receiptNumber && item.receiptNumber === h.receiptNumber) ||
          (h.sourceTransactionNumber && item.transactionNumber === h.sourceTransactionNumber) ||
          (item.receiptNumber &&
            item.originalAmount === h.amount &&
            item.originalCurrency === cur)
      );
      if (alreadyCaptured) return;

      // Standalone "holding_*" entries must NEVER duplicate an official receipt issued for this custodian
      if (h.id.startsWith('holding_')) {
        const hasMatchingOfficialReceipt = allReceipts.some(
          (r) =>
            isReceiptValid(r.status) &&
            (r.custodianMemberId === member.id ||
              (r as any).custodianId === member.id ||
              r.cashBankAccountId === `custodian_${member.id}` ||
              (r.cashBankAccountName && r.cashBankAccountName.includes(member.fullName))) &&
            r.amount === h.amount &&
            (r.currency || 'AED').toUpperCase() === cur
        );
        if (hasMatchingOfficialReceipt) return;
      }

      const key = `holding_${h.id}`;
      if (seenItemKeys.has(key)) return;
      seenItemKeys.add(key);

      const resolvedCase = resolveCaseForRecord(h.caseId, h.caseTitle, h.caseNumber, h.notes, h.caseNote);
      const snap = getRecordExchangeRateSnapshot(h, 'AED');
      const rate = snap.rate;
      const baseAmt = getHistoricalBaseAmount(h, 'AED');

      receivedItems.push({
        id: h.id,
        transactionNumber: h.sourceTransactionNumber || h.receiptNumber || h.id,
        receiptNumber: h.receiptNumber,
        date: h.date,
        contributorId: h.donorMemberId || '',
        contributorNumber: h.donorMemberNumber,
        contributorName: h.donorMemberName || 'Donor Member',
        purpose: h.caseTitle || resolvedCase?.caseTitle || h.caseNote || h.notes || 'Charity Case Contribution',
        caseId: resolvedCase?.caseId,
        caseNumber: resolvedCase?.caseNumber,
        caseTitle: resolvedCase?.caseTitle,
        originalAmount: h.amount,
        originalCurrency: cur,
        exchangeRate: rate,
        baseAmount: baseAmt,
        status: 'Received / Valid',
        notes: h.notes,
      });
    });

    // Multi-currency calculation
    const receivedByCurrency: Record<string, number> = {};
    let totalBaseReceived = 0;

    receivedItems.forEach((item) => {
      const cur = item.originalCurrency || 'AED';
      receivedByCurrency[cur] = (receivedByCurrency[cur] || 0) + item.originalAmount;
      totalBaseReceived += item.baseAmount;
    });

    totalBaseReceived = Number(totalBaseReceived.toFixed(2));

    const curParts = Object.entries(receivedByCurrency)
      .filter(([_, amt]) => amt > 0)
      .map(([cur, amt]) => formatCurrency(amt, cur));

    const receivedOriginalFormatted = curParts.length > 0 ? curParts.join(' | ') : formatCurrency(0, 'AED');
    const hasForeignCurrency = Boolean(receivedByCurrency['INR'] && receivedByCurrency['INR'] > 0);

    let cashBreakdown: CashInHandBreakdown | undefined = undefined;

    if (receivedItems.length > 0 || totalBaseReceived > 0 || cashCurrentlyHeld > 0 || transfersReceivedBase > 0) {
      const primaryItem = receivedItems[0];
      const donorName = primaryItem
        ? (receivedItems.length > 1 ? `${primaryItem.contributorName} (+${receivedItems.length - 1} more)` : primaryItem.contributorName)
        : (memberHoldings[0]?.donorMemberName || member.fullName);
      const donorId = primaryItem?.contributorId || memberHoldings[0]?.donorMemberId || member.id;
      const donorNumber = primaryItem?.contributorNumber || memberHoldings[0]?.donorMemberNumber || member.memberNumber;

      const firstCaseItem = receivedItems.find(
        (it) => it.caseId || (it.caseTitle && !it.caseTitle.toLowerCase().includes('monthly contribution') && !it.caseTitle.toLowerCase().includes('general fund'))
      );
      const holdingCase = memberHoldings.find(
        (h) => h.caseId || (h.caseTitle && !h.caseTitle.toLowerCase().includes('monthly contribution') && !h.caseTitle.toLowerCase().includes('general fund'))
      );
      const allocatedCaseObj = firstCaseItem
        ? {
            caseId: firstCaseItem.caseId,
            caseTitle: firstCaseItem.caseTitle || 'Designated Charity Case',
            caseNumber: firstCaseItem.caseNumber,
          }
        : holdingCase
        ? {
            caseId: holdingCase.caseId,
            caseTitle: holdingCase.caseTitle || 'Designated Case',
            caseNumber: holdingCase.caseNumber,
          }
        : undefined;

      const paidAmt = charityPayments;
      const returnedAmt = 0;
      const depositedAmt = 0;
      const finalReceivedBase = totalBaseReceived > 0 ? totalBaseReceived : (cashCurrentlyHeld > 0 ? cashCurrentlyHeld : transfersReceivedBase);
      // Derive active cash held strictly from verified receipts minus disbursements
      const heldAmt = totalBaseReceived > 0
        ? Math.max(0, Number((totalBaseReceived - paidAmt - returnedAmt - depositedAmt).toFixed(2)))
        : (cashCurrentlyHeld > 0 ? cashCurrentlyHeld : Math.max(0, finalReceivedBase - paidAmt - returnedAmt - depositedAmt));

      cashBreakdown = {
        received: finalReceivedBase,
        receivedOriginalFormatted,
        receivedByCurrency,
        hasForeignCurrency,
        receivedItems,
        receivedFrom: {
          memberId: donorId,
          memberName: donorName,
          memberNumber: donorNumber,
        },
        allocatedCase: allocatedCaseObj,
        paid: paidAmt,
        returned: returnedAmt,
        deposited: depositedAmt,
        currentCashHeld: heldAmt,
        notes: primaryItem?.notes || memberHoldings[0]?.notes || 'Cash custody for designated charity case distribution',
      };
    }

    const verifiedCashCurrentlyHeld = totalBaseReceived > 0 ? (cashBreakdown?.currentCashHeld ?? totalBaseReceived) : cashCurrentlyHeld;

    // Format transfers breakdown (e.g. "₹ 4,000.00 / AED 176.04")
    const formatTransfersBreakdown = (byCur: Record<string, number>, baseTotal: number) => {
      const curKeys = Object.keys(byCur).filter((c) => (byCur[c] || 0) > 0);
      if (curKeys.length === 0) {
        return { formatted: formatCurrency(baseTotal, 'AED'), hasForeign: false };
      }
      const hasForeign = curKeys.some((c) => c.toUpperCase() !== 'AED');
      if (!hasForeign) {
        return { formatted: formatCurrency(baseTotal, 'AED'), hasForeign: false };
      }
      const parts = curKeys.map((c) => formatCurrency(byCur[c], c));
      const nativeStr = parts.join(' + ');
      return {
        formatted: `${nativeStr} / ${formatCurrency(baseTotal, 'AED')}`,
        hasForeign: true,
      };
    };

    const transfersSentInfo = formatTransfersBreakdown(transfersSentByCur, transfersSentBase);
    const transfersReceivedInfo = formatTransfersBreakdown(transfersReceivedByCur, transfersReceivedBase);

    return {
      memberId: member.id,
      memberNumber: member.memberNumber,
      memberName: member.fullName,
      fatherName: member.fatherName || member.fatherHusbandName,
      contact: member.mobileNumber || member.email,
      localAddress: localAddr,
      homeCountryAddress: homeAddr,
      bloodGroup: member.bloodGroup,
      monthlyPledge: member.monthlyContributionAmount || 0,
      totalContributions: Number(totalContributions.toFixed(2)),
      currentMonthContribution: Number(currentMonthContribution.toFixed(2)),
      contributionsByMonth,
      transfersReceived: Number(transfersReceivedBase.toFixed(2)),
      transfersSent: Number(transfersSentBase.toFixed(2)),
      transfersSentOriginalFormatted: transfersSentInfo.formatted,
      transfersReceivedOriginalFormatted: transfersReceivedInfo.formatted,
      hasTransfersSentForeign: transfersSentInfo.hasForeign,
      hasTransfersReceivedForeign: transfersReceivedInfo.hasForeign,
      charityContributions: Number(charityContributions.toFixed(2)),
      charityPayments: Number(charityPayments.toFixed(2)),
      adjustments: Number(adjustments.toFixed(2)),
      cashCurrentlyHeld: verifiedCashCurrentlyHeld,
      cashBalancesByCurrency: memberBalancesByCur,
      currentBalance: verifiedCashCurrentlyHeld, // Physical cash held on behalf of charity
      transactionsCount: ledgerRows.length,
      lastTransactionDate: lastDate || (ledgerRows[0]?.date),
      cashBreakdown,
      ledgerRows,
    };
  }

  /**
   * Calculate detailed financial stats and chronological ledger for a specific Charity Case
   */
  static getCaseFinancials(
    charityCase: CharityCase,
    allTransactions: Transaction[],
    allReceipts: Receipt[],
    allPayments: CharityPayment[],
    allMembers: Member[]
  ): CaseFinancialStats {
    const caseId = charityCase.id;

    // 1. Gather all receipts linked to this case
    const caseReceipts = allReceipts.filter(
      (r) => (r.caseId === caseId || r.caseNumber === charityCase.caseNumber) && r.status === 'valid'
    );

    // 2. Gather all payments linked to this case
    const casePayments = allPayments.filter(
      (p) => (p.caseId === caseId || p.caseNumber === charityCase.caseNumber) && p.status === 'valid'
    );

    // 3. Gather all transactions linked to this case
    const caseTxns = allTransactions.filter((t) => {
      if (t.status !== 'valid') return false;
      return t.linkedCaseId === caseId || t.linkedCaseNumber === charityCase.caseNumber;
    });

    // Build chronological case ledger rows
    const rows: CaseLedgerRow[] = [];
    let runningBalance = 0;
    let totalReceived = 0;
    let totalDisbursed = 0;
    let totalTransfers = 0;

    // Combine transactions and raw payments/receipts without duplication
    const handledReceiptIds = new Set<string>();
    const handledPaymentIds = new Set<string>();

    const sortedTxns = [...caseTxns].sort((a, b) => {
      const cDate = (a.date || '').localeCompare(b.date || '');
      if (cDate !== 0) return cDate;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    sortedTxns.forEach((txn) => {
      if (txn.linkedReceiptId) handledReceiptIds.add(txn.linkedReceiptId);
      if (txn.linkedPaymentId) handledPaymentIds.add(txn.linkedPaymentId);

      const standardType = this.getStandardTransactionType(txn);
      const cur = txn.currency || 'AED';
      const snap = getRecordExchangeRateSnapshot(txn, 'AED');
      const rate = snap.rate;
      const amt = txn.amount || 0;
      const baseAmt = getHistoricalBaseAmount(txn, 'AED');
      let debit = 0;
      let credit = 0;
      let baseDebit = 0;
      let baseCredit = 0;

      const mKey = normalizeContributionMonthKey(txn.date);

      // Find member & custodian names
      const memName = txn.creditMemberName || allMembers.find((m) => m.id === txn.creditMemberId)?.fullName;
      const custName = txn.debitMemberName || allMembers.find((m) => m.id === txn.debitMemberId)?.fullName;

      if (standardType === 'Member Contribution') {
        credit = amt;
        baseCredit = baseAmt;
        debit = 0;
        baseDebit = 0;
        totalReceived += baseAmt;
        runningBalance += baseAmt;
      } else if (standardType === 'Charity Disbursement') {
        debit = amt;
        baseDebit = baseAmt;
        credit = 0;
        baseCredit = 0;
        totalDisbursed += baseAmt;
        runningBalance -= baseAmt;
      } else if (standardType === 'Cash Transfer') {
        totalTransfers += baseAmt;
        // Internal transfer between custodians for this case does not change net case fund balance
        debit = 0;
        credit = 0;
      }

      rows.push({
        id: txn.id,
        date: txn.date,
        transactionNumber: txn.transactionNumber || txn.id,
        contributionMonth: mKey,
        contributionMonthFormatted: formatContributionMonth(mKey),
        transactionType: standardType,
        memberId: txn.creditMemberId,
        memberName: memName,
        custodianId: txn.debitMemberId,
        custodianName: custName,
        from: txn.creditAccountName || memName || 'Donor Member',
        to: txn.debitAccountName || custName || charityCase.beneficiaryName,
        amount: amt,
        currency: cur,
        exchangeRate: rate,
        exchangeRateSnapshot: snap,
        baseAmount: baseAmt,
        baseDebit,
        baseCredit,
        debit,
        credit,
        runningBalance: Number(runningBalance.toFixed(2)),
        paymentReference: txn.reference || txn.transactionNumber || '',
        notes: txn.description,
        status: 'valid',
        rawTxn: txn,
      });
    });

    // Add standalone receipts if not in transaction list
    caseReceipts.forEach((r) => {
      if (!handledReceiptIds.has(r.id)) {
        const mKey = normalizeContributionMonthKey(r.contributionMonth || r.periodMonth, r.receiptDate);
        const cur = r.currency || 'AED';
        const snap = getRecordExchangeRateSnapshot(r, 'AED');
        const rate = snap.rate;
        const baseAmt = getHistoricalBaseAmount(r, 'AED');
        totalReceived += baseAmt;
        runningBalance += baseAmt;
        rows.push({
          id: r.id,
          date: r.receiptDate,
          transactionNumber: r.receiptNumber,
          contributionMonth: mKey,
          contributionMonthFormatted: formatContributionMonth(mKey),
          transactionType: 'Member Contribution',
          memberId: r.memberId,
          memberName: r.memberName,
          from: r.memberName,
          to: r.cashBankAccountName || 'Case Fund',
          amount: r.amount,
          currency: cur,
          exchangeRate: rate,
          exchangeRateSnapshot: snap,
          baseAmount: baseAmt,
          baseDebit: 0,
          baseCredit: baseAmt,
          debit: 0,
          credit: r.amount,
          runningBalance: Number(runningBalance.toFixed(2)),
          paymentReference: r.receiptNumber,
          notes: r.notes,
          status: 'valid',
          rawReceipt: r,
        });
      }
    });

    // Add standalone payments if not in transaction list
    casePayments.forEach((p) => {
      if (!handledPaymentIds.has(p.id)) {
        const mKey = normalizeContributionMonthKey(p.paymentDate);
        const cur = p.currency || 'AED';
        const snap = getRecordExchangeRateSnapshot(p, 'AED');
        const rate = snap.rate;
        const baseAmt = getHistoricalBaseAmount(p, 'AED');
        totalDisbursed += baseAmt;
        runningBalance -= baseAmt;
        rows.push({
          id: p.id,
          date: p.paymentDate,
          transactionNumber: p.paymentNumber,
          contributionMonth: mKey,
          contributionMonthFormatted: formatContributionMonth(mKey),
          transactionType: 'Charity Disbursement',
          from: p.paidByMemberName || p.cashBankAccountName,
          to: p.payeeName || charityCase.beneficiaryName,
          amount: p.amount,
          currency: cur,
          exchangeRate: rate,
          exchangeRateSnapshot: snap,
          baseAmount: baseAmt,
          baseDebit: baseAmt,
          baseCredit: 0,
          debit: p.amount,
          credit: 0,
          runningBalance: Number(runningBalance.toFixed(2)),
          paymentReference: p.paymentNumber,
          notes: p.description,
          status: 'valid',
          rawPayment: p,
        });
      }
    });

    // Sort final rows descending (newest first)
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    // Priority reconciliation: use collectedAmount / disbursedAmount if higher
    const finalReceived = Math.max(totalReceived, charityCase.collectedAmount || 0);
    const finalDisbursed = Math.max(totalDisbursed, charityCase.disbursedAmount || 0);
    const remainingBalance = Math.max(0, finalReceived - finalDisbursed);

    return {
      caseId: charityCase.id,
      caseNumber: charityCase.caseNumber,
      caseName: charityCase.title,
      beneficiary: charityCase.beneficiaryName,
      beneficiaryPhone: charityCase.beneficiaryPhone,
      purpose: charityCase.description || charityCase.title,
      category: charityCase.caseType,
      createdDate: charityCase.createdAt?.slice(0, 10) || '2026-01-01',
      targetAmount: charityCase.approvedAmount || 0,
      status: charityCase.status,
      openingBalance: 0,
      totalFundsReceived: Number(finalReceived.toFixed(2)),
      totalContributions: Number(finalReceived.toFixed(2)),
      totalCashTransfers: Number(totalTransfers.toFixed(2)),
      totalDisbursed: Number(finalDisbursed.toFixed(2)),
      remainingBalance: Number(remainingBalance.toFixed(2)),
      transactionsCount: rows.length,
      ledgerRows: rows,
    };
  }

  /**
   * Single Source of Truth selector for Custodian Base Balance.
   * Strictly evaluates: convertedTotal = (aedCustodyBalance * fxRateAED) + (inrCustodyBalance * fxRateINR)
   */
  static calculateCustodianBaseBalance(
    cashInHandByCurrency: Record<string, number>,
    fxRates: { AED?: number; INR?: number } | number = 0.0440123
  ): number {
    const inrRate = typeof fxRates === 'number' ? fxRates : (fxRates.INR ?? 0.0440123);
    const aedRate = typeof fxRates === 'number' ? 1.0 : (fxRates.AED ?? 1.0);

    let total = 0;
    Object.entries(cashInHandByCurrency || {}).forEach(([cur, bal]) => {
      const b = Number(bal) || 0;
      if (b <= 0) return;
      const c = cur.toUpperCase();
      if (c === 'AED') {
        total += b * aedRate;
      } else if (c === 'INR') {
        total += b * inrRate;
      } else {
        total += convertToBaseCurrency(b, c, 1, 'AED');
      }
    });
    return Number(total.toFixed(2));
  }

  /**
   * Get all active Cash Custodians (members holding physical cash)
   * Enforces strict base formula: convertedTotal = (aedCustodyBalance * fxRateAED) + (inrCustodyBalance * fxRateINR)
   */
  static getCashCustodians(
    allMembers: Member[],
    allTransactions: Transaction[],
    allReceipts: Receipt[],
    allPayments: CharityPayment[],
    allCases: CharityCase[],
    allCashHoldings: CashHolding[] = [],
    exchangeRateInrToAed: number = 0.0440123
  ): { custodians: CashCustodianItem[]; totalCashHeld: number; totalCashHeldByCurrency: Record<string, number>; count: number } {
    const list: CashCustodianItem[] = [];

    // Polymorphism safety: support overloaded signature (members, cashHoldings, payments, receipts, currency)
    let transactionsList = allTransactions || [];
    let receiptsList = allReceipts || [];
    let paymentsList = allPayments || [];
    let casesList = allCases || [];
    let holdingsList = allCashHoldings || [];
    const inrFxRate = typeof exchangeRateInrToAed === 'number' && exchangeRateInrToAed > 0 ? exchangeRateInrToAed : 0.0440123;

    if (Array.isArray(allTransactions) && allTransactions.length > 0 && ('category' in (allTransactions[0] as any) || 'donorMemberId' in (allTransactions[0] as any))) {
      holdingsList = (allTransactions as any) || [];
      paymentsList = (allReceipts as any) || [];
      receiptsList = (allPayments as any) || [];
      transactionsList = [];
      casesList = [];
    }

    // Check each member's financial state
    allMembers.forEach((member) => {
      const stats = this.getMemberFinancials(
        member,
        transactionsList,
        receiptsList,
        paymentsList,
        casesList,
        holdingsList
      );

      // Receipts held by member
      const memberReceiptsHeld = receiptsList.filter(
        (r) => isReceiptValid(r.status) && isReceiptHeldByMember(r, member)
      );

      // Explicit CashHolding records in HELD state
      const memberHoldings = holdingsList.filter(
        (h) => (h.memberId === member.id || h.memberNumber === member.memberNumber) && h.status === 'HELD'
      );

      const receiptsByCur: Record<string, number> = {};
      memberReceiptsHeld.forEach((r) => {
        const cur = (r.currency || 'AED').toUpperCase();
        // Check if there is a linked transaction with an updated amount
        const linkedTxn = transactionsList.find((t) => t.id === r.transactionId || t.linkedReceiptId === r.id || t.reference === r.receiptNumber);
        const rAmt = linkedTxn?.amount && linkedTxn.amount > (r.amount || 0) ? linkedTxn.amount : (r.amount || 0);
        receiptsByCur[cur] = Number(((receiptsByCur[cur] || 0) + rAmt).toFixed(2));
      });

      // Transactions where member is receiver/custodian of cash and not already captured in receipts
      const txnsByCur: Record<string, number> = {};
      const memName = (member.fullName || '').toLowerCase().trim();
      transactionsList.forEach((t) => {
        if (t.status !== 'valid') return;
        const isReceiver =
          t.debitMemberId === member.id ||
          t.custodianId === member.id ||
          (t.debitMemberNumber && t.debitMemberNumber === member.memberNumber) ||
          (memName && t.toName && t.toName.toLowerCase().includes(memName)) ||
          (memName && t.debitAccountName && t.debitAccountName.toLowerCase().includes(memName));
        if (!isReceiver) return;
        const isAlreadyInReceipts = memberReceiptsHeld.some(
          (r) =>
            r.id === t.linkedReceiptId ||
            (t.reference && (t.reference === r.receiptNumber || t.reference.includes(r.receiptNumber || ''))) ||
            (r.receiptNumber && (r.receiptNumber === t.reference || (t.reference && t.reference.includes(r.receiptNumber)))) ||
            r.transactionId === t.id ||
            r.transactionId === t.transactionNumber ||
            (r.receiptDate === t.date && Math.abs((r.amount || 0) - (t.amount || 0)) < 0.01 && (r.currency || 'AED').toUpperCase() === (t.currency || 'AED').toUpperCase())
        );
        if (isAlreadyInReceipts) return;
        const cur = (t.currency || 'AED').toUpperCase();
        txnsByCur[cur] = Number(((txnsByCur[cur] || 0) + (t.amount || 0)).toFixed(2));
      });

      const holdingsByCur: Record<string, number> = {};
      memberHoldings.forEach((h) => {
        // Skip holdings that represent an already captured receipt or transaction
        const isHoldingAlreadyCaptured = memberReceiptsHeld.some(
          (r) =>
            (h.receiptId && r.id === h.receiptId) ||
            (h.receiptNumber && r.receiptNumber === h.receiptNumber) ||
            (r.amount === h.amount && (r.currency || 'AED').toUpperCase() === (h.currency || 'AED').toUpperCase())
        );
        if (isHoldingAlreadyCaptured) return;
        const cur = (h.currency || 'AED').toUpperCase();
        holdingsByCur[cur] = Number(((holdingsByCur[cur] || 0) + (h.amount || 0)).toFixed(2));
      });

      // Also check stats.cashBreakdown?.receivedByCurrency
      const breakdownByCur = stats.cashBreakdown?.receivedByCurrency || {};

      const memberCurrencyMap: Record<string, number> = {};

      const allCurrencies = Array.from(
        new Set([
          ...Object.keys(receiptsByCur),
          ...Object.keys(txnsByCur),
          ...Object.keys(holdingsByCur),
          ...Object.keys(breakdownByCur),
          ...(member.cashBalances ? Object.keys(member.cashBalances).map((c) => c.toUpperCase()) : []),
        ])
      );

      allCurrencies.forEach((cur) => {
        const rAmt = receiptsByCur[cur] || 0;
        const tAmt = txnsByCur[cur] || 0;
        const hAmt = holdingsByCur[cur] || 0;
        const bAmt = Number(member.cashBalances?.[cur] || member.cashBalances?.[cur.toLowerCase()] || 0);
        const bdAmt = Number(breakdownByCur[cur] || 0);
        // Take maximum verified held amount across all reconciled sources
        const maxHeld = Math.max(rAmt, tAmt, hAmt, bAmt, bdAmt);
        if (maxHeld > 0) {
          memberCurrencyMap[cur] = Number(maxHeld.toFixed(2));
        }
      });

      // Strict Base Formula: convertedTotal = (aedCustodyBalance * fxRateAED) + (inrCustodyBalance * fxRateINR)
      // Single Source of Truth: avoids double-counting from compound additions
      const cashInHand = FinancialLedgerService.calculateCustodianBaseBalance(memberCurrencyMap, inrFxRate);

      if (cashInHand > 0) {
        // Find latest transaction or holding for allocated purpose
        const latestHolding = memberHoldings[0];
        const latestReceipt = memberReceiptsHeld[0];
        const recentTxn = stats.ledgerRows.find((r) => r.debit > 0 || r.credit > 0);

        let allocatedPurpose = 'General Charity Pool';
        let caseId: string | undefined = undefined;
        let caseNumber: string | undefined = undefined;
        let caseTitle: string | undefined = undefined;

        const isHoldingGeneral = latestHolding?.caseTitle?.toLowerCase().includes('monthly contribution') || latestHolding?.caseTitle?.toLowerCase().includes('general fund');
        const isReceiptGeneral = latestReceipt?.contributionType === 'MONTHLY_CONTRIBUTION' || latestReceipt?.caseTitle?.toLowerCase().includes('monthly contribution') || latestReceipt?.caseTitle?.toLowerCase().includes('general fund') || latestReceipt?.purpose?.toLowerCase().includes('monthly contribution') || latestReceipt?.purpose?.toLowerCase().includes('general fund');

        if (latestHolding?.caseId && !isHoldingGeneral) {
          allocatedPurpose = latestHolding.caseTitle || `Case ${latestHolding.caseNumber}`;
          caseId = latestHolding.caseId;
          caseNumber = latestHolding.caseNumber;
          caseTitle = latestHolding.caseTitle;
        } else if (latestReceipt?.caseId && !isReceiptGeneral) {
          allocatedPurpose = latestReceipt.caseTitle || (latestReceipt.caseNumber ? `Case ${latestReceipt.caseNumber}` : 'Charity Case');
          caseId = latestReceipt.caseId;
          caseNumber = latestReceipt.caseNumber;
          caseTitle = latestReceipt.caseTitle;
        } else if (latestReceipt?.purpose) {
          allocatedPurpose = latestReceipt.purpose;
        } else if (latestHolding?.notes) {
          allocatedPurpose = latestHolding.notes;
        } else if (recentTxn?.charityCaseId && !recentTxn.charityCaseName?.toLowerCase().includes('monthly contribution') && !recentTxn.charityCaseName?.toLowerCase().includes('general fund')) {
          allocatedPurpose = recentTxn.charityCaseName || 'Charity Case';
          caseId = recentTxn.charityCaseId;
        } else if (recentTxn?.description) {
          allocatedPurpose = recentTxn.description;
        }

        list.push({
          memberId: member.id,
          memberNumber: member.memberNumber,
          memberName: member.fullName,
          phone: member.mobileNumber,
          cashInHand,
          cashInHandByCurrency: memberCurrencyMap,
          allocatedPurpose,
          caseId,
          caseNumber,
          caseTitle,
          collectionDate: latestHolding?.date || latestReceipt?.receiptDate || recentTxn?.date || new Date().toISOString().slice(0, 10),
          status: 'ACTIVE',
          transactionsCount: stats.transactionsCount,
        });
      }
    });

    const totalCashHeld = list.reduce((sum, item) => sum + item.cashInHand, 0);
    const totalCashHeldByCurrency: Record<string, number> = {};
    list.forEach((item) => {
      if (item.cashInHandByCurrency) {
        Object.entries(item.cashInHandByCurrency).forEach(([cur, amt]) => {
          totalCashHeldByCurrency[cur] = Number(((totalCashHeldByCurrency[cur] || 0) + amt).toFixed(2));
        });
      }
    });

    return {
      custodians: list,
      totalCashHeld: Number(totalCashHeld.toFixed(2)),
      totalCashHeldByCurrency,
      count: list.length,
    };
  }

  /**
   * Single Source of Truth Balance Sheet computation
   */
  static getBalanceSheet(
    allMembers: Member[],
    allCases: CharityCase[],
    allCashAccounts: CashAccount[],
    allTransactions: Transaction[],
    allReceipts: Receipt[],
    allPayments: CharityPayment[],
    allCashHoldings: CashHolding[] = [],
    filters?: {
      year?: string;
      contributionMonth?: string;
      memberId?: string;
      caseId?: string;
      status?: string;
    }
  ): BalanceSheetData {
    // 1. Member balances
    let memberBalances = allMembers.map((m) =>
      this.getMemberFinancials(m, allTransactions, allReceipts, allPayments, allCases)
    );

    // 2. Case balances
    let caseBalances = allCases.map((c) =>
      this.getCaseFinancials(c, allTransactions, allReceipts, allPayments, allMembers)
    );

    // Apply filters if specified
    if (filters?.memberId && filters.memberId !== 'ALL') {
      memberBalances = memberBalances.filter((m) => m.memberId === filters.memberId);
    }
    if (filters?.caseId && filters.caseId !== 'ALL') {
      caseBalances = caseBalances.filter((c) => c.caseId === filters.caseId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      caseBalances = caseBalances.filter((c) => c.status === filters.status);
    }

    // 3. Custodians
    const custodianData = this.getCashCustodians(
      allMembers,
      allTransactions,
      allReceipts,
      allPayments,
      allCases,
      allCashHoldings
    );

    // 4. Bank Balance from active Bank accounts (filter out removed bank accounts: Emirates NBD, Dubai Islamic Bank)
    const validCashAccounts = allCashAccounts.filter((a) => {
      const name = (a.name || '').toLowerCase();
      const bankName = (a.bankName || '').toLowerCase();
      return (
        !name.includes('emirates nbd') &&
        !name.includes('dubai islamic bank') &&
        !bankName.includes('emirates nbd') &&
        !bankName.includes('dubai islamic bank')
      );
    });

    const bankBalance = validCashAccounts
      .filter((a) => a.type === 'Bank' || a.accountCode.startsWith('102'))
      .reduce((sum, a) => {
        const rate = (a as any).exchangeRate || (a.currency === 'INR' ? 0.04401 : 1);
        const baseAmt = convertToBaseCurrency(a.currentBalance || 0, a.currency, rate, 'AED');
        return sum + baseAmt;
      }, 0);

    // Other Cash assets (office safe, etc.)
    const otherCashAssets = validCashAccounts
      .filter((a) => a.type === 'Cash' || a.accountCode.startsWith('101'))
      .reduce((sum, a) => {
        const rate = (a as any).exchangeRate || (a.currency === 'INR' ? 0.04401 : 1);
        const baseAmt = convertToBaseCurrency(a.currentBalance || 0, a.currency, rate, 'AED');
        return sum + baseAmt;
      }, 0);

    // Total Cash Held by Members in base AED
    const cashHeldByMembers = custodianData.totalCashHeld;

    // Cash Available for Charity Cases (Sum of remaining balances of active cases)
    const cashAvailableForCases = caseBalances
      .filter((c) => c.status !== 'CLOSED')
      .reduce((sum, c) => sum + c.remainingBalance, 0);

    const totalAssetsVal = bankBalance + cashHeldByMembers + otherCashAssets;

    // Liabilities
    const pendingCharityCommitments = caseBalances
      .filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS')
      .reduce((sum, c) => sum + Math.max(0, c.targetAmount - c.totalDisbursed), 0);

    const totalLiabilitiesVal = pendingCharityCommitments;
    const netBalanceVal = totalAssetsVal - totalLiabilitiesVal;

    // KPIs
    const validReceipts = allReceipts.filter((r) => isReceiptValid(r.status));
    const validPayments = allPayments.filter((p) => p.status === 'valid');

    const contributionsByCurrency: Record<string, number> = {};
    let totalMemberContributions = 0;
    validReceipts.forEach((r) => {
      const cur = (r.currency || 'AED').toUpperCase();
      contributionsByCurrency[cur] = Number(((contributionsByCurrency[cur] || 0) + (r.amount || 0)).toFixed(2));
      const baseAmt = getHistoricalBaseAmount(r, 'AED');
      totalMemberContributions += baseAmt;
    });

    const charityPaymentsByCurrency: Record<string, number> = {};
    let totalCharityPayments = 0;
    validPayments.forEach((p) => {
      const cur = (p.currency || 'AED').toUpperCase();
      charityPaymentsByCurrency[cur] = Number(((charityPaymentsByCurrency[cur] || 0) + (p.amount || 0)).toFixed(2));
      const baseAmt = getHistoricalBaseAmount(p, 'AED');
      totalCharityPayments += baseAmt;
    });

    const totalActiveCasesCount = allCases.filter((c) => c.status !== 'CLOSED').length;

    return {
      totalAssets: {
        bankBalance: Number(bankBalance.toFixed(2)),
        cashHeldByMembers: Number(cashHeldByMembers.toFixed(2)),
        cashAvailableForCases: Number(cashAvailableForCases.toFixed(2)),
        otherCashAssets: Number(otherCashAssets.toFixed(2)),
        total: Number(totalAssetsVal.toFixed(2)),
        cashHeldByCurrency: custodianData.totalCashHeldByCurrency,
      },
      totalLiabilities: {
        pendingMemberRefunds: 0,
        pendingCharityCommitments: Number(pendingCharityCommitments.toFixed(2)),
        otherOutstandingAmounts: 0,
        total: Number(totalLiabilitiesVal.toFixed(2)),
      },
      netBalance: Number(netBalanceVal.toFixed(2)),
      kpis: {
        totalMemberContributions: Number(totalMemberContributions.toFixed(2)),
        totalCharityPayments: Number(totalCharityPayments.toFixed(2)),
        totalCashHeldByMembers: Number(cashHeldByMembers.toFixed(2)),
        totalCashInBank: Number(bankBalance.toFixed(2)),
        totalOutstandingCaseBalance: Number(cashAvailableForCases.toFixed(2)),
        totalActiveCasesCount,
        contributionsByCurrency,
        charityPaymentsByCurrency,
      },
      memberBalances,
      caseBalances,
    };
  }

  /**
   * Monthly contributions chart series using STRICT Contribution Month (January through December)
   */
  static getMonthlyChartData(
    allReceipts: Receipt[],
    allPayments: CharityPayment[],
    selectedYear: number
  ) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const validReceipts = allReceipts.filter((r) => isReceiptValid(r.status));
    const validPayments = allPayments.filter((p) => p.status === 'valid');

    return monthNames.map((name, idx) => {
      const monthNumStr = String(idx + 1).padStart(2, '0');
      const targetMonthKey = `${selectedYear}-${monthNumStr}`;

      // Strictly filter receipts by CONTRIBUTION MONTH (or periodMonth) and convert to base currency
      const contrib = validReceipts
        .filter((r) => {
          const mKey = normalizeContributionMonthKey(r.contributionMonth || r.periodMonth, r.receiptDate);
          return mKey === targetMonthKey;
        })
        .reduce((sum, r) => {
          const baseAmt = getHistoricalBaseAmount(r, 'AED');
          return sum + baseAmt;
        }, 0);

      // Filter payments by payment date month and convert to base currency
      const disburse = validPayments
        .filter((p) => {
          const pKey = (p.paymentDate || '').slice(0, 7);
          return pKey === targetMonthKey;
        })
        .reduce((sum, p) => {
          const baseAmt = getHistoricalBaseAmount(p, 'AED');
          return sum + baseAmt;
        }, 0);

      return {
        name,
        shortName: name.slice(0, 3),
        monthKey: targetMonthKey,
        Contributions: Number(contrib.toFixed(2)),
        Payments: Number(disburse.toFixed(2)),
        CharityPayments: Number(disburse.toFixed(2)),
        NetSurplus: Number((contrib - disburse).toFixed(2)),
      };
    });
  }

  /**
   * Adapter for MemberLedgerTable component
   */
  static getMemberLedger(
    memberId: string,
    transactions: Transaction[],
    receipts: Receipt[],
    member: Member
  ) {
    const stats = this.getMemberFinancials(member, transactions, receipts, [], []);
    const entries = stats.ledgerRows.map((r) => ({
      id: r.id,
      date: r.date,
      transactionNumber: r.transactionNumber,
      type: r.transactionType,
      contributionMonth: r.contributionMonth,
      purpose: r.charityCaseName || r.description || 'General Contribution',
      fromName: r.from,
      toName: r.to,
      amount: r.amount,
      contributionCredit: r.credit,
      cashInHandImpact: r.credit - r.debit,
      runningCashHeld: r.runningBalance,
      reference: r.reference,
      notes: r.notes,
      receiptId: r.rawReceipt?.id,
      receiptNumber: r.rawReceipt?.receiptNumber,
    }));

    return {
      member,
      totalContributed: stats.totalContributions,
      currentCashInHand: stats.cashCurrentlyHeld,
      totalTransferredOut: stats.transfersSent,
      totalDisbursedToCases: stats.charityPayments,
      entries,
    };
  }

  /**
   * Adapter for CaseLedgerTable component
   */
  static getCharityCaseLedger(
    caseId: string,
    transactions: Transaction[],
    receipts: Receipt[],
    charityCase: CharityCase
  ) {
    const stats = this.getCaseFinancials(charityCase, transactions, receipts, [], []);
    const entries = stats.ledgerRows.map((r) => {
      let impact: 'INFLOW' | 'OUTFLOW' | 'NEUTRAL' = 'NEUTRAL';
      if (r.credit > 0) impact = 'INFLOW';
      else if (r.debit > 0) impact = 'OUTFLOW';

      return {
        id: r.id,
        date: r.date,
        transactionNumber: r.transactionNumber,
        type: r.transactionType,
        impact,
        fromName: r.from,
        toName: r.to,
        description: r.notes || '',
        amount: r.amount,
        runningBalance: r.runningBalance,
        reference: r.paymentReference,
        status: r.status,
      };
    });

    return {
      charityCase,
      targetBudget: stats.targetAmount || charityCase.approvedAmount || charityCase.requestedAmount || 0,
      totalCollected: stats.totalFundsReceived,
      totalDisbursed: stats.totalDisbursed,
      remainingBalance: stats.remainingBalance,
      entries,
    };
  }
}
