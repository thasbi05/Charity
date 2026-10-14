export type UserRole =
  | 'SUPER_ADMIN'
  | 'CHARITY_ADMIN'
  | 'STAFF'
  | 'AUDITOR'
  | 'administrator'
  | 'staff'
  | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  tenantId?: string;
  mustChangePassword?: boolean;
  requirePasswordChangeNextLogin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MemberStatus = 'active' | 'inactive';

// Strictly Separated Addresses per Architectural Specification
export interface LocalAddress {
  buildingVilla?: string;
  flatRoom?: string;
  street?: string;
  area?: string;
  city?: string;
  emirateState?: string;
  country?: string;
  poBox?: string;
  localPhone?: string;
  // Compatibility aliases
  building?: string;
  flat?: string;
  stateOrEmirate?: string;
  postalCodeOrPoBox?: string;
  phone?: string;
}

export interface HomeCountryAddress {
  houseBuilding?: string;
  street?: string;
  villageArea?: string;
  city?: string;
  district?: string;
  taluk?: string;
  stateProvince?: string;
  country?: string;
  postalCode?: string;
  pincode?: string;
  homePhone?: string;
  // Compatibility aliases
  house?: string;
  village?: string;
  building?: string;
  flat?: string;
  area?: string;
  stateOrEmirate?: string;
  postalCodeOrPoBox?: string;
  phone?: string;
}

// Alias for generic address details
export type AddressDetails = LocalAddress;

export interface Member {
  id: string;
  charityId?: string;
  tenantId?: string;
  memberNumber: string; // e.g. MEM-0001
  fullName: string;
  fatherName?: string; // Distinct first-class personal detail field
  fatherHusbandName: string; // Legacy / composite field
  mobileNumber: string;
  email: string;
  address: string; // Summary string representation
  localAddress?: LocalAddress; // STRICT SEPARATION: Local Residence (e.g. UAE)
  homeCountryAddress?: HomeCountryAddress; // STRICT SEPARATION: Home Country Address (e.g. India)
  homeAddress?: {
    country: string;
    state: string;
    district: string;
    taluk: string;
    village: string;
    house: string;
    street: string;
    pincode: string;
  };
  joinDate: string; // YYYY-MM-DD
  monthlyContributionAmount: number;
  status: MemberStatus;
  bloodGroup?: string; // Blood Group (e.g. O+, A+, B+, etc.)
  notes?: string;
  photoUrl?: string;
  totalContributed: number; // Aggregate total
  totalMonthlyContributed?: number; // STRICT SEPARATION: regular dues
  totalSpecialContributed?: number; // STRICT SEPARATION: designated cases
  receiptsCount: number;
  activeCasesCount?: number;
  cashBalances?: Record<string, number>; // e.g. { AED: 500, INR: 10000 }
  contributionsByCurrency?: Record<string, number>; // e.g. { AED: 1200, INR: 25000 }
  reimbursementsDue?: number; // Total reimbursement due to member for personal advances
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// 4 IMMUTABLE FINANCIAL SEPARATION TYPES (The Core Invariant)
export type FinancialTransactionClassification =
  | 'MONTHLY_CONTRIBUTION'
  | 'SPECIAL_CONTRIBUTION'
  | 'CHARITY_ASSISTANCE'
  | 'ADMINISTRATIVE_EXPENSE';

export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'FULLY_FUNDED' | 'DISBURSED' | 'CLOSED';

export type CaseType =
  | 'Medical'
  | 'House Maintenance'
  | 'Wedding'
  | 'Masjid Work'
  | 'Education'
  | 'Food Aid'
  | 'Emergency'
  | 'Funeral'
  | 'Other';

export interface CharityCase {
  id: string;
  tenantId?: string;
  charityId?: string;
  caseNumber: string; // e.g. CASE-2026-00001 or MED-2026-00001
  title: string;
  caseType: CaseType;
  beneficiaryName: string;
  beneficiaryPhone?: string;
  beneficiaryAddress?: string;
  beneficiaryNationalId?: string;
  beneficiaryIdentificationNumber?: string;
  hospitalOrVendor?: string;
  requestedAmount?: number;
  approvedAmount: number;
  targetAmount?: number;
  currency: string;
  exchangeRate?: number;
  baseApprovedAmount?: number;
  collectedAmount: number; // Sum of SPECIAL_CONTRIBUTION
  disbursedAmount: number; // Sum of CHARITY_ASSISTANCE
  remainingBalance?: number; // approvedAmount - disbursedAmount or collectedAmount - disbursedAmount
  status: CaseStatus;
  description: string;
  notes?: string;
  startDate?: string;
  targetDate?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Fund/Equity';

export interface Account {
  id: string;
  charityId?: string;
  tenantId?: string;
  code: string; // e.g. 1000, 4010, 5010
  name: string;
  type: AccountType;
  parentCode?: string;
  description: string;
  balance: number;
  isActive: boolean;
  isSystem?: boolean; // system default accounts cannot be hard-deleted
  isGroup?: boolean; // Summary / Header Group Account
  isSubLedger?: boolean; // Member Custody sub-ledger control account
  appModule?: string; // e.g. "Members Dues", "Cases - Medical", "Cash & Bank", "Treasury Safe"
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CashAccount {
  id: string;
  charityId?: string;
  tenantId?: string;
  name: string; // e.g. "Main Cash in Hand", "Emirates NBD Bank"
  accountNumber?: string;
  bankName?: string;
  accountCode: string; // references chart of accounts code e.g. 1000 or 1010
  type: 'Cash' | 'Bank' | 'Other';
  openingBalance: number;
  currentBalance: number;
  currency?: string;
  status: 'active' | 'inactive';
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface ExchangeRateSnapshot {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  asOfDate: string; // YYYY-MM-DD
}

export type ReceiptStatus =
  | 'valid'
  | 'received'
  | 'pledged'
  | 'draft'
  | 'voided'
  | 'cancelled';

export interface Receipt {
  id: string;
  charityId?: string;
  tenantId?: string;
  receiptNumber: string; // e.g. RCPT-2026-00001
  receiptDate: string; // YYYY-MM-DD
  memberId: string;
  memberNumber: string;
  memberName: string;
  contributionType: 'MONTHLY_CONTRIBUTION' | 'SPECIAL_CONTRIBUTION';
  contributionMonth?: string; // Mandatory explicit Contribution Month e.g. '2026-09'
  contributionMonths?: string[]; // Array of selected contribution months e.g. ['2026-09', '2026-10', '2026-11']
  monthsCount?: number; // Number of contribution months covered
  periodMonth?: string; // e.g. '2026-03' (for MONTHLY_CONTRIBUTION)
  purpose?: string;
  caseId?: string; // Linked case (for SPECIAL_CONTRIBUTION)
  caseNumber?: string;
  caseTitle?: string;
  contributionAccountId: string;
  contributionAccountCode: string;
  contributionAccountName: string;
  amount: number;
  currency?: string; // 'AED' | 'INR' | string
  exchangeRate?: number; // rate relative to base currency
  exchangeRateSnapshot?: ExchangeRateSnapshot; // Permanent locked snapshot on creation
  baseAmount?: number; // Fixed base currency equivalent
  baseCurrency?: string; // Target base currency (e.g. 'AED')
  baseCurrencyAmount?: number; // amount in base currency (synonymous with baseAmount)
  paymentMethod: PaymentMethod;
  cashBankAccountId: string;
  cashBankAccountName: string;
  custodianMemberId?: string;
  custodianMemberName?: string;
  referenceNumber?: string;
  notes?: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string; // Base64 data URL / Storage download URL
  supportingDocumentType?: string; // MIME type e.g. image/jpeg, application/pdf
  supportingDocumentSize?: number; // bytes
  transactionId?: string;
  journalEntryId?: string;
  status: ReceiptStatus;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type CharityCategory =
  | 'Medical Assistance'
  | 'House Maintenance'
  | 'Wedding Assistance'
  | 'Masjid Work'
  | 'Education'
  | 'Food Assistance'
  | 'Emergency Assistance'
  | 'Funeral Assistance'
  | 'Other';

export type DisbursementType = 'CHARITY_ASSISTANCE' | 'ADMINISTRATIVE_EXPENSE';

export interface SplitMemberShare {
  memberId: string;
  memberName: string;
  memberNumber?: string;
  shareAmount: number;
  isPayer: boolean; // True if this member paid the upfront cost
  status: 'SETTLED' | 'PENDING';
  settledAt?: string;
  settledPaymentMethod?: PaymentMethod;
  settledTransactionId?: string;
  notes?: string;
}

export interface SplitExpenseConfig {
  isSplitEvent: boolean;
  eventName?: string;
  totalParticipants: number;
  sharePerMember: number;
  settledCount: number;
  pendingCount: number;
  totalSettledAmount: number;
  totalPendingAmount: number;
  payerMemberId: string;
  payerMemberName: string;
  participants: SplitMemberShare[];
}

export interface CharityPayment {
  id: string;
  charityId?: string;
  tenantId?: string;
  paymentNumber: string; // e.g. PAY-2026-00001 or EXP-2026-00001
  disbursementType?: DisbursementType;
  paymentDate: string; // YYYY-MM-DD
  payeeName: string;
  mobileNumber?: string;
  address?: string;
  caseId?: string; // Linked CharityCase if CHARITY_ASSISTANCE
  caseNumber?: string;
  caseTitle?: string;
  charityCategory?: CharityCategory;
  adminExpenseCategory?: string; // Rent, Printing, IT, Utilities, Bank Fees
  invoiceNumber?: string;
  chartOfAccountId: string;
  chartOfAccountCode: string;
  chartOfAccountName: string;
  amount: number;
  currency?: string; // 'AED' | 'INR' | string
  exchangeRate?: number; // rate relative to base currency
  exchangeRateSnapshot?: ExchangeRateSnapshot; // Permanent locked snapshot on creation
  baseAmount?: number; // Fixed base currency equivalent
  baseCurrency?: string; // Target base currency (e.g. 'AED')
  baseCurrencyAmount?: number; // amount in base currency
  paymentMethod: PaymentMethod;
  cashBankAccountId: string;
  cashBankAccountName: string;
  paidByType?: 'CHARITY_ACCOUNT' | 'MEMBER_CUSTODIAN' | 'MEMBER_ADVANCE';
  paidByMemberId?: string;
  paidByMemberName?: string;
  paidByMemberNumber?: string;
  reimbursementStatus?: 'PENDING' | 'SETTLED' | 'NOT_APPLICABLE';
  reimbursedAt?: string;
  reimbursedTransactionId?: string;
  referenceNumber?: string;
  description: string;
  supportingDocumentName?: string;
  supportingDocumentUrl?: string;
  supportingDocumentData?: string; // Base64 data URL / Storage download URL
  supportingDocumentType?: string; // MIME type e.g. image/jpeg, application/pdf
  supportingDocumentSize?: number; // bytes
  approvedBy: string;
  preparedBy?: string;
  verifiedBy?: string;
  notes?: string;
  transactionId?: string;
  journalEntryId?: string;
  isSplitEvent?: boolean;
  splitExpense?: SplitExpenseConfig;
  status: 'valid' | 'voided';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type TransactionType =
  | 'Member Contribution'
  | 'Cash Transfer'
  | 'Charity Disbursement'
  | 'Bank Deposit'
  | 'Cash Return'
  | 'Contribution'
  | 'Donation'
  | 'Charity Payment'
  | 'Transfer'
  | 'Member Handover'
  | 'Contribution Handover'
  | 'Adjustment'
  | 'Reversal';

export interface JournalLine {
  id: string;
  journalEntryId?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate?: number;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  baseAmount?: number;
  baseCurrencyDebit: number;
  baseCurrencyCredit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // e.g. JRNL-2026-00001
  tenantId?: string;
  charityId?: string;
  date: string;
  description: string;
  sourceTransactionType:
    | 'MONTHLY_CONTRIBUTION'
    | 'SPECIAL_CONTRIBUTION'
    | 'CHARITY_ASSISTANCE'
    | 'ADMINISTRATIVE_EXPENSE'
    | 'TRANSFER'
    | 'INTERNAL_TRANSFER'
    | 'MEMBER_HANDOVER'
    | 'RECEIPT'
    | 'REVERSAL';
  sourceRecordId?: string;
  sourceRecordNumber?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'POSTED' | 'VOIDED';
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  createdBy: string;
}

export interface Transaction {
  id: string;
  charityId?: string;
  tenantId?: string;
  transactionNumber: string; // e.g. TXN-2026-00001
  date: string; // YYYY-MM-DD
  contributionMonth?: string; // e.g. YYYY-MM (e.g. 2026-09)
  contributionMonths?: string[]; // e.g. ['2026-09', '2026-10', '2026-11']
  monthsCount?: number;
  type: TransactionType;
  financialClassification?: FinancialTransactionClassification;
  description: string;
  reference?: string;
  purpose?: string;
  notes?: string;
  paymentMethod?: string;
  memberId?: string;
  memberName?: string;
  memberNumber?: string;
  custodianId?: string;
  custodianName?: string;
  fromName?: string;
  toName?: string;
  currency?: string; // 'AED' | 'INR' | string
  exchangeRate?: number; // rate to base currency
  exchangeRateSnapshot?: ExchangeRateSnapshot; // Permanent locked snapshot on creation
  baseAmount?: number; // Fixed base currency equivalent
  baseCurrency?: string; // Target base currency (e.g. 'AED')
  baseCurrencyAmount?: number; // equivalent in base currency
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  debitEntityType?: 'account' | 'member';
  debitEntityName?: string;
  debitMemberId?: string;
  debitMemberNumber?: string;
  debitMemberName?: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  creditEntityType?: 'account' | 'member';
  creditEntityName?: string;
  creditMemberId?: string;
  creditMemberNumber?: string;
  creditMemberName?: string;
  amount: number;
  status: 'valid' | 'voided' | 'reversal';
  linkedReceiptId?: string;
  linkedPaymentId?: string;
  linkedCaseId?: string;
  linkedCaseNumber?: string;
  linkedCaseTitle?: string;
  handoverFundType?: 'MONTHLY_CONTRIBUTION' | 'CHARITY_CASE' | 'GENERAL_CHARITY' | 'OTHER';
  isContributionHandover?: boolean;
  journalEntryId?: string;
  reversalOfTxnId?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface DocumentAttachment {
  id: string;
  tenantId?: string;
  entityType: 'Member' | 'Receipt' | 'Payment' | 'CharityCase' | 'JournalEntry';
  entityId: string;
  fileName: string;
  fileType: string; // MIME type
  fileSize: number; // bytes
  fileData?: string; // Base64 data URL or Storage URL
  fileUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  description?: string;
}

export interface TemplateSettings {
  headerTitle: string;
  headerSubtitle: string;
  footerDisclaimer: string;
  termsAndConditions: string;
  thankYouMessage?: string;
  recipientAcknowledgmentText?: string;
  preparedByTitle?: string;
  custodianTitle?: string;
  authorizedSignatoryTitle?: string;
  recipientSignatureTitle?: string;
  showQrCode: boolean;
  showCaseAllocation: boolean;
  showCustodianSignature: boolean;
  showSignatureBlock?: boolean;
  showRecipientAcknowledgement?: boolean;
  showStampArea: boolean;
  showWatermark?: boolean;
  watermarkOpacity?: number;
}

export interface OrganizationSettings {
  id?: string;
  charityName: string;
  tagline?: string;
  country?: string; // e.g. "United Arab Emirates"
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  address: string;
  city?: string;
  stateEmirate?: string;
  phone: string;
  email: string;
  emailFrom?: string; // Default Outbound Email Sender (e.g. "Udyavar Muslim Unity UAE <onboarding@resend.dev>")
  website?: string;
  socialLink?: string;
  registrationNumber?: string;
  currency: string; // default "AED"
  defaultCurrency?: string; // 'AED' or 'INR'
  exchangeRateInrToAed?: number; // e.g. 0.04401 (1 INR = 0.04401 AED)
  exchangeRateAedToInr?: number; // e.g. 22.72 (1 AED = 22.72 INR)
  defaultMonthlyPledge?: number; // default 20
  receiptPrefix: string; // default "RCPT-"
  paymentPrefix: string; // default "PAY-"
  expensePrefix?: string; // default "EXP-"
  casePrefix?: string; // default "CASE-"
  memberPrefix: string; // default "MEM-"
  transactionPrefix: string; // default "TXN-"
  financialYear: string; // default "2026"
  footerText: string;
  receiptTemplate?: TemplateSettings;
  voucherTemplate?: TemplateSettings;
  showWatermark?: boolean;
  watermarkOpacity?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CharityOrganization extends OrganizationSettings {
  id: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export type AuditAction =
  | 'Created'
  | 'Updated'
  | 'Deleted'
  | 'Voided'
  | 'Reversed'
  | 'Login'
  | 'Logout'
  | 'Settings Changed';

export interface AuditLog {
  id: string;
  tenantId?: string;
  user?: string;
  userId?: string;
  userEmail: string;
  action: AuditAction;
  module?: string;
  entityType?: string;
  entityId?: string;
  recordId?: string;
  recordNumber?: string;
  details: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  createdAt?: string;
}

export type CashHoldingStatus = 'HELD' | 'SETTLED' | 'DEPOSITED_TO_BANK' | 'DISBURSED_TO_BENEFICIARY' | 'TRANSFERRED_TO_MEMBER' | 'RETURNED_TO_TREASURER';

export type CashHoldingCategory =
  | 'Monthly Contribution'
  | 'Marriage Support'
  | 'Medical Emergency'
  | 'Charity Case'
  | 'General Charity Pool'
  | 'Education Aid'
  | 'Food & Grocery Aid'
  | 'Other';

export interface CashHolding {
  id: string;
  charityId?: string;
  tenantId?: string;
  memberId: string;
  memberName: string;
  memberNumber?: string;
  amount: number; // in AED or current currency
  currency?: string;
  category: CashHoldingCategory | string;
  caseId?: string;
  caseNumber?: string;
  caseTitle?: string;
  caseNote?: string;
  donorMemberId?: string;
  donorMemberName?: string;
  donorMemberNumber?: string;
  sourceTransactionId?: string;
  sourceTransactionNumber?: string;
  status: CashHoldingStatus;
  date: string; // YYYY-MM-DD
  notes?: string;
  settledDate?: string;
  settlementType?: 'BANK_DEPOSIT' | 'BENEFICIARY_DISBURSEMENT' | 'OFFICE_HANDOVER';
  destinationAccountId?: string;
  destinationAccountName?: string;
  receiptId?: string;
  receiptNumber?: string;
  paymentId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type NavTab =
  | 'dashboard'
  | 'members'
  | 'custodians'
  | 'cases'
  | 'receipts'
  | 'payments'
  | 'monthly-status'
  | 'journal'
  | 'chart-of-accounts'
  | 'cash-bank'
  | 'transactions'
  | 'reports'
  | 'users'
  | 'audit-logs'
  | 'settings';

