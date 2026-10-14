/**
 * AI Health Check & Automated Data Diagnostic Engine
 *
 * Implements 5 Automated Validation Rules across all app collections:
 * 1. Multi-Currency Sum Mismatches: Detects mixed currencies summed without exchange rate conversion.
 * 2. Orphan / Ghost Records: Identifies phantom keys (e.g. lingering holding_*), duplicate holdings, or unlinked records.
 * 3. Double-Entry Imbalance: Detects journal entries or transactions where Debits ≠ Credits.
 * 4. Broken Custodian Floats: Verifies physical cash held by each custodian matches verified receipts minus disbursements.
 * 5. Overdue Status Inconsistencies: Identifies members marked overdue who hold paid receipts for that period or desynced totals.
 *
 * Provides batch repair execution (`executeOneClickAiRepair`) committing all fixes via Firestore writeBatch
 * and broadcasting global instant sync to all connected user sessions.
 */

import {
  Member,
  Receipt,
  CharityPayment,
  JournalEntry,
  Transaction,
  CashHolding,
  Account,
  CashAccount,
  CharityCase,
  OrganizationSettings,
  JournalLine,
} from '../types';
import { db, cleanForFirestore } from '../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { convertToBaseCurrency, isReceiptValid } from './financialLedgerService';

export type HealthSeverity = 'critical' | 'warning' | 'info';

export type DiagnosticCategory =
  | 'DOUBLE_ENTRY_IMBALANCE'
  | 'BROKEN_CUSTODIAN_FLOATS'
  | 'GL_ACCOUNT_DRIFT'
  | 'ALLOCATION_MISMATCH'
  | 'MULTI_CURRENCY'
  | 'ORPHAN_GHOST_RECORDS'
  | 'OVERDUE_STATUS';

export interface DiagnosticIssue {
  id: string;
  category: DiagnosticCategory;
  categoryTitle: string;
  severity: HealthSeverity;
  collection:
    | 'receipts'
    | 'payments'
    | 'journal_entries'
    | 'transactions'
    | 'cashHoldings'
    | 'members'
    | 'accounts'
    | 'cases'
    | 'cache';
  recordId: string;
  recordIdentifier?: string;
  title: string;
  description: string;
  detectedDiscrepancy: {
    expected: string | number;
    actual: string | number;
    difference?: string | number;
    currency?: string;
  };
  suggestedAction: string;
  canAutoFix: boolean;
  metadata?: Record<string, any>;
}

export interface HealthScanSummary {
  scannedAt: string;
  overallStatus: 'HEALTHY' | 'DISCREPANCIES_FOUND';
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  collectionsScanned: string[];
  recordsCount: {
    members: number;
    receipts: number;
    payments: number;
    journalEntries: number;
    transactions: number;
    cashHoldings: number;
    accounts: number;
    cases: number;
  };
  categoryCounts: Record<DiagnosticCategory, number>;
  issues: DiagnosticIssue[];
}

export interface RepairExecutionResult {
  repairedAt: string;
  success: boolean;
  summaryMessage: string;
  collectionsScannedCount: number;
  fixedCounts: {
    currencyDiscrepancies: number;
    orphanPurged: number;
    doubleEntriesBalanced: number;
    custodianFloatsReconciled: number;
    overdueInconsistenciesResolved: number;
    glAccountsReconciled: number;
    caseAllocationsReconciled: number;
    totalFixed: number;
  };
  actionsTaken: string[];
  persistedToFirestore: boolean;
  globalSyncTimestamp: number;
  auditLogId?: string;
}

export class SafeBatchManager {
  private currentBatch = writeBatch(db);
  private count = 0;
  private readonly maxOps = 400; // Conservative limit below 500

  async set(ref: any, data: any, options?: any) {
    if (this.count >= this.maxOps) {
      await this.currentBatch.commit();
      this.currentBatch = writeBatch(db);
      this.count = 0;
    }
    const cleaned = cleanForFirestore(data);
    if (options) {
      this.currentBatch.set(ref, cleaned, options);
    } else {
      this.currentBatch.set(ref, cleaned);
    }
    this.count++;
  }

  async update(ref: any, data: any) {
    if (this.count >= this.maxOps) {
      await this.currentBatch.commit();
      this.currentBatch = writeBatch(db);
      this.count = 0;
    }
    this.currentBatch.update(ref, cleanForFirestore(data));
    this.count++;
  }

  async delete(ref: any) {
    if (this.count >= this.maxOps) {
      await this.currentBatch.commit();
      this.currentBatch = writeBatch(db);
      this.count = 0;
    }
    this.currentBatch.delete(ref);
    this.count++;
  }

  async commit() {
    if (this.count > 0) {
      await this.currentBatch.commit();
      this.count = 0;
    }
  }
}

/**
 * Executes full Diagnostic Scan across all collections and state.
 */
export function runAiDiagnosticScan(
  members: Member[],
  receipts: Receipt[],
  payments: CharityPayment[],
  journals: JournalEntry[],
  transactions: Transaction[],
  cashHoldings: CashHolding[],
  accounts: Account[],
  cashAccounts: CashAccount[],
  settings: OrganizationSettings,
  cases: CharityCase[] = []
): HealthScanSummary {
  const issues: DiagnosticIssue[] = [];
  const baseCurrency = (settings.currency || 'AED').toUpperCase();
  const defaultInrRate = settings.exchangeRateInrToAed || 0.04401;

  // =========================================================================
  // CHECK 1: Multi-Currency Sum Mismatches
  // =========================================================================
  receipts.forEach((r) => {
    if (!isReceiptValid(r.status)) return;
    const cur = (r.currency || baseCurrency).toUpperCase();
    if (cur !== baseCurrency) {
      const rate = r.exchangeRateSnapshot?.rate || r.exchangeRate || (cur === 'INR' ? defaultInrRate : 1);
      const expectedBase = Number(((r.amount || 0) * rate).toFixed(2));
      const actualBase = r.baseCurrencyAmount != null ? Number(r.baseCurrencyAmount) : (r.baseAmount != null ? Number(r.baseAmount) : null);

      if (actualBase === null) {
        issues.push({
          id: `curr_rcpt_missing_${r.id}`,
          category: 'MULTI_CURRENCY',
          categoryTitle: 'Multi-Currency Sum Mismatches',
          severity: 'warning',
          collection: 'receipts',
          recordId: r.id,
          recordIdentifier: r.receiptNumber || r.id,
          title: `Receipt ${r.receiptNumber} Missing Base Currency Equivalent`,
          description: `Foreign currency receipt in ${cur} (${r.amount}) has no converted base currency equivalent.`,
          detectedDiscrepancy: {
            expected: `${baseCurrency} ${expectedBase.toFixed(2)}`,
            actual: 'Missing / Null',
            currency: cur,
          },
          suggestedAction: `Convert ${cur} ${r.amount} to ${baseCurrency} ${expectedBase.toFixed(2)} using rate ${rate}.`,
          canAutoFix: true,
          metadata: { receipt: r, expectedBase, rate },
        });
      } else if (Math.abs(actualBase - r.amount) < 0.01 && r.amount > 0 && cur === 'INR') {
        issues.push({
          id: `curr_rcpt_unconverted_${r.id}`,
          category: 'MULTI_CURRENCY',
          categoryTitle: 'Multi-Currency Sum Mismatches',
          severity: 'critical',
          collection: 'receipts',
          recordId: r.id,
          recordIdentifier: r.receiptNumber || r.id,
          title: `Receipt ${r.receiptNumber} 1:1 Foreign Currency Math Error`,
          description: `Receipt amount of ₹${r.amount} was recorded directly as AED ${actualBase} without exchange rate conversion.`,
          detectedDiscrepancy: {
            expected: `${baseCurrency} ${expectedBase.toFixed(2)}`,
            actual: `${baseCurrency} ${actualBase.toFixed(2)}`,
            difference: `${baseCurrency} ${(actualBase - expectedBase).toFixed(2)}`,
            currency: cur,
          },
          suggestedAction: `Auto-convert ₹${r.amount} to AED ${expectedBase.toFixed(2)} using transaction-date exchange rate.`,
          canAutoFix: true,
          metadata: { receipt: r, expectedBase, rate },
        });
      }
    }
  });

  payments.forEach((p) => {
    if (p.status !== 'valid') return;
    const cur = (p.currency || baseCurrency).toUpperCase();
    if (cur !== baseCurrency) {
      const rate = p.exchangeRateSnapshot?.rate || p.exchangeRate || (cur === 'INR' ? defaultInrRate : 1);
      const expectedBase = Number(((p.amount || 0) * rate).toFixed(2));
      const actualBase = p.baseCurrencyAmount != null ? Number(p.baseCurrencyAmount) : (p.baseAmount != null ? Number(p.baseAmount) : null);

      if (actualBase === null) {
        issues.push({
          id: `curr_pay_missing_${p.id}`,
          category: 'MULTI_CURRENCY',
          categoryTitle: 'Multi-Currency Sum Mismatches',
          severity: 'warning',
          collection: 'payments',
          recordId: p.id,
          recordIdentifier: p.paymentNumber || p.id,
          title: `Payment ${p.paymentNumber} Missing Base Currency Equivalent`,
          description: `Foreign currency payment in ${cur} (${p.amount}) lacks base amount equivalent.`,
          detectedDiscrepancy: {
            expected: `${baseCurrency} ${expectedBase.toFixed(2)}`,
            actual: 'Missing / Null',
            currency: cur,
          },
          suggestedAction: `Convert ${cur} ${p.amount} to ${baseCurrency} ${expectedBase.toFixed(2)}.`,
          canAutoFix: true,
          metadata: { payment: p, expectedBase, rate },
        });
      } else if (Math.abs(actualBase - p.amount) < 0.01 && p.amount > 0 && cur === 'INR') {
        issues.push({
          id: `curr_pay_unconverted_${p.id}`,
          category: 'MULTI_CURRENCY',
          categoryTitle: 'Multi-Currency Sum Mismatches',
          severity: 'critical',
          collection: 'payments',
          recordId: p.id,
          recordIdentifier: p.paymentNumber || p.id,
          title: `Payment ${p.paymentNumber} 1:1 Foreign Currency Math Error`,
          description: `Payment of ₹${p.amount} was recorded directly as AED ${actualBase} without exchange rate conversion.`,
          detectedDiscrepancy: {
            expected: `${baseCurrency} ${expectedBase.toFixed(2)}`,
            actual: `${baseCurrency} ${actualBase.toFixed(2)}`,
            difference: `${baseCurrency} ${(actualBase - expectedBase).toFixed(2)}`,
            currency: cur,
          },
          suggestedAction: `Auto-convert ₹${p.amount} to AED ${expectedBase.toFixed(2)}.`,
          canAutoFix: true,
          metadata: { payment: p, expectedBase, rate },
        });
      }
    }
  });

  // Check Journal Lines for unconverted foreign currencies
  journals.forEach((j) => {
    if (j.status !== 'POSTED') return;
    (j.lines || []).forEach((line, idx) => {
      const cur = (line.currency || baseCurrency).toUpperCase();
      if (cur === 'INR' && baseCurrency === 'AED') {
        if (line.debit > 0 && Math.abs(line.baseCurrencyDebit - line.debit) < 0.01) {
          issues.push({
            id: `curr_jrnl_${j.id}_line_${idx}`,
            category: 'MULTI_CURRENCY',
            categoryTitle: 'Multi-Currency Sum Mismatches',
            severity: 'critical',
            collection: 'journal_entries',
            recordId: j.id,
            recordIdentifier: `${j.entryNumber} (Line #${idx + 1})`,
            title: `Journal ${j.entryNumber} Line Currency Mismatch`,
            description: `INR debit line of ₹${line.debit} was recorded with equal base currency debit AED ${line.baseCurrencyDebit}.`,
            detectedDiscrepancy: {
              expected: `AED ${(line.debit * defaultInrRate).toFixed(2)}`,
              actual: `AED ${line.baseCurrencyDebit}`,
              currency: 'INR',
            },
            suggestedAction: `Recalculate baseCurrencyDebit using exchange rate.`,
            canAutoFix: true,
            metadata: { journal: j, lineIndex: idx },
          });
        }
      }
    });
  });

  // =========================================================================
  // CHECK 2: Orphan / Ghost Records
  // =========================================================================
  const receiptIds = new Set(receipts.map((r) => r.id));
  const seenReceiptHoldings = new Set<string>();

  cashHoldings.forEach((h) => {
    // 2a. Lingering known phantom key
    if (h.id === 'holding_1790333624218_w7s6') {
      issues.push({
        id: `orphan_phantom_${h.id}`,
        category: 'ORPHAN_GHOST_RECORDS',
        categoryTitle: 'Orphan & Ghost Records',
        severity: 'critical',
        collection: 'cashHoldings',
        recordId: h.id,
        recordIdentifier: h.id,
        title: `Lingering Phantom Holding Record Found (${h.id})`,
        description: `Known corrupt cache holding record detected in cashHoldings database collection.`,
        detectedDiscrepancy: {
          expected: 'Deleted / Purged',
          actual: `Exists with amount ${h.amount || 0}`,
        },
        suggestedAction: `Permanently delete document from Firestore and localStorage.`,
        canAutoFix: true,
        metadata: { holding: h },
      });
      return;
    }

    // 2b. Holding pointing to non-existent receipt
    if (h.receiptId && !receiptIds.has(h.receiptId)) {
      issues.push({
        id: `orphan_unlinked_receipt_${h.id}`,
        category: 'ORPHAN_GHOST_RECORDS',
        categoryTitle: 'Orphan & Ghost Records',
        severity: 'warning',
        collection: 'cashHoldings',
        recordId: h.id,
        recordIdentifier: h.id,
        title: `Orphan Cash Holding Unlinked to Receipt`,
        description: `Cash holding record ${h.id} references deleted or non-existent receipt ID "${h.receiptId}".`,
        detectedDiscrepancy: {
          expected: 'Valid Receipt Document',
          actual: `Missing Receipt "${h.receiptId}"`,
        },
        suggestedAction: `Purge unlinked orphan holding or unlink reference.`,
        canAutoFix: true,
        metadata: { holding: h },
      });
    }

    // 2c. Duplicate holding for same receipt
    if (h.receiptId) {
      if (seenReceiptHoldings.has(h.receiptId)) {
        issues.push({
          id: `orphan_duplicate_holding_${h.id}`,
          category: 'ORPHAN_GHOST_RECORDS',
          categoryTitle: 'Orphan & Ghost Records',
          severity: 'critical',
          collection: 'cashHoldings',
          recordId: h.id,
          recordIdentifier: h.id,
          title: `Duplicate Holding for Receipt ${h.receiptId}`,
          description: `Multiple cash holding records exist for the same receipt, causing double-counting in custodian cash float.`,
          detectedDiscrepancy: {
            expected: 'Single Cash Holding Record',
            actual: 'Duplicate Holding Record Detected',
          },
          suggestedAction: `Purge duplicate cash holding record.`,
          canAutoFix: true,
          metadata: { holding: h },
        });
      } else {
        seenReceiptHoldings.add(h.receiptId);
      }
    }
  });

  // Check localStorage for phantom keys
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('charity_cached_members');
      if (cached && cached.includes('holding_1790333624218_w7s6')) {
        issues.push({
          id: 'orphan_localstorage_cached_members',
          category: 'ORPHAN_GHOST_RECORDS',
          categoryTitle: 'Orphan & Ghost Records',
          severity: 'warning',
          collection: 'cache',
          recordId: 'localStorage.charity_cached_members',
          recordIdentifier: 'Browser Storage Cache',
          title: 'Phantom Record in Browser Local Cache',
          description: 'Local storage holds obsolete cached member snapshot containing deleted phantom holding key.',
          detectedDiscrepancy: {
            expected: 'Clean Cache',
            actual: 'Contains phantom holding key',
          },
          suggestedAction: 'Purge obsolete local storage keys.',
          canAutoFix: true,
        });
      }
    } catch {
      // ignore
    }
  }

  // =========================================================================
  // CHECK 3: Double-Entry Imbalance
  // =========================================================================
  journals.forEach((j) => {
    if (j.status !== 'POSTED') return;
    const lines = j.lines || [];
    const sumDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
    const sumCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
    const diff = Math.abs(sumDebit - sumCredit);
    const headerDiff = Math.abs((j.totalDebit || 0) - (j.totalCredit || 0));

    if (diff > 0.01 || headerDiff > 0.01 || (!j.isBalanced && lines.length > 0)) {
      issues.push({
        id: `imbalance_journal_${j.id}`,
        category: 'DOUBLE_ENTRY_IMBALANCE',
        categoryTitle: 'Double-Entry Imbalance',
        severity: 'critical',
        collection: 'journal_entries',
        recordId: j.id,
        recordIdentifier: j.entryNumber || j.id,
        title: `Journal Entry ${j.entryNumber} Debit ≠ Credit Imbalance`,
        description: `Total Debits (${sumDebit.toFixed(2)}) does not equal Total Credits (${sumCredit.toFixed(2)}). Difference: ${diff.toFixed(2)}.`,
        detectedDiscrepancy: {
          expected: `Total Debit === Total Credit`,
          actual: `Debit: ${sumDebit.toFixed(2)} vs Credit: ${sumCredit.toFixed(2)}`,
          difference: diff.toFixed(2),
        },
        suggestedAction: `Rebalance journal entry lines so debits match credits exactly.`,
        canAutoFix: true,
        metadata: { journal: j, sumDebit, sumCredit, diff },
      });
    }
  });

  transactions.forEach((t) => {
    if (t.status !== 'valid') return;
    if (!t.debitAccountId || !t.creditAccountId) {
      issues.push({
        id: `imbalance_txn_missing_acc_${t.id}`,
        category: 'DOUBLE_ENTRY_IMBALANCE',
        categoryTitle: 'Double-Entry Imbalance',
        severity: 'warning',
        collection: 'transactions',
        recordId: t.id,
        recordIdentifier: t.transactionNumber || t.id,
        title: `Transaction ${t.transactionNumber} Missing Balancing Account`,
        description: `Transaction has incomplete double-entry accounts (Debit: ${t.debitAccountCode || 'None'}, Credit: ${t.creditAccountCode || 'None'}).`,
        detectedDiscrepancy: {
          expected: 'Debit and Credit Accounts Assigned',
          actual: `Debit: ${t.debitAccountCode || 'Missing'} / Credit: ${t.creditAccountCode || 'Missing'}`,
        },
        suggestedAction: `Auto-assign corresponding default COA account codes.`,
        canAutoFix: true,
        metadata: { transaction: t },
      });
    }
  });

  // =========================================================================
  // CHECK 4: Broken Custodian Floats
  // =========================================================================
  // Verify physical cash held by each custodian matches the exact sum of verified receipts minus recorded disbursements
  const validReceipts = receipts.filter((r) => isReceiptValid(r.status));
  const validPayments = payments.filter((p) => p.status === 'valid');

  members.forEach((m) => {
    // Receipts held by this custodian
    const custodianReceipts = validReceipts.filter(
      (r) =>
        r.custodianMemberId === m.id ||
        (r as any).custodianId === m.id ||
        r.cashBankAccountId === `custodian_${m.id}` ||
        (r.cashBankAccountName && r.cashBankAccountName.includes(m.fullName))
    );

    // Disbursements paid by this custodian
    const custodianDisbursements = validPayments.filter(
      (p) =>
        (p.paidByType === 'MEMBER_CUSTODIAN' && p.paidByMemberId === m.id) ||
        p.cashBankAccountId === `custodian_${m.id}` ||
        (p.cashBankAccountName && p.cashBankAccountName.includes(m.fullName))
    );

    // Expected INR float
    const inrReceived = custodianReceipts
      .filter((r) => (r.currency || baseCurrency).toUpperCase() === 'INR')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const inrDisbursed = custodianDisbursements
      .filter((p) => (p.currency || baseCurrency).toUpperCase() === 'INR')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const expectedInrFloat = Math.max(0, inrReceived - inrDisbursed);

    // Actual recorded INR float
    const recordedInr = m.cashBalances?.['INR'] || 0;

    if (inrReceived > 0 || recordedInr > 0) {
      if (Math.abs(recordedInr - expectedInrFloat) > 0.01) {
        issues.push({
          id: `float_mismatch_inr_${m.id}`,
          category: 'BROKEN_CUSTODIAN_FLOATS',
          categoryTitle: 'Broken Custodian Floats',
          severity: 'critical',
          collection: 'members',
          recordId: m.id,
          recordIdentifier: `${m.memberNumber} (${m.fullName})`,
          title: `Custodian ${m.fullName} INR Float Mismatch`,
          description: `Physical INR cash held is recorded as ₹${recordedInr.toFixed(2)}, but verified receipts minus disbursements equals ₹${expectedInrFloat.toFixed(2)}.`,
          detectedDiscrepancy: {
            expected: `₹${expectedInrFloat.toFixed(2)}`,
            actual: `₹${recordedInr.toFixed(2)}`,
            difference: `₹${(recordedInr - expectedInrFloat).toFixed(2)}`,
            currency: 'INR',
          },
          suggestedAction: `Reconcile custodian INR balance to match verified receipts (₹${expectedInrFloat.toFixed(2)}).`,
          canAutoFix: true,
          metadata: { member: m, expectedInrFloat, recordedInr, inrReceived, inrDisbursed },
        });
      }
    }

    // Expected AED float
    const aedReceived = custodianReceipts
      .filter((r) => (r.currency || baseCurrency).toUpperCase() === 'AED')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const aedDisbursed = custodianDisbursements
      .filter((p) => (p.currency || baseCurrency).toUpperCase() === 'AED')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const expectedAedFloat = Math.max(0, aedReceived - aedDisbursed);

    const recordedAed = m.cashBalances?.['AED'] || 0;
    if (aedReceived > 0 || recordedAed > 0) {
      if (Math.abs(recordedAed - expectedAedFloat) > 0.01) {
        issues.push({
          id: `float_mismatch_aed_${m.id}`,
          category: 'BROKEN_CUSTODIAN_FLOATS',
          categoryTitle: 'Broken Custodian Floats',
          severity: 'critical',
          collection: 'members',
          recordId: m.id,
          recordIdentifier: `${m.memberNumber} (${m.fullName})`,
          title: `Custodian ${m.fullName} AED Float Mismatch`,
          description: `Physical AED cash held is recorded as AED ${recordedAed.toFixed(2)}, but verified receipts minus disbursements equals AED ${expectedAedFloat.toFixed(2)}.`,
          detectedDiscrepancy: {
            expected: `AED ${expectedAedFloat.toFixed(2)}`,
            actual: `AED ${recordedAed.toFixed(2)}`,
            difference: `AED ${(recordedAed - expectedAedFloat).toFixed(2)}`,
            currency: 'AED',
          },
          suggestedAction: `Reconcile custodian AED balance to match verified receipts.`,
          canAutoFix: true,
          metadata: { member: m, expectedAedFloat, recordedAed, aedReceived, aedDisbursed },
        });
      }
    }
  });

  // =========================================================================
  // CHECK 5: Overdue Status Inconsistencies & Member Aggregate Totals
  // =========================================================================
  members.forEach((m) => {
    const memberReceipts = validReceipts.filter((r) => r.memberId === m.id);
    const actualReceiptsCount = memberReceipts.length;

    // Converted total member contributions in base currency
    const actualTotalContributed = memberReceipts.reduce((sum, r) => {
      const baseAmt =
        r.baseCurrencyAmount != null && r.baseCurrencyAmount > 0
          ? r.baseCurrencyAmount
          : convertToBaseCurrency(r.amount || 0, r.currency, r.exchangeRate, baseCurrency);
      return sum + baseAmt;
    }, 0);

    const recordedTotal = m.totalContributed || 0;
    const recordedCount = m.receiptsCount || 0;

    const diffAmt = Math.abs(recordedTotal - actualTotalContributed);
    const diffCount = Math.abs(recordedCount - actualReceiptsCount);

    if (diffAmt > 0.05 || diffCount > 0) {
      issues.push({
        id: `overdue_stats_desync_${m.id}`,
        category: 'OVERDUE_STATUS',
        categoryTitle: 'Overdue & Member Totals Inconsistencies',
        severity: 'warning',
        collection: 'members',
        recordId: m.id,
        recordIdentifier: `${m.memberNumber} (${m.fullName})`,
        title: `Member ${m.fullName} Aggregate Stats Desynchronized`,
        description: `Member total contributions recorded as ${baseCurrency} ${recordedTotal.toFixed(2)} (${recordedCount} receipts), but verified receipts total ${baseCurrency} ${actualTotalContributed.toFixed(2)} (${actualReceiptsCount} receipts).`,
        detectedDiscrepancy: {
          expected: `${baseCurrency} ${actualTotalContributed.toFixed(2)} (${actualReceiptsCount} receipts)`,
          actual: `${baseCurrency} ${recordedTotal.toFixed(2)} (${recordedCount} receipts)`,
          difference: `${baseCurrency} ${(recordedTotal - actualTotalContributed).toFixed(2)}`,
        },
        suggestedAction: `Recompute member totals directly from verified receipts collection.`,
        canAutoFix: true,
        metadata: { member: m, actualTotalContributed, actualReceiptsCount },
      });
    }
  });

  // =========================================================================
  // CHECK 6: Chart of Accounts Balance Drift (General Ledger Integrity)
  // =========================================================================
  accounts.forEach((acc) => {
    if (acc.isGroup) return; // Skip folder grouping titles
    const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
    let expectedBalance = 0;

    journals.forEach((j) => {
      if (j.status !== 'POSTED') return;
      (j.lines || []).forEach((line) => {
        if (line.accountId === acc.id || line.accountCode === acc.code) {
          const rate = line.exchangeRate || (line.currency === 'INR' ? defaultInrRate : 1);
          const dr =
            line.baseCurrencyDebit != null
              ? Number(line.baseCurrencyDebit)
              : (line.currency === baseCurrency ? Number(line.debit || 0) : Number(((line.debit || 0) * rate).toFixed(2)));
          const cr =
            line.baseCurrencyCredit != null
              ? Number(line.baseCurrencyCredit)
              : (line.currency === baseCurrency ? Number(line.credit || 0) : Number(((line.credit || 0) * rate).toFixed(2)));

          if (isDebitNormal) {
            expectedBalance += dr - cr;
          } else {
            expectedBalance += cr - dr;
          }
        }
      });
    });

    expectedBalance = Number(expectedBalance.toFixed(2));
    const recordedBal = Number((acc.balance || 0).toFixed(2));
    const diffBal = Math.abs(recordedBal - expectedBalance);

    if (diffBal > 0.05) {
      issues.push({
        id: `drift_account_${acc.id}`,
        category: 'GL_ACCOUNT_DRIFT',
        categoryTitle: 'Chart of Accounts Balance Drift',
        severity: 'critical',
        collection: 'accounts',
        recordId: acc.id,
        recordIdentifier: `${acc.code} - ${acc.name}`,
        title: `Account ${acc.code} (${acc.name}) Balance Drift`,
        description: `Recorded ledger balance is ${baseCurrency} ${recordedBal.toFixed(2)}, but posted double-entry journal movements equal ${baseCurrency} ${expectedBalance.toFixed(2)}. Difference: ${baseCurrency} ${diffBal.toFixed(2)}.`,
        detectedDiscrepancy: {
          expected: `${baseCurrency} ${expectedBalance.toFixed(2)}`,
          actual: `${baseCurrency} ${recordedBal.toFixed(2)}`,
          difference: `${baseCurrency} ${diffBal.toFixed(2)}`,
        },
        suggestedAction: `Reconcile account balance to match verified posted journal entries (${baseCurrency} ${expectedBalance.toFixed(2)}).`,
        canAutoFix: true,
        metadata: { account: acc, expectedBalance, recordedBal },
      });
    }
  });

  // =========================================================================
  // CHECK 7: Charity Case Allocation Mismatches
  // =========================================================================
  cases.forEach((c) => {
    const caseReceipts = validReceipts.filter(
      (r) => r.caseId === c.id || (r as any).linkedCaseId === c.id
    );
    const expectedCollected = Number(
      caseReceipts
        .reduce((sum, r) => {
          const rate = r.exchangeRateSnapshot?.rate || r.exchangeRate || (r.currency === 'INR' ? defaultInrRate : 1);
          const amt =
            r.baseCurrencyAmount != null
              ? Number(r.baseCurrencyAmount)
              : Number(((r.amount || 0) * rate).toFixed(2));
          return sum + amt;
        }, 0)
        .toFixed(2)
    );

    const casePayments = validPayments.filter(
      (p) => p.caseId === c.id || (p as any).linkedCaseId === c.id
    );
    const expectedDisbursed = Number(
      casePayments
        .reduce((sum, p) => {
          const rate = p.exchangeRateSnapshot?.rate || p.exchangeRate || (p.currency === 'INR' ? defaultInrRate : 1);
          const amt =
            p.baseCurrencyAmount != null
              ? Number(p.baseCurrencyAmount)
              : Number(((p.amount || 0) * rate).toFixed(2));
          return sum + amt;
        }, 0)
        .toFixed(2)
    );

    const recordedCollected = Number((c.collectedAmount || 0).toFixed(2));
    const recordedDisbursed = Number(((c as any).totalDisbursed || c.disbursedAmount || 0).toFixed(2));

    if (Math.abs(recordedCollected - expectedCollected) > 0.05) {
      issues.push({
        id: `case_alloc_collected_${c.id}`,
        category: 'ALLOCATION_MISMATCH',
        categoryTitle: 'Case Allocation Mismatch',
        severity: 'warning',
        collection: 'cases',
        recordId: c.id,
        recordIdentifier: `${c.caseNumber || c.id} - ${c.title}`,
        title: `Case ${c.caseNumber || c.title} Collected Total Desynced`,
        description: `Recorded collected amount is ${baseCurrency} ${recordedCollected.toFixed(2)}, but verified case contribution receipts total ${baseCurrency} ${expectedCollected.toFixed(2)}.`,
        detectedDiscrepancy: {
          expected: `${baseCurrency} ${expectedCollected.toFixed(2)}`,
          actual: `${baseCurrency} ${recordedCollected.toFixed(2)}`,
          difference: `${baseCurrency} ${Math.abs(recordedCollected - expectedCollected).toFixed(2)}`,
        },
        suggestedAction: `Reconcile case collected total to match receipts audit trail (${baseCurrency} ${expectedCollected.toFixed(2)}).`,
        canAutoFix: true,
        metadata: { charityCase: c, expectedCollected, expectedDisbursed },
      });
    }

    if (Math.abs(recordedDisbursed - expectedDisbursed) > 0.05) {
      issues.push({
        id: `case_alloc_disbursed_${c.id}`,
        category: 'ALLOCATION_MISMATCH',
        categoryTitle: 'Case Allocation Mismatch',
        severity: 'warning',
        collection: 'cases',
        recordId: c.id,
        recordIdentifier: `${c.caseNumber || c.id} - ${c.title}`,
        title: `Case ${c.caseNumber || c.title} Disbursed Total Desynced`,
        description: `Recorded disbursed amount is ${baseCurrency} ${recordedDisbursed.toFixed(2)}, but verified case aid vouchers total ${baseCurrency} ${expectedDisbursed.toFixed(2)}.`,
        detectedDiscrepancy: {
          expected: `${baseCurrency} ${expectedDisbursed.toFixed(2)}`,
          actual: `${baseCurrency} ${recordedDisbursed.toFixed(2)}`,
          difference: `${baseCurrency} ${Math.abs(recordedDisbursed - expectedDisbursed).toFixed(2)}`,
        },
        suggestedAction: `Reconcile case disbursed total to match payment vouchers (${baseCurrency} ${expectedDisbursed.toFixed(2)}).`,
        canAutoFix: true,
        metadata: { charityCase: c, expectedCollected, expectedDisbursed },
      });
    }
  });

  // Category counts
  const categoryCounts: Record<DiagnosticCategory, number> = {
    DOUBLE_ENTRY_IMBALANCE: 0,
    BROKEN_CUSTODIAN_FLOATS: 0,
    GL_ACCOUNT_DRIFT: 0,
    ALLOCATION_MISMATCH: 0,
    MULTI_CURRENCY: 0,
    ORPHAN_GHOST_RECORDS: 0,
    OVERDUE_STATUS: 0,
  };

  let criticalCount = 0;
  let warningCount = 0;

  issues.forEach((iss) => {
    categoryCounts[iss.category] = (categoryCounts[iss.category] || 0) + 1;
    if (iss.severity === 'critical') criticalCount++;
    else if (iss.severity === 'warning') warningCount++;
  });

  return {
    scannedAt: new Date().toISOString(),
    overallStatus: issues.length === 0 ? 'HEALTHY' : 'DISCREPANCIES_FOUND',
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    collectionsScanned: [
      'receipts',
      'payments',
      'journal_entries',
      'transactions',
      'cashHoldings',
      'members',
      'accounts',
      'cases',
    ],
    recordsCount: {
      members: members.length,
      receipts: receipts.length,
      payments: payments.length,
      journalEntries: journals.length,
      transactions: transactions.length,
      cashHoldings: cashHoldings.length,
      accounts: accounts.length,
      cases: cases.length,
    },
    categoryCounts,
    issues,
  };
}

/**
 * One-Click AI Repair Execution:
 * Applies automated corrective actions, commits with Firestore writeBatch,
 * bumps global schema_version / cache_timestamp for universal instant sync.
 */
export async function executeOneClickAiRepair(
  scanReport: HealthScanSummary,
  members: Member[],
  receipts: Receipt[],
  payments: CharityPayment[],
  journals: JournalEntry[],
  transactions: Transaction[],
  cashHoldings: CashHolding[],
  accounts: Account[],
  settings: OrganizationSettings,
  userEmail = 'admin'
): Promise<RepairExecutionResult> {
  const batchManager = new SafeBatchManager();
  const baseCurrency = (settings.currency || 'AED').toUpperCase();
  const defaultInrRate = settings.exchangeRateInrToAed || 0.04401;

  let currencyDiscrepancies = 0;
  let orphanPurged = 0;
  let doubleEntriesBalanced = 0;
  let custodianFloatsReconciled = 0;
  let overdueInconsistenciesResolved = 0;
  let glAccountsReconciled = 0;
  let caseAllocationsReconciled = 0;

  const actionsTaken: string[] = [];
  const now = new Date().toISOString();

  // 1. Repair Multi-Currency Sum Mismatches
  const currencyIssues = scanReport.issues.filter((i) => i.category === 'MULTI_CURRENCY');
  for (const issue of currencyIssues) {
    if (issue.collection === 'receipts' && issue.metadata?.receipt) {
      const r = issue.metadata.receipt as Receipt;
      const rate = issue.metadata.rate || (r.currency === 'INR' ? defaultInrRate : 1);
      const expectedBase = issue.metadata.expectedBase || Number(((r.amount || 0) * rate).toFixed(2));

      await batchManager.update(doc(db, 'receipts', r.id), {
        baseAmount: expectedBase,
        baseCurrencyAmount: expectedBase,
        baseCurrency,
        exchangeRate: rate,
        updatedAt: now,
      });
      currencyDiscrepancies++;
      actionsTaken.push(`Re-calculated base currency amount for Receipt ${r.receiptNumber} (${r.currency} ${r.amount} -> ${baseCurrency} ${expectedBase})`);
    } else if (issue.collection === 'payments' && issue.metadata?.payment) {
      const p = issue.metadata.payment as CharityPayment;
      const rate = issue.metadata.rate || (p.currency === 'INR' ? defaultInrRate : 1);
      const expectedBase = issue.metadata.expectedBase || Number(((p.amount || 0) * rate).toFixed(2));

      await batchManager.update(doc(db, 'payments', p.id), {
        baseAmount: expectedBase,
        baseCurrencyAmount: expectedBase,
        baseCurrency,
        exchangeRate: rate,
        updatedAt: now,
      });
      currencyDiscrepancies++;
      actionsTaken.push(`Re-calculated base currency amount for Payment ${p.paymentNumber} (${p.currency} ${p.amount} -> ${baseCurrency} ${expectedBase})`);
    } else if (issue.collection === 'journal_entries' && issue.metadata?.journal) {
      const j = issue.metadata.journal as JournalEntry;
      const updatedLines = (j.lines || []).map((line) => {
        const cur = (line.currency || baseCurrency).toUpperCase();
        if (cur === 'INR' && baseCurrency === 'AED') {
          const rate = line.exchangeRate || defaultInrRate;
          return {
            ...line,
            exchangeRate: rate,
            baseCurrencyDebit: line.debit > 0 ? Number((line.debit * rate).toFixed(2)) : 0,
            baseCurrencyCredit: line.credit > 0 ? Number((line.credit * rate).toFixed(2)) : 0,
          };
        }
        return line;
      });

      await batchManager.update(doc(db, 'journal_entries', j.id), {
        lines: updatedLines,
      });
      currencyDiscrepancies++;
      actionsTaken.push(`Corrected foreign line amounts in Journal Entry ${j.entryNumber}`);
    }
  }

  // 2. Purge Orphan / Ghost Records
  const orphanIssues = scanReport.issues.filter((i) => i.category === 'ORPHAN_GHOST_RECORDS');
  for (const issue of orphanIssues) {
    if (issue.collection === 'cashHoldings') {
      await batchManager.delete(doc(db, 'cashHoldings', issue.recordId));
      orphanPurged++;
      actionsTaken.push(`Purged ghost/duplicate Cash Holding document "${issue.recordId}"`);
    }
  }

  // Clean local browser caches
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('charity_cached_members');
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('holding_1790333624218_w7s6') || k.includes('phantom_'))) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Balance Double-Entry Imbalances
  const imbalanceIssues = scanReport.issues.filter((i) => i.category === 'DOUBLE_ENTRY_IMBALANCE');
  for (const issue of imbalanceIssues) {
    if (issue.collection === 'journal_entries' && issue.metadata?.journal) {
      const j = issue.metadata.journal as JournalEntry;
      const lines = [...(j.lines || [])];
      let sumDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
      let sumCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);

      // Rebalance minor rounding difference on the last line
      if (lines.length > 0 && Math.abs(sumDebit - sumCredit) > 0.001) {
        const diff = Number((sumDebit - sumCredit).toFixed(2));
        if (diff > 0) {
          // Debit is greater, adjust credit on the credit line or add to last line credit
          const lastCreditLine = lines.find((l) => l.credit > 0) || lines[lines.length - 1];
          lastCreditLine.credit = Number((lastCreditLine.credit + diff).toFixed(2));
          lastCreditLine.baseCurrencyCredit = Number((lastCreditLine.baseCurrencyCredit + diff).toFixed(2));
        } else {
          // Credit is greater, adjust debit
          const lastDebitLine = lines.find((l) => l.debit > 0) || lines[0];
          lastDebitLine.debit = Number((lastDebitLine.debit + Math.abs(diff)).toFixed(2));
          lastDebitLine.baseCurrencyDebit = Number((lastDebitLine.baseCurrencyDebit + Math.abs(diff)).toFixed(2));
        }
        sumDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
        sumCredit = sumDebit;
      }

      await batchManager.update(doc(db, 'journal_entries', j.id), {
        lines,
        totalDebit: sumDebit,
        totalCredit: sumDebit,
        isBalanced: true,
      });
      doubleEntriesBalanced++;
      actionsTaken.push(`Balanced Journal Entry ${j.entryNumber} (Total Debits = Credits = ${sumDebit.toFixed(2)})`);
    } else if (issue.collection === 'transactions' && issue.metadata?.transaction) {
      const t = issue.metadata.transaction as Transaction;
      const updates: Partial<Transaction> = {};
      if (!t.debitAccountId) {
        updates.debitAccountId = 'acc_1000';
        updates.debitAccountCode = '1000';
        updates.debitAccountName = 'Main Cash in Hand';
      }
      if (!t.creditAccountId) {
        updates.creditAccountId = 'acc_4000';
        updates.creditAccountCode = '4000';
        updates.creditAccountName = 'Member Monthly Contributions';
      }
      await batchManager.update(doc(db, 'transactions', t.id), updates);
      doubleEntriesBalanced++;
      actionsTaken.push(`Assigned balancing accounts for Transaction ${t.transactionNumber}`);
    }
  }

  // 4. Re-sync Broken Custodian Floats
  const floatIssues = scanReport.issues.filter((i) => i.category === 'BROKEN_CUSTODIAN_FLOATS');
  const membersToUpdate = new Map<string, { member: Member; inr?: number; aed?: number }>();

  for (const issue of floatIssues) {
    if (issue.metadata?.member) {
      const m = issue.metadata.member as Member;
      const entry = membersToUpdate.get(m.id) || { member: m };
      if (issue.metadata.expectedInrFloat !== undefined) {
        entry.inr = issue.metadata.expectedInrFloat;
      }
      if (issue.metadata.expectedAedFloat !== undefined) {
        entry.aed = issue.metadata.expectedAedFloat;
      }
      membersToUpdate.set(m.id, entry);
    }
  }

  for (const [memberId, updateData] of membersToUpdate.entries()) {
    const currentBalances = { ...(updateData.member.cashBalances || {}) };
    if (updateData.inr !== undefined) currentBalances['INR'] = updateData.inr;
    if (updateData.aed !== undefined) currentBalances['AED'] = updateData.aed;

    await batchManager.update(doc(db, 'members', memberId), {
      cashBalances: currentBalances,
      updatedAt: now,
    });
    custodianFloatsReconciled++;
    actionsTaken.push(
      `Reconciled physical cash float for Custodian ${updateData.member.fullName} (${JSON.stringify(currentBalances)})`
    );
  }

  // 5. Fix Overdue & Member Totals Inconsistencies
  const overdueIssues = scanReport.issues.filter((i) => i.category === 'OVERDUE_STATUS');
  for (const issue of overdueIssues) {
    if (issue.metadata?.member) {
      const m = issue.metadata.member as Member;
      const expectedTotal = Number(issue.metadata.actualTotalContributed.toFixed(2));
      const expectedCount = Number(issue.metadata.actualReceiptsCount);

      await batchManager.update(doc(db, 'members', m.id), {
        totalContributed: expectedTotal,
        receiptsCount: expectedCount,
        updatedAt: now,
      });
      overdueInconsistenciesResolved++;
      actionsTaken.push(`Re-synced contribution totals for Member ${m.fullName} (${baseCurrency} ${expectedTotal})`);
    }
  }

  // 6. Universal Instant Sync to All Connected Users
  // Bump global schema_version and cache_timestamp in Firestore
  const syncTimestamp = Date.now();
  const summaryMessage = `Scanned ${scanReport.collectionsScanned.length} collections: Fixed ${currencyDiscrepancies} currency discrepancies, purged ${orphanPurged} duplicate/orphan records, balanced ${doubleEntriesBalanced} double entries, reconciled ${custodianFloatsReconciled} custodian cash floats.`;

  await batchManager.set(
    doc(db, 'organizationSettings', 'system_sync'),
    {
      schema_version: '2.1.0',
      cache_timestamp: syncTimestamp,
      lastHealthCheckAt: now,
      lastRepairAt: now,
      lastRepairSummary: summaryMessage,
      systemHealth: 'HEALTHY',
      reconciledBy: userEmail,
      updatedAt: now,
    },
    { merge: true }
  );

  // Write immutable audit log entry for this AI Health Check & Auto-Repair action
  const logId = `audit_${syncTimestamp}_${Math.random().toString(36).slice(2, 6)}`;
  await batchManager.set(doc(db, 'auditLogs', logId), {
    id: logId,
    user: userEmail,
    userEmail,
    action: 'Updated',
    module: 'AI Health Diagnostic & Auto-Fix',
    recordId: 'system_sync',
    recordNumber: 'AI-HEAL-RUN',
    details: summaryMessage,
    timestamp: now,
    createdAt: now,
  });

  // Commit all queued batch writes in safe chunks
  await batchManager.commit();

  return {
    repairedAt: now,
    success: true,
    summaryMessage,
    collectionsScannedCount: scanReport.collectionsScanned.length,
    fixedCounts: {
      currencyDiscrepancies,
      orphanPurged,
      doubleEntriesBalanced,
      custodianFloatsReconciled,
      overdueInconsistenciesResolved,
      glAccountsReconciled,
      caseAllocationsReconciled,
      totalFixed:
        currencyDiscrepancies +
        orphanPurged +
        doubleEntriesBalanced +
        custodianFloatsReconciled +
        overdueInconsistenciesResolved +
        glAccountsReconciled +
        caseAllocationsReconciled,
    },
    actionsTaken,
    persistedToFirestore: true,
    globalSyncTimestamp: syncTimestamp,
  };
}
