/**
 * FINANCIAL REPORTING SERVICE
 * 
 * Provides unified, reconciled calculation engines for:
 * 1. Double-Entry Trial Balance (with GL account codes, categories, opening, period Dr/Cr, and closing balances)
 * 2. Non-Profit Fund Accounting Balance Sheet (Current Assets, Custodian Cash, Restricted Funds, General Surplus)
 * 3. Interactive General Ledger drill-down entries for any account
 * 4. Multi-currency aggregation (AED Base, INR, and Combined)
 */

import {
  Account,
  CashAccount,
  Member,
  CharityCase,
  Transaction,
  Receipt,
  CharityPayment,
  JournalEntry,
  CashHolding,
  OrganizationSettings,
} from '../types';
import { convertToBaseCurrency, formatContributionMonthShort, getHistoricalBaseAmount } from './financialLedgerService';
import { formatCurrency } from '../utils/numbering';

export type CurrencyViewMode = 'AED' | 'INR' | 'COMBINED';

export interface TrialBalanceAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  subCategory: string;
  normalBalance: 'Debit' | 'Credit';
  isCustodianSubAccount?: boolean;
  isCaseSubAccount?: boolean;
  custodianMemberId?: string;
  custodianMemberNumber?: string;
  charityCaseId?: string;
  charityCaseNumber?: string;
  
  // Opening Balance (before fromDate)
  openingDebit: number;
  openingCredit: number;
  netOpeningBalance: number; // positive = normal balance side

  // Period Movements (between fromDate and toDate)
  periodDebit: number;
  periodCredit: number;

  // Closing Balance (as of toDate)
  closingDebit: number;
  closingCredit: number;
  netClosingBalance: number; // positive = normal side

  // Multi-currency auxiliary information
  nativeCurrency?: string;
  nativeBalance?: number;
  nativeDebit?: number;
  nativeCredit?: number;

  // Entries for drill-down modal
  entriesCount: number;
  entries: AccountLedgerEntry[];
}

export interface AccountLedgerEntry {
  id: string;
  date: string;
  entryNumber: string;
  voucherType: 'Receipt' | 'Payment' | 'Transfer' | 'Journal';
  description: string;
  reference?: string;
  counterAccountName: string;
  counterAccountCode?: string;
  memberId?: string;
  memberName?: string;
  memberNumber?: string;
  caseId?: string;
  caseTitle?: string;
  caseNumber?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  currency: string;
  exchangeRate?: number;
  baseCurrencyDebit: number;
  baseCurrencyCredit: number;
  rawTransactionId?: string;
  rawReceiptId?: string;
  rawPaymentId?: string;
}

export interface TrialBalanceResult {
  asOfDate: string;
  fromDate: string;
  toDate: string;
  currencyView: CurrencyViewMode;
  rows: TrialBalanceAccountRow[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  isBalanced: boolean;
  difference: number;
  categoryTotals: Record<
    string,
    { debit: number; credit: number; net: number; count: number }
  >;
}

export interface BalanceSheetAssetItem {
  id: string;
  code: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Custodian' | 'Other';
  custodianMemberId?: string;
  custodianMemberNumber?: string;
  custodianMemberName?: string;
  currency: string;
  originalAmount: number;
  exchangeRate: number;
  baseAmount: number;
  notes?: string;
  entries: AccountLedgerEntry[];
}

export interface BalanceSheetCaseFundItem {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  beneficiaryName: string;
  status: string;
  totalContributionsCollected: number;
  totalAidDisbursed: number;
  remainingFundBalance: number; // Restricted balance awaiting distribution
  currency: string;
  entries: AccountLedgerEntry[];
}

export interface BalanceSheetResult {
  asOfDate: string;
  currencyView: CurrencyViewMode;
  
  // Assets
  currentAssets: {
    treasuryCash: BalanceSheetAssetItem[];
    bankAccounts: BalanceSheetAssetItem[];
    custodianHoldings: BalanceSheetAssetItem[];
    totalTreasuryCash: number;
    totalBankAccounts: number;
    totalCustodianHoldings: number;
    totalCurrentAssets: number;
  };
  totalAssets: number;

  // Liabilities
  currentLiabilities: {
    payables: Array<{
      id: string;
      code: string;
      name: string;
      amount: number;
      entries: AccountLedgerEntry[];
    }>;
    totalCurrentLiabilities: number;
  };
  totalLiabilities: number;

  // Fund Balances (Equity / Net Assets)
  fundBalances: {
    restrictedCaseFunds: BalanceSheetCaseFundItem[];
    totalRestrictedFunds: number;
    generalUnrestrictedMemberFund: {
      totalMemberContributions: number;
      totalDirectDonations: number;
      totalUnrestrictedIncome: number;
      totalGeneralAidDisbursed: number;
      totalAdminBankCharges: number;
      totalUnrestrictedExpenses: number;
      netUnrestrictedSurplus: number;
    };
    totalFundBalances: number;
  };

  // Total Liabilities & Funds
  totalLiabilitiesAndFunds: number;

  // Verification
  isBalanced: boolean;
  difference: number; // Total Assets - Total Liabilities & Funds

  // Custodian Backing Breakdown
  custodianBacking: Array<{
    custodianId: string;
    custodianNumber: string;
    custodianName: string;
    aedAmount: number;
    inrAmount: number;
    totalBaseAmount: number;
    percentageOfLiquidAssets: number;
  }>;
}

export class FinancialReportingService {
  /**
   * Helper to normalize currency amounts according to CurrencyViewMode
   */
  static formatReportAmount(
    baseAEDAmount: number,
    nativeCurrency: string = 'AED',
    nativeAmount?: number,
    mode: CurrencyViewMode = 'AED',
    exchangeRate: number = 0.04401
  ): {
    displayValue: string;
    numericValue: number;
    subText?: string;
  } {
    const inrRate = exchangeRate || 0.04401;

    if (mode === 'INR') {
      const inrVal = nativeCurrency === 'INR' && nativeAmount != null
        ? nativeAmount
        : Number((baseAEDAmount / inrRate).toFixed(2));
      return {
        displayValue: formatCurrency(inrVal, 'INR'),
        numericValue: inrVal,
      };
    }

    if (mode === 'COMBINED') {
      const aedVal = Number(baseAEDAmount.toFixed(2));
      let sub: string | undefined;
      if (nativeCurrency === 'INR' && nativeAmount != null && nativeAmount > 0) {
        sub = `(₹ ${nativeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
      }
      return {
        displayValue: formatCurrency(aedVal, 'AED'),
        numericValue: aedVal,
        subText: sub,
      };
    }

    // Default 'AED'
    const val = Number(baseAEDAmount.toFixed(2));
    return {
      displayValue: formatCurrency(val, 'AED'),
      numericValue: val,
    };
  }

  /**
   * Compute comprehensive Double-Entry Trial Balance
   */
  static getTrialBalance(params: {
    accounts: Account[];
    cashAccounts: CashAccount[];
    members: Member[];
    cases: CharityCase[];
    transactions: Transaction[];
    receipts: Receipt[];
    payments: CharityPayment[];
    journalEntries: JournalEntry[];
    cashHoldings?: CashHolding[];
    fromDate?: string;
    toDate?: string;
    currencyView?: CurrencyViewMode;
    settings?: OrganizationSettings;
  }): TrialBalanceResult {
    const {
      accounts,
      cashAccounts,
      members,
      cases,
      transactions,
      receipts,
      payments,
      journalEntries,
      fromDate = '2026-01-01',
      toDate = new Date().toISOString().slice(0, 10),
      currencyView = 'AED',
    } = params;

    // Filter valid records
    const validReceipts = receipts.filter((r) => r.status === 'valid');
    const validPayments = payments.filter((p) => p.status === 'valid');
    const validTransactions = transactions.filter((t) => t.status === 'valid');
    const validJournals = journalEntries.filter((j) => j.status !== 'VOIDED');

    // Reconcile custodian member balances
    const custodianReceipts = validReceipts.filter((r) => {
      const bankName = (r.cashBankAccountName || '').toLowerCase();
      const hasMemberHolder = r.custodianMemberId || bankName.includes('cash in hand');
      return Boolean(hasMemberHolder);
    });

    // Extract custodians holding cash
    const activeCustodianIds = new Set<string>();
    members.forEach((m) => {
      const mName = (m.fullName || '').toLowerCase().trim();
      const hasReceipt = custodianReceipts.some((r) => {
        if (r.custodianMemberId && r.custodianMemberId === m.id) return true;
        const bName = (r.cashBankAccountName || '').toLowerCase();
        return Boolean(mName && bName.includes(mName));
      });
      const hasTxn = validTransactions.some(
        (t) => (t.custodianId === m.id || t.debitMemberId === m.id) && t.type === 'Cash Transfer'
      );
      const hasBalance = m.cashBalances && Object.values(m.cashBalances).some((v) => Number(v) > 0);
      if (hasReceipt || hasTxn || hasBalance) {
        activeCustodianIds.add(m.id);
      }
    });

    // Build Master Account Registry: Standard Chart of Accounts + Custodians + Case Funds
    const accountMap = new Map<string, TrialBalanceAccountRow>();

    // 1. Standard Accounts
    accounts.forEach((acc) => {
      if (acc.isGroup) return; // Skip folder grouping titles, we only summarize posting accounts
      const normalSide: 'Debit' | 'Credit' =
        acc.type === 'Asset' || acc.type === 'Expense' ? 'Debit' : 'Credit';

      accountMap.set(acc.code, {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        category: acc.type as any,
        subCategory: acc.appModule || `${acc.type} Account`,
        normalBalance: normalSide,
        openingDebit: 0,
        openingCredit: 0,
        netOpeningBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        netClosingBalance: 0,
        entriesCount: 0,
        entries: [],
      });
    });

    // 2. Ensure Key System Accounts exist if missing from custom list
    const defaultAccountsNeeded: Array<{ code: string; name: string; category: TrialBalanceAccountRow['category']; sub: string }> = [
      { code: '1010', name: 'Cash on Hand (Main Treasury)', category: 'Asset', sub: 'Treasury Cash' },
      { code: '1020', name: 'Bank Account (Primary Operational)', category: 'Asset', sub: 'Bank' },
      { code: '1030', name: 'Bank Account (Islamic / Zakat)', category: 'Asset', sub: 'Bank' },
      { code: '2010', name: 'Accounts Payable / Pending Disbursements', category: 'Liability', sub: 'Payables' },
      { code: '3010', name: 'General Member Relief Pool (Accumulated Surplus)', category: 'Equity', sub: 'Unrestricted Funds' },
      { code: '4010', name: 'Monthly Member Contributions', category: 'Income', sub: 'Member Dues' },
      { code: '4020', name: 'Direct Public Donations & General Sadaqah', category: 'Income', sub: 'Public Donations' },
      { code: '4030', name: 'Restricted Charity Case Contributions', category: 'Income', sub: 'Restricted Appeals' },
      { code: '5010', name: 'Direct Financial Aid Disbursements', category: 'Expense', sub: 'Charity Aid' },
      { code: '5020', name: 'Medical & Healthcare Relief Aid', category: 'Expense', sub: 'Healthcare' },
      { code: '6010', name: 'Bank & Administrative Charges', category: 'Expense', sub: 'Administration' },
    ];

    defaultAccountsNeeded.forEach((def) => {
      if (!accountMap.has(def.code)) {
        accountMap.set(def.code, {
          accountId: `sys_${def.code}`,
          accountCode: def.code,
          accountName: def.name,
          category: def.category,
          subCategory: def.sub,
          normalBalance: def.category === 'Asset' || def.category === 'Expense' ? 'Debit' : 'Credit',
          openingDebit: 0,
          openingCredit: 0,
          netOpeningBalance: 0,
          periodDebit: 0,
          periodCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
          netClosingBalance: 0,
          entriesCount: 0,
          entries: [],
        });
      }
    });

    // 3. Add Custodian Sub-Accounts under Assets (GL 1015-*)
    members.forEach((m) => {
      if (activeCustodianIds.has(m.id)) {
        const custCode = `1015-${m.memberNumber}`;
        if (!accountMap.has(custCode)) {
          accountMap.set(custCode, {
            accountId: `cust_${m.id}`,
            accountCode: custCode,
            accountName: `Cash Custodian - ${m.fullName} (${m.memberNumber})`,
            category: 'Asset',
            subCategory: 'Member Cash Custodian',
            normalBalance: 'Debit',
            isCustodianSubAccount: true,
            custodianMemberId: m.id,
            custodianMemberNumber: m.memberNumber,
            openingDebit: 0,
            openingCredit: 0,
            netOpeningBalance: 0,
            periodDebit: 0,
            periodCredit: 0,
            closingDebit: 0,
            closingCredit: 0,
            netClosingBalance: 0,
            entriesCount: 0,
            entries: [],
          });
        }
      }
    });

    // 4. Ingest Journal Lines & Transactions
    // Helper to post an entry into accountMap
    const recordJournalMovement = (
      accountCode: string,
      accountNameFallback: string,
      debitAmt: number,
      creditAmt: number,
      date: string,
      entry: AccountLedgerEntry,
      options?: {
        categoryFallback?: TrialBalanceAccountRow['category'];
        subCategoryFallback?: string;
        nativeCur?: string;
        nativeAmt?: number;
      }
    ) => {
      let row = accountMap.get(accountCode);
      if (!row) {
        // Fallback or create dynamic row
        const cat = options?.categoryFallback || 'Asset';
        row = {
          accountId: `acc_${accountCode}`,
          accountCode,
          accountName: accountNameFallback,
          category: cat,
          subCategory: options?.subCategoryFallback || `${cat} Sub-account`,
          normalBalance: cat === 'Asset' || cat === 'Expense' ? 'Debit' : 'Credit',
          openingDebit: 0,
          openingCredit: 0,
          netOpeningBalance: 0,
          periodDebit: 0,
          periodCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
          netClosingBalance: 0,
          entriesCount: 0,
          entries: [],
        };
        accountMap.set(accountCode, row);
      }

      const isBeforePeriod = date < fromDate;
      const isInPeriod = date >= fromDate && date <= toDate;

      if (isBeforePeriod) {
        row.openingDebit += debitAmt;
        row.openingCredit += creditAmt;
      } else if (isInPeriod) {
        row.periodDebit += debitAmt;
        row.periodCredit += creditAmt;
        row.entries.push(entry);
        row.entriesCount++;
      }

      if (options?.nativeCur) {
        row.nativeCurrency = options.nativeCur;
      }
    };

    // Track processed transaction IDs to avoid double counting
    const processedTxnKeys = new Set<string>();

    // Pass 1: Process valid Journal Entries (the canonical source of double-entry journals)
    validJournals.forEach((j) => {
      const entryDate = j.date || toDate;
      const ref = (j as any).referenceNumber || j.sourceRecordNumber || j.entryNumber;
      processedTxnKeys.add(j.id);
      if (j.sourceRecordNumber) processedTxnKeys.add(j.sourceRecordNumber);
      if ((j as any).referenceNumber) processedTxnKeys.add((j as any).referenceNumber);

      (j.lines || []).forEach((l) => {
        const cur = (l.currency || 'AED').toUpperCase();
        const rate = l.exchangeRate || (cur === 'INR' ? 0.04401 : 1);
        const bDr = l.baseCurrencyDebit != null
          ? l.baseCurrencyDebit
          : convertToBaseCurrency(l.debit || 0, cur, rate, 'AED');
        const bCr = l.baseCurrencyCredit != null
          ? l.baseCurrencyCredit
          : convertToBaseCurrency(l.credit || 0, cur, rate, 'AED');

        // Check if this line is for a member custodian
        let targetCode = l.accountCode;
        let targetName = l.accountName;
        const lineAny = l as any;
        const targetNameLower = (targetName || '').toLowerCase();

        if (lineAny.memberId && (targetCode === '1010' || targetNameLower.includes('cash'))) {
          const m = members.find((mem) => mem.id === lineAny.memberId);
          if (m && activeCustodianIds.has(m.id)) {
            targetCode = `1015-${m.memberNumber}`;
            targetName = `Cash Custodian - ${m.fullName || m.memberNumber} (${m.memberNumber})`;
          }
        }

        const counterLine = j.lines.find((ol) => ol.id !== l.id);
        const ledgerEntry: AccountLedgerEntry = {
          id: l.id,
          date: entryDate,
          entryNumber: j.entryNumber,
          voucherType: 'Journal',
          description: l.description || (j as any).notes || j.description || `Journal Entry ${j.entryNumber}`,
          reference: ref,
          counterAccountName: counterLine?.accountName || 'Journal Adjustment',
          counterAccountCode: counterLine?.accountCode,
          memberId: lineAny.memberId,
          memberName: lineAny.memberName,
          caseId: lineAny.caseId,
          caseTitle: lineAny.caseName || lineAny.caseTitle,
          debit: l.debit || 0,
          credit: l.credit || 0,
          runningBalance: 0,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyDebit: bDr,
          baseCurrencyCredit: bCr,
          rawTransactionId: j.id,
        };

        recordJournalMovement(targetCode, targetName, bDr, bCr, entryDate, ledgerEntry, {
          nativeCur: cur,
        });
      });
    });

    // Pass 2: Reconcile Receipts that may not have generated journal_entries
    validReceipts.forEach((r) => {
      if (processedTxnKeys.has(r.id) || processedTxnKeys.has(r.receiptNumber)) {
        return; // already captured in journals
      }

      const rDate = r.receiptDate || toDate;
      const cur = (r.currency || 'AED').toUpperCase();
      const rate = r.exchangeRateSnapshot?.rate || r.exchangeRate || (cur === 'INR' ? 0.04401 : 1);
      const baseAmt = getHistoricalBaseAmount(r, 'AED');

      // Debit Side: Cash / Custodian Asset
      let drCode = '1010';
      let drName = 'Cash on Hand (Main Treasury)';
      const rBankName = (r.cashBankAccountName || '').toLowerCase();

      if (r.custodianMemberId) {
        const m = members.find((mem) => mem.id === r.custodianMemberId);
        if (m) {
          drCode = `1015-${m.memberNumber}`;
          drName = `Cash Custodian - ${m.fullName || m.memberNumber} (${m.memberNumber})`;
        }
      } else if (rBankName.includes('cash in hand')) {
        const m = members.find((mem) => {
          const fn = (mem.fullName || '').toLowerCase().trim();
          return Boolean(fn && rBankName.includes(fn));
        });
        if (m) {
          drCode = `1015-${m.memberNumber}`;
          drName = `Cash Custodian - ${m.fullName || m.memberNumber} (${m.memberNumber})`;
        }
      } else if (rBankName.includes('bank')) {
        drCode = '1020';
        drName = r.cashBankAccountName || 'Bank Account';
      }

      // Credit Side: Income
      let crCode = '4010';
      let crName = 'Monthly Member Contributions';
      const contribName = (r.contributionAccountName || '').toLowerCase();
      if (r.caseId || r.caseTitle) {
        crCode = '4030';
        crName = `Restricted Charity Case: ${r.caseTitle || r.caseNumber || 'Case Fund'}`;
      } else if (contribName.includes('sadaqah') || contribName.includes('donation')) {
        crCode = '4020';
        crName = 'Direct Public Donations & General Sadaqah';
      }

      const desc = r.notes || `Receipt ${r.receiptNumber} - ${r.memberName}`;

      // Post Debit
      recordJournalMovement(
        drCode,
        drName,
        baseAmt,
        0,
        rDate,
        {
          id: `r_dr_${r.id}`,
          date: rDate,
          entryNumber: r.receiptNumber,
          voucherType: 'Receipt',
          description: desc,
          reference: r.receiptNumber,
          counterAccountName: crName,
          counterAccountCode: crCode,
          memberId: r.memberId,
          memberName: r.memberName,
          memberNumber: r.memberNumber,
          caseId: r.caseId,
          caseTitle: r.caseTitle,
          caseNumber: r.caseNumber,
          debit: r.amount,
          credit: 0,
          runningBalance: 0,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          rawReceiptId: r.id,
        },
        { nativeCur: cur, nativeAmt: r.amount }
      );

      // Post Credit
      recordJournalMovement(
        crCode,
        crName,
        0,
        baseAmt,
        rDate,
        {
          id: `r_cr_${r.id}`,
          date: rDate,
          entryNumber: r.receiptNumber,
          voucherType: 'Receipt',
          description: desc,
          reference: r.receiptNumber,
          counterAccountName: drName,
          counterAccountCode: drCode,
          memberId: r.memberId,
          memberName: r.memberName,
          memberNumber: r.memberNumber,
          caseId: r.caseId,
          caseTitle: r.caseTitle,
          caseNumber: r.caseNumber,
          debit: 0,
          credit: r.amount,
          runningBalance: 0,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          rawReceiptId: r.id,
        },
        { nativeCur: cur, categoryFallback: 'Income' }
      );
    });

    // Pass 3: Reconcile Payments that may not have generated journal_entries
    validPayments.forEach((p) => {
      if (processedTxnKeys.has(p.id) || processedTxnKeys.has(p.paymentNumber)) {
        return; // already captured in journals
      }

      const pDate = p.paymentDate || toDate;
      const cur = (p.currency || 'AED').toUpperCase();
      const rate = p.exchangeRateSnapshot?.rate || p.exchangeRate || (cur === 'INR' ? 0.04401 : 1);
      const baseAmt = getHistoricalBaseAmount(p, 'AED');

      // Debit Side: Expense Account
      let drCode = '5010';
      let drName = 'Direct Financial Aid Disbursements';
      const catLower = (p.charityCategory || '').toLowerCase();
      if (catLower.includes('medical')) {
        drCode = '5020';
        drName = 'Medical & Healthcare Relief Aid';
      } else if (catLower.includes('admin') || p.adminExpenseCategory) {
        drCode = '6010';
        drName = 'Bank & Administrative Charges';
      }

      // Credit Side: Cash Account / Custodian
      let crCode = '1010';
      let crName = 'Cash on Hand (Main Treasury)';
      const pBankLower = (p.cashBankAccountName || '').toLowerCase();
      if (p.paidByMemberId) {
        const m = members.find((mem) => mem.id === p.paidByMemberId);
        if (m) {
          drCode = `1015-${m.memberNumber}`;
          crName = `Cash Custodian - ${m.fullName || m.memberNumber} (${m.memberNumber})`;
        }
      } else if (pBankLower.includes('bank')) {
        crCode = '1020';
        crName = p.cashBankAccountName || 'Bank Account';
      }

      const desc = p.description || `Payment ${p.paymentNumber} to ${p.payeeName}`;

      // Post Debit (Expense)
      recordJournalMovement(
        drCode,
        drName,
        baseAmt,
        0,
        pDate,
        {
          id: `p_dr_${p.id}`,
          date: pDate,
          entryNumber: p.paymentNumber,
          voucherType: 'Payment',
          description: desc,
          reference: p.paymentNumber,
          counterAccountName: crName,
          counterAccountCode: crCode,
          caseId: p.caseId,
          debit: p.amount,
          credit: 0,
          runningBalance: 0,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          rawPaymentId: p.id,
        },
        { categoryFallback: 'Expense', nativeCur: cur }
      );

      // Post Credit (Cash Asset Outflow)
      recordJournalMovement(
        crCode,
        crName,
        0,
        baseAmt,
        pDate,
        {
          id: `p_cr_${p.id}`,
          date: pDate,
          entryNumber: p.paymentNumber,
          voucherType: 'Payment',
          description: desc,
          reference: p.paymentNumber,
          counterAccountName: drName,
          counterAccountCode: drCode,
          caseId: p.caseId,
          debit: 0,
          credit: p.amount,
          runningBalance: 0,
          currency: cur,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          rawPaymentId: p.id,
        },
        { categoryFallback: 'Asset', nativeCur: cur }
      );
    });

    // Pass 4: Calculate Running Balances, Net Closing Balances, and Audit Totals
    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalPeriodDebit = 0;
    let totalPeriodCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    const categoryTotals: Record<string, { debit: number; credit: number; net: number; count: number }> = {
      Asset: { debit: 0, credit: 0, net: 0, count: 0 },
      Liability: { debit: 0, credit: 0, net: 0, count: 0 },
      Equity: { debit: 0, credit: 0, net: 0, count: 0 },
      Income: { debit: 0, credit: 0, net: 0, count: 0 },
      Expense: { debit: 0, credit: 0, net: 0, count: 0 },
    };

    const finalRows: TrialBalanceAccountRow[] = [];

    accountMap.forEach((row) => {
      // Sort entries chronologically
      row.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      // Calculate running balance for drilldown
      let running = row.normalBalance === 'Debit'
        ? row.openingDebit - row.openingCredit
        : row.openingCredit - row.openingDebit;

      row.netOpeningBalance = Number(running.toFixed(2));

      row.entries.forEach((e) => {
        if (row.normalBalance === 'Debit') {
          running += (e.baseCurrencyDebit - e.baseCurrencyCredit);
        } else {
          running += (e.baseCurrencyCredit - e.baseCurrencyDebit);
        }
        e.runningBalance = Number(running.toFixed(2));
      });

      // Total closing debits / credits across all history up to toDate
      const cumDebit = Number((row.openingDebit + row.periodDebit).toFixed(2));
      const cumCredit = Number((row.openingCredit + row.periodCredit).toFixed(2));

      // Closing balance on normal side
      if (row.normalBalance === 'Debit') {
        const net = cumDebit - cumCredit;
        if (net >= 0) {
          row.closingDebit = Number(net.toFixed(2));
          row.closingCredit = 0;
        } else {
          row.closingDebit = 0;
          row.closingCredit = Number(Math.abs(net).toFixed(2));
        }
        row.netClosingBalance = Number(net.toFixed(2));
      } else {
        const net = cumCredit - cumDebit;
        if (net >= 0) {
          row.closingCredit = Number(net.toFixed(2));
          row.closingDebit = 0;
        } else {
          row.closingCredit = 0;
          row.closingDebit = Number(Math.abs(net).toFixed(2));
        }
        row.netClosingBalance = Number(net.toFixed(2));
      }

      // Filter out totally inactive accounts (0 opening, 0 period, 0 closing)
      const hasActivity =
        row.openingDebit !== 0 ||
        row.openingCredit !== 0 ||
        row.periodDebit !== 0 ||
        row.periodCredit !== 0 ||
        row.closingDebit !== 0 ||
        row.closingCredit !== 0;

      if (hasActivity || ['1010', '1020', '3010', '4010', '5010'].includes(row.accountCode)) {
        finalRows.push(row);

        // Accumulate grand totals
        totalOpeningDebit += row.openingDebit;
        totalOpeningCredit += row.openingCredit;
        totalPeriodDebit += row.periodDebit;
        totalPeriodCredit += row.periodCredit;
        totalClosingDebit += row.closingDebit;
        totalClosingCredit += row.closingCredit;

        const cat = categoryTotals[row.category];
        if (cat) {
          cat.debit += row.closingDebit;
          cat.credit += row.closingCredit;
          cat.net += row.netClosingBalance;
          cat.count++;
        }
      }
    });

    // Sort accounts standard accounting order: Assets (1000s) -> Liabilities (2000s) -> Equity (3000s) -> Income (4000s) -> Expenses (5000s+)
    finalRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }));

    const difference = Math.abs(Number((totalClosingDebit - totalClosingCredit).toFixed(2)));
    const isBalanced = difference < 0.05;

    return {
      asOfDate: toDate,
      fromDate,
      toDate,
      currencyView,
      rows: finalRows,
      totalOpeningDebit: Number(totalOpeningDebit.toFixed(2)),
      totalOpeningCredit: Number(totalOpeningCredit.toFixed(2)),
      totalPeriodDebit: Number(totalPeriodDebit.toFixed(2)),
      totalPeriodCredit: Number(totalPeriodCredit.toFixed(2)),
      totalClosingDebit: Number(totalClosingDebit.toFixed(2)),
      totalClosingCredit: Number(totalClosingCredit.toFixed(2)),
      isBalanced,
      difference,
      categoryTotals,
    };
  }

  /**
   * Compute Non-Profit Fund Accounting Balance Sheet (Statement of Financial Position)
   * Formula enforced: Total Assets = Total Liabilities + Total Fund Balances
   */
  static getBalanceSheet(params: {
    accounts: Account[];
    cashAccounts: CashAccount[];
    members: Member[];
    cases: CharityCase[];
    transactions: Transaction[];
    receipts: Receipt[];
    payments: CharityPayment[];
    journalEntries: JournalEntry[];
    cashHoldings?: CashHolding[];
    asOfDate?: string;
    currencyView?: CurrencyViewMode;
  }): BalanceSheetResult {
    const {
      asOfDate = new Date().toISOString().slice(0, 10),
      currencyView = 'AED',
    } = params;

    // Use Trial Balance engine up to asOfDate to guarantee 100% reconciled numbers across both reports
    const tb = this.getTrialBalance({
      ...params,
      fromDate: '2020-01-01',
      toDate: asOfDate,
      currencyView,
    });

    // 1. ASSETS
    const treasuryCash: BalanceSheetAssetItem[] = [];
    const bankAccounts: BalanceSheetAssetItem[] = [];
    const custodianHoldings: BalanceSheetAssetItem[] = [];

    tb.rows
      .filter((r) => r.category === 'Asset')
      .forEach((r) => {
        const bal = r.closingDebit > 0 ? r.closingDebit : -r.closingCredit;
        if (r.isCustodianSubAccount) {
          const m = params.members.find((mem) => mem.id === r.custodianMemberId);
          // Check if custodian holds INR
          const inrHolding = m?.cashBalances?.['INR'] || m?.cashBalances?.['inr'] || 0;
          custodianHoldings.push({
            id: r.accountId,
            code: r.accountCode,
            name: r.accountName,
            type: 'Custodian',
            custodianMemberId: r.custodianMemberId,
            custodianMemberNumber: r.custodianMemberNumber,
            custodianMemberName: m?.fullName || r.accountName,
            currency: inrHolding > 0 ? 'INR' : 'AED',
            originalAmount: inrHolding > 0 ? inrHolding : bal,
            exchangeRate: inrHolding > 0 ? 0.04401 : 1,
            baseAmount: bal,
            notes: inrHolding > 0 ? `Physical cash in India (₹ ${inrHolding.toLocaleString()})` : 'Physical cash custody in UAE',
            entries: r.entries,
          });
        } else if (
          (r.accountCode && (r.accountCode.startsWith('102') || r.accountCode.startsWith('103'))) ||
          (r.accountName && r.accountName.toLowerCase().includes('bank'))
        ) {
          bankAccounts.push({
            id: r.accountId,
            code: r.accountCode,
            name: r.accountName,
            type: 'Bank',
            currency: 'AED',
            originalAmount: bal,
            exchangeRate: 1,
            baseAmount: bal,
            entries: r.entries,
          });
        } else {
          treasuryCash.push({
            id: r.accountId,
            code: r.accountCode,
            name: r.accountName,
            type: 'Cash',
            currency: 'AED',
            originalAmount: bal,
            exchangeRate: 1,
            baseAmount: bal,
            entries: r.entries,
          });
        }
      });

    const totalTreasuryCash = treasuryCash.reduce((sum, i) => sum + i.baseAmount, 0);
    const totalBankAccounts = bankAccounts.reduce((sum, i) => sum + i.baseAmount, 0);
    const totalCustodianHoldings = custodianHoldings.reduce((sum, i) => sum + i.baseAmount, 0);
    const totalAssets = Number((totalTreasuryCash + totalBankAccounts + totalCustodianHoldings).toFixed(2));

    // 2. LIABILITIES
    const payables: BalanceSheetResult['currentLiabilities']['payables'] = [];
    tb.rows
      .filter((r) => r.category === 'Liability')
      .forEach((r) => {
        const bal = r.closingCredit > 0 ? r.closingCredit : -r.closingDebit;
        payables.push({
          id: r.accountId,
          code: r.accountCode,
          name: r.accountName,
          amount: bal,
          entries: r.entries,
        });
      });

    const totalLiabilities = Number(payables.reduce((sum, p) => sum + p.amount, 0).toFixed(2));

    // 3. FUND BALANCES (Restricted Case Funds & General Member Surplus)
    // Compute restricted case balances
    const restrictedCaseFunds: BalanceSheetCaseFundItem[] = [];
    params.cases.forEach((c) => {
      // Contributions collected for this case
      const caseReceipts = params.receipts.filter(
        (r) => r.status === 'valid' && r.caseId === c.id && r.receiptDate <= asOfDate
      );
      const collected = caseReceipts.reduce((sum, r) => {
        return sum + getHistoricalBaseAmount(r, 'AED');
      }, 0);

      // Aid disbursed for this case
      const casePayments = params.payments.filter(
        (p) => p.status === 'valid' && p.caseId === c.id && p.paymentDate <= asOfDate
      );
      const disbursed = casePayments.reduce((sum, p) => {
        return sum + getHistoricalBaseAmount(p, 'AED');
      }, 0);

      const remainingBalance = Number(Math.max(0, collected - disbursed).toFixed(2));

      // Build case entries
      const entries: AccountLedgerEntry[] = [
        ...caseReceipts.map((r) => ({
          id: r.id,
          date: r.receiptDate,
          entryNumber: r.receiptNumber,
          voucherType: 'Receipt' as const,
          description: `Restricted Contribution: ${r.memberName}`,
          counterAccountName: r.cashBankAccountName || 'Treasury Safe',
          memberId: r.memberId,
          memberName: r.memberName,
          caseId: c.id,
          caseTitle: c.title,
          debit: 0,
          credit: r.amount,
          runningBalance: 0,
          currency: r.currency || 'AED',
          baseCurrencyDebit: 0,
          baseCurrencyCredit: r.baseCurrencyAmount || r.amount,
        })),
        ...casePayments.map((p) => ({
          id: p.id,
          date: p.paymentDate,
          entryNumber: p.paymentNumber,
          voucherType: 'Payment' as const,
          description: `Relief Disbursement: ${p.payeeName} (${p.charityCategory})`,
          counterAccountName: p.cashBankAccountName || 'Treasury Safe',
          caseId: c.id,
          caseTitle: c.title,
          debit: p.amount,
          credit: 0,
          runningBalance: 0,
          currency: p.currency || 'AED',
          baseCurrencyDebit: p.baseCurrencyAmount || p.amount,
          baseCurrencyCredit: 0,
        })),
      ];

      entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      if (collected > 0 || disbursed > 0 || c.status !== 'CLOSED') {
        restrictedCaseFunds.push({
          caseId: c.id,
          caseNumber: c.caseNumber,
          caseTitle: c.title,
          beneficiaryName: c.beneficiaryName,
          status: c.status,
          totalContributionsCollected: Number(collected.toFixed(2)),
          totalAidDisbursed: Number(disbursed.toFixed(2)),
          remainingFundBalance: remainingBalance,
          currency: 'AED',
          entries,
        });
      }
    });

    const totalRestrictedFunds = Number(
      restrictedCaseFunds.reduce((sum, cf) => sum + cf.remainingFundBalance, 0).toFixed(2)
    );

    // General Unrestricted Member Fund:
    // Retained surplus from all unrestricted member dues & general public donations minus general aid & admin expenses
    let totalMemberContributions = 0;
    let totalDirectDonations = 0;
    let totalGeneralAidDisbursed = 0;
    let totalAdminBankCharges = 0;

    tb.rows.forEach((r) => {
      if (r.accountCode === '4010') {
        totalMemberContributions = r.closingCredit > 0 ? r.closingCredit : r.netClosingBalance;
      } else if (r.accountCode === '4020' || r.accountCode === '4040') {
        totalDirectDonations += r.closingCredit > 0 ? r.closingCredit : r.netClosingBalance;
      } else if (r.accountCode === '5010' || r.accountCode === '5020' || r.accountCode.startsWith('50')) {
        // Only unrestricted portion
        totalGeneralAidDisbursed += r.closingDebit > 0 ? r.closingDebit : r.netClosingBalance;
      } else if (r.accountCode.startsWith('60')) {
        totalAdminBankCharges += r.closingDebit > 0 ? r.closingDebit : r.netClosingBalance;
      }
    });

    // Under non-profit fund accounting, Restricted Funds are separated:
    // Net Assets = Total Assets - Total Liabilities
    // General Unrestricted Fund = Net Assets - Restricted Funds
    const netAssets = Number((totalAssets - totalLiabilities).toFixed(2));
    const netUnrestrictedSurplus = Number(Math.max(0, netAssets - totalRestrictedFunds).toFixed(2));
    const totalFundBalances = Number((totalRestrictedFunds + netUnrestrictedSurplus).toFixed(2));
    const totalLiabilitiesAndFunds = Number((totalLiabilities + totalFundBalances).toFixed(2));

    const difference = Number((totalAssets - totalLiabilitiesAndFunds).toFixed(2));
    const isBalanced = Math.abs(difference) < 0.05;

    // 4. Custodian Backing Breakdown
    const totalLiquidAssets = totalAssets;
    const custodianBacking = custodianHoldings.map((ch) => {
      const inrAmt = ch.currency === 'INR' ? ch.originalAmount : 0;
      const aedAmt = ch.currency === 'AED' ? ch.originalAmount : 0;
      const pct = totalLiquidAssets > 0 ? Number(((ch.baseAmount / totalLiquidAssets) * 100).toFixed(1)) : 0;

      return {
        custodianId: ch.custodianMemberId || ch.id,
        custodianNumber: ch.custodianMemberNumber || 'MEM',
        custodianName: ch.custodianMemberName || ch.name,
        aedAmount: aedAmt,
        inrAmount: inrAmt,
        totalBaseAmount: ch.baseAmount,
        percentageOfLiquidAssets: pct,
      };
    });

    return {
      asOfDate,
      currencyView,
      currentAssets: {
        treasuryCash,
        bankAccounts,
        custodianHoldings,
        totalTreasuryCash: Number(totalTreasuryCash.toFixed(2)),
        totalBankAccounts: Number(totalBankAccounts.toFixed(2)),
        totalCustodianHoldings: Number(totalCustodianHoldings.toFixed(2)),
        totalCurrentAssets: totalAssets,
      },
      totalAssets,
      currentLiabilities: {
        payables,
        totalCurrentLiabilities: totalLiabilities,
      },
      totalLiabilities,
      fundBalances: {
        restrictedCaseFunds,
        totalRestrictedFunds,
        generalUnrestrictedMemberFund: {
          totalMemberContributions,
          totalDirectDonations,
          totalUnrestrictedIncome: totalMemberContributions + totalDirectDonations,
          totalGeneralAidDisbursed,
          totalAdminBankCharges,
          totalUnrestrictedExpenses: totalGeneralAidDisbursed + totalAdminBankCharges,
          netUnrestrictedSurplus,
        },
        totalFundBalances,
      },
      totalLiabilitiesAndFunds,
      isBalanced,
      difference,
      custodianBacking,
    };
  }
}
