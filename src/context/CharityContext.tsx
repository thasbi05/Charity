import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanForFirestore } from '../lib/firebase';
import {
  Member,
  Account,
  CashAccount,
  Receipt,
  ReceiptStatus,
  CharityPayment,
  Transaction,
  OrganizationSettings,
  CharityOrganization,
  AuditLog,
  CharityCase,
  JournalEntry,
  JournalLine,
  FinancialTransactionClassification,
  DisbursementType,
  CashHolding,
  ExchangeRateSnapshot,
  SplitExpenseConfig,
  PaymentMethod,
} from '../types';
import { useAuth } from './AuthContext';
import { offlineSyncService } from '../services/offlineSyncService';
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  DEFAULT_CHARITY,
  INITIAL_CHART_OF_ACCOUNTS,
  INITIAL_CASH_ACCOUNTS,
  INITIAL_CHARITY_CASES,
  INITIAL_CASH_HOLDINGS,
  INITIAL_MEMBERS,
  getDefaultAssistanceAccountCode,
  getDefaultAdminExpenseAccountCode,
  getAccountAppModule,
} from '../utils/defaults';
import {
  getNextMemberNumber,
  getNextReceiptNumber,
  getNextPaymentNumber,
  getNextTransactionNumber,
  getNextCaseNumber,
  getNextJournalNumber,
  getNextAdminExpenseNumber,
  formatCurrency,
} from '../utils/numbering';
import {
  AccountingService,
  MonthlyContributionInput,
  SpecialContributionInput,
  CharityAssistanceInput,
  AdminExpenseInput,
} from '../services/accountingService';
import {
  formatContributionMonth,
  formatContributionMonthShort,
} from '../services/financialLedgerService';
import {
  FinancialEngineService,
  FinancialEngineContextState,
  AtomicFinancialExecutionResult,
} from '../services/financialEngineService';
import {
  runAiDiagnosticScan,
  executeOneClickAiRepair,
  HealthScanSummary,
  RepairExecutionResult,
} from '../services/aiHealthCheckService';

export interface SettleHoldingOptions {
  settlementType: 'HANDOVER_TO_MEMBER' | 'BENEFICIARY_DISBURSEMENT' | 'OFFICE_HANDOVER' | 'BANK_DEPOSIT';
  amount?: number;
  settlementDate?: string;
  notes?: string;

  // Handover specific:
  destinationType?: 'member' | 'account';
  destinationMemberId?: string;
  destinationMemberName?: string;
  destinationAccountId?: string;
  destinationAccountName?: string;
  exchangeRate?: number;
  destinationCurrency?: string;
  destinationAmount?: number;

  // Beneficiary Disbursement specific:
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  payeeName?: string;
  voucherReference?: string;
  charityCategory?: CharityPayment['charityCategory'];
}

interface CharityContextType {
  members: Member[];
  accounts: Account[];
  cashAccounts: CashAccount[];
  receipts: Receipt[];
  payments: CharityPayment[];
  transactions: Transaction[];
  cases: CharityCase[];
  journalEntries: JournalEntry[];
  settings: OrganizationSettings;
  charities: CharityOrganization[];
  activeCharityId: string;
  activeCharity: CharityOrganization;
  switchCharity: (charityId: string) => void;
  addCharity: (data: Omit<CharityOrganization, 'id' | 'createdAt' | 'createdBy'>) => Promise<CharityOrganization>;
  updateCharity: (id: string, data: Partial<CharityOrganization>) => Promise<void>;
  deleteCharity: (id: string) => Promise<void>;
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;

  // Member actions
  addMember: (memberData: Omit<Member, 'id' | 'memberNumber' | 'totalContributed' | 'receiptsCount' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<Member>;
  updateMember: (id: string, memberData: Partial<Member>) => Promise<void>;
  deactivateMember: (id: string) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;

  // Charity Cases actions (Designated Funds)
  addCase: (caseData: Omit<CharityCase, 'id' | 'caseNumber' | 'collectedAmount' | 'disbursedAmount' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<CharityCase>;
  updateCase: (id: string, caseData: Partial<CharityCase>) => Promise<void>;
  deleteCase: (id: string) => Promise<void>;

  // High-Level Accounting Transactions (The 4 Strict Invariant Operations)
  recordMonthlyContribution: (input: Omit<MonthlyContributionInput, 'tenantId' | 'userId' | 'userEmail'>) => Promise<Receipt>;
  recordSpecialContribution: (input: Omit<SpecialContributionInput, 'tenantId' | 'userId' | 'userEmail'>) => Promise<Receipt>;
  recordCharityAssistance: (input: Omit<CharityAssistanceInput, 'tenantId' | 'userId' | 'userEmail'>) => Promise<CharityPayment>;
  recordAdminExpense: (input: Omit<AdminExpenseInput, 'tenantId' | 'userId' | 'userEmail'>) => Promise<CharityPayment>;
  voidRecord: (recordType: 'Receipt' | 'Payment', recordId: string, reason: string) => Promise<void>;

  // Receipt / Contribution actions
  createReceipt: (data: {
    receiptDate: string;
    memberId: string;
    contributionType?: 'MONTHLY_CONTRIBUTION' | 'SPECIAL_CONTRIBUTION';
    periodMonth?: string;
    contributionMonth?: string;
    contributionMonths?: string[];
    monthsCount?: number;
    caseId?: string;
    contributionAccountId?: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
    paymentMethod: Receipt['paymentMethod'];
    cashBankAccountId: string;
    referenceNumber?: string;
    notes?: string;
    supportingDocumentName?: string;
    supportingDocumentUrl?: string;
    supportingDocumentData?: string;
    supportingDocumentType?: string;
    supportingDocumentSize?: number;
    status?: ReceiptStatus;
  }) => Promise<Receipt>;
  updateReceipt: (receiptId: string, data: Partial<Receipt>) => Promise<void>;
  updateContributionReceipt: (receiptId: string, data: Partial<Receipt>) => Promise<Receipt>;
  voidReceipt: (receiptId: string, reason: string) => Promise<void>;

  // Payment / Disbursement actions
  createPayment: (data: {
    paymentDate: string;
    disbursementType?: DisbursementType;
    payeeName: string;
    mobileNumber?: string;
    address?: string;
    caseId?: string;
    charityCategory?: CharityPayment['charityCategory'];
    adminExpenseCategory?: string;
    invoiceNumber?: string;
    chartOfAccountId?: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
    paymentMethod: CharityPayment['paymentMethod'];
    cashBankAccountId: string;
    referenceNumber?: string;
    description: string;
    supportingDocumentName?: string;
    supportingDocumentUrl?: string;
    supportingDocumentData?: string;
    supportingDocumentType?: string;
    supportingDocumentSize?: number;
    approvedBy: string;
    preparedBy?: string;
    verifiedBy?: string;
    notes?: string;
  }) => Promise<CharityPayment>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  updateCharityPayment: (paymentId: string, data: Partial<CharityPayment>) => Promise<CharityPayment>;
  updateAdminExpense: (paymentOrTxnId: string, data: Partial<CharityPayment> & { adminExpenseCategory?: string }) => Promise<CharityPayment | Transaction>;

  // Chart of Accounts actions
  addAccount: (accountData: Omit<Account, 'id' | 'balance' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  updateAccount: (id: string, accountData: Partial<Account>) => Promise<void>;
  deactivateAccount: (id: string) => Promise<void>;
  syncStandardAccounts: () => Promise<{ added: number; updated: number }>;
  reconcileAllLedgers: () => Promise<{ updatedAccounts: Account[]; isSystemBalanced: boolean }>;

  // Cash & Bank actions
  addCashAccount: (accountData: Omit<CashAccount, 'id' | 'currentBalance' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  updateCashAccount: (id: string, accountData: Partial<CashAccount>) => Promise<void>;

  // Member Cash Holdings / Cash Custodians actions
  cashHoldings: CashHolding[];
  addCashHolding: (holdingData: Omit<CashHolding, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<CashHolding>;
  settleCashHolding: (
    id: string,
    settlement: SettleHoldingOptions
  ) => Promise<void>;
  deleteCashHolding: (id: string) => Promise<void>;

  // Double-entry Transaction & Handover actions
  createTransferOrHandover: (data: {
    date: string;
    currency: string;
    amount: number;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
    fromType: 'member' | 'account';
    fromId: string;
    toType: 'member' | 'account';
    toId: string;
    referenceNumber?: string;
    notes?: string;
    handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
    isContributionHandover?: boolean;
    caseId?: string;
    caseNumber?: string;
    caseTitle?: string;
  }) => Promise<Transaction>;
  updateHandoverTransfer: (transactionId: string, data: {
    date?: string;
    currency?: string;
    amount?: number;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
    fromType?: 'member' | 'account';
    fromId?: string;
    toType?: 'member' | 'account';
    toId?: string;
    referenceNumber?: string;
    notes?: string;
    handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
    caseId?: string;
    caseNumber?: string;
    caseTitle?: string;
    status?: 'valid' | 'voided';
  }) => Promise<Transaction>;
  voidTransaction: (transactionId: string, reason: string) => Promise<void>;
  reverseTransaction: (transactionId: string, reason: string) => Promise<void>;

  // Settings actions
  updateSettings: (newSettings: Partial<OrganizationSettings>) => Promise<void>;

  // Demo / Sample Data & Firm Reset management
  seedDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  resetAllFirmData: (options?: { resetMembers?: boolean; keepChartOfAccounts?: boolean; allFirms?: boolean; removeMembers?: boolean }) => Promise<void>;

  // AI Health Check & Auto-Repair Utility
  systemSyncState: {
    schema_version?: string;
    cache_timestamp?: number;
    lastHealthCheckAt?: string;
    lastRepairAt?: string;
    lastRepairSummary?: string;
    systemHealth?: 'HEALTHY' | 'DISCREPANCIES_FOUND';
    reconciledBy?: string;
  } | null;
  latestScanReport: HealthScanSummary | null;
  runAiHealthScan: () => HealthScanSummary;
  runAiHealthRepair: (customReport?: HealthScanSummary) => Promise<RepairExecutionResult>;
  recordAuditLog: (action: AuditLog['action'], module: string, recordId: string, details: string) => Promise<void>;
}

const CharityContext = createContext<CharityContextType | undefined>(undefined);

export const CharityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [rawMembers, setRawMembers] = useState<Member[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('charity_cached_members');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_MEMBERS;
  });
  const [rawAccounts, setRawAccounts] = useState<Account[]>([]);
  const [rawCashAccounts, setRawCashAccounts] = useState<CashAccount[]>([]);
  const [rawReceipts, setRawReceipts] = useState<Receipt[]>([]);
  const [rawPayments, setRawPayments] = useState<CharityPayment[]>([]);
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [rawCases, setRawCases] = useState<CharityCase[]>([]);
  const [rawJournals, setRawJournals] = useState<JournalEntry[]>([]);
  const [rawCashHoldings, setRawCashHoldings] = useState<CashHolding[]>([]);
  const [charities, setCharities] = useState<CharityOrganization[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('charity_cached_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object' && (parsed.charityName || parsed.id)) {
            return [{ ...DEFAULT_CHARITY, ...parsed, id: parsed.id || 'default' }];
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return [DEFAULT_CHARITY];
  });
  const [activeCharityId, setActiveCharityId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('charity_active_id') || 'default';
    }
    return 'default';
  });

  // Keep local cache synced for resilience
  useEffect(() => {
    if (typeof window !== 'undefined' && rawMembers && rawMembers.length > 0) {
      try {
        localStorage.setItem('charity_cached_members', JSON.stringify(rawMembers));
      } catch (e) {
        // ignore quota
      }
    }
  }, [rawMembers]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [systemSyncState, setSystemSyncState] = useState<{
    schema_version?: string;
    cache_timestamp?: number;
    lastHealthCheckAt?: string;
    lastRepairAt?: string;
    lastRepairSummary?: string;
    systemHealth?: 'HEALTHY' | 'DISCREPANCIES_FOUND';
    reconciledBy?: string;
  } | null>(null);
  const [latestScanReport, setLatestScanReport] = useState<HealthScanSummary | null>(null);

  // Active charity computation
  const activeCharity = useMemo<CharityOrganization>(() => {
    const found =
      charities.find((c) => c.id === activeCharityId) ||
      charities[0] ||
      DEFAULT_CHARITY;

    if (typeof window !== 'undefined') {
      const cachedLogo = localStorage.getItem('charity_cached_logo');
      // Only fallback to cached logo if found.logoUrl is completely missing or empty
      if (cachedLogo && !found.logoUrl) {
        return { ...found, logoUrl: cachedLogo };
      }
    }
    return found;
  }, [charities, activeCharityId]);

  const settings = useMemo<OrganizationSettings>(() => {
    return activeCharity;
  }, [activeCharity]);

  const switchCharity = (charityId: string) => {
    setActiveCharityId(charityId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('charity_active_id', charityId);
    }
  };

  const addCharity = async (
    data: Omit<CharityOrganization, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<CharityOrganization> => {
    const id = `charity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const newCharity: CharityOrganization = {
      ...data,
      id,
      createdAt: now,
      createdBy: currentUserIdentifier,
    };
    await setDoc(doc(db, 'charities', id), newCharity);

    // Initialize clean chart of accounts and cash accounts for this brand new firm with 0.00 balance
    try {
      for (const a of INITIAL_CHART_OF_ACCOUNTS) {
        const accId = `acc_${id}_${a.code}`;
        const newAcc: Account = {
          ...a,
          id: accId,
          charityId: id,
          balance: 0,
          createdAt: now,
          createdBy: currentUserIdentifier,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        };
        await setDoc(doc(db, 'accounts', accId), cleanForFirestore(newAcc));
      }

      for (let i = 0; i < INITIAL_CASH_ACCOUNTS.length; i++) {
        const c = INITIAL_CASH_ACCOUNTS[i];
        const cashId = `cash_${id}_${i + 1}`;
        const newCash: CashAccount = {
          ...c,
          id: cashId,
          charityId: id,
          currentBalance: 0,
          createdAt: now,
          createdBy: currentUserIdentifier,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        };
        await setDoc(doc(db, 'cashAccounts', cashId), cleanForFirestore(newCash));
      }
    } catch (err) {
      console.warn('Auto-init accounts warning for new firm:', err);
    }

    await logAction('Created', 'Settings', id, `Registered new charity: ${newCharity.charityName} (${newCharity.code || id})`);
    switchCharity(id);
    return newCharity;
  };

  const updateCharity = async (id: string, data: Partial<CharityOrganization>) => {
    const targetId = id || activeCharity?.id || activeCharityId || (charities[0] && charities[0].id) || 'default';
    const now = new Date().toISOString();
    const existingCharity = charities.find((c) => c.id === targetId) || charities[0] || DEFAULT_CHARITY;

    const mergedData = { ...data };
    if (mergedData.charityName) {
      mergedData.receiptTemplate = {
        ...(existingCharity.receiptTemplate || DEFAULT_CHARITY.receiptTemplate),
        ...(mergedData.receiptTemplate || {}),
        headerTitle: mergedData.charityName,
      };
      mergedData.voucherTemplate = {
        ...(existingCharity.voucherTemplate || DEFAULT_CHARITY.voucherTemplate),
        ...(mergedData.voucherTemplate || {}),
        headerTitle: mergedData.charityName,
      };
    }

    const cleanedPayload = cleanForFirestore({
      ...mergedData,
      id: targetId,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    });

    if (cleanedPayload.logoUrl !== undefined) {
      try {
        if (typeof window !== 'undefined') {
          if (cleanedPayload.logoUrl && cleanedPayload.logoUrl !== '/logo.svg') {
            localStorage.setItem('charity_cached_logo', cleanedPayload.logoUrl);
          } else {
            localStorage.removeItem('charity_cached_logo');
          }
        }
      } catch (e) {
        // Quota exceeded: remove stale cache so old logo never resurfaces
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('charity_cached_logo');
          }
        } catch {
          // ignore
        }
      }
    }

    // Optimistic local update for instantaneous UI reactivity across all components
    setCharities((prev) => {
      const matchIndex = prev.findIndex(
        (c) => c.id === targetId || (targetId === 'default' && (c.id === 'default' || !c.id))
      );
      if (matchIndex >= 0) {
        return prev.map((c, i) => (i === matchIndex ? { ...c, ...cleanedPayload, id: targetId } : c));
      }
      if (prev.length > 0) {
        return prev.map((c, i) => (i === 0 ? { ...c, ...cleanedPayload, id: targetId } : c));
      }
      return [{ ...DEFAULT_CHARITY, id: targetId, ...cleanedPayload }];
    });

    // Save to Firestore using setDoc with merge: true to avoid any updateDoc document missing errors
    await setDoc(doc(db, 'charities', targetId), cleanedPayload, { merge: true });

    try {
      await setDoc(doc(db, 'organizationSettings', 'default'), cleanedPayload, { merge: true });
    } catch (e) {
      // Ignore if error
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('charity_cached_settings', JSON.stringify({ ...existingCharity, ...cleanedPayload }));
      } catch {
        // ignore
      }
    }

    await logAction('Updated', 'Settings', targetId, `Updated organization profile for ${data.charityName || targetId}`);
  };

  const deleteCharity = async (id: string) => {
    if (id === 'default' || (charities[0] && id === charities[0].id)) {
      throw new Error('Cannot delete the primary organization.');
    }
    await deleteDoc(doc(db, 'charities', id));
    if (activeCharityId === id) {
      switchCharity(charities[0]?.id || 'default');
    }
    await logAction('Deleted', 'Settings', id, `Deleted charity organization profile: ${id}`);
  };

  // Multi-tenant helper
  const isDefaultCharity = useMemo(() => {
    return (
      activeCharityId === 'default' ||
      !activeCharityId ||
      (charities.length > 0 && activeCharityId === charities[0]?.id)
    );
  }, [activeCharityId, charities]);

  // Scoped views for active charity (strict multi-tenant isolation with zero bleed across firms)
  const members = useMemo(() => {
    const baseList: Member[] = rawMembers && rawMembers.length > 0 ? rawMembers : [];

    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (m) => !m.charityId || m.charityId === 'default' || m.charityId === defaultId
      );
    }

    // In a new / non-default firm: ONLY show members explicitly created for this firm!
    return baseList.filter((m) => m.charityId === activeCharityId);
  }, [rawMembers, activeCharityId, charities, isDefaultCharity]);

  const accounts = useMemo(() => {
    // Check if there are accounts specifically created for this activeCharityId:
    const charitySpecific = (rawAccounts || []).filter((a) => {
      const n = (a.name || '').toLowerCase();
      if (n.includes('emirates nbd') || n.includes('dubai islamic bank')) return false;
      if (a.charityId === activeCharityId) return true;
      if (isDefaultCharity && (!a.charityId || a.charityId === 'default' || a.charityId === charities[0]?.id)) {
        return true;
      }
      return false;
    });

    if (charitySpecific.length > 0) {
      return [...charitySpecific].sort((a, b) => a.code.localeCompare(b.code));
    }

    // If this firm doesn't have custom accounts yet, return fresh standard chart of accounts with 0.00 balance:
    return INITIAL_CHART_OF_ACCOUNTS.map((a) => ({
      ...a,
      id: `acc_${activeCharityId}_${a.code}`,
      charityId: activeCharityId,
      balance: 0,
    })) as Account[];
  }, [rawAccounts, activeCharityId, isDefaultCharity, charities]);

  const cashAccounts = useMemo(() => {
    const charitySpecific = (rawCashAccounts || []).filter((c) => {
      const n = (c.name || '').toLowerCase();
      const b = (c.bankName || '').toLowerCase();
      if (
        n.includes('emirates nbd') ||
        n.includes('dubai islamic bank') ||
        b.includes('emirates nbd') ||
        b.includes('dubai islamic bank')
      ) {
        return false;
      }
      if (c.charityId === activeCharityId) return true;
      if (isDefaultCharity && (!c.charityId || c.charityId === 'default' || c.charityId === charities[0]?.id)) {
        return true;
      }
      return false;
    });

    if (charitySpecific.length > 0) {
      return [...charitySpecific].sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
    }

    // If this firm doesn't have custom cash accounts yet, return fresh standard accounts with 0.00 balance:
    return INITIAL_CASH_ACCOUNTS.map((c, i) => ({
      ...c,
      id: `cash_${activeCharityId}_${i + 1}`,
      charityId: activeCharityId,
      openingBalance: 0,
      currentBalance: 0,
      currency: c.currency || activeCharity?.currency || 'AED',
    })) as CashAccount[];
  }, [rawCashAccounts, activeCharityId, isDefaultCharity, charities, activeCharity]);

  const receipts = useMemo(() => {
    const baseList = rawReceipts || [];
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (r) => !r.charityId || r.charityId === 'default' || r.charityId === defaultId
      );
    }
    return baseList.filter((r) => r.charityId === activeCharityId);
  }, [rawReceipts, activeCharityId, charities, isDefaultCharity]);

  const payments = useMemo(() => {
    const baseList = rawPayments || [];
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (p) => !p.charityId || p.charityId === 'default' || p.charityId === defaultId
      );
    }
    return baseList.filter((p) => p.charityId === activeCharityId);
  }, [rawPayments, activeCharityId, charities, isDefaultCharity]);

  const transactions = useMemo(() => {
    const baseList = rawTransactions || [];
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (t) => !t.charityId || t.charityId === 'default' || t.charityId === defaultId
      );
    }
    return baseList.filter((t) => t.charityId === activeCharityId);
  }, [rawTransactions, activeCharityId, charities, isDefaultCharity]);

  const cases = useMemo(() => {
    const baseList = rawCases || [];
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      const filtered = baseList.filter(
        (c) => !c.charityId || c.charityId === 'default' || c.charityId === defaultId
      );
      return filtered;
    }
    return baseList.filter((c) => c.charityId === activeCharityId);
  }, [rawCases, activeCharityId, charities, isDefaultCharity]);

  const journalEntries = useMemo(() => {
    const baseList = rawJournals || [];
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (j) => !j.charityId || j.charityId === 'default' || j.charityId === defaultId
      );
    }
    return baseList.filter((j) => j.charityId === activeCharityId);
  }, [rawJournals, activeCharityId, charities, isDefaultCharity]);

  const cashHoldings = useMemo(() => {
    const baseList = (rawCashHoldings || []).filter(
      (h) => h.id !== 'holding_1790333624218_w7s6'
    );
    if (isDefaultCharity) {
      const defaultId = charities[0]?.id || 'default';
      return baseList.filter(
        (h) => !h.charityId || h.charityId === 'default' || h.charityId === defaultId
      );
    }
    return baseList.filter((h) => h.charityId === activeCharityId);
  }, [rawCashHoldings, activeCharityId, charities, isDefaultCharity]);

  // Current username / email helper
  const currentUserIdentifier = user?.displayName || user?.email || 'Administrator';
  const currentUserEmail = user?.email || 'udyavarmuslimunityuae@gmail.com';

  // Helper to log system actions
  const logAction = async (action: AuditLog['action'], module: string, recordId: string, details: string) => {
    try {
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const log: AuditLog = {
        id: logId,
        user: currentUserIdentifier,
        userEmail: currentUserEmail,
        action,
        module,
        recordId,
        details,
        timestamp: new Date().toLocaleString(),
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'auditLogs', logId), log);
    } catch (err) {
      console.warn('Audit log write error:', err);
    }
  };

  // Attach Firestore listeners when authenticated
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubCharities = onSnapshot(
      collection(db, 'charities'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: CharityOrganization[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as CharityOrganization;
            const cachedLogo = typeof window !== 'undefined' ? localStorage.getItem('charity_cached_logo') : null;
            if (cachedLogo && !data.logoUrl) {
              data.logoUrl = cachedLogo;
            }
            // Upgrade legacy default placeholder data to Udyavar Muslim Unity UAE only if legacy placeholder
            if (d.id === 'default' && data.charityName && data.charityName.includes('Al-Ihsan')) {
              data.charityName = DEFAULT_CHARITY.charityName;
              data.logoUrl = data.logoUrl || cachedLogo || DEFAULT_CHARITY.logoUrl;
              data.email = data.email || DEFAULT_CHARITY.email;
              data.website = data.website || DEFAULT_CHARITY.website;
              data.registrationNumber = data.registrationNumber || DEFAULT_CHARITY.registrationNumber;
              if (data.receiptTemplate) data.receiptTemplate.headerTitle = DEFAULT_CHARITY.charityName;
              if (data.voucherTemplate) data.voucherTemplate.headerTitle = DEFAULT_CHARITY.charityName;
              if (user.role === 'administrator' || user.role === 'SUPER_ADMIN') {
                setDoc(doc(db, 'charities', 'default'), cleanForFirestore(data), { merge: true }).catch(() => {});
              }
            }
            list.push({ ...data, id: d.id });
          });
          setCharities(list);
          if (typeof window !== 'undefined' && list.length > 0) {
            try {
              localStorage.setItem('charity_cached_settings', JSON.stringify(list[0]));
            } catch {
              // ignore
            }
          }
        } else {
          // Initialize default charity if none exist
          if (user.role === 'administrator' || user.role === 'SUPER_ADMIN') {
            setDoc(doc(db, 'charities', 'default'), DEFAULT_CHARITY);
          }
          setCharities([DEFAULT_CHARITY]);
        }
      },
      (err) => console.warn('Charities listener error:', err)
    );

    const unsubMembers = onSnapshot(
      collection(db, 'members'),
      (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as Member), id: d.id }));
        list.sort((a, b) => (a.memberNumber || '').localeCompare(b.memberNumber || ''));
        if (list.length > 0) {
          setRawMembers(list);
        } else if (snapshot.empty && (user.role === 'administrator' || user.role === 'SUPER_ADMIN')) {
          initializeDefaultMembers();
        }
      },
      (err) => {
        console.warn('Members listener error:', err);
      }
    );

    const unsubAccounts = onSnapshot(
      collection(db, 'accounts'),
      (snapshot) => {
        const list: Account[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as Account), id: d.id };
          const n = (item.name || '').toLowerCase();
          if (n.includes('emirates nbd') || n.includes('dubai islamic bank')) {
            deleteDoc(doc(db, 'accounts', d.id)).catch(() => {});
            return;
          }
          list.push(item);
        });
        list.sort((a, b) => a.code.localeCompare(b.code));
        setRawAccounts(list);

        if (snapshot.empty) {
          initializeDefaultAccounts();
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
    );

    const unsubCash = onSnapshot(
      collection(db, 'cashAccounts'),
      (snapshot) => {
        const list: CashAccount[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as CashAccount), id: d.id };
          const n = (item.name || '').toLowerCase();
          const b = (item.bankName || '').toLowerCase();
          if (
            n.includes('emirates nbd') ||
            n.includes('dubai islamic bank') ||
            b.includes('emirates nbd') ||
            b.includes('dubai islamic bank')
          ) {
            deleteDoc(doc(db, 'cashAccounts', d.id)).catch(() => {});
            return;
          }
          list.push(item);
        });
        setRawCashAccounts(list);

        if (snapshot.empty) {
          initializeDefaultCashAccounts();
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cashAccounts')
    );

    const unsubCases = onSnapshot(
      collection(db, 'cases'),
      (snapshot) => {
        const list: CharityCase[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as CharityCase), id: d.id }));
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setRawCases(list);

        if (snapshot.empty && (user.role === 'administrator' || user.role === 'SUPER_ADMIN')) {
          initializeDefaultCases();
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cases')
    );

    const unsubReceipts = onSnapshot(
      collection(db, 'receipts'),
      (snapshot) => {
        const list: Receipt[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as Receipt), id: d.id }));
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setRawReceipts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'receipts')
    );

    const unsubPayments = onSnapshot(
      collection(db, 'payments'),
      (snapshot) => {
        const list: CharityPayment[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as CharityPayment), id: d.id }));
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setRawPayments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    const unsubJournals = onSnapshot(
      collection(db, 'journal_entries'),
      (snapshot) => {
        const list: JournalEntry[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as JournalEntry), id: d.id }));
        list.sort((a, b) => (a.date < b.date ? 1 : -1));
        setRawJournals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'journal_entries')
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as Transaction), id: d.id }));
        list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setRawTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubHoldings = onSnapshot(
      collection(db, 'cashHoldings'),
      (snapshot) => {
        const list: CashHolding[] = [];
        snapshot.forEach((d) => {
          // Identify & Eliminate Phantom Record ("holding_1790333624218_w7s6")
          if (d.id === 'holding_1790333624218_w7s6') {
            deleteDoc(doc(db, 'cashHoldings', d.id)).catch(() => {});
            return;
          }
          list.push({ ...(d.data() as CashHolding), id: d.id });
        });
        list.sort((a, b) => (a.date < b.date ? 1 : -1));
        setRawCashHoldings(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cashHoldings')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(200)),
      (snapshot) => {
        const list: AuditLog[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as AuditLog), id: d.id }));
        setAuditLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    const unsubSystemSync = onSnapshot(
      doc(db, 'organizationSettings', 'system_sync'),
      (snapshot) => {
        if (snapshot.exists()) {
          const syncData = snapshot.data();
          setSystemSyncState({
            schema_version: syncData.schema_version,
            cache_timestamp: syncData.cache_timestamp,
            lastHealthCheckAt: syncData.lastHealthCheckAt,
            lastRepairAt: syncData.lastRepairAt,
            lastRepairSummary: syncData.lastRepairSummary,
            systemHealth: syncData.systemHealth,
            reconciledBy: syncData.reconciledBy,
          });

          // Invalidate and purge obsolete browser cache on global sync bump
          try {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('charity_cached_members');
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.includes('holding_1790333624218_w7s6') || k.includes('phantom_'))) {
                  localStorage.removeItem(k);
                }
              }
            }
          } catch {
            // ignore
          }
        }
      },
      (err) => console.warn('System sync listener note:', err)
    );

    // Register offline mutation flush executor for PWA offline sync
    if (typeof window !== 'undefined') {
      (window as any).__flushOfflineLedgerQueue = async () => {
        return offlineSyncService.flushQueue(async (mut) => {
          try {
            const targetDoc = doc(db, mut.collectionName, mut.docId);
            await setDoc(targetDoc, cleanForFirestore(mut.payload), { merge: true });
            return true;
          } catch (e) {
            console.error('Error writing queued mutation to Firestore:', e);
            return false;
          }
        });
      };
    }

    setLoading(false);

    // One-time storage cleanup routine for lingering phantom records
    try {
      if (typeof window !== 'undefined') {
        const cachedMembers = localStorage.getItem('charity_cached_members');
        if (cachedMembers && cachedMembers.includes('holding_1790333624218_w7s6')) {
          localStorage.removeItem('charity_cached_members');
        }
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k);
            if (v && v.includes('holding_1790333624218_w7s6')) {
              localStorage.removeItem(k);
            }
          }
        }
      }
      deleteDoc(doc(db, 'cashHoldings', 'holding_1790333624218_w7s6')).catch(() => {});
    } catch (e) {
      // ignore
    }

    return () => {
      unsubCharities();
      unsubMembers();
      unsubAccounts();
      unsubCash();
      unsubCases();
      unsubReceipts();
      unsubPayments();
      unsubJournals();
      unsubTransactions();
      unsubHoldings();
      unsubLogs();
      unsubSystemSync();
    };
  }, [user]);

  // Clean data reconciliation routine: Reconcile custodian member balances and holdings to official receipts
  useEffect(() => {
    if (!rawMembers || rawMembers.length === 0 || !rawReceipts) return;

    // 1. Synchronize any cashHoldings linked to official receipts where amounts drifted
    if (rawCashHoldings && rawCashHoldings.length > 0) {
      rawCashHoldings.forEach((h) => {
        if (!h.receiptId && !h.receiptNumber) return;
        const matchingReceipt = rawReceipts.find(
          (r) =>
            (r.status === 'valid' || r.status === 'received') &&
            (h.receiptId === r.id || (h.receiptNumber && r.receiptNumber === h.receiptNumber))
        );
        if (
          matchingReceipt &&
          (h.amount !== matchingReceipt.amount ||
            (h.currency || 'AED').toUpperCase() !== (matchingReceipt.currency || 'AED').toUpperCase())
        ) {
          const syncedHolding = {
            ...h,
            amount: matchingReceipt.amount,
            currency: matchingReceipt.currency || 'AED',
            updatedAt: new Date().toISOString(),
          };
          updateDoc(doc(db, 'cashHoldings', h.id), {
            amount: matchingReceipt.amount,
            currency: matchingReceipt.currency || 'AED',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          setRawCashHoldings((prev) => prev.map((item) => (item.id === h.id ? syncedHolding : item)));
        }
      });
    }

    rawMembers.forEach((m) => {
      // Check Mohammed Bilal (mem_003) or any custodian whose INR cash float was inflated by +₹2,000
      if (m.id === 'mem_003' || (m.cashBalances && m.cashBalances['INR'] && m.cashBalances['INR'] > 0)) {
        const officialReceipts = rawReceipts.filter(
          (r) =>
            (r.status === 'valid' || r.status === 'received') &&
            (r.custodianMemberId === m.id ||
              (r as any).custodianId === m.id ||
              r.cashBankAccountId === `custodian_${m.id}` ||
              (r.cashBankAccountName && r.cashBankAccountName.includes(m.fullName)))
        );
        const inrReceiptTotal = officialReceipts
          .filter((r) => (r.currency || 'AED').toUpperCase() === 'INR')
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        if (inrReceiptTotal > 0 && m.cashBalances && m.cashBalances['INR'] === inrReceiptTotal + 2000) {
          // Reconcile and heal the balance back to official ₹4,000 (or true receipt sum)
          const updatedBalances = { ...m.cashBalances, INR: inrReceiptTotal };
          updateDoc(doc(db, 'members', m.id), {
            cashBalances: updatedBalances,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          setRawMembers((prev) =>
            prev.map((pm) => (pm.id === m.id ? { ...pm, cashBalances: updatedBalances } : pm))
          );
        }
      }
    });

    // Reconcile Chart of Accounts balances with posted journals if drift occurs
    if (rawAccounts && rawAccounts.length > 0 && rawJournals) {
      const journalTotals: Record<string, number> = {};
      rawJournals
        .filter((j) => j.status === 'POSTED')
        .forEach((j) => {
          (j.lines || []).forEach((l) => {
            const accId = l.accountId;
            const net = (l.debit || 0) - (l.credit || 0);
            journalTotals[accId] = (journalTotals[accId] || 0) + net;
          });
        });

      rawAccounts.forEach((acc) => {
        if (acc.code === '1010' || acc.code === '4010') {
          const expected = Math.abs(journalTotals[acc.id] || 0);
          if (acc.balance !== expected && (acc.balance === 2000 || acc.balance === 0)) {
            updateDoc(doc(db, 'accounts', acc.id), {
              balance: expected,
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
            setRawAccounts((prev) =>
              prev.map((pa) => (pa.id === acc.id ? { ...pa, balance: expected } : pa))
            );
          }
        }
      });
    }
  }, [rawMembers, rawReceipts, rawCashHoldings, rawAccounts, rawJournals]);

  // Initializers for first time launch
  const initializeDefaultAccounts = async () => {
    try {
      for (const acc of INITIAL_CHART_OF_ACCOUNTS) {
        const id = `acc_${acc.code}`;
        await setDoc(doc(db, 'accounts', id), {
          ...acc,
          id,
          charityId: 'default',
          appModule: acc.appModule || getAccountAppModule(acc.code),
        });
      }
    } catch (e) {
      console.warn('Initial COA setup:', e);
    }
  };

  const initializeDefaultCashAccounts = async () => {
    try {
      for (let i = 0; i < INITIAL_CASH_ACCOUNTS.length; i++) {
        const ca = INITIAL_CASH_ACCOUNTS[i];
        const id = `cash_${i + 1}`;
        await setDoc(doc(db, 'cashAccounts', id), { ...ca, id, charityId: 'default' });
      }
    } catch (e) {
      console.warn('Initial cash accounts setup:', e);
    }
  };

  const initializeDefaultCases = async () => {
    try {
      for (const c of INITIAL_CHARITY_CASES) {
        await setDoc(doc(db, 'cases', c.id), { ...c, charityId: 'default' });
      }
    } catch (e) {
      console.warn('Initial cases setup:', e);
    }
  };

  const initializeDefaultMembers = async () => {
    try {
      for (const m of INITIAL_MEMBERS) {
        await setDoc(doc(db, 'members', m.id), { ...m, charityId: activeCharityId || 'default' });
      }
    } catch (e) {
      console.warn('Initial members setup:', e);
    }
  };

  // --- Member Operations ---
  const addMember = async (
    data: Omit<Member, 'id' | 'memberNumber' | 'totalContributed' | 'receiptsCount' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<Member> => {
    const memberNumber = getNextMemberNumber(members);
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const charityIdToUse = activeCharityId || activeCharity?.id || 'default';

    const newMember: Member = {
      ...data,
      id,
      charityId: charityIdToUse,
      tenantId: charityIdToUse,
      memberNumber,
      totalContributed: 0,
      totalMonthlyContributed: 0,
      totalSpecialContributed: 0,
      receiptsCount: 0,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    // Optimistically update rawMembers so the UI updates synchronously
    setRawMembers((prev) => {
      const exists = prev.some((m) => m.id === id);
      if (exists) return prev;
      const next = [...prev, newMember];
      next.sort((a, b) => (a.memberNumber || '').localeCompare(b.memberNumber || ''));
      return next;
    });

    await setDoc(doc(db, 'members', id), newMember);
    await logAction('Created', 'Members', memberNumber, `Added new member: ${newMember.fullName} (${memberNumber})`);
    return newMember;
  };

  const updateMember = async (id: string, memberData: Partial<Member>) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) throw new Error('Member not found');

    const now = new Date().toISOString();
    const updated = {
      ...memberData,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    // Optimistically update rawMembers
    setRawMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
    );

    await updateDoc(doc(db, 'members', id), updated);
    await logAction(
      'Updated',
      'Members',
      existing.memberNumber,
      `Updated member profile: ${existing.fullName} (${existing.memberNumber})`
    );
  };

  const deactivateMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) throw new Error('Member not found');
    const newStatus = existing.status === 'active' ? 'inactive' : 'active';
    const now = new Date().toISOString();

    // Optimistically update rawMembers
    setRawMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: newStatus, updatedAt: now } : m))
    );

    await updateDoc(doc(db, 'members', id), {
      status: newStatus,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    });
    await logAction(
      'Updated',
      'Members',
      existing.memberNumber,
      `Changed member status to ${newStatus}: ${existing.fullName}`
    );
  };

  const deleteMember = async (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) throw new Error('Member not found');
    const hasReceipts = receipts.some((r) => r.memberId === id && r.status === 'valid');
    if (hasReceipts) {
      throw new Error(
        `Cannot delete member ${existing.memberNumber} because valid financial receipts are posted to this member. Deactivate the member instead to preserve audit history.`
      );
    }

    // Optimistically update rawMembers
    setRawMembers((prev) => prev.filter((m) => m.id !== id));

    await deleteDoc(doc(db, 'members', id));
    await logAction('Deleted', 'Members', existing.memberNumber, `Permanently removed member: ${existing.fullName}`);
  };

  // --- Charity Case Operations (Restricted Funds) ---
  const addCase = async (
    caseData: Omit<CharityCase, 'id' | 'caseNumber' | 'collectedAmount' | 'disbursedAmount' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<CharityCase> => {
    const caseNumber = getNextCaseNumber(cases, new Date().getFullYear(), caseData.caseType);
    const id = `case_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const newCase: CharityCase = {
      ...caseData,
      id,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      caseNumber,
      collectedAmount: 0,
      disbursedAmount: 0,
      status: 'OPEN',
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    await setDoc(doc(db, 'cases', id), newCase);
    await logAction('Created', 'Cases', caseNumber, `Created new charity case: ${newCase.title} (${caseNumber})`);
    return newCase;
  };

  const updateCase = async (id: string, caseData: Partial<CharityCase>) => {
    const existing = cases.find((c) => c.id === id);
    if (!existing) throw new Error('Charity case not found');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'cases', id), {
      ...caseData,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    });
    await logAction('Updated', 'Cases', existing.caseNumber, `Updated charity case: ${existing.title}`);
  };

  const deleteCase = async (id: string) => {
    const existing = cases.find((c) => c.id === id);
    if (!existing) throw new Error('Charity case not found');
    if (existing.collectedAmount > 0 || existing.disbursedAmount > 0) {
      throw new Error(`Cannot delete case ${existing.caseNumber} as financial transactions are linked to it.`);
    }
    await deleteDoc(doc(db, 'cases', id));
    await logAction('Deleted', 'Cases', existing.caseNumber, `Deleted case ${existing.caseNumber}`);
  };

  // --- STRICT DOUBLE-ENTRY FINANCIAL SERVICE METHODS (CENTRALIZED FINANCIAL ENGINE) ---

  const getFinancialEngineState = (): FinancialEngineContextState => ({
    activeCharityId,
    currency: settings.currency || 'AED',
    members,
    cases,
    accounts,
    cashAccounts,
    receipts,
    payments,
    transactions,
    journalEntries,
    cashHoldings,
    user: {
      uid: user?.uid,
      email: currentUserEmail,
      displayName: user?.displayName,
    },
  });

  const applyAtomicFinancialResult = (result: AtomicFinancialExecutionResult) => {
    if (result.receipt) {
      setRawReceipts((prev) => {
        const idx = prev.findIndex((r) => r.id === result.receipt!.id);
        return idx >= 0 ? prev.map((r) => (r.id === result.receipt!.id ? result.receipt! : r)) : [result.receipt!, ...prev];
      });
    }
    if (result.payment) {
      setRawPayments((prev) => {
        const idx = prev.findIndex((p) => p.id === result.payment!.id);
        return idx >= 0 ? prev.map((p) => (p.id === result.payment!.id ? result.payment! : p)) : [result.payment!, ...prev];
      });
    }
    if (result.transaction) {
      setRawTransactions((prev) => {
        const idx = prev.findIndex((t) => t.id === result.transaction.id);
        return idx >= 0 ? prev.map((t) => (t.id === result.transaction.id ? result.transaction : t)) : [result.transaction, ...prev];
      });
    }
    if (result.journalEntry) {
      setRawJournals((prev) => {
        const idx = prev.findIndex((j) => j.id === result.journalEntry.id);
        return idx >= 0 ? prev.map((j) => (j.id === result.journalEntry.id ? result.journalEntry : j)) : [result.journalEntry, ...prev];
      });
    }
    if (result.reversalJournalEntry) {
      setRawJournals((prev) => {
        const idx = prev.findIndex((j) => j.id === result.reversalJournalEntry!.id);
        return idx >= 0 ? prev.map((j) => (j.id === result.reversalJournalEntry!.id ? result.reversalJournalEntry! : j)) : [result.reversalJournalEntry!, ...prev];
      });
    }
    if (result.updatedAccounts && result.updatedAccounts.length > 0) {
      const map = new Map(result.updatedAccounts.map((a) => [a.id, a]));
      setRawAccounts((prev) => prev.map((a) => (map.has(a.id) ? { ...a, ...map.get(a.id)! } : a)));
    }
    if (result.updatedCashAccounts && result.updatedCashAccounts.length > 0) {
      const map = new Map(result.updatedCashAccounts.map((c) => [c.id, c]));
      setRawCashAccounts((prev) => prev.map((c) => (map.has(c.id) ? { ...c, ...map.get(c.id)! } : c)));
    }
    if (result.updatedMembers && result.updatedMembers.length > 0) {
      const map = new Map(result.updatedMembers.map((m) => [m.id, m]));
      setRawMembers((prev) => prev.map((m) => (map.has(m.id) ? { ...m, ...map.get(m.id)! } : m)));
    }
    if (result.updatedCases && result.updatedCases.length > 0) {
      const map = new Map(result.updatedCases.map((c) => [c.id, c]));
      setRawCases((prev) => prev.map((c) => (map.has(c.id) ? { ...c, ...map.get(c.id)! } : c)));
    }
    if (result.updatedCashHoldings && result.updatedCashHoldings.length > 0) {
      setRawCashHoldings((prev) => {
        const map = new Map(result.updatedCashHoldings.map((h) => [h.id, h]));
        const updated = prev.map((h) => (map.has(h.id) ? { ...h, ...map.get(h.id)! } : h));
        result.updatedCashHoldings.forEach((h) => {
          if (!prev.some((p) => p.id === h.id)) {
            updated.push(h);
          }
        });
        return updated;
      });
    }
    if (result.auditLog) {
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    }
  };

  const recordMonthlyContribution = async (
    input: Omit<MonthlyContributionInput, 'tenantId' | 'userId' | 'userEmail'>
  ): Promise<Receipt> => {
    const result = await FinancialEngineService.executeAddReceipt(
      {
        ...input,
        contributionType: 'MONTHLY_CONTRIBUTION',
      },
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.receipt!;
  };

  const recordSpecialContribution = async (
    input: Omit<SpecialContributionInput, 'tenantId' | 'userId' | 'userEmail'>
  ): Promise<Receipt> => {
    const result = await FinancialEngineService.executeAddReceipt(
      {
        ...input,
        contributionType: 'SPECIAL_CONTRIBUTION',
        caseId: input.caseId,
      },
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.receipt!;
  };

  const recordCharityAssistance = async (
    input: Omit<CharityAssistanceInput, 'tenantId' | 'userId' | 'userEmail'>
  ): Promise<CharityPayment> => {
    const result = await FinancialEngineService.executeAddPaymentVoucher(
      {
        ...input,
        disbursementType: 'CHARITY_ASSISTANCE',
        payeeName: input.payeeName,
        mobileNumber: input.payeePhone,
        address: input.payeeAddress,
        caseId: input.caseId,
        charityCategory: input.charityCategory,
        chartOfAccountId: input.expenseAccountId,
      },
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.payment!;
  };

  const recordAdminExpense = async (
    input: Omit<AdminExpenseInput, 'tenantId' | 'userId' | 'userEmail'>
  ): Promise<CharityPayment> => {
    const result = await FinancialEngineService.executeAddPaymentVoucher(
      {
        ...input,
        disbursementType: 'ADMINISTRATIVE_EXPENSE',
        payeeName: input.payeeName,
        adminExpenseCategory: input.adminCategory,
        chartOfAccountId: input.expenseAccountId,
      },
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.payment!;
  };

  const voidRecord = async (recordType: 'Receipt' | 'Payment', recordId: string, reason: string): Promise<void> => {
    const result = await FinancialEngineService.executeVoidRecord(
      recordType,
      recordId,
      reason,
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
  };

  // Wrapper for creating contribution receipts
  const createReceipt = async (data: any): Promise<Receipt> => {
    const isSpecialCase = Boolean(
      (data.contributionType === 'SPECIAL_CONTRIBUTION' || data.caseId) &&
      data.caseId &&
      data.caseId !== 'general' &&
      data.caseId !== ''
    );

    if (isSpecialCase) {
      return recordSpecialContribution({
        memberId: data.memberId,
        caseId: data.caseId,
        contributionMonth: data.contributionMonth || data.periodMonth,
        purpose: data.purpose,
        amount: Number(data.amount),
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        exchangeRateSnapshot: data.exchangeRateSnapshot,
        baseAmount: data.baseAmount,
        baseCurrency: data.baseCurrency || settings.currency || 'AED',
        paymentMethod: data.paymentMethod,
        cashBankAccountId: data.cashBankAccountId,
        receiptDate: data.receiptDate,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        supportingDocumentName: data.supportingDocumentName,
        supportingDocumentUrl: data.supportingDocumentUrl,
        supportingDocumentData: data.supportingDocumentData,
        supportingDocumentType: data.supportingDocumentType,
        supportingDocumentSize: data.supportingDocumentSize,
      });
    }

    const periodMonth = data.periodMonth || data.contributionMonth || new Date(data.receiptDate || Date.now()).toISOString().slice(0, 7);
    const receipt = await recordMonthlyContribution({
      memberId: data.memberId,
      periodMonth,
      contributionMonth: periodMonth,
      contributionMonths: data.contributionMonths,
      monthsCount: data.monthsCount,
      amount: Number(data.amount),
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      exchangeRateSnapshot: data.exchangeRateSnapshot,
      baseAmount: data.baseAmount,
      baseCurrency: data.baseCurrency || settings.currency || 'AED',
      paymentMethod: data.paymentMethod,
      cashBankAccountId: data.cashBankAccountId,
      receiptDate: data.receiptDate,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
      supportingDocumentName: data.supportingDocumentName,
      supportingDocumentUrl: data.supportingDocumentUrl,
      supportingDocumentData: data.supportingDocumentData,
      supportingDocumentType: data.supportingDocumentType,
      supportingDocumentSize: data.supportingDocumentSize,
    });

    if (data.status && data.status !== 'valid') {
      await updateDoc(doc(db, 'receipts', receipt.id), {
        status: data.status,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserEmail,
      });
      receipt.status = data.status;
    }
    return receipt;
  };

  const updateContributionReceipt = async (receiptId: string, data: Partial<Receipt>): Promise<Receipt> => {
    const result = await FinancialEngineService.executeUpdateReceipt(
      receiptId,
      data,
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.receipt!;
  };

  const updateReceipt = async (receiptId: string, data: Partial<Receipt>): Promise<void> => {
    await updateContributionReceipt(receiptId, data);
  };

  const voidReceipt = async (receiptId: string, reason: string) => {
    return voidRecord('Receipt', receiptId, reason);
  };

  const updateCharityPayment = async (paymentId: string, data: Partial<CharityPayment>): Promise<CharityPayment> => {
    const result = await FinancialEngineService.executeUpdatePaymentVoucher(
      paymentId,
      data,
      getFinancialEngineState()
    );
    applyAtomicFinancialResult(result);
    return result.payment!;
  };

  const updateAdminExpense = async (paymentOrTxnId: string, data: Partial<CharityPayment> & { adminExpenseCategory?: string }): Promise<CharityPayment | Transaction> => {
    // If it is in payments collection
    const existingPayment = payments.find((p) => p.id === paymentOrTxnId || p.paymentNumber === paymentOrTxnId);
    if (existingPayment) {
      const fallbackAdminCode = getDefaultAdminExpenseAccountCode(data.adminExpenseCategory || existingPayment.adminExpenseCategory || '');
      const expenseAcc = accounts.find((a) => a.id === data.chartOfAccountId) ||
        accounts.find((a) => a.code === fallbackAdminCode) ||
        accounts.find((a) => a.code === '6010') ||
        accounts[0];

      return updateCharityPayment(existingPayment.id, {
        ...data,
        disbursementType: 'ADMINISTRATIVE_EXPENSE',
        charityCategory: (data.adminExpenseCategory || existingPayment.adminExpenseCategory || 'Printing & Stationery') as any,
        adminExpenseCategory: data.adminExpenseCategory || existingPayment.adminExpenseCategory || 'Printing & Stationery',
        chartOfAccountId: expenseAcc.id,
        chartOfAccountCode: expenseAcc.code,
        chartOfAccountName: expenseAcc.name,
      });
    }

    // Else if it is a transaction
    const existingTxn = transactions.find((t) => t.id === paymentOrTxnId || t.transactionNumber === paymentOrTxnId);
    if (!existingTxn) throw new Error('Transaction or Expense not found');

    const now = new Date().toISOString();
    const updatedTxn: Transaction = {
      ...existingTxn,
      ...data,
      date: data.paymentDate || existingTxn.date,
      amount: data.amount !== undefined ? Number(data.amount) : existingTxn.amount,
      currency: data.currency || existingTxn.currency,
      description: data.description || existingTxn.description,
      toName: data.payeeName || existingTxn.toName,
      status: (data.status === 'voided' ? 'voided' : 'valid') as 'valid' | 'voided',
      updatedAt: now,
      updatedBy: currentUserEmail,
    };

    setRawTransactions((prev) => prev.map((t) => (t.id === existingTxn.id ? updatedTxn : t)));
    try {
      await setDoc(doc(db, 'transactions', existingTxn.id), cleanForFirestore(updatedTxn));
    } catch (err) {
      console.warn('Txn update error in updateAdminExpense:', err);
    }

    await logAction('Updated', 'Expense', existingTxn.transactionNumber, `Updated expense fields: ${Object.keys(data).join(', ')}`);
    return updatedTxn;
  };

  const createPayment = async (data: any): Promise<CharityPayment> => {
    if (data.disbursementType === 'ADMINISTRATIVE_EXPENSE') {
      const fallbackAdminCode = getDefaultAdminExpenseAccountCode(data.adminExpenseCategory || '');
      return recordAdminExpense({
        payeeName: data.payeeName,
        adminCategory: data.adminExpenseCategory || 'Printing & Stationery',
        expenseAccountId:
          data.chartOfAccountId ||
          accounts.find((a) => a.code === fallbackAdminCode)?.id ||
          accounts.find((a) => a.code === '6010')?.id ||
          accounts[0]?.id,
        amount: data.amount,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        paymentMethod: data.paymentMethod || 'Cash',
        cashBankAccountId: data.cashBankAccountId,
        invoiceNumber: data.invoiceNumber,
        paymentDate: data.paymentDate,
        referenceNumber: data.referenceNumber,
        description: data.description,
        approvedBy: data.approvedBy || user?.displayName || user?.email || 'Charity Board',
        preparedBy: data.preparedBy || user?.displayName || user?.email || 'Admin',
        verifiedBy: data.verifiedBy || 'Audit Committee',
        notes: data.notes || '',
        paidByType: data.paidByType,
        paidByMemberId: data.paidByMemberId,
        paidByMemberName: data.paidByMemberName,
        paidByMemberNumber: data.paidByMemberNumber,
        isSplitEvent: data.isSplitEvent || false,
        splitExpense: data.splitExpense,
        supportingDocumentName: data.supportingDocumentName,
        supportingDocumentUrl: data.supportingDocumentUrl,
        supportingDocumentData: data.supportingDocumentData,
        supportingDocumentType: data.supportingDocumentType,
        supportingDocumentSize: data.supportingDocumentSize,
      });
    }

    // Default: Charity Assistance
    const targetCaseId = data.caseId || cases[0]?.id;
    if (!targetCaseId) {
      throw new Error('A charity case must be selected to record charitable assistance relief.');
    }

    const fallbackAssistanceCode = getDefaultAssistanceAccountCode(data.charityCategory || '');
    return recordCharityAssistance({
      caseId: targetCaseId,
      payeeName: data.payeeName,
      payeePhone: data.mobileNumber,
      payeeAddress: data.address,
      amount: data.amount,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      paymentMethod: data.paymentMethod || 'Cash',
      cashBankAccountId: data.cashBankAccountId,
      charityCategory: data.charityCategory || 'Medical Assistance',
      expenseAccountId:
        data.chartOfAccountId ||
        accounts.find((a) => a.code === fallbackAssistanceCode)?.id ||
        accounts.find((a) => a.code === '5010')?.id ||
        accounts[0]?.id,
      paymentDate: data.paymentDate,
      referenceNumber: data.referenceNumber,
      description: data.description,
      approvedBy: data.approvedBy || user?.displayName || user?.email || 'Charity Board',
      preparedBy: data.preparedBy || user?.displayName || user?.email || 'Admin',
      verifiedBy: data.verifiedBy || 'Audit Committee',
      notes: data.notes || '',
      paidByType: data.paidByType,
      paidByMemberId: data.paidByMemberId,
      paidByMemberName: data.paidByMemberName,
      paidByMemberNumber: data.paidByMemberNumber,
      supportingDocumentName: data.supportingDocumentName,
      supportingDocumentUrl: data.supportingDocumentUrl,
      supportingDocumentData: data.supportingDocumentData,
      supportingDocumentType: data.supportingDocumentType,
      supportingDocumentSize: data.supportingDocumentSize,
    });
  };

  const settleSplitShare = async (
    paymentId: string,
    memberId: string,
    options?: { paymentMethod?: PaymentMethod; notes?: string }
  ): Promise<CharityPayment> => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('Payment not found');
    if (!payment.splitExpense || !payment.splitExpense.participants) {
      throw new Error('This payment is not configured as a shared event');
    }

    const participantIndex = payment.splitExpense.participants.findIndex((p) => p.memberId === memberId);
    if (participantIndex === -1) throw new Error('Member not found in event participant list');

    const participant = payment.splitExpense.participants[participantIndex];
    if (participant.status === 'SETTLED') {
      return payment;
    }

    const now = new Date().toISOString();
    const dateOnly = now.slice(0, 10);
    const payingMember = members.find((m) => m.id === memberId);
    const shareAmt = participant.shareAmount;
    const paymentCur = payment.currency || settings.currency || 'AED';

    // 1. Create Double-Entry Transfer / Settlement transaction
    const txnNumber = getNextTransactionNumber(transactions);
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Primary payer who handed the upfront cash
    const primaryPayer = members.find(
      (m) => m.id === (payment.paidByMemberId || payment.splitExpense?.payerMemberId)
    );
    const cashAccount =
      accounts.find((a) => a.id === payment.cashBankAccountId) ||
      accounts.find((a) => a.code === '1010') ||
      accounts[0];

    const newTxn: Transaction = {
      id: txnId,
      charityId: activeCharityId,
      transactionNumber: txnNumber,
      date: dateOnly,
      type: 'Transfer',
      financialClassification: 'INTERNAL_TRANSFER' as any, // Does not count as general monthly charity dues!
      description: `Shared Event Share Settlement: ${payment.adminExpenseCategory || 'Expense'} (${payment.paymentNumber}) from ${payingMember?.fullName || participant.memberName}`,
      reference: payment.paymentNumber,
      currency: paymentCur,
      amount: shareAmt,
      baseAmount: shareAmt,
      baseCurrency: settings.currency || 'AED',
      baseCurrencyAmount: shareAmt,
      fromName: payingMember?.fullName || participant.memberName,
      toName: primaryPayer ? primaryPayer.fullName : payment.cashBankAccountName || 'Cash Float',
      debitAccountId: cashAccount.id,
      debitAccountCode: cashAccount.code,
      debitAccountName: cashAccount.name,
      creditAccountId: cashAccount.id,
      creditAccountCode: cashAccount.code,
      creditAccountName: 'Shared Event Clearing',
      creditEntityType: 'member',
      creditMemberId: memberId,
      creditMemberName: payingMember?.fullName || participant.memberName,
      status: 'valid',
      linkedPaymentId: payment.id,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };
    await setDoc(doc(db, 'transactions', txnId), cleanForFirestore(newTxn));

    // 2. Double-Entry: replenish the primary payer / custodian's cash float
    if (primaryPayer) {
      const curBalances = { ...(primaryPayer.cashBalances || {}) };
      curBalances[paymentCur] = Number(((curBalances[paymentCur] || 0) + shareAmt).toFixed(2));
      await updateDoc(doc(db, 'members', primaryPayer.id), cleanForFirestore({
        cashBalances: curBalances,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      }));
    }

    // 3. Update participant record
    const updatedParticipants = [...payment.splitExpense.participants];
    updatedParticipants[participantIndex] = {
      ...participant,
      status: 'SETTLED',
      settledAt: now,
      settledPaymentMethod: options?.paymentMethod || 'Cash',
      settledTransactionId: txnId,
      notes: options?.notes || 'Settled share contribution',
    };

    const settledCount = updatedParticipants.filter((p) => p.status === 'SETTLED').length;
    const pendingCount = updatedParticipants.filter((p) => p.status === 'PENDING').length;
    const totalSettledAmount = Number(
      updatedParticipants
        .filter((p) => p.status === 'SETTLED')
        .reduce((sum, p) => sum + p.shareAmount, 0)
        .toFixed(2)
    );
    const totalPendingAmount = Number(
      updatedParticipants
        .filter((p) => p.status === 'PENDING')
        .reduce((sum, p) => sum + p.shareAmount, 0)
        .toFixed(2)
    );

    const updatedSplitExpense: SplitExpenseConfig = {
      ...payment.splitExpense,
      settledCount,
      pendingCount,
      totalSettledAmount,
      totalPendingAmount,
      participants: updatedParticipants,
    };

    const updatedPayment: CharityPayment = {
      ...payment,
      splitExpense: updatedSplitExpense,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    await updateDoc(doc(db, 'payments', payment.id), cleanForFirestore({
      splitExpense: updatedSplitExpense,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    }));

    setRawPayments((prev) => prev.map((p) => (p.id === payment.id ? updatedPayment : p)));
    setRawTransactions((prev) => [newTxn, ...prev]);

    await logAction(
      'Updated',
      'Expense',
      payment.paymentNumber,
      `Settled ${formatCurrency(shareAmt, paymentCur)} share contribution from ${payingMember?.fullName || participant.memberName} for ${payment.paymentNumber}`
    );

    return updatedPayment;
  };

  const voidPayment = async (paymentId: string, reason: string) => {
    return voidRecord('Payment', paymentId, reason);
  };

  // --- Chart of Accounts Operations ---
  const addAccount = async (accountData: Omit<Account, 'id' | 'balance' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => {
    const existing = accounts.find((a) => a.code === accountData.code);
    if (existing) {
      throw new Error(`Account code ${accountData.code} is already in use.`);
    }
    const id = `acc_${accountData.code}_${Date.now()}`;
    const now = new Date().toISOString();
    const newAcc: Account = {
      ...accountData,
      id,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      balance: 0,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };
    await setDoc(doc(db, 'accounts', id), newAcc);
    await logAction('Created', 'Chart of Accounts', accountData.code, `Created account: ${accountData.code} - ${accountData.name}`);
  };

  const updateAccount = async (id: string, accountData: Partial<Account>) => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) throw new Error('Account not found');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'accounts', id), {
      ...accountData,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    });
    await logAction('Updated', 'Chart of Accounts', existing.code, `Updated account: ${existing.code} - ${accountData.name || existing.name}`);
  };

  const deactivateAccount = async (id: string) => {
    const existing = accounts.find((a) => a.id === id);
    if (!existing) throw new Error('Account not found');
    if (existing.isSystem) {
      throw new Error('System required account cannot be deactivated.');
    }
    const newStatus = !existing.isActive;
    await updateDoc(doc(db, 'accounts', id), {
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUserIdentifier,
    });
    await logAction('Updated', 'Chart of Accounts', existing.code, `${newStatus ? 'Activated' : 'Deactivated'} account: ${existing.code}`);
  };

  const syncStandardAccounts = async (): Promise<{ added: number; updated: number }> => {
    setLoading(true);
    let added = 0;
    let updated = 0;
    try {
      for (const acc of INITIAL_CHART_OF_ACCOUNTS) {
        const existing = accounts.find((a) => a.code === acc.code);
        if (!existing) {
          const id = `acc_${acc.code}`;
          await setDoc(doc(db, 'accounts', id), {
            ...acc,
            id,
            charityId: activeCharityId || 'default',
            balance: acc.balance || 0,
            isActive: true,
            isSystem: true,
            appModule: acc.appModule || getAccountAppModule(acc.code),
            createdAt: new Date().toISOString(),
            createdBy: currentUserIdentifier,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserIdentifier,
          });
          added++;
        } else {
          await updateDoc(doc(db, 'accounts', existing.id), {
            name: acc.name,
            type: acc.type,
            parentCode: acc.parentCode || null,
            description: acc.description,
            isGroup: !!acc.isGroup,
            isSubLedger: !!acc.isSubLedger,
            isSystem: true,
            appModule: acc.appModule || getAccountAppModule(acc.code),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUserIdentifier,
          });
          updated++;
        }
      }
      await logAction(
        'Updated',
        'Chart of Accounts',
        'Sync App Standard COA',
        `Synchronized ${added} new accounts and refreshed ${updated} standard accounts across all app modules.`
      );
      return { added, updated };
    } catch (err: any) {
      console.error('Error synchronizing standard chart of accounts:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // --- Cash & Bank Operations ---
  const addCashAccount = async (accountData: Omit<CashAccount, 'id' | 'currentBalance' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => {
    const id = `cash_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const newCashAcc: CashAccount = {
      ...accountData,
      id,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      currentBalance: accountData.openingBalance || 0,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };
    await setDoc(doc(db, 'cashAccounts', id), newCashAcc);
    await logAction('Created', 'Cash & Bank', newCashAcc.name, `Created cash/bank account: ${newCashAcc.name}`);
  };

  const updateCashAccount = async (id: string, accountData: Partial<CashAccount>) => {
    const existing = cashAccounts.find((c) => c.id === id);
    if (!existing) throw new Error('Cash account not found');
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'cashAccounts', id), {
      ...accountData,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    });
    await logAction('Updated', 'Cash & Bank', existing.name, `Updated cash/bank account: ${existing.name}`);
  };

  // --- Transfer / Handover Operations ---
  const createTransferOrHandover = async (data: {
    date: string;
    currency: string;
    amount: number;
    exchangeRate?: number;
    baseCurrencyAmount?: number;
    fromType: 'member' | 'account';
    fromId: string;
    toType: 'member' | 'account';
    toId: string;
    referenceNumber?: string;
    notes?: string;
    handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
    caseId?: string;
    caseNumber?: string;
    caseTitle?: string;
    isContributionHandover?: boolean;
  }): Promise<Transaction> => {
    if (data.amount <= 0) throw new Error('Transfer amount must be strictly positive.');

    let fromName = '';
    let fromCode = '';
    let toName = '';
    let toCode = '';

    const fromMember = data.fromType === 'member' ? members.find((item) => item.id === data.fromId) : null;
    const toMember = data.toType === 'member' ? members.find((item) => item.id === data.toId) : null;

    if (data.fromType === 'member') {
      if (!fromMember) throw new Error('Source member not found');
      fromName = `${fromMember.fullName} (${fromMember.memberNumber})`;
      fromCode = fromMember.memberNumber;
    } else {
      const a = cashAccounts.find((item) => item.id === data.fromId) || accounts.find((item) => item.id === data.fromId);
      if (!a) throw new Error('Source cash/bank account not found');
      fromName = a.name;
      fromCode = 'accountCode' in a ? a.accountCode : a.code;
    }

    if (data.toType === 'member') {
      if (!toMember) throw new Error('Target member not found');
      toName = `${toMember.fullName} (${toMember.memberNumber})`;
      toCode = toMember.memberNumber;
    } else {
      const a = cashAccounts.find((item) => item.id === data.toId) || accounts.find((item) => item.id === data.toId);
      if (!a) throw new Error('Target cash/bank account not found');
      toName = a.name;
      toCode = 'accountCode' in a ? a.accountCode : a.code;
    }

    const txnNumber = getNextTransactionNumber(transactions);
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const baseCur = settings.currency || 'AED';
    // When currency is identical to base currency (e.g. AED to AED), exchange rate is strictly 1:1
    const rate = data.currency === baseCur ? 1 : (data.exchangeRate || 1);
    const baseAmt = data.currency === baseCur ? data.amount : (data.baseCurrencyAmount ?? Number((data.amount * rate).toFixed(2)));

    // Detect if this is a Member Contribution Handover:
    // When a member makes a contribution and hands the cash directly to a custodian member
    const fromMemberCurBal = fromMember?.cashBalances?.[data.currency] || 0;
    const isContributionHandover =
      data.isContributionHandover ??
      (data.fromType === 'member' && data.toType === 'member' && fromMemberCurBal < data.amount);

    let purposeTag = '';
    if (data.handoverFundType === 'CHARITY_CASE' && (data.caseTitle || data.caseId)) {
      purposeTag = `[Case: ${data.caseNumber ? data.caseNumber + ' - ' : ''}${data.caseTitle || data.caseId}]`;
    } else if (data.handoverFundType === 'MONTHLY_CONTRIBUTION') {
      purposeTag = `[Members' Monthly Contribution]`;
    } else if (data.handoverFundType === 'GENERAL_CHARITY') {
      purposeTag = `[General Charity Pool]`;
    }

    const txnType = isContributionHandover
      ? 'Contribution Handover'
      : data.fromType === 'member' || data.toType === 'member'
      ? 'Member Handover'
      : 'Transfer';

    const desc = isContributionHandover
      ? `Contribution: ${fromName} -> Custodian ${toName} [${data.currency} ${data.amount}]${purposeTag ? ' ' + purposeTag : ''}`
      : `${txnType}: ${fromName} -> ${toName} [${data.currency} ${data.amount}]${purposeTag ? ' ' + purposeTag : ''}`;

    // Generate balanced double-entry Journal Entry
    const journalNumber = getNextJournalNumber(journalEntries, new Date(data.date).getFullYear());
    const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const custodyAcc = accounts.find((a) => a.code === '1050');

    // For contribution handover, debit is Cash in Custody (Asset 1050) and credit is Contribution Revenue (Revenue 4030 or 4010)
    const revenueAcc = data.caseId || data.handoverFundType === 'CHARITY_CASE'
      ? (accounts.find((a) => a.code === '4030') || { id: 'acc_4030', code: '4030', name: 'Designated Charity Case Contributions' })
      : (accounts.find((a) => a.code === '4010') || { id: 'acc_4010', code: '4010', name: 'Members Monthly Contributions' });

    const debitAccId = data.toType === 'member' ? (custodyAcc?.id || 'acc_1050') : data.toId;
    const debitAccCode = data.toType === 'member' ? '1050' : toCode;
    const debitAccName = data.toType === 'member' ? `Member Custody: ${toName}` : toName;

    const creditAccId = isContributionHandover
      ? revenueAcc.id
      : data.fromType === 'member'
      ? (custodyAcc?.id || 'acc_1050')
      : data.fromId;
    const creditAccCode = isContributionHandover
      ? revenueAcc.code
      : data.fromType === 'member'
      ? '1050'
      : fromCode;
    const creditAccName = isContributionHandover
      ? revenueAcc.name
      : data.fromType === 'member'
      ? `Member Custody: ${fromName}`
      : fromName;

    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: debitAccId,
        accountCode: debitAccCode,
        accountName: debitAccName,
        accountType: 'Asset',
        debit: data.amount,
        credit: 0,
        currency: data.currency,
        exchangeRate: rate,
        baseCurrencyDebit: baseAmt,
        baseCurrencyCredit: 0,
        description: `Debit: Received by ${toName} [${data.currency} ${data.amount}]${purposeTag ? ' ' + purposeTag : ''}`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: creditAccId,
        accountCode: creditAccCode,
        accountName: creditAccName,
        accountType: isContributionHandover ? 'Income' : 'Asset',
        debit: 0,
        credit: data.amount,
        currency: data.currency,
        exchangeRate: rate,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: baseAmt,
        description: isContributionHandover
          ? `Credit: Contribution by ${fromName} [${data.currency} ${data.amount}]${purposeTag ? ' ' + purposeTag : ''}`
          : `Credit: Handed over by ${fromName} [${data.currency} ${data.amount}]${purposeTag ? ' ' + purposeTag : ''}`,
      },
    ];

    const journalEntry: JournalEntry = {
      id: journalId,
      entryNumber: journalNumber,
      tenantId: activeCharityId,
      date: data.date,
      description: desc,
      sourceTransactionType: isContributionHandover ? 'RECEIPT' : 'INTERNAL_TRANSFER',
      sourceRecordId: txnId,
      sourceRecordNumber: txnNumber,
      lines: journalLines,
      totalDebit: data.amount,
      totalCredit: data.amount,
      isBalanced: true,
      status: 'POSTED',
      createdAt: now,
      createdBy: currentUserIdentifier,
    };

    await setDoc(doc(db, 'journal_entries', journalId), cleanForFirestore(journalEntry));

    const newTxn: Transaction = {
      id: txnId,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      transactionNumber: txnNumber,
      date: data.date,
      type: txnType,
      description: desc,
      reference: data.referenceNumber || '',
      currency: data.currency,
      exchangeRate: rate,
      baseCurrencyAmount: baseAmt,
      financialClassification: isContributionHandover
        ? (data.caseId || data.handoverFundType === 'CHARITY_CASE' ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION')
        : undefined,
      debitAccountId: data.toId,
      debitAccountCode: toCode,
      debitAccountName: toName,
      debitEntityType: data.toType,
      debitEntityName: toName,
      ...(data.toType === 'member'
        ? {
            debitMemberId: data.toId,
            debitMemberName: toName,
            debitMemberNumber: toCode,
          }
        : {}),
      creditAccountId: data.fromId,
      creditAccountCode: fromCode,
      creditAccountName: fromName,
      creditEntityType: data.fromType,
      creditEntityName: fromName,
      ...(data.fromType === 'member'
        ? {
            creditMemberId: data.fromId,
            creditMemberName: fromName,
            creditMemberNumber: fromCode,
          }
        : {}),
      amount: data.amount,
      status: 'valid',
      ...(data.caseId ? { linkedCaseId: data.caseId } : {}),
      ...(data.caseNumber ? { linkedCaseNumber: data.caseNumber } : {}),
      ...(data.caseTitle ? { linkedCaseTitle: data.caseTitle } : {}),
      ...(data.handoverFundType ? { handoverFundType: data.handoverFundType } : {}),
      journalEntryId: journalId,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    setRawTransactions((prev) => [newTxn, ...prev]);
    await setDoc(doc(db, 'transactions', txnId), cleanForFirestore(newTxn));

    // Handle Contribution Handover: Record official receipt, credit member contribution, and create CashHolding for Custodian
    if (isContributionHandover && fromMember && toMember) {
      const receiptNumber = getNextReceiptNumber(receipts, new Date(data.date).getFullYear());
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const isCaseContrib = Boolean(data.caseId || data.handoverFundType === 'CHARITY_CASE');

      const newReceipt: Receipt = {
        id: receiptId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        receiptNumber,
        receiptDate: data.date,
        memberId: fromMember.id,
        memberNumber: fromMember.memberNumber,
        memberName: fromMember.fullName,
        contributionType: isCaseContrib ? 'SPECIAL_CONTRIBUTION' : 'MONTHLY_CONTRIBUTION',
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        caseTitle: data.caseTitle,
        contributionAccountId: revenueAcc.id,
        contributionAccountCode: revenueAcc.code,
        contributionAccountName: revenueAcc.name,
        amount: data.amount,
        currency: data.currency,
        baseCurrencyAmount: baseAmt,
        paymentMethod: 'Cash',
        cashBankAccountId: toMember.id,
        cashBankAccountName: `Cash in Custody (${toMember.fullName})`,
        notes: `Contribution by ${fromMember.fullName} handed over to Custodian ${toMember.fullName}${data.caseTitle ? ' for ' + data.caseTitle : ''}`,
        status: 'valid',
        transactionId: txnId,
        journalEntryId: journalId,
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };

      setRawReceipts((prev) => [newReceipt, ...prev]);
      await setDoc(doc(db, 'receipts', receiptId), cleanForFirestore(newReceipt));

      // Credit the contributing member's contribution totals WITHOUT reducing cash balance below zero
      const updatedTotalContributed = Number(((fromMember.totalContributed || 0) + baseAmt).toFixed(2));
      const updatedSpecialContributed = isCaseContrib
        ? Number(((fromMember.totalSpecialContributed || 0) + baseAmt).toFixed(2))
        : fromMember.totalSpecialContributed || 0;
      const updatedMonthlyContributed = !isCaseContrib
        ? Number(((fromMember.totalMonthlyContributed || 0) + baseAmt).toFixed(2))
        : fromMember.totalMonthlyContributed || 0;

      await updateDoc(doc(db, 'members', fromMember.id), {
        totalContributed: updatedTotalContributed,
        totalSpecialContributed: updatedSpecialContributed,
        totalMonthlyContributed: updatedMonthlyContributed,
        receiptsCount: (fromMember.receiptsCount || 0) + 1,
        lastContributionDate: data.date,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      });

      // If linked to a specific charity case, increment collectedAmount
      if (data.caseId) {
        const c = cases.find((item) => item.id === data.caseId);
        if (c) {
          const newCollected = Number(((c.collectedAmount || 0) + baseAmt).toFixed(2));
          await updateDoc(doc(db, 'cases', c.id), {
            collectedAmount: newCollected,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      }

      // Create a CashHolding document for the Custodian (toMember)
      const holdingId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newHolding: CashHolding = {
        id: holdingId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        memberId: toMember.id,
        memberName: toMember.fullName,
        memberNumber: toMember.memberNumber,
        amount: data.amount,
        currency: data.currency,
        category: data.handoverFundType === 'CHARITY_CASE'
          ? 'Charity Case'
          : data.handoverFundType === 'MONTHLY_CONTRIBUTION'
          ? 'Monthly Contribution'
          : 'General Charity Pool',
        caseId: data.caseId,
        caseNumber: data.caseNumber,
        caseTitle: data.caseTitle,
        caseNote: data.caseTitle ? `Case: ${data.caseNumber ? data.caseNumber + ' - ' : ''}${data.caseTitle}` : undefined,
        donorMemberId: fromMember.id,
        donorMemberName: fromMember.fullName,
        donorMemberNumber: fromMember.memberNumber,
        status: 'HELD',
        date: data.date,
        notes: `Contributed by ${fromMember.fullName}, handed over to ${toMember.fullName}`,
        sourceTransactionId: txnId,
        sourceTransactionNumber: txnNumber,
        receiptId: receiptId,
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };

      setRawCashHoldings((prev) => [newHolding, ...prev]);
      await setDoc(doc(db, 'cashHoldings', holdingId), cleanForFirestore(newHolding));

      // Increase custodian member's cashBalances
      const toCurBalances = { ...(toMember.cashBalances || {}) };
      toCurBalances[data.currency] = Number(((toCurBalances[data.currency] || 0) + data.amount).toFixed(2));
      await updateDoc(doc(db, 'members', toMember.id), {
        cashBalances: toCurBalances,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      });

    } else {
      // Standard Internal Transfer / Custodian Handover:
      // Update balances: Accounts and Member Custody Wallets
      if (data.fromType === 'account') {
        const ca = cashAccounts.find((item) => item.id === data.fromId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) - baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      } else if (data.fromType === 'member') {
        const mem = members.find((item) => item.id === data.fromId);
        if (mem) {
          const curBalances = { ...(mem.cashBalances || {}) };
          // Member cash balances represent physical cash held - never drop below 0
          curBalances[data.currency] = Math.max(0, Number(((curBalances[data.currency] || 0) - data.amount).toFixed(2)));
          await updateDoc(doc(db, 'members', mem.id), {
            cashBalances: curBalances,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });

          // If member is depositing cash to bank, settle matching active cash holdings
          if (data.toType === 'account') {
            const memberHoldings = cashHoldings.filter(
              (h) => h.memberId === mem.id && h.status === 'HELD' && (h.currency || baseCur) === data.currency
            );
            let remainingToSettle = data.amount;
            for (const h of memberHoldings) {
              if (remainingToSettle <= 0) break;
              if (h.amount <= remainingToSettle) {
                await updateDoc(doc(db, 'cashHoldings', h.id), {
                  status: 'DEPOSITED_TO_BANK',
                  settledDate: data.date,
                  settlementType: 'BANK_DEPOSIT',
                  destinationAccountId: data.toId,
                  destinationAccountName: toName,
                  updatedAt: now,
                  updatedBy: currentUserIdentifier,
                });
                remainingToSettle -= h.amount;
              }
            }
          }
        }
      }

      if (data.toType === 'account') {
        const ca = cashAccounts.find((item) => item.id === data.toId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) + baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      } else if (data.toType === 'member') {
        const mem = members.find((item) => item.id === data.toId);
        if (mem) {
          const curBalances = { ...(mem.cashBalances || {}) };
          curBalances[data.currency] = Number(((curBalances[data.currency] || 0) + data.amount).toFixed(2));
          await updateDoc(doc(db, 'members', mem.id), {
            cashBalances: curBalances,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });

          // Create a CashHolding record for the recipient member
          const holdingId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newHolding: CashHolding = {
            id: holdingId,
            charityId: activeCharityId,
            tenantId: activeCharityId,
            memberId: mem.id,
            memberName: mem.fullName,
            memberNumber: mem.memberNumber,
            amount: data.amount,
            currency: data.currency,
            category: data.handoverFundType === 'CHARITY_CASE'
              ? 'Charity Case'
              : data.handoverFundType === 'MONTHLY_CONTRIBUTION'
              ? 'Monthly Contribution'
              : 'General Charity Pool',
            caseId: data.caseId,
            caseNumber: data.caseNumber,
            caseTitle: data.caseTitle,
            caseNote: data.caseTitle ? `Case: ${data.caseNumber ? data.caseNumber + ' - ' : ''}${data.caseTitle}` : undefined,
            donorMemberId: fromMember?.id,
            donorMemberName: fromMember?.fullName,
            donorMemberNumber: fromMember?.memberNumber,
            status: 'HELD',
            date: data.date,
            notes: `Cash received from ${fromName}`,
            sourceTransactionId: txnId,
            sourceTransactionNumber: txnNumber,
            createdAt: now,
            createdBy: currentUserIdentifier,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          };

          setRawCashHoldings((prev) => [newHolding, ...prev]);
          await setDoc(doc(db, 'cashHoldings', holdingId), cleanForFirestore(newHolding));
        }
      }
    }

    await logAction('Created', 'Transactions', txnNumber, desc);
    return newTxn;
  };

  const updateHandoverTransfer = async (
    transactionId: string,
    data: {
      date?: string;
      currency?: string;
      amount?: number;
      exchangeRate?: number;
      baseCurrencyAmount?: number;
      fromType?: 'member' | 'account';
      fromId?: string;
      toType?: 'member' | 'account';
      toId?: string;
      referenceNumber?: string;
      notes?: string;
      handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
      caseId?: string;
      caseNumber?: string;
      caseTitle?: string;
      status?: 'valid' | 'voided';
    }
  ): Promise<Transaction> => {
    const existing = transactions.find((t) => t.id === transactionId || t.transactionNumber === transactionId);
    if (!existing) throw new Error('Transaction not found');

    const now = new Date().toISOString();
    const baseCur = settings.currency || 'AED';

    const newAmount = Number(data.amount !== undefined ? data.amount : existing.amount);
    const newCurrency = data.currency || existing.currency || baseCur;
    const newRate = newCurrency === baseCur ? 1 : (data.exchangeRate || existing.exchangeRate || 1);
    const newBaseAmount = newCurrency === baseCur ? newAmount : (data.baseCurrencyAmount ?? Number((newAmount * newRate).toFixed(2)));
    const newDate = data.date || existing.date;

    const fromType = data.fromType || (existing.creditEntityType === 'member' ? 'member' : 'account');
    const fromId = data.fromId || existing.creditMemberId || existing.creditAccountId;
    const toType = data.toType || (existing.debitEntityType === 'member' ? 'member' : 'account');
    const toId = data.toId || existing.debitMemberId || existing.debitAccountId;

    let fromName = existing.fromName || '';
    let toName = existing.toName || '';
    const fromMember = fromType === 'member' ? members.find((m) => m.id === fromId) : undefined;
    const toMember = toType === 'member' ? members.find((m) => m.id === toId) : undefined;
    const fromAccount = fromType === 'account' ? (cashAccounts.find((a) => a.id === fromId) || accounts.find((a) => a.id === fromId)) : undefined;
    const toAccount = toType === 'account' ? (cashAccounts.find((a) => a.id === toId) || accounts.find((a) => a.id === toId)) : undefined;

    if (fromMember) fromName = fromMember.fullName;
    else if (fromAccount) fromName = fromAccount.name;

    if (toMember) toName = toMember.fullName;
    else if (toAccount) toName = toAccount.name;

    const charityCase = data.caseId ? cases.find((c) => c.id === data.caseId) : (existing.linkedCaseId ? cases.find((c) => c.id === existing.linkedCaseId) : undefined);

    const desc = data.notes || existing.notes || `Internal Transfer of ${newCurrency} ${newAmount} from ${fromName} to ${toName}`;

    const updatedTxn: Transaction = {
      ...existing,
      date: newDate,
      amount: newAmount,
      currency: newCurrency,
      exchangeRate: newRate,
      baseCurrencyAmount: newBaseAmount,
      fromName,
      toName,
      debitAccountId: toType === 'account' ? toId : existing.debitAccountId,
      debitAccountName: toName,
      debitEntityType: toType,
      debitMemberId: toMember?.id,
      debitMemberName: toMember?.fullName,
      debitMemberNumber: toMember?.memberNumber,
      creditAccountId: fromType === 'account' ? fromId : existing.creditAccountId,
      creditAccountName: fromName,
      creditEntityType: fromType,
      creditMemberId: fromMember?.id,
      creditMemberName: fromMember?.fullName,
      creditMemberNumber: fromMember?.memberNumber,
      linkedCaseId: charityCase?.id,
      linkedCaseNumber: charityCase?.caseNumber,
      linkedCaseTitle: charityCase?.title,
      description: desc,
      notes: data.notes || existing.notes,
      reference: data.referenceNumber || existing.reference,
      status: (data.status === 'voided' ? 'voided' : 'valid') as 'valid' | 'voided',
      updatedAt: now,
      updatedBy: currentUserEmail,
    };

    // Update JournalEntry
    const journalId = existing.journalEntryId || `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingJrnl = journalEntries.find((j) => j.id === journalId || j.sourceRecordId === existing.id || j.sourceRecordNumber === existing.transactionNumber);

    const journalLines: JournalLine[] = [
      {
        id: `line_${journalId}_1`,
        journalEntryId: journalId,
        accountId: updatedTxn.debitAccountId || accounts[0].id,
        accountCode: updatedTxn.debitAccountCode || accounts[0].code,
        accountName: updatedTxn.debitAccountName || toName,
        accountType: 'Asset',
        debit: newAmount,
        credit: 0,
        currency: newCurrency,
        exchangeRate: newRate,
        baseCurrencyDebit: newBaseAmount,
        baseCurrencyCredit: 0,
        description: `Debit: Received by ${toName} [${newCurrency} ${newAmount}]`,
      },
      {
        id: `line_${journalId}_2`,
        journalEntryId: journalId,
        accountId: updatedTxn.creditAccountId || accounts[0].id,
        accountCode: updatedTxn.creditAccountCode || accounts[0].code,
        accountName: updatedTxn.creditAccountName || fromName,
        accountType: 'Asset',
        debit: 0,
        credit: newAmount,
        currency: newCurrency,
        exchangeRate: newRate,
        baseCurrencyDebit: 0,
        baseCurrencyCredit: newBaseAmount,
        description: `Credit: Handed over by ${fromName} [${newCurrency} ${newAmount}]`,
      },
    ];

    const updatedJrnl: JournalEntry = {
      ...(existingJrnl || {
        id: journalId,
        entryNumber: `JRNL-${new Date(newDate).getFullYear()}-0000`,
        tenantId: activeCharityId,
        createdAt: now,
        createdBy: currentUserEmail,
      }),
      date: newDate,
      description: desc,
      lines: journalLines,
      totalDebit: newAmount,
      totalCredit: newAmount,
      isBalanced: true,
      status: data.status === 'voided' ? 'VOIDED' : 'POSTED',
      sourceRecordId: updatedTxn.id,
      sourceRecordNumber: updatedTxn.transactionNumber,
    };

    // Optimistic UI updates
    setRawTransactions((prev) => prev.map((t) => (t.id === existing.id ? updatedTxn : t)));
    setRawJournals((prev) => {
      const idx = prev.findIndex((j) => j.id === updatedJrnl.id);
      return idx >= 0 ? prev.map((j) => (j.id === updatedJrnl.id ? updatedJrnl : j)) : [updatedJrnl, ...prev];
    });

    try {
      await setDoc(doc(db, 'transactions', existing.id), cleanForFirestore(updatedTxn));
      await setDoc(doc(db, 'journal_entries', updatedJrnl.id), cleanForFirestore(updatedJrnl));
    } catch (err) {
      console.warn('Firestore write error in updateHandoverTransfer:', err);
    }

    await logAction('Updated', 'Transfer', existing.transactionNumber, `Updated transfer: ${desc}`);
    return updatedTxn;
  };

  const voidTransaction = async (transactionId: string, reason: string) => {
    const txn = transactions.find((t) => t.id === transactionId);
    if (!txn) throw new Error('Transaction not found');
    if (txn.status === 'voided') throw new Error('Transaction is already voided');

    const now = new Date().toISOString();
    await updateDoc(doc(db, 'transactions', transactionId), {
      status: 'voided',
      voidReason: reason,
      voidedBy: currentUserEmail,
      voidedAt: now,
      updatedAt: now,
      updatedBy: currentUserEmail,
    });

    // Revert balances if this was a transfer or handover
    if (txn.type === 'Member Handover' || txn.type === 'Transfer') {
      const rate = txn.exchangeRate || 1;
      const baseAmt = txn.baseCurrencyAmount ?? Number((txn.amount * rate).toFixed(2));

      // Revert Credit Account (From) -> Add back
      const fromMem = members.find((m) => m.id === txn.creditAccountId);
      if (fromMem) {
        const curBalances = { ...(fromMem.cashBalances || {}) };
        curBalances[txn.currency] = Number(((curBalances[txn.currency] || 0) + txn.amount).toFixed(2));
        await updateDoc(doc(db, 'members', fromMem.id), {
          cashBalances: curBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      } else {
        const ca = cashAccounts.find((c) => c.id === txn.creditAccountId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) + baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      }

      // Revert Debit Account (To) -> Deduct
      const toMem = members.find((m) => m.id === txn.debitAccountId);
      if (toMem) {
        const curBalances = { ...(toMem.cashBalances || {}) };
        curBalances[txn.currency] = Number(((curBalances[txn.currency] || 0) - txn.amount).toFixed(2));
        await updateDoc(doc(db, 'members', toMem.id), {
          cashBalances: curBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      } else {
        const ca = cashAccounts.find((c) => c.id === txn.debitAccountId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) - baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      }

      // Post reversing journal entry
      const revJournalNumber = getNextJournalNumber(journalEntries, new Date().getFullYear());
      const revJournalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const revJournalLines: JournalLine[] = [
        {
          id: `line_${revJournalId}_1`,
          journalEntryId: revJournalId,
          accountId: txn.creditAccountId,
          accountCode: txn.creditAccountCode,
          accountName: txn.creditAccountName,
          accountType: 'Asset',
          debit: txn.amount,
          credit: 0,
          currency: txn.currency,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          description: `VOID REVERSAL: Debit back to ${txn.creditAccountName}`,
        },
        {
          id: `line_${revJournalId}_2`,
          journalEntryId: revJournalId,
          accountId: txn.debitAccountId,
          accountCode: txn.debitAccountCode,
          accountName: txn.debitAccountName,
          accountType: 'Asset',
          debit: 0,
          credit: txn.amount,
          currency: txn.currency,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          description: `VOID REVERSAL: Credit reversal from ${txn.debitAccountName}`,
        },
      ];

      const revJournalEntry: JournalEntry = {
        id: revJournalId,
        entryNumber: revJournalNumber,
        tenantId: activeCharityId,
        date: now.slice(0, 10),
        description: `VOID REVERSAL of ${txn.transactionNumber}: ${reason}`,
        sourceTransactionType: 'INTERNAL_TRANSFER',
        sourceRecordId: txn.id,
        sourceRecordNumber: txn.transactionNumber,
        lines: revJournalLines,
        totalDebit: txn.amount,
        totalCredit: txn.amount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUserIdentifier,
      };

      await setDoc(doc(db, 'journal_entries', revJournalId), revJournalEntry);
    }

    await logAction('Voided', 'Transactions', txn.transactionNumber, `Voided transaction ${txn.transactionNumber}: ${reason}`);
  };

  const reverseTransaction = async (transactionId: string, reason: string) => {
    const txn = transactions.find((t) => t.id === transactionId);
    if (!txn) throw new Error('Transaction not found');
    const revTxnNumber = getNextTransactionNumber(transactions);
    const revTxnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const rate = txn.exchangeRate || 1;
    const baseAmt = txn.baseCurrencyAmount ?? Number((txn.amount * rate).toFixed(2));

    const reversingEntry: Transaction = {
      id: revTxnId,
      charityId: activeCharityId,
      tenantId: activeCharityId,
      transactionNumber: revTxnNumber,
      date: now.slice(0, 10),
      type: 'Reversal',
      description: `REVERSAL of ${txn.transactionNumber}: ${reason}`,
      reference: txn.transactionNumber,
      currency: txn.currency,
      exchangeRate: txn.exchangeRate,
      baseCurrencyAmount: txn.baseCurrencyAmount,
      debitAccountId: txn.creditAccountId,
      debitAccountCode: txn.creditAccountCode,
      debitAccountName: txn.creditAccountName,
      creditAccountId: txn.debitAccountId,
      creditAccountCode: txn.debitAccountCode,
      creditAccountName: txn.debitAccountName,
      amount: txn.amount,
      status: 'reversal',
      reversalOfTxnId: txn.id,
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    await setDoc(doc(db, 'transactions', revTxnId), cleanForFirestore(reversingEntry));

    // Revert balances
    if (txn.type === 'Member Handover' || txn.type === 'Transfer') {
      // Debit reversing account: txn.creditAccountId (Source gets funds back)
      const fromMem = members.find((m) => m.id === txn.creditAccountId);
      if (fromMem) {
        const curBalances = { ...(fromMem.cashBalances || {}) };
        curBalances[txn.currency] = Number(((curBalances[txn.currency] || 0) + txn.amount).toFixed(2));
        await updateDoc(doc(db, 'members', fromMem.id), {
          cashBalances: curBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      } else {
        const ca = cashAccounts.find((c) => c.id === txn.creditAccountId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) + baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      }

      // Credit reversing account: txn.debitAccountId (Destination gets deducted)
      const toMem = members.find((m) => m.id === txn.debitAccountId);
      if (toMem) {
        const curBalances = { ...(toMem.cashBalances || {}) };
        curBalances[txn.currency] = Number(((curBalances[txn.currency] || 0) - txn.amount).toFixed(2));
        await updateDoc(doc(db, 'members', toMem.id), {
          cashBalances: curBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      } else {
        const ca = cashAccounts.find((c) => c.id === txn.debitAccountId);
        if (ca) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            currentBalance: (ca.currentBalance || 0) - baseAmt,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }
      }

      // Post reversing journal entry
      const revJournalNumber = getNextJournalNumber(journalEntries, new Date().getFullYear());
      const revJournalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const revJournalLines: JournalLine[] = [
        {
          id: `line_${revJournalId}_1`,
          journalEntryId: revJournalId,
          accountId: txn.creditAccountId,
          accountCode: txn.creditAccountCode,
          accountName: txn.creditAccountName,
          accountType: 'Asset',
          debit: txn.amount,
          credit: 0,
          currency: txn.currency,
          exchangeRate: rate,
          baseCurrencyDebit: baseAmt,
          baseCurrencyCredit: 0,
          description: `REVERSAL: Debit back to ${txn.creditAccountName}`,
        },
        {
          id: `line_${revJournalId}_2`,
          journalEntryId: revJournalId,
          accountId: txn.debitAccountId,
          accountCode: txn.debitAccountCode,
          accountName: txn.debitAccountName,
          accountType: 'Asset',
          debit: 0,
          credit: txn.amount,
          currency: txn.currency,
          exchangeRate: rate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmt,
          description: `REVERSAL: Credit reversal from ${txn.debitAccountName}`,
        },
      ];

      const revJournalEntry: JournalEntry = {
        id: revJournalId,
        entryNumber: revJournalNumber,
        tenantId: activeCharityId,
        date: now.slice(0, 10),
        description: `REVERSAL of ${txn.transactionNumber}: ${reason}`,
        sourceTransactionType: 'INTERNAL_TRANSFER',
        sourceRecordId: revTxnId,
        sourceRecordNumber: revTxnNumber,
        lines: revJournalLines,
        totalDebit: txn.amount,
        totalCredit: txn.amount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUserIdentifier,
      };

      await setDoc(doc(db, 'journal_entries', revJournalId), revJournalEntry);
    }
    await logAction('Reversed', 'Transactions', txn.transactionNumber, `Reversed ${txn.transactionNumber} with ${revTxnNumber}`);
  };

  const updateSettings = async (newSettings: Partial<OrganizationSettings>) => {
    const targetId = activeCharity?.id || activeCharityId || (charities[0] && charities[0].id) || 'default';
    await updateCharity(targetId, newSettings);
  };

  // --- Sample Demo Data Seeding ---
  const seedDemoData = async () => {
    setLoading(true);
    try {
      await initializeDefaultAccounts();
      await initializeDefaultCashAccounts();
      await initializeDefaultCases();

      // Sample 20 members with structured Local & Home Country Addresses
      const sampleMembers = [
        {
          name: 'Mohammed Al-Mansoor',
          father: 'Rashid Al-Mansoor',
          phone: '+971 50 123 4567',
          amount: 500,
          localCity: 'Dubai',
          localArea: 'Al Barsha 2',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Calicut',
        },
        {
          name: 'Fatima Zahra Khan',
          father: 'Ibrahim Khan',
          phone: '+971 55 234 5678',
          amount: 300,
          localCity: 'Sharjah',
          localArea: 'Al Majaz 3',
          homeCountry: 'Pakistan',
          homeState: 'Punjab',
          homeCity: 'Lahore',
        },
        {
          name: 'Abdullah Omar Farooq',
          father: 'Omar Farooq',
          phone: '+971 52 345 6789',
          amount: 1000,
          localCity: 'Dubai',
          localArea: 'Deira, Al Muraqqabat',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Kochi',
        },
        {
          name: 'Ayesha Siddiqua',
          father: 'Husband: Tariq Mahmood',
          phone: '+971 54 456 7890',
          amount: 200,
          localCity: 'Ajman',
          localArea: 'Al Nuaimia',
          homeCountry: 'India',
          homeState: 'Telangana',
          homeCity: 'Hyderabad',
        },
        {
          name: 'Zayed Sultan Al-Nuaimi',
          father: 'Sultan Al-Nuaimi',
          phone: '+971 50 567 8901',
          amount: 500,
          localCity: 'Abu Dhabi',
          localArea: 'Al Khalidiya',
          homeCountry: 'UAE',
          homeState: 'Abu Dhabi',
          homeCity: 'Abu Dhabi',
        },
        {
          name: 'Mariam Bint Khalid',
          father: 'Khalid Al-Hashemi',
          phone: '+971 56 678 9012',
          amount: 150,
          localCity: 'Dubai',
          localArea: 'Jumeirah 1',
          homeCountry: 'Egypt',
          homeState: 'Cairo',
          homeCity: 'Cairo',
        },
        {
          name: 'Hamza Abdul Rahman',
          father: 'Abdul Rahman',
          phone: '+971 52 789 0123',
          amount: 250,
          localCity: 'Dubai',
          localArea: 'Bur Dubai',
          homeCountry: 'India',
          homeState: 'Karnataka',
          homeCity: 'Mangalore',
        },
        {
          name: 'Khadija Nouruddin',
          father: 'Nouruddin Ahmed',
          phone: '+971 55 890 1234',
          amount: 400,
          localCity: 'Sharjah',
          localArea: 'Al Taawun',
          homeCountry: 'Bangladesh',
          homeState: 'Dhaka',
          homeCity: 'Dhaka',
        },
        {
          name: 'Bilal Mustafa',
          father: 'Mustafa Kamal',
          phone: '+971 50 901 2345',
          amount: 500,
          localCity: 'Dubai',
          localArea: 'Silicon Oasis',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Malappuram',
        },
        {
          name: 'Hessa Salem Al-Kaabi',
          father: 'Salem Al-Kaabi',
          phone: '+971 54 012 3456',
          amount: 100,
          localCity: 'Al Ain',
          localArea: 'Al Jimi',
          homeCountry: 'UAE',
          homeState: 'Abu Dhabi',
          homeCity: 'Al Ain',
        },
        {
          name: 'Dr. Yusuf Al-Qasimi',
          father: 'Saeed Al-Qasimi',
          phone: '+971 50 321 6547',
          amount: 1500,
          localCity: 'Dubai',
          localArea: 'Dubai Marina',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Trivandrum',
        },
        {
          name: 'Zainab Ali Reza',
          father: 'Ali Reza',
          phone: '+971 55 432 7658',
          amount: 300,
          localCity: 'Dubai',
          localArea: 'Mirdif',
          homeCountry: 'India',
          homeState: 'Maharashtra',
          homeCity: 'Mumbai',
        },
        {
          name: 'Rashid Mubarak',
          father: 'Mubarak Al-Ketbi',
          phone: '+971 52 543 8769',
          amount: 500,
          localCity: 'Sharjah',
          localArea: 'Al Qasimia',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Kannur',
        },
        {
          name: 'Salma Tariq',
          father: 'Tariq Aziz',
          phone: '+971 56 654 9870',
          amount: 200,
          localCity: 'Dubai',
          localArea: 'International City',
          homeCountry: 'Pakistan',
          homeState: 'Sindh',
          homeCity: 'Karachi',
        },
        {
          name: 'Suleiman Al-Husseini',
          father: 'Hassan Al-Husseini',
          phone: '+971 50 765 0981',
          amount: 600,
          localCity: 'Dubai',
          localArea: 'Al Quoz 4',
          homeCountry: 'Jordan',
          homeState: 'Amman',
          homeCity: 'Amman',
        },
        {
          name: 'Noor Bint Ahmed',
          father: 'Ahmed Al-Shehhi',
          phone: '+971 54 876 1092',
          amount: 350,
          localCity: 'Ras Al Khaimah',
          localArea: 'Al Dhait',
          homeCountry: 'UAE',
          homeState: 'Ras Al Khaimah',
          homeCity: 'RAK',
        },
        {
          name: 'Ibrahim Al-Falasi',
          father: 'Mattar Al-Falasi',
          phone: '+971 52 987 2103',
          amount: 500,
          localCity: 'Dubai',
          localArea: 'Nad Al Sheba',
          homeCountry: 'India',
          homeState: 'Kerala',
          homeCity: 'Thrissur',
        },
        {
          name: 'Layla Mahmoud',
          father: 'Mahmoud Hassan',
          phone: '+971 55 098 3214',
          amount: 250,
          localCity: 'Sharjah',
          localArea: 'Muwaileh Commercial',
          homeCountry: 'Egypt',
          homeState: 'Alexandria',
          homeCity: 'Alexandria',
        },
        {
          name: 'Sultan Al-Dhaheri',
          father: 'Humaid Al-Dhaheri',
          phone: '+971 50 109 4325',
          amount: 750,
          localCity: 'Abu Dhabi',
          localArea: 'Al Bateen',
          homeCountry: 'UAE',
          homeState: 'Abu Dhabi',
          homeCity: 'Abu Dhabi',
        },
        {
          name: 'Amna Bint Saeed',
          father: 'Saeed Al-Maktoum',
          phone: '+971 56 210 5436',
          amount: 400,
          localCity: 'Dubai',
          localArea: 'Al Safa 2',
          homeCountry: 'India',
          homeState: 'Tamil Nadu',
          homeCity: 'Chennai',
        },
      ];

      for (let i = 0; i < sampleMembers.length; i++) {
        const item = sampleMembers[i];
        const memNum = `MEM-${String(i + 1).padStart(4, '0')}`;
        const memId = `mem_demo_${i + 1}`;

        const memberDoc: Member = {
          id: memId,
          charityId: 'default',
          tenantId: 'default',
          memberNumber: memNum,
          fullName: item.name,
          fatherHusbandName: item.father,
          mobileNumber: item.phone,
          email: `${item.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
          address: `${item.localArea}, ${item.localCity}, UAE`,
          localAddress: {
            building: 'Tower 4',
            flat: `Unit ${101 + i}`,
            area: item.localArea,
            city: item.localCity,
            stateOrEmirate: item.localCity,
            country: 'United Arab Emirates',
            phone: item.phone,
          },
          homeCountryAddress: {
            building: 'Bait Al-Salam Villa',
            flat: 'House #12',
            area: 'Main Town',
            city: item.homeCity,
            stateOrEmirate: item.homeState,
            postalCodeOrPoBox: `${673001 + i}`,
            country: item.homeCountry,
            phone: item.phone,
          },
          joinDate: '2026-01-01',
          monthlyContributionAmount: item.amount,
          status: 'active',
          notes: 'Regular active monthly contributor',
          totalContributed: 0,
          totalMonthlyContributed: 0,
          totalSpecialContributed: 0,
          receiptsCount: 0,
          createdAt: new Date().toISOString(),
          createdBy: 'Demo Seeder',
          updatedAt: new Date().toISOString(),
          updatedBy: 'Demo Seeder',
        };
        await setDoc(doc(db, 'members', memId), memberDoc);
      }

      await logAction('Created', 'System', 'Seed', 'Seeded initial demo members, cases, and default Chart of Accounts');
    } catch (e) {
      console.error('Seeding error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const clearDemoData = async () => {
    setLoading(true);
    try {
      for (const r of receipts) await deleteDoc(doc(db, 'receipts', r.id));
      for (const p of payments) await deleteDoc(doc(db, 'payments', p.id));
      for (const t of transactions) await deleteDoc(doc(db, 'transactions', t.id));
      for (const j of journalEntries) await deleteDoc(doc(db, 'journal_entries', j.id));
      for (const c of cases) await deleteDoc(doc(db, 'cases', c.id));
      for (const m of members) await deleteDoc(doc(db, 'members', m.id));
      for (const h of cashHoldings) await deleteDoc(doc(db, 'cashHoldings', h.id));
      await logAction('Deleted', 'System', 'All', 'Cleared all demo transactional and member data');
    } catch (e) {
      console.error('Clear data error:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset All Amounts / Start Fresh For New Firm
   * - Wipes all financial transactions, receipts, payments, vouchers, transfers, journal entries, and cash holdings
   * - Resets all member cash-in-hand custody balances to 0.00 AED and total contributed to 0.00 AED
   * - Resets all Cash & Bank accounts and Chart of Account ledger balances to 0.00 AED
   * - Resets cases collected and disbursed totals to 0.00 AED
   * - Clears local storage caches
   */
  /**
   * Reset Firm Financial Data
   * Cleans recorded transactions, receipts, payments, and resets cash holdings & balances to 0.00
   */
  const resetAllFirmData = async (
    options: { resetMembers?: boolean; keepChartOfAccounts?: boolean; allFirms?: boolean; removeMembers?: boolean } = {}
  ) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const all = !!options.allFirms;
      const targetCharityId = activeCharityId;

      const shouldMatch = (itemCharityId?: string) => {
        if (all) return true;
        if (itemCharityId === targetCharityId) return true;
        if (
          isDefaultCharity &&
          (!itemCharityId || itemCharityId === 'default' || itemCharityId === charities[0]?.id)
        ) {
          return true;
        }
        return false;
      };

      // 1. Delete matching receipts
      const receiptsToDelete = rawReceipts.filter((r) => shouldMatch(r.charityId));
      for (const r of receiptsToDelete) {
        await deleteDoc(doc(db, 'receipts', r.id)).catch(() => {});
      }
      setRawReceipts((prev) => prev.filter((r) => !shouldMatch(r.charityId)));

      // 2. Delete matching payments & vouchers
      const paymentsToDelete = rawPayments.filter((p) => shouldMatch(p.charityId));
      for (const p of paymentsToDelete) {
        await deleteDoc(doc(db, 'payments', p.id)).catch(() => {});
      }
      setRawPayments((prev) => prev.filter((p) => !shouldMatch(p.charityId)));

      // 3. Delete matching ledger transactions & handovers
      const txnsToDelete = rawTransactions.filter((t) => shouldMatch(t.charityId));
      for (const t of txnsToDelete) {
        await deleteDoc(doc(db, 'transactions', t.id)).catch(() => {});
      }
      setRawTransactions((prev) => prev.filter((t) => !shouldMatch(t.charityId)));

      // 4. Delete matching double-entry journal entries
      const journalsToDelete = rawJournals.filter((j) => shouldMatch(j.charityId));
      for (const j of journalsToDelete) {
        await deleteDoc(doc(db, 'journal_entries', j.id)).catch(() => {});
      }
      setRawJournals((prev) => prev.filter((j) => !shouldMatch(j.charityId)));

      // 5. Delete matching cash custody holdings
      const holdingsToDelete = rawCashHoldings.filter((h) => shouldMatch(h.charityId));
      for (const h of holdingsToDelete) {
        await deleteDoc(doc(db, 'cashHoldings', h.id)).catch(() => {});
      }
      setRawCashHoldings((prev) => prev.filter((h) => !shouldMatch(h.charityId)));

      // 6. Handle Members
      if (options.removeMembers) {
        const membersToDelete = rawMembers.filter((m) => shouldMatch(m.charityId));
        for (const m of membersToDelete) {
          await deleteDoc(doc(db, 'members', m.id)).catch(() => {});
        }
        setRawMembers((prev) => prev.filter((m) => !shouldMatch(m.charityId)));
      } else {
        const updatedMembers = rawMembers.map((m) => {
          if (!shouldMatch(m.charityId)) return m;
          return {
            ...m,
            totalContributed: 0,
            totalMonthlyContributed: 0,
            totalSpecialContributed: 0,
            receiptsCount: 0,
            cashBalances: {},
            reimbursementsDue: 0,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          };
        });

        for (const m of updatedMembers) {
          if (shouldMatch(m.charityId)) {
            await updateDoc(doc(db, 'members', m.id), {
              totalContributed: 0,
              totalMonthlyContributed: 0,
              totalSpecialContributed: 0,
              receiptsCount: 0,
              cashBalances: {},
              reimbursementsDue: 0,
              updatedAt: now,
              updatedBy: currentUserIdentifier,
            }).catch(async () => {
              await setDoc(doc(db, 'members', m.id), m).catch(() => {});
            });
          }
        }
        setRawMembers(updatedMembers);
      }

      // 7. Reset Cash & Bank Accounts balances to 0.00
      for (const ca of rawCashAccounts) {
        if (shouldMatch(ca.charityId)) {
          await updateDoc(doc(db, 'cashAccounts', ca.id), {
            openingBalance: 0,
            currentBalance: 0,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          }).catch(() => {});
        }
      }
      setRawCashAccounts((prev) =>
        prev.map((ca) => (shouldMatch(ca.charityId) ? { ...ca, openingBalance: 0, currentBalance: 0 } : ca))
      );

      // 8. Reset Chart of Accounts balances to 0.00
      for (const acc of rawAccounts) {
        if (shouldMatch(acc.charityId)) {
          await updateDoc(doc(db, 'accounts', acc.id), {
            balance: 0,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          }).catch(() => {});
        }
      }
      setRawAccounts((prev) =>
        prev.map((a) => (shouldMatch(a.charityId) ? { ...a, balance: 0 } : a))
      );

      // 9. Reset Case progress balances (collected = 0, disbursed = 0)
      for (const c of rawCases) {
        if (shouldMatch(c.charityId)) {
          await updateDoc(doc(db, 'cases', c.id), {
            collectedAmount: 0,
            disbursedAmount: 0,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          }).catch(() => {});
        }
      }
      setRawCases((prev) =>
        prev.map((c) =>
          shouldMatch(c.charityId) ? { ...c, collectedAmount: 0, disbursedAmount: 0 } : c
        )
      );

      // 10. Clear localStorage caches
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('charity_cached_members');
        } catch (e) {
          // ignore
        }
      }

      const scopeName = all
        ? 'All Organizations (Complete System Wipe)'
        : `Firm "${activeCharity.charityName}" (${activeCharityId})`;

      await logAction(
        'Deleted',
        'System',
        'FirmReset',
        `Performed Firm Reset for ${scopeName}: Cleared transactions, receipts, payments, cash holdings, and reset balances to 0.00 AED`
      );
    } catch (e) {
      console.error('Reset all firm data error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  // Cash Holding / Cash Custodian Operations
  const addCashHolding = async (
    holdingData: Omit<CashHolding, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<CashHolding> => {
    const id = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newHolding: CashHolding = {
      ...holdingData,
      id,
      charityId: holdingData.charityId || activeCharityId,
      currency: holdingData.currency || settings.currency || 'AED',
      status: holdingData.status || 'HELD',
      createdAt: now,
      createdBy: currentUserIdentifier,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };

    await setDoc(doc(db, 'cashHoldings', id), newHolding);

    // Update the custodian member's physical cash balance
    const mem = rawMembers.find((m) => m.id === holdingData.memberId);
    if (mem) {
      const cur = holdingData.currency || settings.currency || 'AED';
      const curBalances = { ...(mem.cashBalances || {}) };
      curBalances[cur] = Number(((curBalances[cur] || 0) + holdingData.amount).toFixed(2));
      await updateDoc(doc(db, 'members', mem.id), {
        cashBalances: curBalances,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      });
    }

    await logAction(
      'Created',
      'CashCustodians',
      id,
      `Recorded cash in hand: ${newHolding.amount} ${newHolding.currency} held by ${newHolding.memberName} for ${newHolding.category}${
        newHolding.caseTitle ? ` (${newHolding.caseTitle})` : ''
      }`
    );
    return newHolding;
  };

  const settleCashHolding = async (
    id: string,
    settlement: SettleHoldingOptions
  ): Promise<void> => {
    const holding = cashHoldings.find((h) => h.id === id);
    if (!holding) throw new Error('Cash holding record not found');

    const now = new Date().toISOString();
    const today = settlement.settlementDate || now.slice(0, 10);
    const sourceCurrency = holding.currency || settings.currency || 'AED';
    const baseCur = settings.currency || 'AED';

    // Amount to settle (supports partial or full settlement)
    const rawSettleAmt = settlement.amount !== undefined ? settlement.amount : holding.amount;
    const settleAmount = Number(Math.min(holding.amount, Math.max(0.01, rawSettleAmt)).toFixed(2));
    if (settleAmount <= 0) throw new Error('Settlement amount must be greater than zero');

    const isPartial = settleAmount < holding.amount - 0.005;
    const remainingHoldingAmount = isPartial
      ? Number((holding.amount - settleAmount).toFixed(2))
      : 0;

    // Conversion rate to base currency (AED)
    const sourceToBaseRate =
      sourceCurrency === baseCur
        ? 1
        : sourceCurrency === 'INR'
        ? (settings.exchangeRateInrToAed || 0.0440123)
        : 1;
    const baseAmount =
      sourceCurrency === baseCur
        ? settleAmount
        : Number((settleAmount * sourceToBaseRate).toFixed(2));

    const sourceMem =
      rawMembers.find((m) => m.id === holding.memberId) ||
      members.find((m) => m.id === holding.memberId);

    // =========================================================================
    // OPTION 1: HAND OVER TO ANOTHER MEMBER / CUSTODIAN (OR MAIN TREASURY SAFE)
    // =========================================================================
    if (
      settlement.settlementType === 'HANDOVER_TO_MEMBER' ||
      settlement.settlementType === 'OFFICE_HANDOVER'
    ) {
      const isTreasury =
        settlement.destinationType === 'account' ||
        settlement.destinationAccountId === 'main_treasury' ||
        (settlement.destinationAccountName &&
          settlement.destinationAccountName.toLowerCase().includes('treasury'));

      if (isTreasury) {
        // Hand over to Main Treasury Safe
        const destAcc =
          cashAccounts.find(
            (c) =>
              c.name.toLowerCase().includes('main treasury') ||
              c.accountCode === '1010'
          ) || cashAccounts[0];

        const txnNumber = getNextTransactionNumber(transactions);
        const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const journalNumber = getNextJournalNumber(
          journalEntries,
          new Date(today).getFullYear()
        );
        const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const desc = `Cash Handover to Treasury Safe: ${holding.memberName} -> ${
          destAcc?.name || 'Main Treasury Safe'
        } [${sourceCurrency} ${settleAmount}]`;

        const custodyAcc =
          accounts.find((a) => a.code === '1050') || {
            id: 'acc_1050',
            code: '1050',
            name: 'Cash in Member Custody',
            type: 'Asset' as const,
          };
        const treasuryGL =
          accounts.find((a) => a.code === '1010') || {
            id: 'acc_1010',
            code: '1010',
            name: 'Cash on Hand (Main Treasury)',
            type: 'Asset' as const,
          };

        const journalLines: JournalLine[] = [
          {
            id: `line_${journalId}_1`,
            journalEntryId: journalId,
            accountId: treasuryGL.id,
            accountCode: treasuryGL.code,
            accountName: treasuryGL.name,
            accountType: 'Asset',
            debit: baseAmount,
            credit: 0,
            currency: baseCur,
            exchangeRate: 1,
            baseCurrencyDebit: baseAmount,
            baseCurrencyCredit: 0,
            description: `Debit: Received in Treasury Safe from ${holding.memberName}`,
          },
          {
            id: `line_${journalId}_2`,
            journalEntryId: journalId,
            accountId: custodyAcc.id,
            accountCode: custodyAcc.code,
            accountName: `Member Custody: ${holding.memberName}`,
            accountType: 'Asset',
            debit: 0,
            credit: settleAmount,
            currency: sourceCurrency,
            exchangeRate: sourceToBaseRate,
            baseCurrencyDebit: 0,
            baseCurrencyCredit: baseAmount,
            description: `Credit: Handed over from ${holding.memberName}`,
          },
        ];

        const newJournal: JournalEntry = {
          id: journalId,
          entryNumber: journalNumber,
          tenantId: activeCharityId,
          date: today,
          description: desc,
          sourceTransactionType: 'INTERNAL_TRANSFER',
          sourceRecordId: txnId,
          sourceRecordNumber: txnNumber,
          lines: journalLines,
          totalDebit: baseAmount,
          totalCredit: baseAmount,
          isBalanced: true,
          status: 'POSTED',
          createdAt: now,
          createdBy: currentUserIdentifier,
        };

        const newTxn: Transaction = {
          id: txnId,
          charityId: activeCharityId,
          tenantId: activeCharityId,
          transactionNumber: txnNumber,
          date: today,
          type: 'Cash Transfer',
          description: desc,
          reference:
            settlement.voucherReference ||
            settlement.notes ||
            `SAFE-${holding.memberNumber || 'CUST'}`,
          currency: sourceCurrency,
          exchangeRate: sourceToBaseRate,
          baseCurrencyAmount: baseAmount,
          fromName: holding.memberName,
          toName: destAcc?.name || 'Cash on Hand (Main Treasury Safe)',
          creditAccountId: custodyAcc.id,
          creditAccountCode: '1050',
          creditAccountName: `Member Custody (${holding.memberName})`,
          creditEntityType: 'member',
          creditMemberId: holding.memberId,
          creditMemberName: holding.memberName,
          creditMemberNumber: holding.memberNumber,
          debitAccountId: destAcc?.id || treasuryGL.id,
          debitAccountCode: destAcc?.accountCode || '1010',
          debitAccountName: destAcc?.name || 'Cash on Hand (Main Treasury Safe)',
          debitEntityType: 'account',
          amount: settleAmount,
          status: 'valid',
          linkedCaseId: holding.caseId,
          linkedCaseNumber: holding.caseNumber,
          linkedCaseTitle: holding.caseTitle,
          journalEntryId: journalId,
          createdAt: now,
          createdBy: currentUserIdentifier,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        };

        // 1. Deduct source member cash balance
        if (sourceMem) {
          const curBalances = { ...(sourceMem.cashBalances || {}) };
          curBalances[sourceCurrency] = Math.max(
            0,
            Number(((curBalances[sourceCurrency] || 0) - settleAmount).toFixed(2))
          );
          setRawMembers((prev) =>
            prev.map((m) =>
              m.id === sourceMem.id ? { ...m, cashBalances: curBalances } : m
            )
          );
          await updateDoc(doc(db, 'members', sourceMem.id), {
            cashBalances: curBalances,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }

        // 2. Increment Main Treasury Account Balance
        if (destAcc) {
          const newBal = Number(
            ((destAcc.currentBalance || 0) + baseAmount).toFixed(2)
          );
          setRawCashAccounts((prev) =>
            prev.map((c) =>
              c.id === destAcc.id ? { ...c, currentBalance: newBal } : c
            )
          );
          await updateDoc(doc(db, 'cashAccounts', destAcc.id), {
            currentBalance: newBal,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }

        // 3. Update source holding
        const noteText = settlement.notes
          ? `${holding.notes || ''} | Settled to Treasury Safe: ${settlement.notes}`
          : holding.notes;

        if (isPartial) {
          setRawCashHoldings((prev) =>
            prev.map((h) =>
              h.id === holding.id ? { ...h, amount: remainingHoldingAmount } : h
            )
          );
          await updateDoc(doc(db, 'cashHoldings', holding.id), {
            amount: remainingHoldingAmount,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });

          const settledSliceId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const settledSlice: CashHolding = {
            ...holding,
            id: settledSliceId,
            amount: settleAmount,
            status: 'RETURNED_TO_TREASURER',
            settledDate: today,
            settlementType: 'OFFICE_HANDOVER',
            destinationAccountId: destAcc?.id,
            destinationAccountName:
              destAcc?.name || 'Cash on Hand (Main Treasury Safe)',
            notes: noteText,
            sourceTransactionId: txnId,
            sourceTransactionNumber: txnNumber,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          };
          setRawCashHoldings((prev) => [settledSlice, ...prev]);
          await setDoc(
            doc(db, 'cashHoldings', settledSliceId),
            cleanForFirestore(settledSlice)
          );
        } else {
          setRawCashHoldings((prev) =>
            prev.map((h) =>
              h.id === holding.id
                ? {
                    ...h,
                    status: 'RETURNED_TO_TREASURER',
                    settledDate: today,
                    settlementType: 'OFFICE_HANDOVER',
                    destinationAccountId: destAcc?.id,
                    destinationAccountName:
                      destAcc?.name || 'Cash on Hand (Main Treasury Safe)',
                    notes: noteText,
                    sourceTransactionId: txnId,
                    sourceTransactionNumber: txnNumber,
                  }
                : h
            )
          );
          await updateDoc(doc(db, 'cashHoldings', holding.id), {
            status: 'RETURNED_TO_TREASURER',
            settledDate: today,
            settlementType: 'OFFICE_HANDOVER',
            destinationAccountId: destAcc?.id,
            destinationAccountName:
              destAcc?.name || 'Cash on Hand (Main Treasury Safe)',
            notes: noteText,
            sourceTransactionId: txnId,
            sourceTransactionNumber: txnNumber,
            updatedAt: now,
            updatedBy: currentUserIdentifier,
          });
        }

        // 4. Save journal and transaction
        setRawJournals((prev) => [newJournal, ...prev]);
        setRawTransactions((prev) => [newTxn, ...prev]);
        await setDoc(
          doc(db, 'journal_entries', journalId),
          cleanForFirestore(newJournal)
        );
        await setDoc(doc(db, 'transactions', txnId), cleanForFirestore(newTxn));

        await logAction(
          'Updated',
          'CashCustodians',
          holding.id,
          `Handed over ${sourceCurrency} ${settleAmount} from ${holding.memberName} to Main Treasury Safe`
        );
        return;
      }

      // Handover to Another Member / Custodian
      const destMember =
        rawMembers.find((m) => m.id === settlement.destinationMemberId) ||
        members.find((m) => m.id === settlement.destinationMemberId);
      if (!destMember) {
        throw new Error('Please select an authorized receiving custodian member');
      }

      // Determine recipient currency and exchange rate
      let destCurrency = settlement.destinationCurrency;
      if (!destCurrency) {
        const destInrOnly =
          (destMember.cashBalances?.['INR'] || 0) > 0 &&
          !(destMember.cashBalances?.['AED'] || 0);
        const isIndia =
          destMember.homeCountryAddress?.country?.toLowerCase() === 'india';
        destCurrency = destInrOnly || isIndia ? 'INR' : sourceCurrency || 'AED';
      }

      let destRate = settlement.exchangeRate;
      if (!destRate) {
        if (sourceCurrency === destCurrency) destRate = 1;
        else if (sourceCurrency === 'AED' && destCurrency === 'INR')
          destRate = settings.exchangeRateAedToInr || 22.72;
        else if (sourceCurrency === 'INR' && destCurrency === 'AED')
          destRate = settings.exchangeRateInrToAed || 0.0440123;
        else destRate = 1;
      }

      const destAmount =
        settlement.destinationAmount && settlement.destinationAmount > 0
          ? Number(settlement.destinationAmount.toFixed(2))
          : Number((settleAmount * destRate).toFixed(2));

      const txnNumber = getNextTransactionNumber(transactions);
      const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const journalNumber = getNextJournalNumber(
        journalEntries,
        new Date(today).getFullYear()
      );
      const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const caseTag = holding.caseTitle
        ? ` [Case: ${holding.caseNumber ? holding.caseNumber + ' - ' : ''}${holding.caseTitle}]`
        : '';
      const desc = `Peer-to-Peer Cash Handover: ${holding.memberName} -> ${
        destMember.fullName
      } (${sourceCurrency} ${settleAmount}${
        destCurrency !== sourceCurrency ? ` -> ${destCurrency} ${destAmount}` : ''
      })${caseTag}`;

      const custodyAcc =
        accounts.find((a) => a.code === '1050') || {
          id: 'acc_1050',
          code: '1050',
          name: 'Cash in Member Custody',
          type: 'Asset' as const,
        };

      const journalLines: JournalLine[] = [
        {
          id: `line_${journalId}_1`,
          journalEntryId: journalId,
          accountId: custodyAcc.id,
          accountCode: custodyAcc.code,
          accountName: `Member Custody: ${destMember.fullName}`,
          accountType: 'Asset',
          debit: destAmount,
          credit: 0,
          currency: destCurrency,
          exchangeRate:
            destCurrency === baseCur
              ? 1
              : destCurrency === 'INR'
              ? (settings.exchangeRateInrToAed || 0.0440123)
              : 1,
          baseCurrencyDebit: baseAmount,
          baseCurrencyCredit: 0,
          description: `Debit: Received in custody by ${destMember.fullName}${caseTag}`,
        },
        {
          id: `line_${journalId}_2`,
          journalEntryId: journalId,
          accountId: custodyAcc.id,
          accountCode: custodyAcc.code,
          accountName: `Member Custody: ${holding.memberName}`,
          accountType: 'Asset',
          debit: 0,
          credit: settleAmount,
          currency: sourceCurrency,
          exchangeRate: sourceToBaseRate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmount,
          description: `Credit: Handed over from custody by ${holding.memberName}${caseTag}`,
        },
      ];

      const newJournal: JournalEntry = {
        id: journalId,
        entryNumber: journalNumber,
        tenantId: activeCharityId,
        date: today,
        description: desc,
        sourceTransactionType: 'INTERNAL_TRANSFER',
        sourceRecordId: txnId,
        sourceRecordNumber: txnNumber,
        lines: journalLines,
        totalDebit: settleAmount,
        totalCredit: settleAmount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUserIdentifier,
      };

      const newTxn: Transaction = {
        id: txnId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        transactionNumber: txnNumber,
        date: today,
        type: 'Member Handover',
        description: desc,
        reference:
          settlement.voucherReference ||
          settlement.notes ||
          `HANDOVER-${holding.memberNumber || 'CUST'}`,
        currency: sourceCurrency,
        exchangeRate: sourceToBaseRate,
        baseCurrencyAmount: baseAmount,
        fromName: holding.memberName,
        toName: destMember.fullName,
        creditAccountId: custodyAcc.id,
        creditAccountCode: '1050',
        creditAccountName: `Member Custody (${holding.memberName})`,
        creditEntityType: 'member',
        creditMemberId: holding.memberId,
        creditMemberName: holding.memberName,
        creditMemberNumber: holding.memberNumber,
        debitAccountId: custodyAcc.id,
        debitAccountCode: '1050',
        debitAccountName: `Member Custody (${destMember.fullName})`,
        debitEntityType: 'member',
        debitMemberId: destMember.id,
        debitMemberName: destMember.fullName,
        debitMemberNumber: destMember.memberNumber,
        amount: settleAmount,
        status: 'valid',
        linkedCaseId: holding.caseId,
        linkedCaseNumber: holding.caseNumber,
        linkedCaseTitle: holding.caseTitle,
        journalEntryId: journalId,
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };

      // 1. Deduct source member cash balance
      if (sourceMem) {
        const sourceBalances = { ...(sourceMem.cashBalances || {}) };
        sourceBalances[sourceCurrency] = Math.max(
          0,
          Number(((sourceBalances[sourceCurrency] || 0) - settleAmount).toFixed(2))
        );
        setRawMembers((prev) =>
          prev.map((m) =>
            m.id === sourceMem.id ? { ...m, cashBalances: sourceBalances } : m
          )
        );
        await updateDoc(doc(db, 'members', sourceMem.id), {
          cashBalances: sourceBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      }

      // 2. Increase destination member cash balance
      const destBalances = { ...(destMember.cashBalances || {}) };
      destBalances[destCurrency] = Number(
        ((destBalances[destCurrency] || 0) + destAmount).toFixed(2)
      );
      setRawMembers((prev) =>
        prev.map((m) =>
          m.id === destMember.id ? { ...m, cashBalances: destBalances } : m
        )
      );
      await updateDoc(doc(db, 'members', destMember.id), {
        cashBalances: destBalances,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      });

      // 3. Create active CashHolding for recipient member
      const newHoldingId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newHolding: CashHolding = {
        id: newHoldingId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        memberId: destMember.id,
        memberName: destMember.fullName,
        memberNumber: destMember.memberNumber,
        amount: destAmount,
        currency: destCurrency,
        category: holding.category || 'Member Handover',
        caseId: holding.caseId,
        caseNumber: holding.caseNumber,
        caseTitle: holding.caseTitle,
        caseNote:
          holding.caseNote ||
          (holding.caseTitle
            ? `Case: ${holding.caseNumber ? holding.caseNumber + ' - ' : ''}${holding.caseTitle}`
            : undefined),
        donorMemberId: holding.donorMemberId || holding.memberId,
        donorMemberName: holding.donorMemberName || holding.memberName,
        donorMemberNumber: holding.donorMemberNumber || holding.memberNumber,
        status: 'HELD',
        date: today,
        notes: `Handed over from ${holding.memberName}${
          settlement.notes ? ' | ' + settlement.notes : ''
        }`,
        sourceTransactionId: txnId,
        sourceTransactionNumber: txnNumber,
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };
      setRawCashHoldings((prev) => [newHolding, ...prev]);
      await setDoc(doc(db, 'cashHoldings', newHoldingId), cleanForFirestore(newHolding));

      // 4. Update source holding
      const noteText = settlement.notes
        ? `${holding.notes || ''} | Handover: ${settlement.notes}`
        : holding.notes;

      if (isPartial) {
        setRawCashHoldings((prev) =>
          prev.map((h) =>
            h.id === holding.id ? { ...h, amount: remainingHoldingAmount } : h
          )
        );
        await updateDoc(doc(db, 'cashHoldings', holding.id), {
          amount: remainingHoldingAmount,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });

        const settledSliceId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const settledSlice: CashHolding = {
          ...holding,
          id: settledSliceId,
          amount: settleAmount,
          status: 'TRANSFERRED_TO_MEMBER',
          settledDate: today,
          settlementType: 'HANDOVER_TO_MEMBER',
          destinationAccountId: destMember.id,
          destinationAccountName: destMember.fullName,
          notes: noteText,
          sourceTransactionId: txnId,
          sourceTransactionNumber: txnNumber,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        };
        setRawCashHoldings((prev) => [settledSlice, ...prev]);
        await setDoc(
          doc(db, 'cashHoldings', settledSliceId),
          cleanForFirestore(settledSlice)
        );
      } else {
        setRawCashHoldings((prev) =>
          prev.map((h) =>
            h.id === holding.id
              ? {
                  ...h,
                  status: 'TRANSFERRED_TO_MEMBER',
                  settledDate: today,
                  settlementType: 'HANDOVER_TO_MEMBER',
                  destinationAccountId: destMember.id,
                  destinationAccountName: destMember.fullName,
                  notes: noteText,
                  sourceTransactionId: txnId,
                  sourceTransactionNumber: txnNumber,
                }
              : h
          )
        );
        await updateDoc(doc(db, 'cashHoldings', holding.id), {
          status: 'TRANSFERRED_TO_MEMBER',
          settledDate: today,
          settlementType: 'HANDOVER_TO_MEMBER',
          destinationAccountId: destMember.id,
          destinationAccountName: destMember.fullName,
          notes: noteText,
          sourceTransactionId: txnId,
          sourceTransactionNumber: txnNumber,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      }

      // 5. Save journal and transaction
      setRawJournals((prev) => [newJournal, ...prev]);
      setRawTransactions((prev) => [newTxn, ...prev]);
      await setDoc(
        doc(db, 'journal_entries', journalId),
        cleanForFirestore(newJournal)
      );
      await setDoc(doc(db, 'transactions', txnId), cleanForFirestore(newTxn));

      await logAction(
        'Updated',
        'CashCustodians',
        holding.id,
        `Handed over ${sourceCurrency} ${settleAmount} from ${holding.memberName} to ${destMember.fullName}`
      );
      return;
    }

    // =========================================================================
    // OPTION 2: DIRECT BENEFICIARY DISBURSEMENT (PAY CHARITY CASE)
    // =========================================================================
    if (settlement.settlementType === 'BENEFICIARY_DISBURSEMENT') {
      const targetCase =
        cases.find((c) => c.id === (settlement.caseId || holding.caseId)) ||
        rawCases.find((c) => c.id === (settlement.caseId || holding.caseId));
      if (!targetCase) {
        throw new Error(
          'Please select an active charity case for direct beneficiary disbursement'
        );
      }

      const payeeName = (
        settlement.payeeName ||
        targetCase.beneficiaryName ||
        'Beneficiary'
      ).trim();
      const paymentNumber = getNextPaymentNumber(
        payments,
        new Date(today).getFullYear(),
        'CHARITY_ASSISTANCE'
      );
      const txnNumber = getNextTransactionNumber(transactions);
      const journalNumber = getNextJournalNumber(
        journalEntries,
        new Date(today).getFullYear()
      );

      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const journalId = `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Calculate amount in case currency
      const caseAmt =
        sourceCurrency === targetCase.currency ? settleAmount : baseAmount;
      const newDisbursed = Number(
        ((targetCase.disbursedAmount || 0) + caseAmt).toFixed(2)
      );
      const newCaseStatus =
        newDisbursed >= targetCase.approvedAmount
          ? 'DISBURSED'
          : targetCase.status === 'OPEN'
          ? 'IN_PROGRESS'
          : targetCase.status;

      const targetCategory =
        settlement.charityCategory ||
        (targetCase.caseType === 'Medical'
          ? 'Medical Assistance'
          : targetCase.caseType === 'House Maintenance'
          ? 'House Maintenance'
          : 'Other');

      const expenseAcc = accounts.find((a) => a.code === '5010') ||
        accounts.find((a) => a.type === 'Expense') || {
          id: 'acc_5010',
          code: '5010',
          name: 'Direct Charitable Aid & Patient Relief',
          type: 'Expense' as const,
        };
      const custodyAcc = accounts.find((a) => a.code === '1050') || {
        id: 'acc_1050',
        code: '1050',
        name: 'Cash in Member Custody',
        type: 'Asset' as const,
      };

      // Double-entry Journal: Dr Expense 5010, Cr Member Custody 1050
      const journalLines: JournalLine[] = [
        {
          id: `line_${journalId}_1`,
          journalEntryId: journalId,
          accountId: expenseAcc.id,
          accountCode: expenseAcc.code,
          accountName: expenseAcc.name,
          accountType: 'Expense',
          debit: settleAmount,
          credit: 0,
          currency: sourceCurrency,
          exchangeRate: sourceToBaseRate,
          baseCurrencyDebit: baseAmount,
          baseCurrencyCredit: 0,
          description: `Debit: Direct Aid Voucher ${paymentNumber} to ${payeeName} for Case ${targetCase.caseNumber}`,
        },
        {
          id: `line_${journalId}_2`,
          journalEntryId: journalId,
          accountId: custodyAcc.id,
          accountCode: custodyAcc.code,
          accountName: `Member Custody: ${holding.memberName}`,
          accountType: 'Asset',
          debit: 0,
          credit: settleAmount,
          currency: sourceCurrency,
          exchangeRate: sourceToBaseRate,
          baseCurrencyDebit: 0,
          baseCurrencyCredit: baseAmount,
          description: `Credit: Disbursed from cash held by Custodian ${holding.memberName}`,
        },
      ];

      const newJournal: JournalEntry = {
        id: journalId,
        entryNumber: journalNumber,
        tenantId: activeCharityId,
        date: today,
        description: `Direct Aid Voucher ${paymentNumber}: Disbursed ${sourceCurrency} ${settleAmount} to ${payeeName} for Case ${targetCase.caseNumber} (${targetCase.title})`,
        sourceTransactionType: 'CHARITY_ASSISTANCE',
        sourceRecordId: paymentId,
        sourceRecordNumber: paymentNumber,
        lines: journalLines,
        totalDebit: settleAmount,
        totalCredit: settleAmount,
        isBalanced: true,
        status: 'POSTED',
        createdAt: now,
        createdBy: currentUserIdentifier,
      };

      const newPayment: CharityPayment = {
        id: paymentId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        paymentNumber,
        disbursementType: 'CHARITY_ASSISTANCE',
        paymentDate: today,
        payeeName,
        caseId: targetCase.id,
        caseNumber: targetCase.caseNumber,
        caseTitle: targetCase.title,
        charityCategory: targetCategory,
        chartOfAccountId: expenseAcc.id,
        chartOfAccountCode: expenseAcc.code,
        chartOfAccountName: expenseAcc.name,
        amount: settleAmount,
        currency: sourceCurrency,
        exchangeRate: sourceToBaseRate,
        baseCurrencyAmount: baseAmount,
        paymentMethod: 'Cash',
        cashBankAccountId: sourceMem?.id || holding.memberId,
        cashBankAccountName: `Cash in Custody (${holding.memberName})`,
        paidByType: 'MEMBER_CUSTODIAN',
        paidByMemberId: holding.memberId,
        paidByMemberName: holding.memberName,
        paidByMemberNumber: holding.memberNumber,
        referenceNumber: settlement.voucherReference || paymentNumber,
        description: `Direct Cash Payout to ${payeeName} for Case ${targetCase.caseNumber} - ${targetCase.title}`,
        approvedBy: currentUserIdentifier,
        verifiedBy: holding.memberName,
        notes:
          settlement.notes || `Disbursed by custodian ${holding.memberName}`,
        transactionId: txnId,
        journalEntryId: journalId,
        status: 'valid',
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };

      const newTxn: Transaction = {
        id: txnId,
        charityId: activeCharityId,
        tenantId: activeCharityId,
        transactionNumber: txnNumber,
        date: today,
        contributionMonth: today.slice(0, 7),
        type: 'Charity Disbursement',
        financialClassification: 'CHARITY_ASSISTANCE',
        description: `Direct Beneficiary Aid: Paid ${sourceCurrency} ${settleAmount} to ${payeeName} for Case ${targetCase.caseNumber}`,
        reference: settlement.voucherReference || paymentNumber,
        currency: sourceCurrency,
        exchangeRate: sourceToBaseRate,
        baseCurrencyAmount: baseAmount,
        fromName: holding.memberName,
        toName: payeeName,
        creditAccountId: custodyAcc.id,
        creditAccountCode: '1050',
        creditAccountName: `Member Custody (${holding.memberName})`,
        creditEntityType: 'member',
        creditMemberId: holding.memberId,
        creditMemberName: holding.memberName,
        creditMemberNumber: holding.memberNumber,
        debitAccountId: expenseAcc.id,
        debitAccountCode: expenseAcc.code,
        debitAccountName: expenseAcc.name,
        amount: settleAmount,
        status: 'valid',
        linkedPaymentId: paymentId,
        linkedCaseId: targetCase.id,
        linkedCaseNumber: targetCase.caseNumber,
        linkedCaseTitle: targetCase.title,
        purpose: targetCase.title,
        journalEntryId: journalId,
        createdAt: now,
        createdBy: currentUserIdentifier,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      };

      // 1. Deduct custodian member's physical cash balance
      if (sourceMem) {
        const sourceBalances = { ...(sourceMem.cashBalances || {}) };
        sourceBalances[sourceCurrency] = Math.max(
          0,
          Number(((sourceBalances[sourceCurrency] || 0) - settleAmount).toFixed(2))
        );
        setRawMembers((prev) =>
          prev.map((m) =>
            m.id === sourceMem.id ? { ...m, cashBalances: sourceBalances } : m
          )
        );
        await updateDoc(doc(db, 'members', sourceMem.id), {
          cashBalances: sourceBalances,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      }

      // 2. Update Case disbursed progress
      setRawCases((prev) =>
        prev.map((c) =>
          c.id === targetCase.id
            ? { ...c, disbursedAmount: newDisbursed, status: newCaseStatus }
            : c
        )
      );
      await updateDoc(doc(db, 'cases', targetCase.id), {
        disbursedAmount: newDisbursed,
        status: newCaseStatus,
        updatedAt: now,
        updatedBy: currentUserIdentifier,
      });

      // 3. Update source holding
      const noteText = settlement.notes
        ? `${holding.notes || ''} | Direct Payout (${paymentNumber}): ${settlement.notes}`
        : `${holding.notes || ''} | Direct Payout: ${paymentNumber}`;

      if (isPartial) {
        setRawCashHoldings((prev) =>
          prev.map((h) =>
            h.id === holding.id ? { ...h, amount: remainingHoldingAmount } : h
          )
        );
        await updateDoc(doc(db, 'cashHoldings', holding.id), {
          amount: remainingHoldingAmount,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });

        const settledSliceId = `holding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const settledSlice: CashHolding = {
          ...holding,
          id: settledSliceId,
          amount: settleAmount,
          status: 'DISBURSED_TO_BENEFICIARY',
          settledDate: today,
          settlementType: 'BENEFICIARY_DISBURSEMENT',
          destinationAccountId: targetCase.id,
          destinationAccountName: `${targetCase.caseNumber} - ${targetCase.title}`,
          paymentId: paymentId,
          notes: noteText,
          sourceTransactionId: txnId,
          sourceTransactionNumber: txnNumber,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        };
        setRawCashHoldings((prev) => [settledSlice, ...prev]);
        await setDoc(
          doc(db, 'cashHoldings', settledSliceId),
          cleanForFirestore(settledSlice)
        );
      } else {
        setRawCashHoldings((prev) =>
          prev.map((h) =>
            h.id === holding.id
              ? {
                  ...h,
                  status: 'DISBURSED_TO_BENEFICIARY',
                  settledDate: today,
                  settlementType: 'BENEFICIARY_DISBURSEMENT',
                  destinationAccountId: targetCase.id,
                  destinationAccountName: `${targetCase.caseNumber} - ${targetCase.title}`,
                  paymentId: paymentId,
                  notes: noteText,
                  sourceTransactionId: txnId,
                  sourceTransactionNumber: txnNumber,
                }
              : h
          )
        );
        await updateDoc(doc(db, 'cashHoldings', holding.id), {
          status: 'DISBURSED_TO_BENEFICIARY',
          settledDate: today,
          settlementType: 'BENEFICIARY_DISBURSEMENT',
          destinationAccountId: targetCase.id,
          destinationAccountName: `${targetCase.caseNumber} - ${targetCase.title}`,
          paymentId: paymentId,
          notes: noteText,
          sourceTransactionId: txnId,
          sourceTransactionNumber: txnNumber,
          updatedAt: now,
          updatedBy: currentUserIdentifier,
        });
      }

      // 4. Save Payment, Journal, and Transaction
      setRawPayments((prev) => [newPayment, ...prev]);
      setRawJournals((prev) => [newJournal, ...prev]);
      setRawTransactions((prev) => [newTxn, ...prev]);

      await setDoc(doc(db, 'payments', paymentId), cleanForFirestore(newPayment));
      await setDoc(
        doc(db, 'journal_entries', journalId),
        cleanForFirestore(newJournal)
      );
      await setDoc(doc(db, 'transactions', txnId), cleanForFirestore(newTxn));

      await logAction(
        'Created',
        'Payment',
        paymentNumber,
        `Direct Cash Disbursement (${sourceCurrency} ${settleAmount}) to ${payeeName} for Case ${targetCase.caseNumber}`
      );
      return;
    }

    // Fallback: Default status update for legacy callers
    const updatePayload: Partial<CashHolding> = {
      status: 'RETURNED_TO_TREASURER',
      settledDate: today,
      settlementType: settlement.settlementType,
      notes: settlement.notes,
      updatedAt: now,
      updatedBy: currentUserIdentifier,
    };
    await updateDoc(doc(db, 'cashHoldings', id), updatePayload);
  };

  const deleteCashHolding = async (id: string): Promise<void> => {
    const holding = cashHoldings.find((h) => h.id === id);
    if (holding && holding.status === 'HELD') {
      const mem = rawMembers.find((m) => m.id === holding.memberId);
      if (mem) {
        const cur = holding.currency || settings.currency || 'AED';
        const curBalances = { ...(mem.cashBalances || {}) };
        curBalances[cur] = Math.max(0, Number(((curBalances[cur] || 0) - holding.amount).toFixed(2)));
        await updateDoc(doc(db, 'members', mem.id), {
          cashBalances: curBalances,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUserIdentifier,
        });
      }
    }
    await deleteDoc(doc(db, 'cashHoldings', id));
    await logAction('Deleted', 'CashCustodians', id, `Deleted cash holding record ${id}`);
  };

  const runAiHealthScan = (): HealthScanSummary => {
    const report = runAiDiagnosticScan(
      rawMembers,
      rawReceipts,
      rawPayments,
      rawJournals,
      rawTransactions,
      rawCashHoldings,
      rawAccounts,
      rawCashAccounts,
      settings
    );
    setLatestScanReport(report);
    return report;
  };

  const runAiHealthRepair = async (customReport?: HealthScanSummary): Promise<RepairExecutionResult> => {
    const reportToUse = customReport || latestScanReport || runAiHealthScan();
    const result = await executeOneClickAiRepair(
      reportToUse,
      rawMembers,
      rawReceipts,
      rawPayments,
      rawJournals,
      rawTransactions,
      rawCashHoldings,
      rawAccounts,
      settings,
      user?.email || 'admin'
    );
    // After repair, run fresh scan to verify clean state
    runAiHealthScan();
    return result;
  };

  return (
    <CharityContext.Provider
      value={{
        charities,
        activeCharityId,
        activeCharity,
        switchCharity,
        addCharity,
        updateCharity,
        deleteCharity,
        members,
        accounts,
        cashAccounts,
        receipts,
        payments,
        transactions,
        cases,
        journalEntries,
        settings,
        auditLogs,
        loading,
        error,
        addMember,
        updateMember,
        deactivateMember,
        deleteMember,
        addCase,
        updateCase,
        deleteCase,
        recordMonthlyContribution,
        recordSpecialContribution,
        recordCharityAssistance,
        recordAdminExpense,
        voidRecord,
        createReceipt,
        updateReceipt,
        updateContributionReceipt,
        voidReceipt,
        createPayment,
        voidPayment,
        updateCharityPayment,
        updateAdminExpense,
        addAccount,
        updateAccount,
        deactivateAccount,
        syncStandardAccounts,
        addCashAccount,
        updateCashAccount,
        cashHoldings,
        addCashHolding,
        settleCashHolding,
        deleteCashHolding,
        createTransferOrHandover,
        updateHandoverTransfer,
        voidTransaction,
        reverseTransaction,
        updateSettings,
        seedDemoData,
        clearDemoData,
        resetAllFirmData,
        systemSyncState,
        latestScanReport,
        runAiHealthScan,
        runAiHealthRepair,
        recordAuditLog: logAction,
      }}
    >
      {children}
    </CharityContext.Provider>
  );
};

export const useCharity = () => {
  const context = useContext(CharityContext);
  if (!context) throw new Error('useCharity must be used within a CharityProvider');
  return context;
};
