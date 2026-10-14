import React, { useState } from 'react';
import {
  Keyboard,
  X,
  Search,
  PlusCircle,
  HeartHandshake,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Receipt,
  FileText,
  Landmark,
  BookOpen,
  PieChart,
  Scale,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  ShieldCheck,
  FolderTree,
  Table,
  Cpu,
  ArrowRight,
  Database,
  RefreshCw,
  Coins,
  Check,
  Building,
  Layers,
} from 'lucide-react';

interface HelpDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'shortcuts' | 'double-entry' | 'dictionary' | 'catalog' | 'engine';
}

export const HelpDocumentationModal: React.FC<HelpDocumentationModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'shortcuts',
}) => {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'double-entry' | 'dictionary' | 'catalog' | 'engine'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const metaKey = isMac ? '⌘' : 'Ctrl';

  const SHORTCUT_GROUPS = [
    {
      title: 'Administrator Quick Actions',
      shortcuts: [
        {
          keys: [`${metaKey}`, 'K'],
          description: 'Open Global Search (search members, receipts, vouchers)',
          icon: Search,
        },
        {
          keys: [`${metaKey}`, 'N'],
          description: 'Issue New Contribution Receipt',
          icon: PlusCircle,
        },
        {
          keys: ['Alt', 'P'],
          secondaryKeys: [`${metaKey}`, 'Shift', 'N'],
          description: 'Record Charity Relief Payment Voucher',
          icon: HeartHandshake,
        },
        {
          keys: ['?'],
          secondaryKeys: ['Shift', '/'],
          description: 'Open Help & Accounting Documentation Center',
          icon: HelpCircle,
        },
        {
          keys: [`${metaKey}`, '['],
          secondaryKeys: [`${metaKey}`, 'B'],
          description: 'Toggle Sidebar Navigation (Collapse / Expand)',
          icon: LayoutDashboard,
        },
        {
          keys: ['Esc'],
          description: 'Close any active dialog or modal window',
          icon: X,
        },
      ],
    },
    {
      title: 'Direct Module Navigation',
      shortcuts: [
        {
          keys: ['Alt', '1'],
          description: 'Dashboard (Analytics, Cash Liquidity, Overdue Alert)',
          icon: LayoutDashboard,
        },
        {
          keys: ['Alt', '2'],
          description: 'Members Directory & Status',
          icon: Users,
        },
        {
          keys: ['Alt', '3'],
          description: 'Monthly Contribution Grid (12-Month Matrix)',
          icon: CalendarCheck,
        },
        {
          keys: ['Alt', '4'],
          description: 'Receipts Register & Printing',
          icon: Receipt,
        },
        {
          keys: ['Alt', '5'],
          description: 'Charity Relief Payments Register',
          icon: FileText,
        },
        {
          keys: ['Alt', '6'],
          description: 'Chart of Accounts (GL structure)',
          icon: Landmark,
        },
        {
          keys: ['Alt', '7'],
          description: 'Cash & Bank Management',
          icon: Landmark,
        },
        {
          keys: ['Alt', '8'],
          description: 'General Journal & Audit Ledger',
          icon: BookOpen,
        },
        {
          keys: ['Alt', '9'],
          description: 'Financial Statements (Trial Balance, Balance Sheet)',
          icon: PieChart,
        },
      ],
    },
  ];

  const DOUBLE_ENTRY_RULES = [
    {
      id: 'rule-member-dues',
      title: '1. Member Monthly Contribution (Receipt)',
      scenario: 'A member pays their AED 50 monthly subscription in cash to a volunteer custodian or directly into the bank.',
      lines: [
        { type: 'DEBIT', accountCode: '1010', accountName: 'Cash in Custody - [Custodian Name] / Bank', effect: 'Increases Asset (Cash in Hand)' },
        { type: 'CREDIT', accountCode: '4010', accountName: 'Member Subscription Contributions', effect: 'Increases Revenue / Equity' },
      ],
      notes: 'Total Debits equal Total Credits. Automatically updates Member totalContributed and clears overdue month flags in the 12-Month Grid.',
    },
    {
      id: 'rule-special-case',
      title: '2. Restricted Charity Case Contribution',
      scenario: 'A donor contributes AED 1,000 earmarked specifically for Medical Emergency Relief (e.g. Case #2026-001).',
      lines: [
        { type: 'DEBIT', accountCode: '1010', accountName: 'Cash in Custody - [Custodian Name]', effect: 'Increases Asset (Restricted Float)' },
        { type: 'CREDIT', accountCode: '4030', accountName: 'Special Case Appeal Contributions', effect: 'Increases Restricted Case Revenue' },
      ],
      notes: 'Increments charity case collectedAmount and maps the transaction directly to the case ledger.',
    },
    {
      id: 'rule-peer-handover',
      title: '3. Peer-to-Peer Cash Custodian Handover',
      scenario: 'Custodian A transfers AED 500 collected cash to Custodian B or safe deposit box.',
      lines: [
        { type: 'DEBIT', accountCode: '1010', accountName: 'Cash in Custody - Custodian B (Recipient)', effect: 'Increases Recipient Asset Float' },
        { type: 'CREDIT', accountCode: '1010', accountName: 'Cash in Custody - Custodian A (Sender)', effect: 'Decreases Sender Asset Float' },
      ],
      notes: 'Net organization cash remains unchanged. Zeroes out Custodian A liability and transfers custody to Custodian B with full audit logging.',
    },
    {
      id: 'rule-charity-disbursement',
      title: '4. Charitable Assistance Relief Payment (Voucher)',
      scenario: 'Charity pays INR 25,000 / AED 1,100 to hospital/beneficiary for approved Medical Aid voucher.',
      lines: [
        { type: 'DEBIT', accountCode: '5010', accountName: 'Medical Assistance Expenses', effect: 'Increases Charitable Relief Expense' },
        { type: 'CREDIT', accountCode: '1010', accountName: 'Cash in Custody - Disbursing Custodian', effect: 'Decreases Custodian Cash Asset' },
      ],
      notes: 'Increments charity case disbursedAmount and deducts from custodian float.',
    },
    {
      id: 'rule-operating-expense',
      title: '5. Administrative & Operating Expense (Voucher)',
      scenario: 'Board purchases receipts stationery and accounting printouts (AED 120).',
      lines: [
        { type: 'DEBIT', accountCode: '6010', accountName: 'Printing & Stationery Expenses', effect: 'Increases Operating Expense' },
        { type: 'CREDIT', accountCode: '1020', accountName: 'Commercial Bank Checking Account', effect: 'Decreases Bank Asset' },
      ],
      notes: 'Reduces net surplus without affecting restricted case donation pools.',
    },
  ];

  const FIELD_DICTIONARY = [
    {
      module: 'Members',
      field: 'Full Name',
      code: 'fullName',
      type: 'Text',
      validation: 'Required, min 2 chars. Trimmed whitespace.',
      purpose: 'Official member identity for receipts, membership cards, and audit vouchers.',
    },
    {
      module: 'Members',
      field: 'Member Number',
      code: 'memberNumber',
      type: 'String',
      validation: 'Autogenerated (e.g. MEM-0001). Must be unique.',
      purpose: 'Primary organizational key linked to contribution ledgers.',
    },
    {
      module: 'Members',
      field: 'Monthly Due Amount',
      code: 'monthlyDue',
      type: 'Number (AED)',
      validation: 'Numeric >= 0. Default: AED 50.00.',
      purpose: 'Expected monthly contribution used to compute member dues and overdue indicators.',
    },
    {
      module: 'Members',
      field: 'Assigned Custodian',
      code: 'assignedCustodianId',
      type: 'Dropdown (Members)',
      validation: 'Optional. Must be an active member.',
      purpose: 'Assigns volunteer custodian responsible for collecting monthly dues from this member.',
    },
    {
      module: 'Receipts',
      field: 'Contribution Month(s)',
      code: 'contributionMonths',
      type: 'Array of YYYY-MM',
      validation: 'Required for monthly dues. Can select multiple consecutive or scattered months.',
      purpose: 'Determines which grid slots in the 12-month matrix are marked as PAID.',
    },
    {
      module: 'Receipts',
      field: 'Amount & Currency',
      code: 'amount, currency',
      type: 'Decimal + Currency Code',
      validation: 'Amount > 0. Supported currencies: AED, INR, USD, SAR.',
      purpose: 'Nominal amount collected. Real-time conversion calculates baseCurrencyAmount.',
    },
    {
      module: 'Receipts',
      field: 'Exchange Rate',
      code: 'exchangeRate',
      type: 'Decimal (5 digits)',
      validation: 'Must be > 0. Captured as of transaction date with immutable snapshot.',
      purpose: 'Standard valuation conversion without floating-point drift.',
    },
    {
      module: 'Receipts / Vouchers',
      field: 'Cash / Bank Account',
      code: 'cashBankAccountId',
      type: 'Dropdown',
      validation: 'Required. Either a physical Custodian or a Bank/Safe Account.',
      purpose: 'Determines the exact debit or credit asset leg in double-entry journal items.',
    },
    {
      module: 'Payments',
      field: 'Payee Name & Mobile',
      code: 'payeeName, mobileNumber',
      type: 'Text + Phone',
      validation: 'Payee Name is required. Phone required for SMS receipt / verification.',
      purpose: 'Official recipient of charity assistance relief or vendor reimbursement.',
    },
    {
      module: 'Payments',
      field: 'Charity Case Allocation',
      code: 'caseId',
      type: 'Dropdown (Cases)',
      validation: 'Required for Charity Assistance relief.',
      purpose: 'Allocates expenditure directly against the approved case fund.',
    },
    {
      module: 'Handovers',
      field: 'From / To Custodians',
      code: 'fromId, toId',
      type: 'Dropdown',
      validation: 'fromId cannot equal toId. Amount <= current custodian float.',
      purpose: 'Maintains custodian cash custody trail without balance leaks.',
    },
  ];

  const MENU_CATALOG = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      path: 'dashboard',
      description: 'Executive overview with real-time liquidity cards, total contributions, active cases, overdue dues alert, and the AI Diagnostic banner.',
    },
    {
      title: 'Members Directory',
      icon: Users,
      path: 'members',
      description: 'Complete directory of registered donors and members with ID cards, address records (UAE & Home Country), dues summary, and individual audit ledger.',
    },
    {
      title: 'Monthly Contribution Grid',
      icon: CalendarCheck,
      path: 'monthly-status',
      description: '12-month visual payment matrix with instant green/amber/red indicators for every member, year selector, multi-month receipt issuing, and WhatsApp reminders.',
    },
    {
      title: 'Receipts Register',
      icon: Receipt,
      path: 'receipts',
      description: 'Complete audit log of all issued contribution receipts with multi-month breakdowns, printable thermal/A4 vouchers, and voiding functionality.',
    },
    {
      title: 'Payments & Relief Vouchers',
      icon: FileText,
      path: 'payments',
      description: 'Comprehensive disbursement registry for Medical, Education, Ration, and Administrative vouchers with split event capabilities and dual signatures.',
    },
    {
      title: 'Charity Cases',
      icon: HeartHandshake,
      path: 'cases',
      description: 'Restricted and unrestricted emergency aid cases with target budgets, collected amounts, disbursed aid, and individual case statements.',
    },
    {
      title: 'Cash Custodians',
      icon: Landmark,
      path: 'custodians',
      description: 'Peer-to-peer physical cash holding manager tracking which committee members hold charity cash floats and settlement handovers to the bank.',
    },
    {
      title: 'Chart of Accounts & GL',
      icon: FolderTree,
      path: 'chart-of-accounts',
      description: 'Standard double-entry chart of accounts (1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000 Charity Relief, 6000 Operating).',
    },
    {
      title: 'Financial Statements',
      icon: PieChart,
      path: 'trial-balance',
      description: 'Real-time Trial Balance and Balance Sheet reports generated directly from posted journal entries with drill-down account ledger drawers.',
    },
    {
      title: 'Audit Logs',
      icon: BookOpen,
      path: 'audit-logs',
      description: 'Immutable timeline recording every create, edit, void, and auto-reconciliation event with timestamps, user emails, and before/after states.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="help-documentation-center-modal"
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                Help & Accounting Documentation Center
              </h3>
              <p className="text-xs text-slate-400">
                Double-Entry Rules, Field Dictionary, Workflow Guide & AI Diagnostic Engine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100 border-b border-slate-200 overflow-x-auto shrink-0 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Keyboard className="w-4 h-4 text-emerald-600" />
            <span>1. Shortcuts Cheat Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('double-entry')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'double-entry'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Scale className="w-4 h-4 text-blue-600" />
            <span>2. Double-Entry Rulebook</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'dictionary'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Table className="w-4 h-4 text-purple-600" />
            <span>3. Field Dictionary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FolderTree className="w-4 h-4 text-amber-600" />
            <span>4. Menu Catalog & Workflows</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('engine')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'engine'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Cpu className="w-4 h-4 text-rose-600" />
            <span>5. AI Self-Healing Engine</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
          {/* TAB 1: KEYBOARD SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    High-Velocity Workflow Shortcuts
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Operate the complete accounting software without taking your hands off the keyboard. Press <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-emerald-900 font-mono text-[11px] font-bold">?</kbd> anywhere to reopen this guide.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SHORTCUT_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {group.title}
                    </h5>
                    <div className="space-y-2">
                      {group.shortcuts.map((sc, idx) => {
                        const Icon = sc.icon;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="text-slate-700 font-medium truncate">
                                {sc.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono">
                              {sc.keys.map((k, kIdx) => (
                                <kbd
                                  key={kIdx}
                                  className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 border border-slate-300 rounded shadow-2xs text-slate-800"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: DOUBLE-ENTRY RULEBOOK */}
          {activeTab === 'double-entry' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span>The Fundamental Law of Accounting: Total Debits == Total Credits</span>
                </h4>
                <p className="text-xs text-blue-800 mt-1">
                  Every financial transaction in this charity system creates balanced double-entry journal items ($Dr = Cr$). The equations are mathematically enforced by the <code className="font-mono bg-blue-100 px-1 rounded font-bold">FinancialEngineService</code>:
                </p>
                <div className="mt-2 text-xs font-mono font-bold text-blue-900 bg-white/80 p-2 rounded border border-blue-200">
                  Assets = Liabilities + Equity + (Revenues - Expenses)
                </div>
              </div>

              <div className="space-y-4">
                {DOUBLE_ENTRY_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-slate-900">{rule.title}</h5>
                        <p className="text-xs text-slate-500 mt-0.5">{rule.scenario}</p>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        Balanced (Dr == Cr)
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Side</th>
                            <th className="py-2 px-3">Account Code</th>
                            <th className="py-2 px-3">Account Title</th>
                            <th className="py-2 px-3">Accounting Effect</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {rule.lines.map((line, lIdx) => (
                            <tr
                              key={lIdx}
                              className={line.type === 'DEBIT' ? 'bg-emerald-50/30' : 'bg-blue-50/30'}
                            >
                              <td className="py-2 px-3 font-bold">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    line.type === 'DEBIT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {line.type}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {line.accountCode}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-800 font-medium">
                                {line.accountName}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600">
                                {line.effect}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-slate-500 italic flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{rule.notes}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETE FIELD DICTIONARY */}
          {activeTab === 'dictionary' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-purple-950">
                  Comprehensive Input Field Dictionary & Validation Rules
                </h4>
                <p className="text-xs text-purple-800 mt-0.5">
                  Every form field programmed into the application with schema types, validation constraints, and ledger implications.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Module</th>
                        <th className="py-2.5 px-4">Field Label</th>
                        <th className="py-2.5 px-4">Key / Variable</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Validation Rule</th>
                        <th className="py-2.5 px-4">Accounting Function</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {FIELD_DICTIONARY.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {row.module}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">
                            {row.field}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                            {row.code}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                            {row.validation}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 text-[11px]">
                            {row.purpose}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MENU CATALOG & WORKFLOWS */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-amber-950">
                  Application Architecture & Workflow Index
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Guide to every sidebar module, view route, and business operation in the PWA.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MENU_CATALOG.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.path}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                          <span className="text-[10px] font-mono text-slate-400">
                            Route: #{item.path}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: AI SELF-HEALING & DIAGNOSTIC ENGINE */}
          {activeTab === 'engine' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <span>Autonomous AI Diagnostic & Auto-Reconcile System</span>
                </h4>
                <p className="text-xs text-rose-800 mt-1">
                  How the PWA monitors ledger integrity, detects double-entry asymmetries, and executes one-click self-healing repair batches directly in Firestore and React state.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">Background Integrity Auditor</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Continuously scans all 8 collections (receipts, payments, journal entries, transactions, custody holdings, members, accounts, cases). Flags any entry where $\sum Dr \neq \sum Cr$, any ghost holding records, or any mismatched custodian float.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">Root-Cause Explanation</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Provides accounting breakdown for every detected anomaly (e.g. &ldquo;Receipt #RCT-2026-0012 missing offsetting debit asset leg&rdquo; or &ldquo;Custodian A physical float exceeds verified collections&rdquo;) with expected vs actual values.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">One-Click Atomic Fix</h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Executes atomic Firestore <code className="font-mono bg-slate-100 px-1 rounded text-[11px]">writeBatch</code> repairs that regenerate missing journal legs, deduplicate holdings, and re-derive all Balance Sheet balances from raw journal trails without app reload.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Key Diagnostic Rules Executed
                </h5>
                <ul className="text-xs text-slate-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Rule 1 - Out-of-Balance Journals:</strong> Verifies each journal entry's debit sum matches credit sum within ±0.009 precision.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Rule 2 - Broken Custodian Floats:</strong> Recomputes custodian member cash in hand by totaling verified collected receipts minus settled handovers and disbursements.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Rule 3 - Chart of Accounts Drift:</strong> Compares top-level account card balances against the aggregate sum of all posted journal lines for that account code.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Rule 4 - Multi-Currency Valuation:</strong> Ensures transactions in INR/USD use frozen exchange rate snapshots to prevent floating-point rounding mismatches.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Rule 5 - Case Allocation Consistency:</strong> Verifies collected and disbursed amounts on Charity Cases match the sum of tagged receipts and relief vouchers.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Remix Charity Accounting PWA • Multi-Tenant Enterprise Edition</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
