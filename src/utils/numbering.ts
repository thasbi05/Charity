/**
 * Numbering utilities for automatic document codes and currency formatters.
 * Compliant with specifications:
 * - Receipts: RCPT-YYYY-XXXXX
 * - Charity Assistance Vouchers: PAY-YYYY-XXXXX
 * - Administrative Expense Vouchers: EXP-YYYY-XXXXX
 * - Cases: CASE-YYYY-XXXXX or MED-YYYY-XXXXX
 * - Journal Entries: JRNL-YYYY-XXXXX
 * - Member IDs: MEM-XXXX
 */

export function getNextMemberNumber(existingMembers: { memberNumber: string }[]): string {
  let maxNum = 0;
  for (const m of existingMembers) {
    if (m.memberNumber && m.memberNumber.startsWith('MEM-')) {
      const numPart = parseInt(m.memberNumber.replace('MEM-', ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `MEM-${String(next).padStart(4, '0')}`;
}

export function getNextReceiptNumber(
  existingReceipts: { receiptNumber: string }[],
  year = new Date().getFullYear()
): string {
  const prefix = `RCPT-${year}-`;
  let maxNum = 0;
  for (const r of existingReceipts) {
    if (r.receiptNumber && r.receiptNumber.startsWith(prefix)) {
      const numPart = parseInt(r.receiptNumber.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export function getNextPaymentNumber(
  existingPayments: { paymentNumber: string }[],
  year = new Date().getFullYear(),
  type: 'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE' = 'CHARITY_ASSISTANCE'
): string {
  const code = type === 'ADMINISTRATIVE' ? 'EXP' : 'PAY';
  const prefix = `${code}-${year}-`;
  let maxNum = 0;
  for (const p of existingPayments) {
    if (p.paymentNumber && p.paymentNumber.startsWith(prefix)) {
      const numPart = parseInt(p.paymentNumber.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export function getNextAdminExpenseNumber(
  existingPayments: { paymentNumber: string }[],
  year = new Date().getFullYear()
): string {
  return getNextPaymentNumber(existingPayments, year, 'ADMINISTRATIVE');
}

export function getNextCaseNumber(
  existingCases: { caseNumber: string }[],
  year = new Date().getFullYear(),
  caseType: string = 'General'
): string {
  const isMed = caseType.toLowerCase().includes('med');
  const code = isMed ? 'MED' : 'CASE';
  const prefix = `${code}-${year}-`;
  let maxNum = 0;
  for (const c of existingCases) {
    if (c.caseNumber && (c.caseNumber.startsWith(`CASE-${year}-`) || c.caseNumber.startsWith(`MED-${year}-`))) {
      const parts = c.caseNumber.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export function getNextJournalNumber(
  existingEntries: { entryNumber?: string }[],
  year = new Date().getFullYear()
): string {
  const prefix = `JRNL-${year}-`;
  let maxNum = 0;
  for (const e of existingEntries) {
    if (e.entryNumber && e.entryNumber.startsWith(prefix)) {
      const numPart = parseInt(e.entryNumber.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export function getNextTransactionNumber(
  existingTxns: { transactionNumber: string }[],
  year = new Date().getFullYear()
): string {
  const prefix = `TXN-${year}-`;
  let maxNum = 0;
  for (const t of existingTxns) {
    if (t.transactionNumber && t.transactionNumber.startsWith(prefix)) {
      const numPart = parseInt(t.transactionNumber.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

export function formatCurrency(amount: number, currency = 'AED'): string {
  const symbol = currency === 'INR' || currency === '₹' ? '₹' : currency;
  return `${symbol} ${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
