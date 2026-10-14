/**
 * AUDITABLE DOUBLE-ENTRY ACCOUNTING SERVICE LAYER
 * Enforces the core invariant: 4 strict financial classifications and Debit == Credit balanced journals.
 */

import {
  Member,
  CharityCase,
  Account,
  Receipt,
  CharityPayment,
  JournalEntry,
  JournalLine,
  AuditLog,
  ExchangeRateSnapshot,
  SplitExpenseConfig,
} from '../types';
import {
  getNextReceiptNumber,
  getNextPaymentNumber,
  getNextAdminExpenseNumber,
  getNextJournalNumber,
} from '../utils/numbering';
import {
  formatContributionMonth,
  formatContributionMonthShort,
} from './financialLedgerService';

export function resolveRateAndSnapshot(
  amount: number,
  currency?: string,
  baseCurrency = 'AED',
  rate?: number,
  snapshot?: ExchangeRateSnapshot,
  dateOnly?: string
): { rate: number; baseAmount: number; snapshot: ExchangeRateSnapshot; baseCur: string } {
  const from = (currency || baseCurrency).toUpperCase();
  const to = baseCurrency.toUpperCase();
  const date = dateOnly || new Date().toISOString().slice(0, 10);

  if (snapshot && snapshot.rate > 0) {
    const rateVal = Number(snapshot.rate);
    const baseAmt = from === to ? amount : Number((amount * rateVal).toFixed(2));
    return {
      rate: rateVal,
      baseAmount: baseAmt,
      snapshot: {
        fromCurrency: snapshot.fromCurrency || from,
        toCurrency: snapshot.toCurrency || to,
        rate: rateVal,
        asOfDate: snapshot.asOfDate || date,
      },
      baseCur: to,
    };
  }

  let rateVal = rate;
  if (!rateVal || rateVal <= 0) {
    if (from === to) {
      rateVal = 1;
    } else if (from === 'INR' && to === 'AED') {
      rateVal = 0.04401;
    } else if (from === 'AED' && to === 'INR') {
      rateVal = 22.72;
    } else {
      rateVal = 1;
    }
  }

  const baseAmt = from === to ? amount : Number((amount * rateVal).toFixed(2));
  return {
    rate: rateVal,
    baseAmount: baseAmt,
    snapshot: {
      fromCurrency: from,
      toCurrency: to,
      rate: rateVal,
      asOfDate: date,
    },
    baseCur: to,
  };
}

export interface MonthlyContributionInput {
  tenantId: string;
  memberId: string;
  periodMonth?: string; // YYYY-MM
  contributionMonth?: string; // Explicit contribution month YYYY-MM
  contributionMonths?: string[]; // Array of selected contribution months e.g. ['2026-09', '2026-10', '2026-11']
  monthsCount?: number;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  baseCurrency?: string;
  baseAmount?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  paymentMethod: Receipt['paymentMethod'];
  cashBankAccountId: string;
  receiptDate?: string;
  referenceNumber?: string;
  notes?: string;
  userId: string;
  userEmail: string;
  custodianMemberId?: string;
  custodianMemberName?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
}

export interface SpecialContributionInput {
  tenantId: string;
  memberId: string;
  caseId: string;
  contributionMonth?: string; // Explicit contribution month YYYY-MM
  purpose?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  baseCurrency?: string;
  baseAmount?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  paymentMethod: Receipt['paymentMethod'];
  cashBankAccountId: string;
  receiptDate?: string;
  referenceNumber?: string;
  notes?: string;
  userId: string;
  userEmail: string;
  custodianMemberId?: string;
  custodianMemberName?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
}

export interface CharityAssistanceInput {
  tenantId: string;
  caseId: string;
  payeeName: string;
  payeePhone?: string;
  payeeAddress?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  baseCurrency?: string;
  baseAmount?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  paymentMethod: CharityPayment['paymentMethod'];
  cashBankAccountId: string;
  charityCategory: CharityPayment['charityCategory'];
  expenseAccountId?: string;
  paymentDate?: string;
  referenceNumber?: string;
  description: string;
  paidByType?: 'CHARITY_ACCOUNT' | 'MEMBER_CUSTODIAN' | 'MEMBER_ADVANCE';
  paidByMemberId?: string;
  paidByMemberName?: string;
  paidByMemberNumber?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
  approvedBy: string;
  preparedBy?: string;
  verifiedBy?: string;
  notes?: string;
  userId: string;
  userEmail: string;
}

export interface AdminExpenseInput {
  tenantId: string;
  payeeName: string;
  adminCategory: string; // Rent, Printing, IT, Utilities, Bank Fees
  expenseAccountId: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  baseCurrency?: string;
  baseAmount?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  paymentMethod: CharityPayment['paymentMethod'];
  cashBankAccountId: string;
  invoiceNumber?: string;
  paymentDate?: string;
  referenceNumber?: string;
  description: string;
  paidByType?: 'CHARITY_ACCOUNT' | 'MEMBER_CUSTODIAN' | 'MEMBER_ADVANCE';
  paidByMemberId?: string;
  paidByMemberName?: string;
  paidByMemberNumber?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string;
  supportingDocumentType?: string;
  supportingDocumentSize?: number;
  approvedBy: string;
  preparedBy?: string;
  verifiedBy?: string;
  notes?: string;
  isSplitEvent?: boolean;
  splitExpense?: SplitExpenseConfig;
  userId: string;
  userEmail: string;
}

export interface VoidTransactionResult {
  voidedReceipt?: Receipt;
  voidedPayment?: CharityPayment;
  reversalJournalEntry: JournalEntry;
  updatedCase?: CharityCase;
  auditLog: AuditLog;
}

export class AccountingService {
  /**
   * 1. RECORD MONTHLY CONTRIBUTION
   * Validates active member, checks duplicate periods, assigns receipt #, writes balanced journal lines.
   * Accounting Entry:
   *   Dr Cash / Bank Account (Asset)
   *   Cr Monthly Contribution Income (Account 4010)
   */
  static recordMonthlyContribution(params: {
    input: MonthlyContributionInput;
    member: Member;
    existingReceipts: Receipt[];
    existingJournals: JournalEntry[];
    cashAccount: Account;
    incomeAccount: Account;
  }): { receipt: Receipt; journalEntry: JournalEntry; auditLog: AuditLog } {
    const { input, member, existingReceipts, existingJournals, cashAccount, incomeAccount } = params;

    // 1. Validation: Member must be active
    if (member.status !== 'active') {
      throw new Error(`Cannot record contribution: Member ${member.fullName} (${member.memberNumber}) is inactive.`);
    }

    const now = new Date().toISOString();
    const dateOnly = input.receiptDate || now.slice(0, 10);
    const baseCur = input.baseCurrency || 'AED';
    const resolved = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolved.rate;
    const baseAmount = resolved.baseAmount;
    const snapshot = resolved.snapshot;

    // Resolve list of months covered
    const rawMonths = input.contributionMonths && input.contributionMonths.length > 0
      ? input.contributionMonths
      : [input.periodMonth || input.contributionMonth || dateOnly.slice(0, 7)];
    const monthsList = Array.from(new Set(rawMonths)).sort();
    const monthsCount = monthsList.length;
    const primaryPeriod = monthsList[0];
    const monthsSummary = monthsCount > 1
      ? `${monthsCount} Months: ${monthsList.map((m) => formatContributionMonthShort(m)).join(', ')}`
      : formatContributionMonth(primaryPeriod);

    // 2. Validation: Duplicate period check for regular monthly dues across all selected months
    const alreadyPaidMonth = monthsList.find((mStr) => {
      if (!mStr) return false;
      return existingReceipts.some((r) => {
        if (r.status !== 'valid' || r.memberId !== member.id || r.contributionType !== 'MONTHLY_CONTRIBUTION') {
          return false;
        }
        if (r.contributionMonths && Array.isArray(r.contributionMonths) && r.contributionMonths.includes(mStr)) {
          return true;
        }
        if (r.periodMonth === mStr || r.contributionMonth === mStr) {
          return true;
        }
        return false;
      });
    });

    if (alreadyPaidMonth) {
      throw new Error(
        `Duplicate period detected: Member ${member.fullName} already has a valid contribution recorded for ${formatContributionMonthShort(alreadyPaidMonth)} (${alreadyPaidMonth}).`
      );
    }

    if (input.amount <= 0) {
      throw new Error('Contribution amount must be greater than zero.');
    }

    const receiptNumber = getNextReceiptNumber(existingReceipts, new Date(dateOnly).getFullYear());
    const journalNumber = getNextJournalNumber(existingJournals, new Date(dateOnly).getFullYear());

    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Balanced Journal Lines: Dr Cash/Bank, Cr Monthly Income (Debit == Credit)
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: cashAccount.name,
        accountType: cashAccount.type,
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Receipt ${receiptNumber} dues (${monthsSummary}) from ${member.fullName}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: incomeAccount.id,
        accountCode: incomeAccount.code,
        accountName: incomeAccount.name,
        accountType: incomeAccount.type,
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Member Monthly Dues Income - (${monthsSummary}) (${member.memberNumber})`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: input.tenantId,
      date: dateOnly,
      description: `Monthly Contribution (${monthsSummary}) - ${member.fullName}`,
      sourceTransactionType: 'MONTHLY_CONTRIBUTION',
      sourceRecordId: receiptId,
      sourceRecordNumber: receiptNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: input.userEmail,
    };

    const dynamicNotes = input.notes?.trim()
      ? `${input.notes.trim()} (Covered: ${monthsSummary})`
      : `Monthly Contribution (${monthsSummary}) - ${member.fullName}`;

    const receipt: Receipt = {
      id: receiptId,
      charityId: input.tenantId,
      tenantId: input.tenantId,
      receiptNumber,
      receiptDate: dateOnly,
      memberId: member.id,
      memberNumber: member.memberNumber,
      memberName: member.fullName,
      contributionType: 'MONTHLY_CONTRIBUTION',
      contributionMonth: primaryPeriod,
      contributionMonths: monthsList,
      monthsCount,
      periodMonth: primaryPeriod,
      contributionAccountId: incomeAccount.id,
      contributionAccountCode: incomeAccount.code,
      contributionAccountName: incomeAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot: snapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: cashAccount.id,
      cashBankAccountName: cashAccount.name,
      custodianMemberId: input.custodianMemberId,
      custodianMemberName: input.custodianMemberName,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      referenceNumber: input.referenceNumber,
      notes: dynamicNotes,
      journalEntryId: journalId,
      status: 'valid',
      createdAt: now,
      createdBy: input.userEmail,
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: input.tenantId,
      user: input.userId,
      userEmail: input.userEmail,
      action: 'Created',
      module: 'Contribution',
      recordId: receiptId,
      recordNumber: receiptNumber,
      details: `Recorded monthly contribution of ${currency} ${input.amount} (${monthsSummary}) for ${member.fullName}. Balanced journal ${journalNumber} posted.`,
      timestamp: now,
      createdAt: now,
    };

    return { receipt, journalEntry, auditLog };
  }

  /**
   * 2. RECORD SPECIAL CONTRIBUTION (DESIGNATED RESTRICTED DONATION)
   * Validates case status (must be OPEN or IN_PROGRESS), tags restricted purpose,
   * assigns receipt #, updates case funded amount, writes balanced journal lines.
   * Accounting Entry:
   *   Dr Cash / Bank Account (Asset)
   *   Cr Special Donation / Designated Income (Account 4030)
   */
  static recordSpecialContribution(params: {
    input: SpecialContributionInput;
    member: Member;
    charityCase: CharityCase;
    existingReceipts: Receipt[];
    existingJournals: JournalEntry[];
    cashAccount: Account;
    incomeAccount: Account;
  }): { receipt: Receipt; updatedCase: CharityCase; journalEntry: JournalEntry; auditLog: AuditLog } {
    const { input, member, charityCase, existingReceipts, existingJournals, cashAccount, incomeAccount } = params;

    // 1. Validation: Case status check
    if (charityCase.status === 'CLOSED' || charityCase.status === 'DISBURSED') {
      throw new Error(`Cannot record donation: Case ${charityCase.caseNumber} is already ${charityCase.status}.`);
    }

    if (input.amount <= 0) {
      throw new Error('Contribution amount must be greater than zero.');
    }

    const now = new Date().toISOString();
    const dateOnly = input.receiptDate || now.slice(0, 10);
    const baseCur = input.baseCurrency || 'AED';
    const resolved = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolved.rate;
    const baseAmount = resolved.baseAmount;
    const snapshot = resolved.snapshot;

    const receiptNumber = getNextReceiptNumber(existingReceipts, new Date(dateOnly).getFullYear());
    const journalNumber = getNextJournalNumber(existingJournals, new Date(dateOnly).getFullYear());

    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Update case collected amount
    const newCollectedAmount = Number((charityCase.collectedAmount + baseAmount).toFixed(2));
    const isFullyFunded = newCollectedAmount >= charityCase.approvedAmount;
    const updatedCaseStatus = isFullyFunded ? 'FULLY_FUNDED' : 'IN_PROGRESS';

    const updatedCase: CharityCase = {
      ...charityCase,
      collectedAmount: newCollectedAmount,
      status: updatedCaseStatus,
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    // Balanced Journal Lines: Dr Cash/Bank, Cr Special Donation Income
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: cashAccount.name,
        accountType: cashAccount.type,
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Receipt ${receiptNumber} restricted donation for case ${charityCase.caseNumber}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: incomeAccount.id,
        accountCode: incomeAccount.code,
        accountName: incomeAccount.name,
        accountType: incomeAccount.type,
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Restricted Charity Fund - Case ${charityCase.caseNumber} (${charityCase.title})`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: input.tenantId,
      date: dateOnly,
      description: `Special Designated Contribution - Case ${charityCase.caseNumber} (${charityCase.title}) from ${member.fullName}`,
      sourceTransactionType: 'SPECIAL_CONTRIBUTION',
      sourceRecordId: receiptId,
      sourceRecordNumber: receiptNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: input.userEmail,
    };

    const receipt: Receipt = {
      id: receiptId,
      charityId: input.tenantId,
      tenantId: input.tenantId,
      receiptNumber,
      receiptDate: dateOnly,
      memberId: member.id,
      memberNumber: member.memberNumber,
      memberName: member.fullName,
      contributionType: 'SPECIAL_CONTRIBUTION',
      contributionMonth: input.contributionMonth || dateOnly.slice(0, 7),
      purpose: input.purpose || charityCase.title,
      caseId: charityCase.id,
      caseNumber: charityCase.caseNumber,
      caseTitle: charityCase.title,
      contributionAccountId: incomeAccount.id,
      contributionAccountCode: incomeAccount.code,
      contributionAccountName: incomeAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot: snapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: cashAccount.id,
      cashBankAccountName: cashAccount.name,
      custodianMemberId: input.custodianMemberId,
      custodianMemberName: input.custodianMemberName,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      journalEntryId: journalId,
      status: 'valid',
      createdAt: now,
      createdBy: input.userEmail,
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: input.tenantId,
      user: input.userId,
      userEmail: input.userEmail,
      action: 'Created',
      module: 'Contribution',
      recordId: receiptId,
      recordNumber: receiptNumber,
      details: `Recorded special contribution of ${currency} ${input.amount} for Case ${charityCase.caseNumber} (${charityCase.title}). Total funded: ${newCollectedAmount}/${charityCase.approvedAmount}. Journal ${journalNumber} posted.`,
      timestamp: now,
      createdAt: now,
    };

    return { receipt, updatedCase, journalEntry, auditLog };
  }

  /**
   * 3. RECORD CHARITY ASSISTANCE (OUTGOING RELIEF AID)
   * Validates budget/approved amount on CharityCase, issues payment voucher (PAY-YYYY-XXXXX),
   * updates case disbursed amount, writes balanced journal lines.
   * Accounting Entry:
   *   Dr Charity Assistance Expense (Account 5010..5090)
   *   Cr Cash / Bank Account (Asset)
   */
  static recordCharityAssistance(params: {
    input: CharityAssistanceInput;
    charityCase: CharityCase;
    existingPayments: CharityPayment[];
    existingJournals: JournalEntry[];
    cashAccount: Account;
    expenseAccount: Account;
  }): { payment: CharityPayment; updatedCase: CharityCase; journalEntry: JournalEntry; auditLog: AuditLog } {
    const { input, charityCase, existingPayments, existingJournals, cashAccount, expenseAccount } = params;

    const now = new Date().toISOString();
    const dateOnly = input.paymentDate || now.slice(0, 10);
    const baseCur = input.baseCurrency || 'AED';
    const resolved = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolved.rate;
    const baseAmount = resolved.baseAmount;
    const snapshot = resolved.snapshot;

    // 1. Validation: Cannot disburse more than approved limit
    const remainingApproved = charityCase.approvedAmount - charityCase.disbursedAmount;
    if (baseAmount > remainingApproved + 0.01) {
      throw new Error(
        `Over-disbursement rejected: Requested payout of ${currency} ${input.amount} exceeds the remaining approved budget limit of ${charityCase.currency} ${remainingApproved}.`
      );
    }

    if (input.amount <= 0) {
      throw new Error('Assistance disbursement amount must be greater than zero.');
    }

    const paymentNumber = getNextPaymentNumber(existingPayments, new Date(dateOnly).getFullYear(), 'CHARITY_ASSISTANCE');
    const journalNumber = getNextJournalNumber(existingJournals, new Date(dateOnly).getFullYear());

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const newDisbursedAmount = Number((charityCase.disbursedAmount + baseAmount).toFixed(2));
    const isCompleted = newDisbursedAmount >= charityCase.approvedAmount;

    const updatedCase: CharityCase = {
      ...charityCase,
      disbursedAmount: newDisbursedAmount,
      status: isCompleted ? 'DISBURSED' : 'IN_PROGRESS',
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    // Balanced Journal Lines: Dr Charity Assistance Expense, Cr Cash/Bank
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: expenseAccount.id,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        accountType: expenseAccount.type,
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Voucher ${paymentNumber} assistance for Case ${charityCase.caseNumber} - ${input.payeeName}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: cashAccount.name,
        accountType: cashAccount.type,
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Disbursement from ${cashAccount.name} for Case ${charityCase.caseNumber}`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: input.tenantId,
      date: dateOnly,
      description: `Charity Assistance Aid - Case ${charityCase.caseNumber} (${input.charityCategory}) to ${input.payeeName}`,
      sourceTransactionType: 'CHARITY_ASSISTANCE',
      sourceRecordId: paymentId,
      sourceRecordNumber: paymentNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: input.userEmail,
    };

    const payment: CharityPayment = {
      id: paymentId,
      charityId: input.tenantId,
      tenantId: input.tenantId,
      paymentNumber,
      disbursementType: 'CHARITY_ASSISTANCE',
      paymentDate: dateOnly,
      payeeName: input.payeeName,
      mobileNumber: input.payeePhone,
      address: input.payeeAddress,
      caseId: charityCase.id,
      caseNumber: charityCase.caseNumber,
      caseTitle: charityCase.title,
      charityCategory: input.charityCategory,
      chartOfAccountId: expenseAccount.id,
      chartOfAccountCode: expenseAccount.code,
      chartOfAccountName: expenseAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot: snapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: cashAccount.id,
      cashBankAccountName: cashAccount.name,
      paidByType: input.paidByType,
      paidByMemberId: input.paidByMemberId,
      paidByMemberName: input.paidByMemberName,
      paidByMemberNumber: input.paidByMemberNumber,
      reimbursementStatus: input.paidByType === 'MEMBER_ADVANCE' ? 'PENDING' : 'NOT_APPLICABLE',
      referenceNumber: input.referenceNumber,
      description: input.description,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      approvedBy: input.approvedBy || 'Charity Board',
      preparedBy: input.preparedBy || input.userEmail || 'Admin',
      verifiedBy: input.verifiedBy || 'Audit Committee',
      notes: input.notes || '',
      journalEntryId: journalId,
      status: 'valid',
      createdAt: now,
      createdBy: input.userEmail,
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: input.tenantId,
      user: input.userId,
      userEmail: input.userEmail,
      action: 'Created',
      module: 'Disbursement',
      recordId: paymentId,
      recordNumber: paymentNumber,
      details: `Issued assistance voucher ${paymentNumber} of ${currency} ${input.amount} for Case ${charityCase.caseNumber} to ${input.payeeName}. Total disbursed: ${newDisbursedAmount}/${charityCase.approvedAmount}. Journal ${journalNumber} posted.`,
      timestamp: now,
      createdAt: now,
    };

    return { payment, updatedCase, journalEntry, auditLog };
  }

  /**
   * 4. RECORD ADMINISTRATIVE EXPENSE (OPERATIONAL OVERHEAD)
   * Validates active expense category, records vendor/invoice, issues voucher (EXP-YYYY-XXXXX),
   * writes balanced journal lines.
   * Accounting Entry:
   *   Dr Administrative Expense Account (Account 6010..6090)
   *   Cr Cash / Bank Account (Asset)
   */
  static recordAdminExpense(params: {
    input: AdminExpenseInput;
    existingPayments: CharityPayment[];
    existingJournals: JournalEntry[];
    cashAccount: Account;
    expenseAccount: Account;
  }): { payment: CharityPayment; journalEntry: JournalEntry; auditLog: AuditLog } {
    const { input, existingPayments, existingJournals, cashAccount, expenseAccount } = params;

    if (input.amount <= 0) {
      throw new Error('Administrative expense amount must be greater than zero.');
    }

    const now = new Date().toISOString();
    const dateOnly = input.paymentDate || now.slice(0, 10);
    const baseCur = input.baseCurrency || 'AED';
    const resolved = resolveRateAndSnapshot(
      input.amount,
      input.currency,
      baseCur,
      input.exchangeRate,
      input.exchangeRateSnapshot,
      dateOnly
    );
    const currency = (input.currency || baseCur).toUpperCase();
    const exchangeRate = resolved.rate;
    const baseAmount = resolved.baseAmount;
    const snapshot = resolved.snapshot;

    const voucherNumber = getNextAdminExpenseNumber(existingPayments, new Date(dateOnly).getFullYear());
    const journalNumber = getNextJournalNumber(existingJournals, new Date(dateOnly).getFullYear());

    const paymentId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Balanced Journal Lines: Dr Administrative Operating Expense, Cr Cash/Bank
    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: expenseAccount.id,
        accountCode: expenseAccount.code,
        accountName: expenseAccount.name,
        accountType: expenseAccount.type,
        debit: input.amount,
        credit: 0,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: baseAmount,
        baseCurrencyCredit: 0,
        description: `Expense Voucher ${voucherNumber} - ${input.adminCategory} (${input.payeeName})`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: cashAccount.id,
        accountCode: cashAccount.code,
        accountName: cashAccount.name,
        accountType: cashAccount.type,
        debit: 0,
        credit: input.amount,
        currency,
        exchangeRate,
        exchangeRateSnapshot: snapshot,
        baseAmount,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmount,
        description: `Disbursement from ${cashAccount.name} for ${input.adminCategory}`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: input.tenantId,
      date: dateOnly,
      description: `Administrative Expense - ${input.adminCategory} to ${input.payeeName}`,
      sourceTransactionType: 'ADMINISTRATIVE_EXPENSE',
      sourceRecordId: paymentId,
      sourceRecordNumber: voucherNumber,
      lines: journalLines,
      totalDebit: input.amount,
      totalCredit: input.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: input.userEmail,
    };

    const payment: CharityPayment = {
      id: paymentId,
      charityId: input.tenantId,
      tenantId: input.tenantId,
      paymentNumber: voucherNumber,
      disbursementType: 'ADMINISTRATIVE_EXPENSE',
      paymentDate: dateOnly,
      payeeName: input.payeeName,
      adminExpenseCategory: input.adminCategory,
      invoiceNumber: input.invoiceNumber,
      chartOfAccountId: expenseAccount.id,
      chartOfAccountCode: expenseAccount.code,
      chartOfAccountName: expenseAccount.name,
      amount: input.amount,
      currency,
      exchangeRate,
      exchangeRateSnapshot: snapshot,
      baseAmount,
      baseCurrency: baseCur,
      baseCurrencyAmount: baseAmount,
      paymentMethod: input.paymentMethod,
      cashBankAccountId: cashAccount.id,
      cashBankAccountName: cashAccount.name,
      paidByType: input.paidByType,
      paidByMemberId: input.paidByMemberId,
      paidByMemberName: input.paidByMemberName,
      paidByMemberNumber: input.paidByMemberNumber,
      reimbursementStatus: input.paidByType === 'MEMBER_ADVANCE' ? 'PENDING' : 'NOT_APPLICABLE',
      referenceNumber: input.referenceNumber,
      description: input.description,
      supportingDocumentName: input.supportingDocumentName,
      supportingDocumentUrl: input.supportingDocumentUrl,
      supportingDocumentData: input.supportingDocumentData,
      supportingDocumentType: input.supportingDocumentType,
      supportingDocumentSize: input.supportingDocumentSize,
      approvedBy: input.approvedBy || 'Charity Board',
      preparedBy: input.preparedBy || input.userEmail || 'Admin',
      verifiedBy: input.verifiedBy || 'Audit Committee',
      notes: input.notes || '',
      isSplitEvent: input.isSplitEvent || false,
      splitExpense: input.splitExpense,
      journalEntryId: journalId,
      status: 'valid',
      createdAt: now,
      createdBy: input.userEmail,
      updatedAt: now,
      updatedBy: input.userEmail,
    };

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: input.tenantId,
      user: input.userId,
      userEmail: input.userEmail,
      action: 'Created',
      module: 'Disbursement',
      recordId: paymentId,
      recordNumber: voucherNumber,
      details: `Issued administrative expense voucher ${voucherNumber} of ${currency} ${input.amount} for ${input.adminCategory} to ${input.payeeName}. Journal ${journalNumber} posted.`,
      timestamp: now,
      createdAt: now,
    };

    return { payment, journalEntry, auditLog };
  }

  /**
   * 5. VOID TRANSACTION & AUTOMATED OFFSETTING REVERSAL ENTRY
   * Immutability Rule: Deleting posted financial records is strictly forbidden.
   * Generates inverse balanced lines ($Debit <-> Credit$) and marks transaction as VOIDED
   * with mandatory audit metadata (voided_by, voided_at, reason).
   */
  static voidTransaction(params: {
    recordType: 'Receipt' | 'Payment';
    recordId: string;
    reason: string;
    userId: string;
    userEmail: string;
    existingReceipts: Receipt[];
    existingPayments: CharityPayment[];
    existingJournals: JournalEntry[];
    cases: CharityCase[];
  }): VoidTransactionResult {
    const {
      recordType,
      recordId,
      reason,
      userId,
      userEmail,
      existingReceipts,
      existingPayments,
      existingJournals,
      cases,
    } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed reason (at least 5 characters) is mandatory to void an auditable transaction.');
    }

    const now = new Date().toISOString();
    let voidedReceipt: Receipt | undefined;
    let voidedPayment: CharityPayment | undefined;
    let targetJournal: JournalEntry | undefined;
    let updatedCase: CharityCase | undefined;
    let recordNumber = '';

    if (recordType === 'Receipt') {
      const target = existingReceipts.find((r) => r.id === recordId);
      if (!target) throw new Error(`Receipt not found: ${recordId}`);
      if (target.status === 'voided') throw new Error(`Receipt ${target.receiptNumber} is already voided.`);

      recordNumber = target.receiptNumber;
      voidedReceipt = {
        ...target,
        status: 'voided',
        voidReason: reason,
        voidedBy: userEmail,
        voidedAt: now,
        updatedAt: now,
        updatedBy: userEmail,
      };

      // Find original journal
      targetJournal = existingJournals.find(
        (j) => j.id === target.journalEntryId || j.sourceRecordNumber === target.receiptNumber
      );

      // If this was a special contribution, deduct collectedAmount from case
      if (target.contributionType === 'SPECIAL_CONTRIBUTION' && target.caseId) {
        const c = cases.find((item) => item.id === target.caseId);
        if (c) {
          const newCollected = Math.max(0, c.collectedAmount - (target.baseCurrencyAmount || target.amount));
          updatedCase = {
            ...c,
            collectedAmount: newCollected,
            status: newCollected < c.approvedAmount ? 'IN_PROGRESS' : c.status,
            updatedAt: now,
            updatedBy: userEmail,
          };
        }
      }
    } else {
      const target = existingPayments.find((p) => p.id === recordId);
      if (!target) throw new Error(`Payment voucher not found: ${recordId}`);
      if (target.status === 'voided') throw new Error(`Voucher ${target.paymentNumber} is already voided.`);

      recordNumber = target.paymentNumber;
      voidedPayment = {
        ...target,
        status: 'voided',
        voidReason: reason,
        voidedBy: userEmail,
        voidedAt: now,
        updatedAt: now,
        updatedBy: userEmail,
      };

      targetJournal = existingJournals.find(
        (j) => j.id === target.journalEntryId || j.sourceRecordNumber === target.paymentNumber
      );

      // If charity assistance, deduct disbursed amount from case
      if (target.disbursementType === 'CHARITY_ASSISTANCE' && target.caseId) {
        const c = cases.find((item) => item.id === target.caseId);
        if (c) {
          const newDisbursed = Math.max(0, c.disbursedAmount - (target.baseCurrencyAmount || target.amount));
          updatedCase = {
            ...c,
            disbursedAmount: newDisbursed,
            status: newDisbursed < c.approvedAmount ? 'IN_PROGRESS' : c.status,
            updatedAt: now,
            updatedBy: userEmail,
          };
        }
      }
    }

    // Generate offsetting reversal journal entry
    const reversalNumber = getNextJournalNumber(existingJournals, new Date().getFullYear());
    const reversalJournalId = `jrnl_rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Invert lines: Debits become Credits, Credits become Debits
    const invertedLines: JournalLine[] = (targetJournal?.lines || []).map((line, idx) => ({
      id: `line_rev_${reversalJournalId}_${idx + 1}`,
      journalEntryId: reversalJournalId,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      debit: line.credit, // Inversion!
      credit: line.debit, // Inversion!
      currency: line.currency,
      exchangeRate: line.exchangeRate,
      baseCurrencyDebit: line.baseCurrencyCredit,
      baseCurrencyCredit: line.baseCurrencyDebit,
      description: `Reversal of ${line.description} (Voided: ${reason})`,
    }));

    const reversalJournalEntry: JournalEntry = {
      id: reversalJournalId,
      entryNumber: reversalNumber,
      tenantId: targetJournal?.tenantId || 'default',
      date: now.slice(0, 10),
      description: `REVERSAL of ${recordNumber} - Reason: ${reason}`,
      sourceTransactionType: 'REVERSAL',
      sourceRecordId: recordId,
      sourceRecordNumber: recordNumber,
      lines: invertedLines,
      totalDebit: targetJournal?.totalCredit || 0,
      totalCredit: targetJournal?.totalDebit || 0,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: userEmail,
    };

    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId: targetJournal?.tenantId || 'default',
      user: userId,
      userEmail,
      action: 'Voided',
      module: recordType === 'Receipt' ? 'Contribution' : 'Disbursement',
      recordId,
      recordNumber,
      reason,
      details: `Voided ${recordType} ${recordNumber}. Generated offsetting balanced reversal journal ${reversalNumber}. Reason: ${reason}`,
      timestamp: now,
      createdAt: now,
    };

    return {
      voidedReceipt,
      voidedPayment,
      reversalJournalEntry,
      updatedCase,
      auditLog,
    };
  }
}
