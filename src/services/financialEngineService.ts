/**
 * FinancialEngineService
 * 
 * Centralized Double-Entry Accounting & Transactional Engine.
 * Enforces perfect symmetry across:
 * - Primary Financial Documents (Receipts & Vouchers/Payments)
 * - Double-Entry General Journal Entries (Dr == Cr balanced lines)
 * - Mirrored Audit Transactions
 * - Chart of Accounts Ledgers (Asset, Liability, Equity, Income, Expense)
 * - Physical Custodian Cash Floats (CashHoldings & Member cashBalances)
 * - Charity Case Allocations (collectedAmount & disbursedAmount)
 * - Member Contribution Matrices & Dues
 * 
 * ALL mutations are committed ATOMICALLY via Firestore `writeBatch` to ensure
 * no partial, orphaned, or asymmetric entries ever exist.
 */

import {
  Member,
  CharityCase,
  Account,
  CashAccount,
  Receipt,
  CharityPayment,
  JournalEntry,
  JournalLine,
  Transaction,
  CashHolding,
  AuditLog,
  ExchangeRateSnapshot,
  PaymentMethod,
  ReceiptStatus,
  CharityCategory,
  DisbursementType,
  SplitExpenseConfig,
} from '../types';
import { db, cleanForFirestore } from '../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import {
  getNextReceiptNumber,
  getNextPaymentNumber,
  getNextAdminExpenseNumber,
  getNextJournalNumber,
  getNextTransactionNumber,
} from '../utils/numbering';
import {
  resolveRateAndSnapshot,
} from './accountingService';
import {
  formatContributionMonth,
  formatContributionMonthShort,
} from './financialLedgerService';
import {
  getDefaultAssistanceAccountCode,
  getDefaultAdminExpenseAccountCode,
} from '../utils/defaults';

export interface FinancialEngineContextState {
  activeCharityId: string;
  currency?: string; // Base currency, e.g. 'AED'
  members: Member[];
  cases: CharityCase[];
  accounts: Account[];
  cashAccounts: CashAccount[];
  receipts: Receipt[];
  payments: CharityPayment[];
  transactions: Transaction[];
  journalEntries: JournalEntry[];
  cashHoldings: CashHolding[];
  user?: {
    uid?: string;
    email?: string;
    displayName?: string;
  } | null;
}

export interface AddReceiptInput {
  memberId: string;
  contributionType?: 'MONTHLY_CONTRIBUTION' | 'SPECIAL_CONTRIBUTION';
  periodMonth?: string;
  contributionMonth?: string;
  contributionMonths?: string[];
  monthsCount?: number;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  baseAmount?: number;
  baseCurrency?: string;
  paymentMethod: PaymentMethod;
  cashBankAccountId: string;
  receiptDate?: string;
  referenceNumber?: string;
  notes?: string;
  purpose?: string;
  caseId?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
  status?: ReceiptStatus;
}

export interface AddPaymentVoucherInput {
  payeeName: string;
  mobileNumber?: string;
  address?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  baseAmount?: number;
  baseCurrency?: string;
  paymentMethod: PaymentMethod;
  cashBankAccountId: string;
  paymentDate?: string;
  referenceNumber?: string;
  description?: string;
  caseId?: string;
  charityCategory?: CharityCategory;
  adminExpenseCategory?: string;
  chartOfAccountId?: string;
  disbursementType?: DisbursementType;
  invoiceNumber?: string;
  notes?: string;
  paidByType?: 'CHARITY_ACCOUNT' | 'MEMBER_CUSTODIAN' | 'MEMBER_ADVANCE';
  paidByMemberId?: string;
  paidByMemberName?: string;
  paidByMemberNumber?: string;
  isSplitEvent?: boolean;
  splitExpense?: SplitExpenseConfig;
  approvedBy?: string;
  preparedBy?: string;
  verifiedBy?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
  status?: 'valid' | 'voided';
}

export interface HandoverTransferInput {
  fromType: 'custodian' | 'bank';
  fromId: string;
  toType: 'custodian' | 'bank';
  toId: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  date?: string;
  notes?: string;
  referenceNumber?: string;
  caseId?: string;
  handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
}

export interface AtomicFinancialExecutionResult {
  success: boolean;
  receipt?: Receipt;
  payment?: CharityPayment;
  transaction: Transaction;
  journalEntry: JournalEntry;
  updatedAccounts: Account[];
  updatedCashAccounts: CashAccount[];
  updatedMembers: Member[];
  updatedCases: CharityCase[];
  updatedCashHoldings: CashHolding[];
  reversalJournalEntry?: JournalEntry;
  auditLog: AuditLog;
}

export class FinancialEngineService {
  private static instance: FinancialEngineService;

  public static getInstance(): FinancialEngineService {
    if (!FinancialEngineService.instance) {
      FinancialEngineService.instance = new FinancialEngineService();
    }
    return FinancialEngineService.instance;
  }

  /**
   * Validates that journal entries have balanced debits and credits: sum Dr == sum Cr
   */
  public validateBalance(entries: JournalEntry[]): { isBalanced: boolean; totalDebits: number; totalCredits: number; imbalancedEntries: JournalEntry[] } {
    let totalDebits = 0;
    let totalCredits = 0;
    const imbalancedEntries: JournalEntry[] = [];

    entries.forEach((entry) => {
      if (entry.status === 'VOIDED') return;
      const dr = entry.lines?.reduce((s, l) => s + (l.debit || 0), 0) ?? entry.totalDebit ?? 0;
      const cr = entry.lines?.reduce((s, l) => s + (l.credit || 0), 0) ?? entry.totalCredit ?? 0;
      totalDebits += dr;
      totalCredits += cr;
      if (Math.abs(dr - cr) > 0.009) {
        imbalancedEntries.push(entry);
      }
    });

    return {
      isBalanced: imbalancedEntries.length === 0,
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      imbalancedEntries,
    };
  }

  // Instance wrappers delegating to static methods:
  public async addReceipt(input: AddReceiptInput, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeAddReceipt(input, state);
  }

  public async updateReceipt(receiptId: string, data: Partial<Receipt>, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeUpdateReceipt(receiptId, data, state);
  }

  public async addPaymentVoucher(input: AddPaymentVoucherInput, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeAddPaymentVoucher(input, state);
  }

  public async updatePaymentVoucher(paymentId: string, data: Partial<CharityPayment>, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeUpdatePaymentVoucher(paymentId, data, state);
  }

  public async voidRecord(recordType: 'Receipt' | 'Payment', recordId: string, reason: string, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeVoidRecord(recordType, recordId, reason, state);
  }

  public async transferHandover(input: HandoverTransferInput, state: FinancialEngineContextState): Promise<AtomicFinancialExecutionResult> {
    return FinancialEngineService.executeHandoverTransfer(input, state);
  }

  public async recalculateAllBalances(state: FinancialEngineContextState) {
    return FinancialEngineService.recalculateAllAccountBalancesFromJournals(state.accounts, state.journalEntries);
  }
  /**
   * Helper to resolve standard cash and income/expense accounts
   */
  private static resolveCashAccount(
    cashBankAccountId: string,
    accounts: Account[],
    members: Member[]
  ): { cashAccount: Account; isCustodian: boolean; custodianMember?: Member } {
    const isCustodian = cashBankAccountId?.startsWith('custodian_');
    const custodianMemberId = isCustodian ? cashBankAccountId.replace('custodian_', '') : undefined;
    const custodianMember = custodianMemberId ? members.find((m) => m.id === custodianMemberId) : undefined;

    const baseCashAccount =
      accounts.find((a) => a.id === cashBankAccountId) ||
      accounts.find((a) => a.code === '1010') ||
      accounts.find((a) => a.code === '1000') ||
      accounts[0];

    const cashAccount: Account =
      isCustodian && custodianMember
        ? { ...baseCashAccount, name: `Cash in Hand - ${custodianMember.fullName}` }
        : baseCashAccount;

    return { cashAccount, isCustodian, custodianMember };
  }

  /**
   * 1. ATOMIC EXECUTION: ADD RECEIPT
   * Generates Receipt, Transaction, JournalEntry, updates Accounts (Dr Asset, Cr Income),
   * updates Member totalContributed, updates Case collectedAmount, and updates CashHolding if custodian.
   * Commits all changes in a single Firestore `writeBatch`.
   */
  static async executeAddReceipt(
    input: AddReceiptInput,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, cashAccounts, receipts, transactions, journalEntries, cashHoldings, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const dateOnly = input.receiptDate || now.slice(0, 10);
    const currentUser = user?.email || user?.displayName || 'Finance System';

    // 1. Validation
    const member = members.find((m) => m.id === input.memberId);
    if (!member) throw new Error('Member not found for receipt creation.');
    if (member.status !== 'active') {
      throw new Error(`Cannot record contribution: Member ${member.fullName} (${member.memberNumber}) is inactive.`);
    }
    if (input.amount <= 0) {
      throw new Error('Receipt amount must be greater than zero.');
    }

    // 2. Resolve currency conversion & locked snapshot
    const resolvedRate = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolvedRate.rate;
    const baseAmount = resolvedRate.baseAmount;
    const exchangeRateSnapshot = resolvedRate.snapshot;

    // 3. Resolve accounts
    const isSpecialCase = Boolean(
      (input.contributionType === 'SPECIAL_CONTRIBUTION' || input.caseId) &&
      input.caseId &&
      input.caseId !== 'general' &&
      input.caseId !== ''
    );
    const charityCase = isSpecialCase ? cases.find((c) => c.id === input.caseId) : undefined;

    const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(
      input.cashBankAccountId,
      accounts,
      members
    );

    const incomeAccount = charityCase
      ? (accounts.find((a) => a.code === '4030') || accounts[0])
      : (accounts.find((a) => a.code === '4010') || accounts[0]);

    // 4. Resolve contribution period(s)
    const rawMonths = input.contributionMonths && input.contributionMonths.length > 0
      ? input.contributionMonths
      : [input.periodMonth || input.contributionMonth || dateOnly.slice(0, 7)];
    const monthsList = Array.from(new Set(rawMonths)).sort();
    const monthsCount = monthsList.length;
    const primaryPeriod = monthsList[0];
    const monthsSummary = monthsCount > 1
      ? `${monthsCount} Months: ${monthsList.map((m) => formatContributionMonthShort(m)).join(', ')}`
      : formatContributionMonth(primaryPeriod);

    // 5. Generate unique IDs & numbers
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const receiptNumber = getNextReceiptNumber(receipts, new Date(dateOnly).getFullYear());
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalNumber = getNextJournalNumber(journalEntries, new Date(dateOnly).getFullYear());
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txnNumber = getNextTransactionNumber(transactions, new Date(dateOnly).getFullYear());

    // 6. Build Journal Lines (Debit Asset == Credit Income)
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
        accountType: 'Asset',
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: Cash collection from ${member.fullName} (${monthsSummary})`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: incomeAccount.id,
        accountCode: incomeAccount.code,
        accountName: incomeAccount.name,
        accountType: 'Income',
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Credit: Contribution from ${member.fullName} (${charityCase ? 'Case ' + charityCase.caseNumber : monthsSummary})`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: activeCharityId,
      date: dateOnly,
      description: charityCase
        ? `Special Contribution - Case ${charityCase.caseNumber} (${charityCase.title}) from ${member.fullName}`
        : `Monthly Contribution (${monthsSummary}) - ${member.fullName}`,
      sourceTransactionType: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      sourceRecordId: receiptId,
      sourceRecordNumber: receiptNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: input.status === 'voided' ? 'VOIDED' : 'POSTED',
      createdAt: now,
      createdBy: currentUser,
    };

    // 7. Build Receipt
    const receipt: Receipt = {
      id: receiptId,
      tenantId: activeCharityId,
      receiptNumber,
      receiptDate: dateOnly,
      memberId: member.id,
      memberNumber: member.memberNumber,
      memberName: member.fullName,
      contributionType: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      contributionMonth: primaryPeriod,
      contributionMonths: monthsList,
      monthsCount,
      periodMonth: primaryPeriod,
      purpose: charityCase ? charityCase.title : (input.purpose || input.notes || 'Monthly Member Contribution'),
      caseId: charityCase?.id,
      caseNumber: charityCase?.caseNumber,
      caseTitle: charityCase?.title,
      contributionAccountId: incomeAccount.id,
      contributionAccountCode: incomeAccount.code,
      contributionAccountName: incomeAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: input.cashBankAccountId,
      cashBankAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      custodianMemberId: custodianMember?.id,
      custodianMemberName: custodianMember?.fullName,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      transactionId: txnId,
      journalEntryId: journalId,
      status: input.status || 'valid',
      createdAt: now,
      createdBy: currentUser,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // 8. Build Mirrored Transaction
    const transaction: Transaction = {
      id: txnId,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      transactionNumber: txnNumber,
      date: dateOnly,
      contributionMonth: primaryPeriod,
      contributionMonths: monthsList,
      monthsCount,
      type: 'Member Contribution',
      financialClassification: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      description: charityCase
        ? `Special Contribution - Case ${charityCase.caseNumber} (${charityCase.title}) from ${member.fullName}`
        : `Monthly Contribution (${monthsSummary}) - ${member.fullName}`,
      reference: receiptNumber,
      currency,
      exchangeRate,
      exchangeRateSnapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.memberNumber,
      custodianId: custodianMember?.id,
      custodianName: custodianMember?.fullName,
      fromName: member.fullName,
      toName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      paymentMethod: input.paymentMethod,
      debitAccountId: cashAccount.id,
      debitAccountCode: cashAccount.code,
      debitAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      debitEntityType: isCustodian && custodianMember ? 'member' : undefined,
      debitMemberId: custodianMember?.id,
      debitMemberName: custodianMember?.fullName,
      debitMemberNumber: custodianMember?.memberNumber,
      creditAccountId: incomeAccount.id,
      creditAccountCode: incomeAccount.code,
      creditAccountName: incomeAccount.name,
      creditEntityType: 'member',
      creditMemberId: member.id,
      creditMemberName: member.fullName,
      creditMemberNumber: member.memberNumber,
      amount: input.amount,
      status: input.status === 'voided' ? 'voided' : 'valid',
      linkedReceiptId: receiptId,
      journalEntryId: journalId,
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      purpose: charityCase ? charityCase.title : (input.notes || 'Monthly Member Contribution'),
      createdAt: now,
      createdBy: currentUser,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // 9. Prepare atomic updates to related models
    const batch = writeBatch(db);
    batch.set(doc(db, 'receipts', receipt.id), cleanForFirestore(receipt));
    batch.set(doc(db, 'journal_entries', journalEntry.id), cleanForFirestore(journalEntry));
    batch.set(doc(db, 'transactions', transaction.id), cleanForFirestore(transaction));

    // A. Chart of Accounts balances (Symmetric update: Asset Dr +, Income Cr +)
    const updatedAccounts: Account[] = [];
    const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
    if (cashAccDoc) {
      const newCashBal = Number(((cashAccDoc.balance || 0) + baseAmount).toFixed(2));
      const upCashAcc = { ...cashAccDoc, balance: newCashBal, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newCashBal, updatedAt: now, updatedBy: currentUser });
      updatedAccounts.push(upCashAcc);
    }
    const incAccDoc = accounts.find((a) => a.id === incomeAccount.id);
    if (incAccDoc) {
      const newIncBal = Number(((incAccDoc.balance || 0) + baseAmount).toFixed(2));
      const upIncAcc = { ...incAccDoc, balance: newIncBal, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'accounts', incAccDoc.id), { balance: newIncBal, updatedAt: now, updatedBy: currentUser });
      updatedAccounts.push(upIncAcc);
    }

    // B. Cash Accounts (Bank records if deposited to bank)
    const updatedCashAccounts: CashAccount[] = [];
    if (!isCustodian) {
      const bankRec = cashAccounts.find((c) => c.accountCode === cashAccount.code || c.id === input.cashBankAccountId);
      if (bankRec) {
        const newBankBal = Number(((bankRec.currentBalance || 0) + baseAmount).toFixed(2));
        const upBank = { ...bankRec, currentBalance: newBankBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'cashAccounts', bankRec.id), { currentBalance: newBankBal, updatedAt: now, updatedBy: currentUser });
        updatedCashAccounts.push(upBank);
      }
    }

    // C. Custodian Cash Holding & Float
    const updatedCashHoldings: CashHolding[] = [];
    const updatedMembers: Member[] = [];

    if (isCustodian && custodianMember) {
      const holdingId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newHolding: CashHolding = {
        id: holdingId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        memberId: custodianMember.id,
        memberName: custodianMember.fullName,
        memberNumber: custodianMember.memberNumber,
        donorMemberId: member.id,
        donorMemberName: member.fullName,
        amount: input.amount,
        currency,
        category: charityCase ? 'Charity Case' : 'Monthly Contribution',
        caseId: charityCase?.id,
        caseTitle: charityCase?.title,
        caseNumber: charityCase?.caseNumber,
        date: dateOnly,
        status: 'HELD',
        notes: `Receipt ${receiptNumber} collected from ${member.fullName}`,
        receiptId,
        receiptNumber,
        sourceTransactionId: txnId,
        sourceTransactionNumber: txnNumber,
        createdAt: now,
        createdBy: currentUser,
        updatedAt: now,
        updatedBy: currentUser,
      };
      batch.set(doc(db, 'cashHoldings', holdingId), cleanForFirestore(newHolding));
      updatedCashHoldings.push(newHolding);

      // Update custodian cashBalances
      const custBalances = { ...(custodianMember.cashBalances || {}) };
      custBalances[currency] = Number(((custBalances[currency] || 0) + input.amount).toFixed(2));
      const upCustodian = { ...custodianMember, cashBalances: custBalances, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'members', custodianMember.id), { cashBalances: custBalances, updatedAt: now, updatedBy: currentUser });
      updatedMembers.push(upCustodian);
    }

    // D. Member stats (contributor)
    const newTotalContributed = Number(((member.totalContributed || 0) + baseAmount).toFixed(2));
    const newMonthly = charityCase ? (member.totalMonthlyContributed || 0) : Number(((member.totalMonthlyContributed || 0) + baseAmount).toFixed(2));
    const newSpecial = charityCase ? Number(((member.totalSpecialContributed || 0) + baseAmount).toFixed(2)) : (member.totalSpecialContributed || 0);
    const newReceiptsCount = (member.receiptsCount || 0) + 1;

    const upMember: Member = {
      ...member,
      totalContributed: newTotalContributed,
      totalMonthlyContributed: newMonthly,
      totalSpecialContributed: newSpecial,
      receiptsCount: newReceiptsCount,
      updatedAt: now,
      updatedBy: currentUser,
    };
    batch.update(doc(db, 'members', member.id), {
      totalContributed: newTotalContributed,
      totalMonthlyContributed: newMonthly,
      totalSpecialContributed: newSpecial,
      receiptsCount: newReceiptsCount,
      updatedAt: now,
      updatedBy: currentUser,
    });
    // Add or merge if custodian was same member
    const existingIdx = updatedMembers.findIndex((m) => m.id === member.id);
    if (existingIdx >= 0) {
      updatedMembers[existingIdx] = { ...updatedMembers[existingIdx], ...upMember };
    } else {
      updatedMembers.push(upMember);
    }

    // E. Charity Case stats (if special case)
    const updatedCases: CharityCase[] = [];
    if (charityCase) {
      const newCollected = Number(((charityCase.collectedAmount || 0) + baseAmount).toFixed(2));
      const upCase: CharityCase = {
        ...charityCase,
        collectedAmount: newCollected,
        updatedAt: now,
        updatedBy: currentUser,
      };
      batch.update(doc(db, 'cases', charityCase.id), {
        collectedAmount: newCollected,
        updatedAt: now,
        updatedBy: currentUser,
      });
      updatedCases.push(upCase);
    }

    // F. Audit Log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AuditLog = {
      id: auditLogId,
      timestamp: now,
      userId: user?.uid || 'system',
      userEmail: currentUser,
      action: 'Created',
      entityType: 'Contribution',
      entityId: receiptNumber,
      details: `Atomic Double-Entry Receipt ${receiptNumber} posted: Dr ${cashAccount.name} ${currency} ${input.amount} / Cr ${incomeAccount.name}`,
    };
    batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

    // COMMIT ALL ATOMICALLY
    await batch.commit();

    return {
      success: true,
      receipt,
      transaction,
      journalEntry,
      updatedAccounts,
      updatedCashAccounts,
      updatedMembers,
      updatedCases,
      updatedCashHoldings,
      auditLog,
    };
  }

  /**
   * 2. ATOMIC EXECUTION: UPDATE RECEIPT
   * Evaluates previous vs new state, recalculates differentials across:
   * - Debit Account & Credit Account
   * - Custodian Floats & CashHoldings
   * - Contributor totals & Case collections
   * Commits all changes in a single Firestore `writeBatch`.
   */
  static async executeUpdateReceipt(
    receiptId: string,
    data: Partial<Receipt>,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, cashAccounts, receipts, transactions, journalEntries, cashHoldings, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const currentUser = user?.email || user?.displayName || 'Finance System';

    const existing = receipts.find((r) => r.id === receiptId || r.receiptNumber === receiptId);
    if (!existing) throw new Error('Receipt not found for update.');

    const newMemberId = data.memberId || existing.memberId;
    const member = members.find((m) => m.id === newMemberId);
    if (!member) throw new Error('Member not found for receipt update.');

    const newCaseId = data.caseId !== undefined ? data.caseId : existing.caseId;
    const charityCase = newCaseId && newCaseId !== 'general' && newCaseId !== ''
      ? cases.find((c) => c.id === newCaseId)
      : undefined;

    const newDate = data.receiptDate || existing.receiptDate || now.slice(0, 10);
    const newAmount = Number(data.amount !== undefined ? data.amount : existing.amount);
    if (newAmount <= 0) throw new Error('Receipt amount must be greater than zero.');

    const newCurrency = (data.currency || existing.currency || baseCur).toUpperCase();
    const resolvedRate = resolveRateAndSnapshot(
      newAmount,
      newCurrency,
      baseCur,
      data.exchangeRate !== undefined ? data.exchangeRate : existing.exchangeRate,
      data.exchangeRateSnapshot || existing.exchangeRateSnapshot,
      newDate
    );
    const newRate = resolvedRate.rate;
    const newBaseAmount = resolvedRate.baseAmount;
    const newSnapshot = resolvedRate.snapshot;

    const newCashBankId = data.cashBankAccountId || existing.cashBankAccountId;
    const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(newCashBankId, accounts, members);

    const incomeAccount = charityCase
      ? (accounts.find((a) => a.code === '4030') || accounts[0])
      : (accounts.find((a) => a.code === '4010') || accounts[0]);

    const newPeriod = data.periodMonth || data.contributionMonth || existing.periodMonth || newDate.slice(0, 7);
    const newMonths = data.contributionMonths || existing.contributionMonths || [newPeriod];
    const newStatus = (data.status || existing.status || 'valid') as ReceiptStatus;

    // Build Updated Receipt
    const updatedReceipt: Receipt = {
      ...existing,
      ...data,
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.memberNumber,
      caseId: charityCase?.id,
      caseNumber: charityCase?.caseNumber,
      caseTitle: charityCase?.title,
      contributionType: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      periodMonth: newPeriod,
      contributionMonth: newPeriod,
      contributionMonths: newMonths,
      monthsCount: newMonths.length,
      receiptDate: newDate,
      amount: newAmount,
      currency: newCurrency,
      exchangeRate: newRate,
      exchangeRateSnapshot: newSnapshot,
      baseAmount: newBaseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: newBaseAmount,
      cashBankAccountId: newCashBankId,
      cashBankAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      custodianMemberId: custodianMember?.id,
      custodianMemberName: custodianMember?.fullName,
      status: newStatus,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Find and update linked Transaction
    const existingTxn = transactions.find(
      (t) => t.linkedReceiptId === existing.id || t.reference === existing.receiptNumber || t.id === existing.transactionId
    );
    const txnId = existingTxn?.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txnNumber = existingTxn?.transactionNumber || getNextTransactionNumber(transactions, new Date(newDate).getFullYear());

    const updatedTxn: Transaction = {
      ...(existingTxn || {
        id: txnId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        transactionNumber: txnNumber,
        createdAt: now,
        createdBy: currentUser,
      }),
      date: newDate,
      contributionMonth: newPeriod,
      contributionMonths: newMonths,
      monthsCount: newMonths.length,
      type: 'Member Contribution',
      financialClassification: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      description: charityCase
        ? `Special Contribution - Case ${charityCase.caseNumber} (${charityCase.title}) from ${member.fullName}`
        : `Monthly Contribution (${formatContributionMonth(newPeriod)}) - ${member.fullName}`,
      reference: updatedReceipt.receiptNumber,
      currency: newCurrency,
      exchangeRate: newRate,
      exchangeRateSnapshot: newSnapshot,
      baseAmount: newBaseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: newBaseAmount,
      memberId: member.id,
      memberName: member.fullName,
      memberNumber: member.memberNumber,
      custodianId: custodianMember?.id,
      custodianName: custodianMember?.fullName,
      fromName: member.fullName,
      toName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      paymentMethod: updatedReceipt.paymentMethod,
      debitAccountId: cashAccount.id,
      debitAccountCode: cashAccount.code,
      debitAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      debitEntityType: isCustodian && custodianMember ? 'member' : undefined,
      debitMemberId: custodianMember?.id,
      debitMemberName: custodianMember?.fullName,
      debitMemberNumber: custodianMember?.memberNumber,
      creditAccountId: incomeAccount.id,
      creditAccountCode: incomeAccount.code,
      creditAccountName: incomeAccount.name,
      creditEntityType: 'member',
      creditMemberId: member.id,
      creditMemberName: member.fullName,
      creditMemberNumber: member.memberNumber,
      amount: newAmount,
      status: newStatus === 'voided' ? 'voided' : 'valid',
      linkedReceiptId: updatedReceipt.id,
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      purpose: charityCase ? charityCase.title : (data.notes || 'Monthly Member Contribution'),
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Update JournalEntry
    const journalId = existingTxn?.journalEntryId || existing.journalEntryId || `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingJrnl = journalEntries.find(
      (j) => j.id === journalId || j.sourceRecordId === existing.id || j.sourceRecordNumber === existing.receiptNumber
    );
    const journalNumber = existingJrnl?.entryNumber || getNextJournalNumber(journalEntries, new Date(newDate).getFullYear());

    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
        accountType: 'Asset',
        debit: newAmount,
        credit: 0,
        currency: newCurrency,
        exchangeRate: newRate,
        exchangeRateSnapshot: newSnapshot,
        baseAmount: newBaseAmount,
        baseCurrencyDebit: newBaseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: Cash collection for ${member.fullName}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: incomeAccount.id,
        accountCode: incomeAccount.code,
        accountName: incomeAccount.name,
        accountType: 'Income',
        debit: 0,
        credit: newAmount,
        currency: newCurrency,
        exchangeRate: newRate,
        exchangeRateSnapshot: newSnapshot,
        baseAmount: newBaseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: newBaseAmount,
        description: `Credit: Contribution from ${member.fullName}`,
      },
    ];

    const updatedJrnl: JournalEntry = {
      ...(existingJrnl || {
        id: journalId,
        entryNumber: journalNumber,
        tenantId: activeCharityId,
        createdAt: now,
        createdBy: currentUser,
      }),
      date: newDate,
      description: charityCase
        ? `Special Contribution - Case ${charityCase.caseNumber} (${charityCase.title}) from ${member.fullName}`
        : `Monthly Contribution (${formatContributionMonth(newPeriod)}) - ${member.fullName}`,
      sourceTransactionType: charityCase ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
      sourceRecordId: updatedReceipt.id,
      sourceRecordNumber: updatedReceipt.receiptNumber,
      lines: journalLines,
      totalDebit: newAmount,
      totalCredit: newAmount,
      isBalanced: true,
      status: newStatus === 'voided' ? 'VOIDED' : 'POSTED',
      voidReason: newStatus === 'voided' ? data.voidReason || existing.voidReason || 'Voided by user' : undefined,
      voidedBy: newStatus === 'voided' ? currentUser : undefined,
      voidedAt: newStatus === 'voided' ? now : undefined,
    };

    // Prepare Batch
    const batch = writeBatch(db);
    batch.set(doc(db, 'receipts', updatedReceipt.id), cleanForFirestore(updatedReceipt));
    batch.set(doc(db, 'transactions', updatedTxn.id), cleanForFirestore(updatedTxn));
    batch.set(doc(db, 'journal_entries', updatedJrnl.id), cleanForFirestore(updatedJrnl));

    // Calculate delta on Accounts
    const prevBaseAmount = existing.status === 'voided' ? 0 : (existing.baseCurrencyAmount || existing.amount);
    const activeNewBaseAmount = newStatus === 'voided' ? 0 : newBaseAmount;
    const diff = Number((activeNewBaseAmount - prevBaseAmount).toFixed(2));

    const updatedAccounts: Account[] = [];
    if (diff !== 0) {
      const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
      if (cashAccDoc) {
        const newBal = Number(((cashAccDoc.balance || 0) + diff).toFixed(2));
        const upAcc = { ...cashAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push(upAcc);
      }
      const incAccDoc = accounts.find((a) => a.id === incomeAccount.id);
      if (incAccDoc) {
        const newBal = Number(((incAccDoc.balance || 0) + diff).toFixed(2));
        const upAcc = { ...incAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'accounts', incAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push(upAcc);
      }
    }

    // Custodian Float and CashHolding updates
    const updatedCashHoldings: CashHolding[] = [];
    const updatedMembers: Member[] = [];

    const existingHolding = cashHoldings.find(
      (h) => h.receiptId === existing.id || (existing.receiptNumber && h.receiptNumber === existing.receiptNumber)
    );

    if (isCustodian && custodianMember) {
      const holdingDoc: CashHolding = existingHolding
        ? {
            ...existingHolding,
            memberId: custodianMember.id,
            memberName: custodianMember.fullName,
            memberNumber: custodianMember.memberNumber,
            donorMemberId: member.id,
            donorMemberName: member.fullName,
            amount: newAmount,
            currency: newCurrency,
            caseId: charityCase?.id,
            caseTitle: charityCase?.title,
            caseNumber: charityCase?.caseNumber,
            date: newDate,
            status: newStatus === 'voided' ? 'SETTLED' : 'HELD',
            notes: `Receipt ${updatedReceipt.receiptNumber} collected from ${member.fullName}`,
            updatedAt: now,
            updatedBy: currentUser,
          }
        : {
            id: `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            charityId: activeCharityId,
            tenantId: activeCharityId,
            memberId: custodianMember.id,
            memberName: custodianMember.fullName,
            memberNumber: custodianMember.memberNumber,
            donorMemberId: member.id,
            donorMemberName: member.fullName,
            amount: newAmount,
            currency: newCurrency,
            category: charityCase ? 'Charity Case' : 'Monthly Contribution',
            caseId: charityCase?.id,
            caseTitle: charityCase?.title,
            caseNumber: charityCase?.caseNumber,
            date: newDate,
            status: newStatus === 'voided' ? 'SETTLED' : 'HELD',
            notes: `Receipt ${updatedReceipt.receiptNumber} collected from ${member.fullName}`,
            receiptId: updatedReceipt.id,
            receiptNumber: updatedReceipt.receiptNumber,
            createdAt: now,
            createdBy: currentUser,
            updatedAt: now,
            updatedBy: currentUser,
          };

      batch.set(doc(db, 'cashHoldings', holdingDoc.id), cleanForFirestore(holdingDoc));
      updatedCashHoldings.push(holdingDoc);
    } else if (existingHolding && !isCustodian) {
      // Deposited or moved out of custody
      const settledHolding = { ...existingHolding, status: 'DEPOSITED_TO_BANK' as any, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'cashHoldings', existingHolding.id), { status: 'DEPOSITED_TO_BANK', updatedAt: now, updatedBy: currentUser });
      updatedCashHoldings.push(settledHolding);
    }

    // Contributor recalculation
    const allValidReceipts = receipts
      .map((r) => (r.id === existing.id ? updatedReceipt : r))
      .filter((r) => r.status === 'valid' || r.status === 'received');

    const memberReceipts = allValidReceipts.filter((r) => r.memberId === member.id);
    const totalContributed = Number(memberReceipts.reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0).toFixed(2));
    const upMember: Member = {
      ...member,
      totalContributed,
      receiptsCount: memberReceipts.length,
      updatedAt: now,
      updatedBy: currentUser,
    };
    batch.update(doc(db, 'members', member.id), {
      totalContributed,
      receiptsCount: memberReceipts.length,
      updatedAt: now,
      updatedBy: currentUser,
    });
    updatedMembers.push(upMember);

    // If member changed, update old member too
    if (existing.memberId !== member.id) {
      const oldMem = members.find((m) => m.id === existing.memberId);
      if (oldMem) {
        const oldReceipts = allValidReceipts.filter((r) => r.memberId === oldMem.id);
        const oldTotal = Number(oldReceipts.reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0).toFixed(2));
        const upOldMem = { ...oldMem, totalContributed: oldTotal, receiptsCount: oldReceipts.length, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'members', oldMem.id), {
          totalContributed: oldTotal,
          receiptsCount: oldReceipts.length,
          updatedAt: now,
          updatedBy: currentUser,
        });
        updatedMembers.push(upOldMem);
      }
    }

    // Charity Case recalculation
    const updatedCases: CharityCase[] = [];
    if (charityCase) {
      const caseReceipts = allValidReceipts.filter((r) => r.caseId === charityCase.id);
      const collectedAmount = Number(caseReceipts.reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0).toFixed(2));
      const upCase = { ...charityCase, collectedAmount, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'cases', charityCase.id), { collectedAmount, updatedAt: now, updatedBy: currentUser });
      updatedCases.push(upCase);
    }
    if (existing.caseId && existing.caseId !== charityCase?.id) {
      const oldCase = cases.find((c) => c.id === existing.caseId);
      if (oldCase) {
        const oldCaseReceipts = allValidReceipts.filter((r) => r.caseId === oldCase.id);
        const collectedAmount = Number(oldCaseReceipts.reduce((sum, r) => sum + (r.baseCurrencyAmount || r.amount), 0).toFixed(2));
        const upOldCase = { ...oldCase, collectedAmount, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'cases', oldCase.id), { collectedAmount, updatedAt: now, updatedBy: currentUser });
        updatedCases.push(upOldCase);
      }
    }

    // Audit Log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AuditLog = {
      id: auditLogId,
      timestamp: now,
      userId: user?.uid || 'system',
      userEmail: currentUser,
      action: 'Updated',
      entityType: 'Contribution',
      entityId: updatedReceipt.receiptNumber,
      details: `Atomic Double-Entry Update on Receipt ${updatedReceipt.receiptNumber}: Dr ${cashAccount.name} / Cr ${incomeAccount.name}. Base: ${newBaseAmount} ${baseCur}`,
    };
    batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

    await batch.commit();

    return {
      success: true,
      receipt: updatedReceipt,
      transaction: updatedTxn,
      journalEntry: updatedJrnl,
      updatedAccounts,
      updatedCashAccounts: [],
      updatedMembers,
      updatedCases,
      updatedCashHoldings,
      auditLog,
    };
  }

  /**
   * 3. ATOMIC EXECUTION: ADD PAYMENT VOUCHER
   * Covers Charity Relief Assistance & Administrative Operating Expenses.
   * Posts: Payment, Transaction, JournalEntry (Dr Expense, Cr Cash/Bank/Custodian Asset),
   * updates Case disbursedAmount, updates Custodian cash balance, and updates Account balances symmetrically.
   */
  static async executeAddPaymentVoucher(
    input: AddPaymentVoucherInput,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, cashAccounts, payments, transactions, journalEntries, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const dateOnly = input.paymentDate || now.slice(0, 10);
    const currentUser = user?.email || user?.displayName || 'Finance System';

    if (input.amount <= 0) {
      throw new Error('Payment voucher amount must be greater than zero.');
    }

    const isAdminExpense = input.disbursementType === 'ADMINISTRATIVE_EXPENSE';
    const charityCase = !isAdminExpense && input.caseId ? cases.find((c) => c.id === input.caseId) : undefined;
    if (!isAdminExpense && !charityCase && cases.length > 0) {
      // Default to first case if available
    }

    // Resolve rate and snapshot
    const resolvedRate = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolvedRate.rate;
    const baseAmount = resolvedRate.baseAmount;
    const exchangeRateSnapshot = resolvedRate.snapshot;

    // Resolve accounts
    const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(
      input.cashBankAccountId,
      accounts,
      members
    );

    let expenseAccount: Account;
    if (isAdminExpense) {
      const fallbackAdminCode = getDefaultAdminExpenseAccountCode(input.adminExpenseCategory || '');
      expenseAccount =
        accounts.find((a) => a.id === input.chartOfAccountId) ||
        accounts.find((a) => a.code === fallbackAdminCode) ||
        accounts.find((a) => a.code === '6010') ||
        accounts[0];
    } else {
      const fallbackAssistanceCode = getDefaultAssistanceAccountCode(input.charityCategory || '');
      expenseAccount =
        accounts.find((a) => a.id === input.chartOfAccountId) ||
        accounts.find((a) => a.code === fallbackAssistanceCode) ||
        accounts.find((a) => a.code === '5010') ||
        accounts[0];
    }

    // Numbering & IDs
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const paymentNumber = isAdminExpense
      ? getNextAdminExpenseNumber(payments, new Date(dateOnly).getFullYear())
      : getNextPaymentNumber(payments, new Date(dateOnly).getFullYear(), 'CHARITY_ASSISTANCE');
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalNumber = getNextJournalNumber(journalEntries, new Date(dateOnly).getFullYear());
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txnNumber = getNextTransactionNumber(transactions, new Date(dateOnly).getFullYear());

    // Build Journal Lines (Dr Expense == Cr Asset)
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: expenseAccount.id,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        accountType: 'Expense',
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: ${isAdminExpense ? 'Operating Expense - ' + (input.adminExpenseCategory || '') : 'Charity Relief Aid to ' + input.payeeName}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
        accountType: 'Asset',
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Credit: Disbursed from ${isCustodian && custodianMember ? custodianMember.fullName : cashAccount.name}`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: activeCharityId,
      date: dateOnly,
      description: isAdminExpense
        ? `Operating Expense (${input.adminExpenseCategory || 'Admin'}) paid to ${input.payeeName}`
        : `Charity Relief Aid (${input.charityCategory || 'Relief'}) paid to ${input.payeeName}${charityCase ? ' for Case ' + charityCase.caseNumber : ''}`,
      sourceTransactionType: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      sourceRecordId: paymentId,
      sourceRecordNumber: paymentNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: input.status === 'voided' ? 'VOIDED' : 'POSTED',
      createdAt: now,
      createdBy: currentUser,
    };

    // Build CharityPayment
    const payment: CharityPayment = {
      id: paymentId,
      tenantId: activeCharityId,
      paymentNumber,
      disbursementType: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      paymentDate: dateOnly,
      payeeName: input.payeeName,
      mobileNumber: input.mobileNumber,
      address: input.address,
      caseId: charityCase?.id,
      caseNumber: charityCase?.caseNumber,
      caseTitle: charityCase?.title,
      charityCategory: input.charityCategory || 'Medical Assistance',
      adminExpenseCategory: input.adminExpenseCategory,
      invoiceNumber: input.invoiceNumber,
      chartOfAccountId: expenseAccount.id,
      chartOfAccountCode: expenseAccount.code,
      chartOfAccountName: expenseAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: input.cashBankAccountId,
      cashBankAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      paidByType: isCustodian ? 'MEMBER_CUSTODIAN' : 'CHARITY_ACCOUNT',
      paidByMemberId: custodianMember?.id || input.paidByMemberId,
      paidByMemberName: custodianMember?.fullName || input.paidByMemberName,
      paidByMemberNumber: custodianMember?.memberNumber || input.paidByMemberNumber,
      referenceNumber: input.referenceNumber,
      description: input.description || (isAdminExpense
        ? `Admin Expense (${input.adminExpenseCategory}) paid to ${input.payeeName}`
        : `Charity Relief Aid (${input.charityCategory}) paid to ${input.payeeName}`),
      approvedBy: input.approvedBy || 'Charity Board',
      preparedBy: input.preparedBy || currentUser,
      verifiedBy: input.verifiedBy || 'Audit Committee',
      notes: input.notes,
      isSplitEvent: input.isSplitEvent,
      splitExpense: input.splitExpense,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      transactionId: txnId,
      journalEntryId: journalId,
      status: input.status || 'valid',
      createdAt: now,
      createdBy: currentUser,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Build Transaction
    const transaction: Transaction = {
      id: txnId,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      transactionNumber: txnNumber,
      date: dateOnly,
      contributionMonth: dateOnly.slice(0, 7),
      type: 'Charity Disbursement',
      financialClassification: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      description: payment.description,
      reference: paymentNumber,
      currency,
      exchangeRate,
      exchangeRateSnapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      fromName: isCustodian && custodianMember ? custodianMember.fullName : cashAccount.name,
      toName: input.payeeName,
      paymentMethod: input.paymentMethod,
      debitAccountId: expenseAccount.id,
      debitAccountCode: expenseAccount.code,
      debitAccountName: expenseAccount.name,
      creditAccountId: cashAccount.id,
      creditAccountCode: cashAccount.code,
      creditAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      creditEntityType: isCustodian ? 'member' : 'account',
      creditMemberId: custodianMember?.id,
      creditMemberName: custodianMember?.fullName,
      creditMemberNumber: custodianMember?.memberNumber,
      amount: input.amount,
      status: input.status === 'voided' ? 'voided' : 'valid',
      linkedPaymentId: paymentId,
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      purpose: charityCase ? charityCase.title : (input.notes || payment.description),
      journalEntryId: journalId,
      createdAt: now,
      createdBy: currentUser,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Prepare Batch
    const batch = writeBatch(db);
    batch.set(doc(db, 'payments', payment.id), cleanForFirestore(payment));
    batch.set(doc(db, 'journal_entries', journalEntry.id), cleanForFirestore(journalEntry));
    batch.set(doc(db, 'transactions', transaction.id), cleanForFirestore(transaction));

    // A. Chart of Accounts balances (Symmetric update: Expense Dr +, Cash Asset Cr -)
    const updatedAccounts: Account[] = [];
    const expAccDoc = accounts.find((a) => a.id === expenseAccount.id);
    if (expAccDoc) {
      const newExpBal = Number(((expAccDoc.balance || 0) + baseAmount).toFixed(2));
      const upExp = { ...expAccDoc, balance: newExpBal, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'accounts', expAccDoc.id), { balance: newExpBal, updatedAt: now, updatedBy: currentUser });
      updatedAccounts.push(upExp);
    }
    const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
    if (cashAccDoc) {
      const newCashBal = Number(((cashAccDoc.balance || 0) - baseAmount).toFixed(2));
      const upCash = { ...cashAccDoc, balance: newCashBal, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newCashBal, updatedAt: now, updatedBy: currentUser });
      updatedAccounts.push(upCash);
    }

    // B. Cash Accounts (Bank balance)
    const updatedCashAccounts: CashAccount[] = [];
    if (!isCustodian) {
      const bankRec = cashAccounts.find((c) => c.accountCode === cashAccount.code || c.id === input.cashBankAccountId);
      if (bankRec) {
        const newBankBal = Number(((bankRec.currentBalance || 0) - baseAmount).toFixed(2));
        const upBank = { ...bankRec, currentBalance: newBankBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'cashAccounts', bankRec.id), { currentBalance: newBankBal, updatedAt: now, updatedBy: currentUser });
        updatedCashAccounts.push(upBank);
      }
    }

    // C. Custodian Member cash balance (Deduction from cash in hand)
    const updatedMembers: Member[] = [];
    if (isCustodian && custodianMember) {
      const curBalances = { ...(custodianMember.cashBalances || {}) };
      curBalances[currency] = Math.max(0, Number(((curBalances[currency] || 0) - input.amount).toFixed(2)));
      const upCust = { ...custodianMember, cashBalances: curBalances, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'members', custodianMember.id), { cashBalances: curBalances, updatedAt: now, updatedBy: currentUser });
      updatedMembers.push(upCust);
    }

    // D. Charity Case (Disbursed Amount increase)
    const updatedCases: CharityCase[] = [];
    if (charityCase) {
      const newDisbursed = Number(((charityCase.disbursedAmount || 0) + baseAmount).toFixed(2));
      const upCase = { ...charityCase, disbursedAmount: newDisbursed, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'cases', charityCase.id), { disbursedAmount: newDisbursed, updatedAt: now, updatedBy: currentUser });
      updatedCases.push(upCase);
    }

    // E. Audit Log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AuditLog = {
      id: auditLogId,
      timestamp: now,
      userId: user?.uid || 'system',
      userEmail: currentUser,
      action: 'Created',
      entityType: 'Disbursement',
      entityId: paymentNumber,
      details: `Atomic Double-Entry Payment Voucher ${paymentNumber} posted: Dr ${expenseAccount.name} ${currency} ${input.amount} / Cr ${cashAccount.name}`,
    };
    batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

    await batch.commit();

    return {
      success: true,
      payment,
      transaction,
      journalEntry,
      updatedAccounts,
      updatedCashAccounts,
      updatedMembers,
      updatedCases,
      updatedCashHoldings: [],
      auditLog,
    };
  }

  /**
   * 4. ATOMIC EXECUTION: UPDATE PAYMENT VOUCHER
   * Adjusts differentials across Expense and Cash accounts, updates Case disbursed amounts,
   * updates Custodian float balances, and commits all changes via Firestore `writeBatch`.
   */
  static async executeUpdatePaymentVoucher(
    paymentId: string,
    data: Partial<CharityPayment>,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, cashAccounts, payments, transactions, journalEntries, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const currentUser = user?.email || user?.displayName || 'Finance System';

    const existing = payments.find((p) => p.id === paymentId || p.paymentNumber === paymentId);
    if (!existing) throw new Error('Payment voucher not found for update.');

    const isAdminExpense = (data.disbursementType || existing.disbursementType) === 'ADMINISTRATIVE_EXPENSE';
    const newCaseId = data.caseId !== undefined ? data.caseId : existing.caseId;
    const charityCase = !isAdminExpense && newCaseId ? cases.find((c) => c.id === newCaseId) : undefined;

    const newDate = data.paymentDate || existing.paymentDate || now.slice(0, 10);
    const newAmount = Number(data.amount !== undefined ? data.amount : existing.amount);
    if (newAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    const newCurrency = (data.currency || existing.currency || baseCur).toUpperCase();
    const resolvedRate = resolveRateAndSnapshot(
      newAmount,
      newCurrency,
      baseCur,
      data.exchangeRate !== undefined ? data.exchangeRate : existing.exchangeRate,
      data.exchangeRateSnapshot || existing.exchangeRateSnapshot,
      newDate
    );
    const newRate = resolvedRate.rate;
    const newBaseAmount = resolvedRate.baseAmount;
    const newSnapshot = resolvedRate.snapshot;

    const newCashBankId = data.cashBankAccountId || existing.cashBankAccountId;
    const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(newCashBankId, accounts, members);

    let expenseAccount: Account;
    if (isAdminExpense) {
      const fallbackAdminCode = getDefaultAdminExpenseAccountCode(data.adminExpenseCategory || existing.adminExpenseCategory || '');
      expenseAccount =
        accounts.find((a) => a.id === data.chartOfAccountId) ||
        accounts.find((a) => a.code === fallbackAdminCode) ||
        accounts.find((a) => a.code === '6010') ||
        accounts[0];
    } else {
      const fallbackAssistanceCode = getDefaultAssistanceAccountCode(data.charityCategory || existing.charityCategory || '');
      expenseAccount =
        accounts.find((a) => a.id === data.chartOfAccountId) ||
        accounts.find((a) => a.code === fallbackAssistanceCode) ||
        accounts.find((a) => a.code === '5010') ||
        accounts[0];
    }

    const newStatus = (data.status || existing.status || 'valid') as 'valid' | 'voided';

    // Build Updated Payment
    const updatedPayment: CharityPayment = {
      ...existing,
      ...data,
      caseId: charityCase?.id,
      caseNumber: charityCase?.caseNumber,
      caseTitle: charityCase?.title,
      disbursementType: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      paymentDate: newDate,
      amount: newAmount,
      currency: newCurrency,
      exchangeRate: newRate,
      exchangeRateSnapshot: newSnapshot,
      baseAmount: newBaseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: newBaseAmount,
      chartOfAccountId: expenseAccount.id,
      chartOfAccountCode: expenseAccount.code,
      chartOfAccountName: expenseAccount.name,
      cashBankAccountId: newCashBankId,
      cashBankAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      paidByType: isCustodian ? 'MEMBER_CUSTODIAN' : 'CHARITY_ACCOUNT',
      paidByMemberId: custodianMember?.id || data.paidByMemberId || existing.paidByMemberId,
      paidByMemberName: custodianMember?.fullName || data.paidByMemberName || existing.paidByMemberName,
      paidByMemberNumber: custodianMember?.memberNumber || data.paidByMemberNumber || existing.paidByMemberNumber,
      status: newStatus,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Find and update Transaction
    const existingTxn = transactions.find(
      (t) => t.reference === existing.paymentNumber || t.id === existing.transactionId || t.linkedPaymentId === existing.id
    );
    const txnId = existingTxn?.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txnNumber = existingTxn?.transactionNumber || getNextTransactionNumber(transactions, new Date(newDate).getFullYear());

    const updatedTxn: Transaction = {
      ...(existingTxn || {
        id: txnId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        transactionNumber: txnNumber,
        createdAt: now,
        createdBy: currentUser,
      }),
      date: newDate,
      type: 'Charity Disbursement',
      financialClassification: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      description: updatedPayment.description,
      reference: updatedPayment.paymentNumber,
      currency: newCurrency,
      exchangeRate: newRate,
      exchangeRateSnapshot: newSnapshot,
      baseAmount: newBaseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: newBaseAmount,
      fromName: isCustodian && custodianMember ? custodianMember.fullName : cashAccount.name,
      toName: updatedPayment.payeeName,
      paymentMethod: updatedPayment.paymentMethod,
      debitAccountId: expenseAccount.id,
      debitAccountCode: expenseAccount.code,
      debitAccountName: expenseAccount.name,
      creditAccountId: cashAccount.id,
      creditAccountCode: cashAccount.code,
      creditAccountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
      creditEntityType: isCustodian ? 'member' : 'account',
      creditMemberId: custodianMember?.id,
      creditMemberName: custodianMember?.fullName,
      creditMemberNumber: custodianMember?.memberNumber,
      amount: newAmount,
      status: newStatus === 'voided' ? 'voided' : 'valid',
      linkedPaymentId: updatedPayment.id,
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      updatedAt: now,
      updatedBy: currentUser,
    };

    // Find and update JournalEntry
    const journalId = existing.journalEntryId || existingTxn?.journalEntryId || `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingJrnl = journalEntries.find(
      (j) => j.id === journalId || j.sourceRecordId === existing.id || j.sourceRecordNumber === existing.paymentNumber
    );
    const journalNumber = existingJrnl?.entryNumber || getNextJournalNumber(journalEntries, new Date(newDate).getFullYear());

    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: expenseAccount.id,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        accountType: 'Expense',
        debit: newAmount,
        credit: 0,
        currency: newCurrency,
        exchangeRate: newRate,
        exchangeRateSnapshot: newSnapshot,
        baseAmount: newBaseAmount,
        baseCurrencyDebit: newBaseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: ${isAdminExpense ? 'Operating Expense - ' + (updatedPayment.adminExpenseCategory || '') : 'Charity Relief Aid to ' + updatedPayment.payeeName}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: isCustodian && custodianMember ? `Cash in Hand - ${custodianMember.fullName}` : cashAccount.name,
        accountType: 'Asset',
        debit: 0,
        credit: newAmount,
        currency: newCurrency,
        exchangeRate: newRate,
        exchangeRateSnapshot: newSnapshot,
        baseAmount: newBaseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: newBaseAmount,
        description: `Credit: Disbursed from ${isCustodian && custodianMember ? custodianMember.fullName : cashAccount.name}`,
      },
    ];

    const updatedJrnl: JournalEntry = {
      ...(existingJrnl || {
        id: journalId,
        entryNumber: journalNumber,
        tenantId: activeCharityId,
        createdAt: now,
        createdBy: currentUser,
      }),
      date: newDate,
      description: updatedPayment.description,
      sourceTransactionType: isAdminExpense ? 'ADMINISTRATIVE_EXPENSE' : 'CHARITY_ASSISTANCE',
      sourceRecordId: updatedPayment.id,
      sourceRecordNumber: updatedPayment.paymentNumber,
      lines: journalLines,
      totalDebit: newAmount,
      totalCredit: newAmount,
      isBalanced: true,
      status: newStatus === 'voided' ? 'VOIDED' : 'POSTED',
      voidReason: newStatus === 'voided' ? data.voidReason || existing.voidReason || 'Voided by user' : undefined,
      voidedBy: newStatus === 'voided' ? currentUser : undefined,
      voidedAt: newStatus === 'voided' ? now : undefined,
    };

    // Prepare Batch
    const batch = writeBatch(db);
    batch.set(doc(db, 'payments', updatedPayment.id), cleanForFirestore(updatedPayment));
    batch.set(doc(db, 'transactions', updatedTxn.id), cleanForFirestore(updatedTxn));
    batch.set(doc(db, 'journal_entries', updatedJrnl.id), cleanForFirestore(updatedJrnl));

    // Calculate delta on Accounts
    const prevBaseAmount = existing.status === 'voided' ? 0 : (existing.baseCurrencyAmount || existing.amount);
    const activeNewBaseAmount = newStatus === 'voided' ? 0 : newBaseAmount;
    const diff = Number((activeNewBaseAmount - prevBaseAmount).toFixed(2));

    const updatedAccounts: Account[] = [];
    if (diff !== 0) {
      // Expense increases with positive diff
      const expAccDoc = accounts.find((a) => a.id === expenseAccount.id);
      if (expAccDoc) {
        const newBal = Number(((expAccDoc.balance || 0) + diff).toFixed(2));
        const upAcc = { ...expAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'accounts', expAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push(upAcc);
      }
      // Cash/Asset decreases with positive diff
      const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
      if (cashAccDoc) {
        const newBal = Number(((cashAccDoc.balance || 0) - diff).toFixed(2));
        const upAcc = { ...cashAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push(upAcc);
      }
    }

    // Case Disbursed Amount Recalculation
    const allValidPayments = payments
      .map((p) => (p.id === existing.id ? updatedPayment : p))
      .filter((p) => p.status === 'valid');

    const updatedCases: CharityCase[] = [];
    if (charityCase) {
      const casePayments = allValidPayments.filter((p) => p.caseId === charityCase.id);
      const disbursedAmount = Number(casePayments.reduce((sum, p) => sum + (p.baseCurrencyAmount || p.amount), 0).toFixed(2));
      const upCase = { ...charityCase, disbursedAmount, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'cases', charityCase.id), { disbursedAmount, updatedAt: now, updatedBy: currentUser });
      updatedCases.push(upCase);
    }
    if (existing.caseId && existing.caseId !== charityCase?.id) {
      const oldCase = cases.find((c) => c.id === existing.caseId);
      if (oldCase) {
        const oldPayments = allValidPayments.filter((p) => p.caseId === oldCase.id);
        const disbursedAmount = Number(oldPayments.reduce((sum, p) => sum + (p.baseCurrencyAmount || p.amount), 0).toFixed(2));
        const upOldCase = { ...oldCase, disbursedAmount, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'cases', oldCase.id), { disbursedAmount, updatedAt: now, updatedBy: currentUser });
        updatedCases.push(upOldCase);
      }
    }

    // Audit Log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AuditLog = {
      id: auditLogId,
      timestamp: now,
      userId: user?.uid || 'system',
      userEmail: currentUser,
      action: 'Updated',
      entityType: 'Disbursement',
      entityId: updatedPayment.paymentNumber,
      details: `Atomic Double-Entry Update on Voucher ${updatedPayment.paymentNumber}: Dr ${expenseAccount.name} / Cr ${cashAccount.name}. Base: ${newBaseAmount} ${baseCur}`,
    };
    batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

    await batch.commit();

    return {
      success: true,
      payment: updatedPayment,
      transaction: updatedTxn,
      journalEntry: updatedJrnl,
      updatedAccounts,
      updatedCashAccounts: [],
      updatedMembers: [],
      updatedCases,
      updatedCashHoldings: [],
      auditLog,
    };
  }

  /**
   * 5. ATOMIC EXECUTION: VOID RECORD (RECEIPT OR PAYMENT)
   * Creates an offsetting reversal journal entry, marks the target record and mirrored transaction as voided,
   * rolls back Chart of Accounts, Member stats, Case allocations, and Custodian cash balances in a single atomic batch.
   */
  static async executeVoidRecord(
    recordType: 'Receipt' | 'Payment',
    recordId: string,
    reason: string,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, receipts, payments, transactions, journalEntries, cashHoldings, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const currentUser = user?.email || user?.displayName || 'Finance System';

    if (recordType === 'Receipt') {
      const receipt = receipts.find((r) => r.id === recordId || r.receiptNumber === recordId);
      if (!receipt) throw new Error('Receipt not found to void.');
      if (receipt.status === 'voided') throw new Error('Receipt is already voided.');

      const baseAmt = receipt.baseCurrencyAmount || receipt.amount;
      const currency = receipt.currency || baseCur;
      const rate = receipt.exchangeRate || 1;

      // Find original cash and income accounts
      const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(receipt.cashBankAccountId, accounts, members);
      const charityCase = receipt.caseId ? cases.find((c) => c.id === receipt.caseId) : undefined;
      const incomeAccount = charityCase
        ? (accounts.find((a) => a.code === '4030') || accounts[0])
        : (accounts.find((a) => a.code === '4010') || accounts[0]);

      // Generate Reversal Journal Entry: Dr Income, Cr Cash Asset
      const revJournalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const revJournalNumber = getNextJournalNumber(journalEntries, new Date().getFullYear());
      const revLines: JournalLine[] = [
        {
          id: `line_${revJournalId}_1`,
          journalEntryId: revJournalId,
          accountId: incomeAccount.id,
          accountCode: incomeAccount.code,
          accountName: incomeAccount.name,
          accountType: 'Income',
          debit: receipt.amount,
          credit: 0,
          currency,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          description: `VOID REVERSAL: Cancel contribution income for receipt ${receipt.receiptNumber}`,
        },
        {
          id: `line_${revJournalId}_2`,
          journalEntryId: revJournalId,
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          accountName: cashAccount.name,
          accountType: 'Asset',
          debit: 0,
          credit: receipt.amount,
          currency,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          description: `VOID REVERSAL: Reverse cash intake for receipt ${receipt.receiptNumber}`,
        },
      ];

      const reversalJournalEntry: JournalEntry = {
        id: revJournalId,
        entryNumber: revJournalNumber,
        tenantId: activeCharityId,
        date: now.slice(0, 10),
        description: `REVERSAL of Receipt ${receipt.receiptNumber}: ${reason}`,
        sourceTransactionType: 'REVERSAL',
        sourceRecordId: receipt.id,
        sourceRecordNumber: receipt.receiptNumber,
        lines: revLines,
        totalDebit: receipt.amount,
        totalCredit: receipt.amount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUser,
      };

      const updatedReceipt: Receipt = {
        ...receipt,
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUser,
        voidedAt: now,
        updatedAt: now,
        updatedBy: currentUser,
      };

      const existingTxn = transactions.find(
        (t) => t.linkedReceiptId === receipt.id || t.reference === receipt.receiptNumber || t.id === receipt.transactionId
      );
      const updatedTxn: Transaction = existingTxn
        ? {
            ...existingTxn,
            status: 'voided',
            voidReason: reason,
            voidedBy: currentUser,
            voidedAt: now,
            updatedAt: now,
            updatedBy: currentUser,
          }
        : {
            id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            transactionNumber: getNextTransactionNumber(transactions),
            date: now.slice(0, 10),
            type: 'Reversal',
            amount: receipt.amount,
            currency,
            status: 'voided',
            reference: receipt.receiptNumber,
            description: `Voided Receipt ${receipt.receiptNumber}: ${reason}`,
            fromName: receipt.memberName,
            toName: cashAccount.name,
            debitAccountId: incomeAccount.id,
            debitAccountCode: incomeAccount.code,
            debitAccountName: incomeAccount.name,
            creditAccountId: cashAccount.id,
            creditAccountCode: cashAccount.code,
            creditAccountName: cashAccount.name,
            createdAt: now,
            createdBy: currentUser,
            updatedAt: now,
            updatedBy: currentUser,
          };

      const batch = writeBatch(db);
      batch.set(doc(db, 'journal_entries', reversalJournalEntry.id), cleanForFirestore(reversalJournalEntry));
      batch.update(doc(db, 'receipts', receipt.id), {
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUser,
        voidedAt: now,
        updatedAt: now,
        updatedBy: currentUser,
      });
      if (existingTxn) {
        batch.update(doc(db, 'transactions', existingTxn.id), {
          status: 'voided',
          voidReason: reason,
          voidedBy: currentUser,
          voidedAt: now,
          updatedAt: now,
          updatedBy: currentUser,
        });
      }

      // Revert Chart of Accounts (Deduct Asset, Deduct Income)
      const updatedAccounts: Account[] = [];
      const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
      if (cashAccDoc) {
        const newBal = Number(((cashAccDoc.balance || 0) - baseAmt).toFixed(2));
        batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push({ ...cashAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser });
      }
      const incAccDoc = accounts.find((a) => a.id === incomeAccount.id);
      if (incAccDoc) {
        const newBal = Number(((incAccDoc.balance || 0) - baseAmt).toFixed(2));
        batch.update(doc(db, 'accounts', incAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push({ ...incAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser });
      }

      // Revert Member totalContributed
      const updatedMembers: Member[] = [];
      const member = members.find((m) => m.id === receipt.memberId);
      if (member) {
        const newTotal = Math.max(0, Number(((member.totalContributed || 0) - baseAmt).toFixed(2)));
        const newCount = Math.max(0, (member.receiptsCount || 0) - 1);
        batch.update(doc(db, 'members', member.id), {
          totalContributed: newTotal,
          receiptsCount: newCount,
          updatedAt: now,
          updatedBy: currentUser,
        });
        updatedMembers.push({ ...member, totalContributed: newTotal, receiptsCount: newCount, updatedAt: now, updatedBy: currentUser });
      }

      // Revert Case collectedAmount
      const updatedCases: CharityCase[] = [];
      if (charityCase) {
        const newCollected = Math.max(0, Number(((charityCase.collectedAmount || 0) - baseAmt).toFixed(2)));
        batch.update(doc(db, 'cases', charityCase.id), {
          collectedAmount: newCollected,
          updatedAt: now,
          updatedBy: currentUser,
        });
        updatedCases.push({ ...charityCase, collectedAmount: newCollected, updatedAt: now, updatedBy: currentUser });
      }

      // Revert Custodian cash float
      const updatedCashHoldings: CashHolding[] = [];
      const existingHolding = cashHoldings.find(
        (h) => h.receiptId === receipt.id || (receipt.receiptNumber && h.receiptNumber === receipt.receiptNumber)
      );
      if (existingHolding) {
        batch.update(doc(db, 'cashHoldings', existingHolding.id), {
          status: 'SETTLED',
          notes: `${existingHolding.notes || ''} [VOIDED: ${reason}]`,
          updatedAt: now,
          updatedBy: currentUser,
        });
        updatedCashHoldings.push({ ...existingHolding, status: 'SETTLED', updatedAt: now, updatedBy: currentUser });
      }
      if (isCustodian && custodianMember) {
        const curBalances = { ...(custodianMember.cashBalances || {}) };
        curBalances[currency] = Math.max(0, Number(((curBalances[currency] || 0) - receipt.amount).toFixed(2)));
        batch.update(doc(db, 'members', custodianMember.id), { cashBalances: curBalances, updatedAt: now, updatedBy: currentUser });
        const exIdx = updatedMembers.findIndex((m) => m.id === custodianMember.id);
        if (exIdx >= 0) {
          updatedMembers[exIdx] = { ...updatedMembers[exIdx], cashBalances: curBalances };
        } else {
          updatedMembers.push({ ...custodianMember, cashBalances: curBalances });
        }
      }

      // Audit Log
      const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const auditLog: AuditLog = {
        id: auditLogId,
        timestamp: now,
        userId: user?.uid || 'system',
        userEmail: currentUser,
        action: 'Voided',
        entityType: 'Contribution',
        entityId: receipt.receiptNumber,
        details: `Voided Receipt ${receipt.receiptNumber}: ${reason}. Reversal journal ${revJournalNumber} posted.`,
      };
      batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

      await batch.commit();

      return {
        success: true,
        receipt: updatedReceipt,
        transaction: updatedTxn,
        journalEntry: reversalJournalEntry,
        reversalJournalEntry,
        updatedAccounts,
        updatedCashAccounts: [],
        updatedMembers,
        updatedCases,
        updatedCashHoldings,
        auditLog,
      };
    } else {
      // Voiding Payment Voucher
      const payment = payments.find((p) => p.id === recordId || p.paymentNumber === recordId);
      if (!payment) throw new Error('Payment voucher not found to void.');
      if (payment.status === 'voided') throw new Error('Payment voucher is already voided.');

      const baseAmt = payment.baseCurrencyAmount || payment.amount;
      const currency = payment.currency || baseCur;
      const rate = payment.exchangeRate || 1;

      const { cashAccount, isCustodian, custodianMember } = this.resolveCashAccount(payment.cashBankAccountId, accounts, members);
      const charityCase = payment.caseId ? cases.find((c) => c.id === payment.caseId) : undefined;
      const expenseAccount = accounts.find((a) => a.id === payment.chartOfAccountId) || accounts[0];

      // Reversal Journal: Dr Cash Asset, Cr Expense
      const revJournalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const revJournalNumber = getNextJournalNumber(journalEntries, new Date().getFullYear());
      const revLines: JournalLine[] = [
        {
          id: `line_${revJournalId}_1`,
          journalEntryId: revJournalId,
          accountId: cashAccount.id,
          accountCode: cashAccount.code,
          accountName: cashAccount.name,
          accountType: 'Asset',
          debit: payment.amount,
          credit: 0,
          currency,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          description: `VOID REVERSAL: Restore cash from voided voucher ${payment.paymentNumber}`,
        },
        {
          id: `line_${revJournalId}_2`,
          journalEntryId: revJournalId,
          accountId: expenseAccount.id,
          accountCode: expenseAccount.code,
          accountName: expenseAccount.name,
          accountType: 'Expense',
          debit: 0,
          credit: payment.amount,
          currency,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          description: `VOID REVERSAL: Reverse expense from voided voucher ${payment.paymentNumber}`,
        },
      ];

      const reversalJournalEntry: JournalEntry = {
        id: revJournalId,
        entryNumber: revJournalNumber,
        tenantId: activeCharityId,
        date: now.slice(0, 10),
        description: `REVERSAL of Voucher ${payment.paymentNumber}: ${reason}`,
        sourceTransactionType: 'REVERSAL',
        sourceRecordId: payment.id,
        sourceRecordNumber: payment.paymentNumber,
        lines: revLines,
        totalDebit: payment.amount,
        totalCredit: payment.amount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUser,
      };

      const updatedPayment: CharityPayment = {
        ...payment,
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUser,
        voidedAt: now,
        updatedAt: now,
        updatedBy: currentUser,
      };

      const existingTxn = transactions.find(
        (t) => t.reference === payment.paymentNumber || t.id === payment.transactionId || t.linkedPaymentId === payment.id
      );
      const updatedTxn: Transaction = existingTxn
        ? {
            ...existingTxn,
            status: 'voided',
            voidReason: reason,
            voidedBy: currentUser,
            voidedAt: now,
            updatedAt: now,
            updatedBy: currentUser,
          }
        : {
            id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            transactionNumber: getNextTransactionNumber(transactions),
            date: now.slice(0, 10),
            type: 'Reversal',
            amount: payment.amount,
            currency,
            status: 'voided',
            reference: payment.paymentNumber,
            description: `Voided Voucher ${payment.paymentNumber}: ${reason}`,
            fromName: cashAccount.name,
            toName: payment.payeeName,
            debitAccountId: cashAccount.id,
            debitAccountCode: cashAccount.code,
            debitAccountName: cashAccount.name,
            creditAccountId: expenseAccount.id,
            creditAccountCode: expenseAccount.code,
            creditAccountName: expenseAccount.name,
            createdAt: now,
            createdBy: currentUser,
            updatedAt: now,
            updatedBy: currentUser,
          };

      const batch = writeBatch(db);
      batch.set(doc(db, 'journal_entries', reversalJournalEntry.id), cleanForFirestore(reversalJournalEntry));
      batch.update(doc(db, 'payments', payment.id), {
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUser,
        voidedAt: now,
        updatedAt: now,
        updatedBy: currentUser,
      });
      if (existingTxn) {
        batch.update(doc(db, 'transactions', existingTxn.id), {
          status: 'voided',
          voidReason: reason,
          voidedBy: currentUser,
          voidedAt: now,
          updatedAt: now,
          updatedBy: currentUser,
        });
      }

      // Revert Accounts (Add back Cash, Deduct Expense)
      const updatedAccounts: Account[] = [];
      const cashAccDoc = accounts.find((a) => a.id === cashAccount.id);
      if (cashAccDoc) {
        const newBal = Number(((cashAccDoc.balance || 0) + baseAmt).toFixed(2));
        batch.update(doc(db, 'accounts', cashAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push({ ...cashAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser });
      }
      const expAccDoc = accounts.find((a) => a.id === expenseAccount.id);
      if (expAccDoc) {
        const newBal = Math.max(0, Number(((expAccDoc.balance || 0) - baseAmt).toFixed(2)));
        batch.update(doc(db, 'accounts', expAccDoc.id), { balance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedAccounts.push({ ...expAccDoc, balance: newBal, updatedAt: now, updatedBy: currentUser });
      }

      // Revert Case disbursedAmount
      const updatedCases: CharityCase[] = [];
      if (charityCase) {
        const newDisbursed = Math.max(0, Number(((charityCase.disbursedAmount || 0) - baseAmt).toFixed(2)));
        batch.update(doc(db, 'cases', charityCase.id), { disbursedAmount: newDisbursed, updatedAt: now, updatedBy: currentUser });
        updatedCases.push({ ...charityCase, disbursedAmount: newDisbursed, updatedAt: now, updatedBy: currentUser });
      }

      // Revert Custodian cash balance if paid by custodian
      const updatedMembers: Member[] = [];
      if (isCustodian && custodianMember) {
        const curBalances = { ...(custodianMember.cashBalances || {}) };
        curBalances[currency] = Number(((curBalances[currency] || 0) + payment.amount).toFixed(2));
        batch.update(doc(db, 'members', custodianMember.id), { cashBalances: curBalances, updatedAt: now, updatedBy: currentUser });
        updatedMembers.push({ ...custodianMember, cashBalances: curBalances, updatedAt: now, updatedBy: currentUser });
      }

      // Audit Log
      const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const auditLog: AuditLog = {
        id: auditLogId,
        timestamp: now,
        userId: user?.uid || 'system',
        userEmail: currentUser,
        action: 'Voided',
        entityType: 'Disbursement',
        entityId: payment.paymentNumber,
        details: `Voided Voucher ${payment.paymentNumber}: ${reason}. Reversal journal ${revJournalNumber} posted.`,
      };
      batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

      await batch.commit();

      return {
        success: true,
        payment: updatedPayment,
        transaction: updatedTxn,
        journalEntry: reversalJournalEntry,
        reversalJournalEntry,
        updatedAccounts,
        updatedCashAccounts: [],
        updatedMembers,
        updatedCases,
        updatedCashHoldings: [],
        auditLog,
      };
    }
  }

  /**
   * 6. ATOMIC RECALCULATION & FULL SYSTEM RECONCILIATION
   * Derives exact account balances directly from all valid posted journal entries.
   * Guarantees that Total Assets - Total Liabilities == Total Equity + Total Income - Total Expenses.
   */
  static recalculateAllAccountBalancesFromJournals(
    accounts: Account[],
    journalEntries: JournalEntry[]
  ): { updatedAccounts: Account[]; totalDebits: number; totalCredits: number; isSystemBalanced: boolean } {
    const validJournals = journalEntries.filter((j) => j.status === 'POSTED');
    const runningBalances: Record<string, { debits: number; credits: number }> = {};

    accounts.forEach((acc) => {
      runningBalances[acc.id] = { debits: 0, credits: 0 };
    });

    let totalDebits = 0;
    let totalCredits = 0;

    validJournals.forEach((j) => {
      j.lines.forEach((line) => {
        const debit = line.baseCurrencyDebit || line.debit || 0;
        const credit = line.baseCurrencyCredit || line.credit || 0;
        totalDebits += debit;
        totalCredits += credit;

        if (runningBalances[line.accountId]) {
          runningBalances[line.accountId].debits += debit;
          runningBalances[line.accountId].credits += credit;
        } else {
          // Account might be referenced by code instead of ID
          const accByCode = accounts.find((a) => a.code === line.accountCode);
          if (accByCode && runningBalances[accByCode.id]) {
            runningBalances[accByCode.id].debits += debit;
            runningBalances[accByCode.id].credits += credit;
          }
        }
      });
    });

    const updatedAccounts: Account[] = accounts.map((acc) => {
      const stats = runningBalances[acc.id] || { debits: 0, credits: 0 };
      let newBalance = 0;

      // Double-entry normal balance calculation
      switch (acc.type) {
        case 'Asset':
        case 'Expense':
          newBalance = Number((stats.debits - stats.credits).toFixed(2));
          break;
        case 'Liability':
        case 'Fund/Equity':
        case 'Income':
          newBalance = Number((stats.credits - stats.debits).toFixed(2));
          break;
        default:
          newBalance = Number((stats.debits - stats.credits).toFixed(2));
      }

      return {
        ...acc,
        balance: newBalance,
      };
    });

    const isSystemBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return {
      updatedAccounts,
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      isSystemBalanced,
    };
  }

  /**
   * 7. ATOMIC EXECUTION: HANDOVER / CASH TRANSFER
   * Transfers cash float between custodians, or deposits cash into bank.
   * Generates: DR Destination Asset, CR Source Asset.
   * Commits all changes in a single Firestore `writeBatch`.
   */
  static async executeHandoverTransfer(
    input: HandoverTransferInput,
    state: FinancialEngineContextState
  ): Promise<AtomicFinancialExecutionResult> {
    const { activeCharityId, members, cases, accounts, cashAccounts, transactions, journalEntries, user } = state;
    const baseCur = state.currency || 'AED';
    const now = new Date().toISOString();
    const dateOnly = input.date || now.slice(0, 10);
    const currentUser = user?.email || user?.displayName || 'Finance System';

    if (input.amount <= 0) {
      throw new Error('Handover amount must be greater than zero.');
    }

    const resolvedRate = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      undefined,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolvedRate.rate;
    const baseAmount = resolvedRate.baseAmount;
    const exchangeRateSnapshot = resolvedRate.snapshot;

    const fromMember = input.fromType === 'custodian' ? members.find((m) => m.id === input.fromId) : undefined;
    const toMember = input.toType === 'custodian' ? members.find((m) => m.id === input.toId) : undefined;
    const fromCashAcc = input.fromType === 'bank' ? (cashAccounts.find((c) => c.id === input.fromId) || accounts.find((a) => a.id === input.fromId)) : undefined;
    const toCashAcc = input.toType === 'bank' ? (cashAccounts.find((c) => c.id === input.toId) || accounts.find((a) => a.id === input.toId)) : undefined;

    const fromName = fromMember ? fromMember.fullName : (fromCashAcc?.name || 'Source Account');
    const toName = toMember ? toMember.fullName : (toCashAcc?.name || 'Destination Account');

    const charityCase = input.caseId ? cases.find((c) => c.id === input.caseId) : undefined;

    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txnNumber = getNextTransactionNumber(transactions, new Date(dateOnly).getFullYear());
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalNumber = getNextJournalNumber(journalEntries, new Date(dateOnly).getFullYear());

    const isBankDeposit = input.toType === 'bank';
    const txnType = isBankDeposit ? 'Bank Deposit' : 'Cash Transfer';
    const desc = input.notes || `Cash Handover of ${currency} ${input.amount} from ${fromName} to ${toName}${charityCase ? ' for Case ' + charityCase.caseNumber : ''}`;

    // Debit Account: To Asset
    const toGLAccount = accounts.find((a) => a.id === input.toId || a.code === (isBankDeposit ? '1020' : '1010')) || accounts[0];
    // Credit Account: From Asset
    const fromGLAccount = accounts.find((a) => a.id === input.fromId || a.code === '1010') || accounts[0];

    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: toGLAccount.id,
        accountCode: toGLAccount.code,
        accountName: toMember ? `Cash in Hand - ${toMember.fullName}` : toGLAccount.name,
        accountType: 'Asset',
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: Received by ${toName} [${currency} ${input.amount}]`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: fromGLAccount.id,
        accountCode: fromGLAccount.code,
        accountName: fromMember ? `Cash in Hand - ${fromMember.fullName}` : fromGLAccount.name,
        accountType: 'Asset',
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Credit: Handed over by ${fromName} [${currency} ${input.amount}]`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: activeCharityId,
      date: dateOnly,
      description: desc,
      sourceTransactionType: isBankDeposit ? 'INTERNAL_TRANSFER' : 'MEMBER_HANDOVER',
      sourceRecordId: txnId,
      sourceRecordNumber: txnNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: currentUser,
    };

    const transaction: Transaction = {
      id: txnId,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      transactionNumber: txnNumber,
      date: dateOnly,
      type: txnType,
      financialClassification: 'MONTHLY_CONTRIBUTION',
      description: desc,
      notes: input.notes,
      reference: input.referenceNumber || `HO-${dateOnly.replace(/-/g, '')}`,
      currency,
      exchangeRate,
      exchangeRateSnapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      fromName,
      toName,
      debitAccountId: toGLAccount.id,
      debitAccountCode: toGLAccount.code,
      debitAccountName: toName,
      debitEntityType: input.toType === 'custodian' ? 'member' : 'account',
      debitMemberId: toMember?.id,
      debitMemberName: toMember?.fullName,
      debitMemberNumber: toMember?.memberNumber,
      creditAccountId: fromGLAccount.id,
      creditAccountCode: fromGLAccount.code,
      creditAccountName: fromName,
      creditEntityType: input.fromType === 'custodian' ? 'member' : 'account',
      creditMemberId: fromMember?.id,
      creditMemberName: fromMember?.fullName,
      creditMemberNumber: fromMember?.memberNumber,
      amount: input.amount,
      status: 'valid',
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      journalEntryId: journalEntry.id,
      createdAt: now,
      createdBy: currentUser,
      updatedAt: now,
      updatedBy: currentUser,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'transactions', txnId), cleanForFirestore(transaction));
    batch.set(doc(db, 'journal_entries', journalId), cleanForFirestore(journalEntry));

    // Update Members' cashBalances
    const updatedMembers: Member[] = [];
    if (fromMember) {
      const fromBalances = { ...(fromMember.cashBalances || {}) };
      fromBalances[currency] = Math.max(0, Number(((fromBalances[currency] || 0) - input.amount).toFixed(2)));
      const upFrom = { ...fromMember, cashBalances: fromBalances, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'members', fromMember.id), { cashBalances: fromBalances, updatedAt: now, updatedBy: currentUser });
      updatedMembers.push(upFrom);
    }
    if (toMember) {
      const toBalances = { ...(toMember.cashBalances || {}) };
      toBalances[currency] = Number(((toBalances[currency] || 0) + input.amount).toFixed(2));
      const upTo = { ...toMember, cashBalances: toBalances, updatedAt: now, updatedBy: currentUser };
      batch.update(doc(db, 'members', toMember.id), { cashBalances: toBalances, updatedAt: now, updatedBy: currentUser });
      const exIdx = updatedMembers.findIndex((m) => m.id === toMember.id);
      if (exIdx >= 0) {
        updatedMembers[exIdx] = { ...updatedMembers[exIdx], ...upTo };
      } else {
        updatedMembers.push(upTo);
      }
    }

    // Update Bank Account if deposited
    const updatedCashAccounts: CashAccount[] = [];
    if (isBankDeposit && toCashAcc) {
      const bankRec = cashAccounts.find((c) => c.id === toCashAcc.id);
      if (bankRec) {
        const newBal = Number(((bankRec.currentBalance || 0) + baseAmount).toFixed(2));
        const upBank = { ...bankRec, currentBalance: newBal, updatedAt: now, updatedBy: currentUser };
        batch.update(doc(db, 'cashAccounts', bankRec.id), { currentBalance: newBal, updatedAt: now, updatedBy: currentUser });
        updatedCashAccounts.push(upBank);
      }
    }

    // Audit Log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const auditLog: AuditLog = {
      id: auditLogId,
      timestamp: now,
      userId: user?.uid || 'system',
      userEmail: currentUser,
      action: 'Created',
      entityType: 'Transfer',
      entityId: txnNumber,
      details: `Atomic Handover Transfer ${txnNumber}: ${fromName} -> ${toName} (${currency} ${input.amount})`,
    };
    batch.set(doc(db, 'auditLogs', auditLogId), cleanForFirestore(auditLog));

    await batch.commit();

    return {
      success: true,
      transaction,
      journalEntry,
      updatedAccounts: [],
      updatedCashAccounts,
      updatedMembers,
      updatedCases: [],
      updatedCashHoldings: [],
      auditLog,
    };
  }
}
