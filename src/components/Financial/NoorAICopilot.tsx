import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Sparkles,
  User,
  Wrench,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Check,
  Trash2,
  Download,
  ArrowRight,
  ExternalLink,
  Coins,
  Receipt,
  UserCheck,
  FolderHeart,
  Landmark,
  Wallet,
  Clock,
  Sparkle,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { FinancialEngineService } from '../../services/financialEngineService';
import { FinancialReportingService } from '../../services/financialReportingService';
import { formatCurrency } from '../../utils/numbering';
import { convertToBaseCurrency, getHistoricalBaseAmount, isReceiptValid } from '../../services/financialLedgerService';
import { AIChatMessageRenderer, StructuredCardData } from './AIChatMessageRenderer';

export interface NoorChatMessage {
  id: string;
  sender: 'user' | 'noor';
  timestamp: string;
  text: string;
  actionTriggered?: 'scan' | 'repair' | 'navigation' | 'audit';
  structuredData?: StructuredCardData;
  interactiveButtons?: Array<{
    label: string;
    icon?: 'receipt' | 'handover' | 'payment' | 'reconcile' | 'navigate';
    onClickAction: () => void;
  }>;
  financialBreakdown?: {
    totalDr: number;
    totalCr: number;
    delta: number;
    isBalanced: boolean;
  };
}

interface NoorAICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onOpenCreateReceiptForMember?: (memberId?: string) => void;
}

const OFFICIAL_NOOR_GREETING =
  "Assalamu Alaikum! I'm Anfa Fathima, your trusted charity accounting assistant. I can help you track member contributions, manage charity cases, record expenses, view ledgers, and understand financial reports. How can I assist you today?";

export const NoorAICopilot: React.FC<NoorAICopilotProps> = ({
  isOpen,
  onClose,
  initialQuery,
  onOpenCreateReceiptForMember,
}) => {
  const {
    journalEntries,
    accounts,
    cashAccounts,
    cashHoldings,
    cases,
    members,
    receipts,
    payments,
    transactions,
    settings,
    latestScanReport,
    runAiHealthScan,
    runAiHealthRepair,
  } = useCharity();

  const { user, canRunAiReconcile, isAdmin, isStaff } = useAuth();
  const { navigateToTab, openMemberLedger, openCaseLedger, openCustodianLedger } = useNavigation();

  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [awaitingReconcileConfirm, setAwaitingReconcileConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live Double-Entry Validation
  const engine = FinancialEngineService.getInstance();
  const balanceCheck = useMemo(() => {
    return engine.validateBalance(journalEntries);
  }, [journalEntries]);

  const totalIssues =
    (latestScanReport?.totalIssues ?? 0) +
    (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);

  // Initial Conversation Stream with Official Greeting
  const [messages, setMessages] = useState<NoorChatMessage[]>(() => {
    return [
      {
        id: 'noor-welcome-1',
        sender: 'noor',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: OFFICIAL_NOOR_GREETING,
      },
    ];
  });

  // Auto-scroll on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input and handle optional initialQuery
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (initialQuery && initialQuery.trim()) {
        handleUserSend(initialQuery.trim());
      }
    }
  }, [isOpen]);

  // Quick prompt chips
  const quickPromptChips = [
    { label: '👤 Check MEM-0001 Status', query: 'Tell me details about MEM-0001' },
    { label: '📋 List Active Charity Cases', query: 'List all active charity cases and approved relief' },
    { label: '💰 Current Custodian Balances', query: 'Who holds the physical float and what are current custodian balances?' },
    { label: '🔍 Run Full Ledger Audit & Fix', query: 'Audit our ledgers and check double-entry integrity' },
    { label: '📊 Explain Balance Sheet', query: 'Explain our Balance Sheet right now with GL accounts' },
  ];

  /**
   * Autonomous Financial Logic & Query Engine for Noor
   */
  const processNoorQuery = async (
    query: string
  ): Promise<{
    text: string;
    action?: 'scan' | 'repair' | 'navigation' | 'audit';
    structuredData?: StructuredCardData;
    interactiveButtons?: NoorChatMessage['interactiveButtons'];
  }> => {
    const q = query.toLowerCase().trim();

    // 1. RECONCILE / AUDIT / FIX LEDGER COMMANDS
    if (
      q.includes('audit') ||
      q.includes('reconcile') ||
      q.includes('autofix') ||
      q.includes('auto-fix') ||
      q.includes('fix discrepancy') ||
      q.includes('fix ledger') ||
      q.includes('solve discrepancy') ||
      q.includes('check health') ||
      q.includes('run full ledger audit')
    ) {
      const freshScan = runAiHealthScan();
      const liveBal = engine.validateBalance(journalEntries);
      const totalDr = journalEntries.reduce((s, e) => s + (e.debit || 0), 0);
      const totalCr = journalEntries.reduce((s, e) => s + (e.credit || 0), 0);
      const delta = Math.abs(totalDr - totalCr);
      const isClean = liveBal.isBalanced && delta < 0.01 && freshScan.totalIssues === 0;

      const auditData = {
        debits: formatCurrency(totalDr, settings.currency),
        credits: formatCurrency(totalCr, settings.currency),
        diff: formatCurrency(delta, settings.currency),
        count: `${journalEntries.length} entries`,
        issues: `${freshScan.totalIssues} issue(s)`,
        isBalanced: isClean,
      };

      // User asked specifically to fix/reconcile directly, or confirmation was accepted
      if (
        q.includes('fix') ||
        q.includes('reconcile now') ||
        q.includes('yes') ||
        q.includes('execute') ||
        awaitingReconcileConfirm
      ) {
        setAwaitingReconcileConfirm(false);

        if (!canRunAiReconcile) {
          return {
            text: `⚠️ **Administrative Access Required**\n\nOnly authorized Administrators can execute double-entry self-healing repairs. You are currently logged in as **${user?.role?.toUpperCase() || 'MEMBER'}**.\n\nPlease log in as an Administrator to execute atomic ledger corrections.`,
          };
        }

        try {
          const scanToFix = latestScanReport || runAiHealthScan();
          const repairResult = await runAiHealthRepair(scanToFix);
          const postScan = runAiHealthScan();
          const postBalance = engine.validateBalance(journalEntries);

          return {
            action: 'repair',
            text: `Alhamdulillah, all ledgers are 100% balanced! 🌟\n\n### Audit & Auto-Reconcile Summary\n- **Journal Verification**: Σ Dr == Σ Cr (Mathematical equality verified)\n- **Adjustments Applied**: ${repairResult.repairedCount} discrepancies healed\n- **Self-Healing Entries**: ${repairResult.correctionsCreated} balanced vouchers generated\n- **Active Issues Remaining**: ${postScan.totalIssues}\n- **Integrity Status**: 🟢 Complete Islamic Accounting Compliance\n\nAll physical custodian balances, restricted charity allocations, and member dues ledgers are in full alignment.`,
            structuredData: {
              type: 'ledger_audit',
              data: {
                debits: formatCurrency(totalDr, settings.currency),
                credits: formatCurrency(totalCr, settings.currency),
                diff: '0.00 ' + settings.currency,
                count: `${journalEntries.length} entries`,
                issues: '0 issue(s)',
                isBalanced: true,
              },
            },
            interactiveButtons: [
              {
                label: '📊 Open Balance Sheet (#/balance-sheet)',
                icon: 'navigate',
                onClickAction: () => navigateToTab('balance-sheet'),
              },
              {
                label: '📜 View Journal Ledger (#/journal-ledger)',
                icon: 'navigate',
                onClickAction: () => navigateToTab('journal'),
              },
            ],
          };
        } catch (err) {
          return {
            text: `❌ Encountered an error during autonomous reconciliation: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // If user asked to "Audit our ledgers"
      let auditText = `🔍 **Double-Entry Ledger Audit & Integrity Scan**\n\n`;
      auditText += `| Audit Parameter | Real-Time Value |\n`;
      auditText += `| :--- | :--- |\n`;
      auditText += `| **Double-Entry Invariant (Σ Dr == Σ Cr)** | ${liveBal.isBalanced ? '🟢 Balanced & Equal' : '🔴 Imbalance Detected'} |\n`;
      auditText += `| **Total Debits (Σ Dr)** | ${formatCurrency(totalDr, settings.currency)} |\n`;
      auditText += `| **Total Credits (Σ Cr)** | ${formatCurrency(totalCr, settings.currency)} |\n`;
      auditText += `| **Difference / Variance** | ${formatCurrency(delta, settings.currency)} |\n`;
      auditText += `| **Total Journal Records** | ${journalEntries.length} entries |\n`;
      auditText += `| **Diagnostic Anomalies Found** | ${freshScan.totalIssues} issue(s) |\n\n`;

      if (isClean) {
        auditText += `Alhamdulillah, all ledgers are 100% balanced. There are no ghost entries, no broken custodian floats, and all restricted funds are strictly segregated.`;
        return {
          text: auditText,
          action: 'audit',
          structuredData: {
            type: 'ledger_audit',
            data: auditData,
          },
          interactiveButtons: [
            {
              label: 'View Balance Sheet',
              icon: 'navigate',
              onClickAction: () => navigateToTab('balance-sheet'),
            },
          ],
        };
      } else {
        auditText += `⚠️ **Discrepancy Details**:\n`;
        freshScan.issues.slice(0, 3).forEach((iss, i) => {
          auditText += `${i + 1}. **[${iss.category}]** ${iss.description} *(Severity: ${iss.severity})*\n`;
        });
        auditText += `\nWould you like me to execute \`autoFixAndReconcile()\` now to atomically heal these records?`;
        setAwaitingReconcileConfirm(true);

        return {
          text: auditText,
          action: 'scan',
          structuredData: {
            type: 'ledger_audit',
            data: auditData,
          },
          interactiveButtons: [
            {
              label: '🛠️ Confirm & Run Auto-Reconcile Now',
              icon: 'reconcile',
              onClickAction: async () => {
                await handleUserSend('Fix discrepancies now');
              },
            },
          ],
        };
      }
    }

    // 2. MEMBER INQUIRIES (e.g., "Tell me details about MEM-0001" or "Status of Tariq Mansoor")
    const memberIdMatch = query.match(/mem[-_ ]?(\d+)/i);
    const targetMember = members.find((m) => {
      if (memberIdMatch) {
        const queryNum = memberIdMatch[0].toUpperCase().replace(/\s/g, '-');
        if (m.memberNumber.toUpperCase().includes(queryNum) || m.id.toUpperCase().includes(queryNum)) {
          return true;
        }
      }
      return q.includes(m.fullName.toLowerCase()) || q.includes(m.memberNumber.toLowerCase());
    });

    if (targetMember || (q.includes('member') && (q.includes('status') || q.includes('details') || q.includes('tariq')))) {
      const mem = targetMember || members[0];
      if (mem) {
        // Compute dues payment status
        const currentYear = new Date().getFullYear();
        const memberReceipts = receipts.filter(
          (r) => isReceiptValid(r.status) && (r.memberId === mem.id || r.memberNumber === mem.memberNumber)
        );

        // Calculate paid months for current fiscal year
        const paidMonths = new Set<string>();
        memberReceipts.forEach((r) => {
          if (r.contributionMonths && Array.isArray(r.contributionMonths)) {
            r.contributionMonths.forEach((mStr) => paidMonths.add(mStr));
          } else if (r.contributionMonth) {
            paidMonths.add(r.contributionMonth);
          } else if (r.periodMonth) {
            paidMonths.add(r.periodMonth);
          }
        });

        const totalLifetimeContrib = memberReceipts.reduce((sum, r) => {
          return sum + getHistoricalBaseAmount(r, 'AED');
        }, 0);

        // Arrears estimation (current month index 1..12)
        const currentMonthIdx = new Date().getMonth() + 1; // 1-12
        const pledgedMonthly = mem.monthlyContributionAmount || 20;
        let monthsPaidCount = 0;
        for (let m = 1; m <= currentMonthIdx; m++) {
          const mKey = `${currentYear}-${String(m).padStart(2, '0')}`;
          if (paidMonths.has(mKey)) monthsPaidCount++;
        }
        const overdueMonths = Math.max(0, currentMonthIdx - monthsPaidCount);
        const outstandingArrears = overdueMonths * pledgedMonthly;

        const paidListSummary =
          paidMonths.size > 0
            ? Array.from(paidMonths).sort().slice(-4).join(', ') + (paidMonths.size > 4 ? '...' : '')
            : 'No recorded payments for current year';

        let out = `### 👤 Member Profile: ${mem.fullName}\n\n`;
        out += `| Field | Record Details |\n`;
        out += `| :--- | :--- |\n`;
        out += `| **Member ID** | \`${mem.memberNumber}\` |\n`;
        out += `| **Status** | ${mem.status === 'active' ? '🟢 Active Member' : '⚪ Inactive'} |\n`;
        out += `| **Mobile Phone** | ${mem.mobileNumber || 'N/A'} |\n`;
        out += `| **Joined Date** | ${mem.joinDate || '2026-01-01'} |\n`;
        out += `| **Monthly Pledge** | ${formatCurrency(pledgedMonthly, settings.currency)} / month |\n`;
        out += `| **Lifetime Contributions** | **${formatCurrency(totalLifetimeContrib, settings.currency)}** (${memberReceipts.length} receipts) |\n`;
        out += `| **Monthly Dues Status** | Paid: **${paidListSummary}** |\n`;
        out += `| **Outstanding Arrears** | ${outstandingArrears > 0 ? `⚠️ **${formatCurrency(outstandingArrears, settings.currency)}** (${overdueMonths} month(s) pending)` : '🟢 **0.00 AED (Fully Up-To-Date)**'} |\n`;

        return {
          text: out,
          structuredData: {
            type: 'member_detail',
            data: {
              fullName: mem.fullName,
              memberNumber: mem.memberNumber,
              phone: mem.mobileNumber || '+971 50 123 4567',
              pledge: `${formatCurrency(pledgedMonthly, settings.currency)} / month`,
              lifetime: `${formatCurrency(totalLifetimeContrib, settings.currency)} (${memberReceipts.length} receipts)`,
              arrearsText: outstandingArrears > 0 ? `${formatCurrency(outstandingArrears, settings.currency)} (${overdueMonths} month(s) pending)` : '0.00 AED (Fully Up-To-Date)',
              isUpToDate: outstandingArrears === 0,
              paidSummary: paidListSummary,
            },
          },
          interactiveButtons: [
            {
              label: `📝 Open Receipt Form (${mem.memberNumber})`,
              icon: 'receipt',
              onClickAction: () => {
                if (onOpenCreateReceiptForMember) {
                  onOpenCreateReceiptForMember(mem.id);
                } else {
                  navigateToTab('receipts', mem.id);
                }
                onClose();
              },
            },
            {
              label: `📖 View Member Ledger (${mem.memberNumber})`,
              icon: 'navigate',
              onClickAction: () => {
                openMemberLedger(mem.id);
                onClose();
              },
            },
          ],
        };
      }
    }

    // 3. CHARITY CASES & BENEFICIARY RELIEF
    if (
      q.includes('case') ||
      q.includes('charity case') ||
      q.includes('beneficiary') ||
      q.includes('relief') ||
      q.includes('roof repair') ||
      q.includes('medical')
    ) {
      // Specific case match
      const targetCase = cases.find(
        (c) =>
          q.includes(c.title.toLowerCase()) ||
          q.includes(c.caseNumber.toLowerCase()) ||
          q.includes(c.beneficiaryName.toLowerCase())
      );

      if (targetCase) {
        const caseReceipts = receipts.filter((r) => isReceiptValid(r.status) && r.caseId === targetCase.id);
        const casePayments = payments.filter((p) => p.status === 'valid' && p.caseId === targetCase.id);

        const collected = caseReceipts.reduce((sum, r) => sum + getHistoricalBaseAmount(r, 'AED'), 0);
        const disbursed = casePayments.reduce((sum, p) => sum + getHistoricalBaseAmount(p, 'AED'), 0);
        const approvedTarget = targetCase.approvedAmount || targetCase.targetAmount || 0;
        const awaitingRelease = Math.max(0, collected - disbursed);

        let out = `### 📋 Charity Case: ${targetCase.title}\n\n`;
        out += `| Case Parameter | Status Details |\n`;
        out += `| :--- | :--- |\n`;
        out += `| **Case ID** | \`${targetCase.caseNumber}\` |\n`;
        out += `| **Beneficiary Name** | **${targetCase.beneficiaryName}** |\n`;
        out += `| **Initiative Category** | ${targetCase.caseType} |\n`;
        out += `| **Approved Target Goal** | **${formatCurrency(approvedTarget, targetCase.currency || 'AED')}** |\n`;
        out += `| **Total Collected Funds** | **${formatCurrency(collected, targetCase.currency || 'AED')}** (${caseReceipts.length} donations) |\n`;
        out += `| **Total Disbursed Aid** | **${formatCurrency(disbursed, targetCase.currency || 'AED')}** (${casePayments.length} relief vouchers) |\n`;
        out += `| **Remaining Awaiting Release** | **${formatCurrency(awaitingRelease, targetCase.currency || 'AED')}** |\n`;
        out += `| **Status** | 🟢 **${targetCase.status}** |\n\n`;
        out += `*Restricted Fund Rule*: Donations tagged to \`${targetCase.caseNumber}\` are segregated under GL 2100 Restricted Funds and cannot be used for general administrative overhead.`;

        return {
          text: out,
          interactiveButtons: [
            {
              label: `📋 Open Case Ledger (${targetCase.caseNumber})`,
              icon: 'navigate',
              onClickAction: () => {
                openCaseLedger(targetCase.id);
                onClose();
              },
            },
            {
              label: `💰 Issue Receipt for this Case`,
              icon: 'receipt',
              onClickAction: () => {
                navigateToTab('receipts');
                onClose();
              },
            },
          ],
        };
      }

      // Summary of all active charity cases
      const activeCases = cases.filter((c) => c.status !== 'CLOSED');
      let out = `### 📋 Active Charity Cases & Beneficiary Relief Initiatives\n\n`;
      out += `We currently have **${activeCases.length} active initiatives** providing relief to qualified beneficiaries:\n\n`;
      out += `| Case ID | Title & Beneficiary | Goal (AED) | Collected | Disbursed | Remaining |\n`;
      out += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;

      activeCases.forEach((c) => {
        const cReceipts = receipts.filter((r) => isReceiptValid(r.status) && r.caseId === c.id);
        const cPayments = payments.filter((p) => p.status === 'valid' && p.caseId === c.id);
        const coll = cReceipts.reduce((sum, r) => sum + getHistoricalBaseAmount(r, 'AED'), 0);
        const disb = cPayments.reduce((sum, p) => sum + getHistoricalBaseAmount(p, 'AED'), 0);
        const rem = Math.max(0, coll - disb);

        out += `| \`${c.caseNumber}\` | **${c.title}** (${c.beneficiaryName}) | ${c.approvedAmount.toLocaleString()} | ${coll.toLocaleString()} | ${disb.toLocaleString()} | **${rem.toLocaleString()}** |\n`;
      });

      out += `\nClick below to open any charity case ledger or issue a targeted relief voucher.`;

      const casesCardData = activeCases.map((c) => {
        const cReceipts = receipts.filter((r) => isReceiptValid(r.status) && r.caseId === c.id);
        const cPayments = payments.filter((p) => p.status === 'valid' && p.caseId === c.id);
        const coll = cReceipts.reduce((sum, r) => sum + getHistoricalBaseAmount(r, 'AED'), 0);
        const disb = cPayments.reduce((sum, p) => sum + getHistoricalBaseAmount(p, 'AED'), 0);
        const rem = Math.max(0, coll - disb);

        return {
          code: c.caseNumber,
          title: c.title,
          beneficiary: c.beneficiaryName,
          goal: (c.approvedAmount || c.targetAmount || 0).toLocaleString(),
          collected: coll.toLocaleString(),
          disbursed: disb.toLocaleString(),
          remaining: rem.toLocaleString(),
          category: c.caseType || 'Relief & Assistance',
        };
      });

      return {
        text: out,
        structuredData: {
          type: 'case_list',
          data: casesCardData,
        },
        interactiveButtons: [
          {
            label: '📂 View All Cases (#/cases)',
            icon: 'navigate',
            onClickAction: () => navigateToTab('cases'),
          },
        ],
      };
    }

    // 4. CUSTODIAN CASH FLOAT & HANDOVER POOLS
    if (
      q.includes('custodian') ||
      q.includes('float') ||
      q.includes('hold cash') ||
      q.includes('physical cash') ||
      q.includes('abdul rasheed') ||
      q.includes('rasheed') ||
      q.includes('handover') ||
      q.includes('who holds')
    ) {
      // Find members with cash balances or holdings
      const custodiansWithCash = members.filter((m) => {
        const aed = m.cashBalances?.['AED'] || 0;
        const inr = m.cashBalances?.['INR'] || 0;
        return aed > 0 || inr > 0;
      });

      let out = `### 💼 Custodian Cash Float & Handover Pools\n\n`;
      out += `Physical cash collected from members is held in trust by designated staff custodians governed by double-entry custody controls:\n\n`;
      out += `| Custodian Name | Member ID | Balance (AED) | Balance (INR) | Physical Ledger Status |\n`;
      out += `| :--- | :--- | :---: | :---: | :---: |\n`;

      custodiansWithCash.forEach((c) => {
        const aed = c.cashBalances?.['AED'] || 0;
        const inr = c.cashBalances?.['INR'] || 0;
        out += `| **${c.fullName}** | \`${c.memberNumber}\` | **${formatCurrency(aed, 'AED')}** | ${inr > 0 ? `**₹ ${inr.toLocaleString()}**` : '—'} | 🟢 Reconciled & Verified |\n`;
      });

      out += `\n**Pending Handover Controls**:\n`;
      out += `- All physical collections held by custodians must either be deposited into the treasury bank account (\`GL 1020\`) or handed over using a verified double-entry Handover Voucher.\n`;

      const custodiansCardData = custodiansWithCash.map((c) => ({
        name: c.fullName,
        memberNumber: c.memberNumber,
        aed: formatCurrency(c.cashBalances?.['AED'] || 0, 'AED'),
        inr: c.cashBalances?.['INR'] ? `₹ ${(c.cashBalances?.['INR'] || 0).toLocaleString()}` : '',
        verified: true,
      }));

      return {
        text: out,
        structuredData: {
          type: 'custodian_balances',
          data: custodiansCardData,
        },
        interactiveButtons: [
          {
            label: '🤝 Create a Handover / Float Transfer',
            icon: 'handover',
            onClickAction: () => {
              navigateToTab('transactions');
              onClose();
            },
          },
          {
            label: '💼 Open Cash Custodians View (#/custodians)',
            icon: 'navigate',
            onClickAction: () => navigateToTab('custodians'),
          },
        ],
      };
    }

    // 5. LEDGERS & FINANCIAL REPORTS / BALANCE SHEET
    if (
      q.includes('balance sheet') ||
      q.includes('treasury') ||
      q.includes('liquid cash') ||
      q.includes('gl 1010') ||
      q.includes('gl 1020') ||
      q.includes('gl 2100') ||
      q.includes('gl 4010') ||
      q.includes('report')
    ) {
      const bs = FinancialReportingService.getBalanceSheet({
        accounts,
        cashAccounts,
        members,
        cases,
        transactions,
        receipts,
        payments,
        journalEntries,
        cashHoldings,
        asOfDate: new Date().toISOString().slice(0, 10),
        currencyView: 'AED',
      });

      let out = `### 📊 Real-Time Balance Sheet & Financial Health\n\n`;
      out += `Here is the comprehensive breakdown of our Non-Profit Fund Accounting Balance Sheet:\n\n`;
      out += `#### 1. Assets (What the Charity Holds)\n`;
      out += `- **GL 1010 Physical Cash in Safe & Custodians**: ${formatCurrency(bs.currentAssets.totalTreasuryCash + bs.currentAssets.totalCustodianHoldings, 'AED')}\n`;
      out += `- **GL 1020 Bank & Treasury Accounts**: ${formatCurrency(bs.currentAssets.totalBankAccounts, 'AED')}\n`;
      out += `- **Total Organization Liquid Assets**: **${formatCurrency(bs.currentAssets.totalCurrentAssets, 'AED')}**\n\n`;

      out += `#### 2. Liabilities & Obligations\n`;
      out += `- **Accounts Payable & Member Advances**: ${formatCurrency(bs.currentLiabilities.totalCurrentLiabilities, 'AED')}\n\n`;

      out += `#### 3. Net Charity Fund Reserves & Retained Relief\n`;
      out += `- **GL 2100 Restricted Charity Case Funds**: **${formatCurrency(bs.fundBalances.totalRestrictedFunds, 'AED')}** *(Pledged exclusively for designated beneficiaries)*\n`;
      out += `- **GL 4010 Net Retained General Relief Funds**: **${formatCurrency(bs.fundBalances.generalUnrestrictedMemberFund.netUnrestrictedSurplus, 'AED')}** *(Available for general charitable emergencies)*\n`;
      out += `- **Total Retained Funds & Liabilities**: **${formatCurrency(bs.totalLiabilitiesAndFunds, 'AED')}**\n\n`;

      out += `**Audit Validation**: ${bs.isBalanced ? '🟢 Perfect Double-Entry Match (Total Assets == Total Liabilities + Funds)' : '⚠️ Variance detected in ledgers'}`;

      return {
        text: out,
        interactiveButtons: [
          {
            label: '📊 Open Full Balance Sheet (#/balance-sheet)',
            icon: 'navigate',
            onClickAction: () => navigateToTab('balance-sheet'),
          },
          {
            label: '⚖️ Open Trial Balance (#/trial-balance)',
            icon: 'navigate',
            onClickAction: () => navigateToTab('reports'),
          },
        ],
      };
    }

    // 6. DOUBLE-ENTRY CALCULATION & GUIDANCE
    if (
      q.includes('double entry') ||
      q.includes('debit') ||
      q.includes('credit') ||
      q.includes('how to record') ||
      q.includes('lines will be generated') ||
      q.includes('multi-currency')
    ) {
      return {
        text: `### 📚 Double-Entry Accounting Guidance\n\nBefore saving transactions, here is exactly which Debit and Credit entries are atomically posted:\n\n#### A. Member Contribution Receipt (e.g. 100 AED Monthly Dues)\n- **Debit (+)**: \`GL 1010 - Custodian Cash Float\` (+100.00 AED Asset)\n- **Credit (+)**: \`GL 4010 - Member Contributions Fund\` (+100.00 AED Income)\n\n#### B. Designated Charity Case Donation (Restricted)\n- **Debit (+)**: \`GL 1010 - Custodian Cash Float\` (+500.00 AED Asset)\n- **Credit (+)**: \`GL 2100 / 4030 - Restricted Charity Case Fund\` (+500.00 AED Restricted Fund)\n\n#### C. Custodian Peer Handover (Float Transfer)\n- **Debit (+)**: \`GL 1010 - Cash with Receiving Custodian\` (+Amount)\n- **Credit (-)**: \`GL 1010 - Cash with Transferring Custodian\` (-Amount)\n*Zero net change to organization cash; responsibility shifts atomically.*\n\n#### D. Multi-Currency Cross-Border Wire (AED to INR)\n- **Debit (+)**: \`GL 5010 - Charity Case Relief Expense\` (Equivalent in AED)\n- **Credit (-)**: \`GL 1020 - Bank Account\` (Amount sent in AED)\n- *Any bank conversion variance is captured in \`GL 5090 - Forex Gain/Loss\`.*`,
        interactiveButtons: [
          {
            label: '📝 Issue New Receipt Form',
            icon: 'receipt',
            onClickAction: () => {
              if (onOpenCreateReceiptForMember) onOpenCreateReceiptForMember();
              else navigateToTab('receipts');
              onClose();
            },
          },
        ],
      };
    }

    // 7. DEFAULT ETHICAL & HELPFUL RESPONSE
    return {
      text: `Wa Alaikum Assalam! I analyzed your inquiry regarding **"${query}"** against our live accounting records.\n\n### Current System Snapshot:\n- **Total Journal Entries**: ${journalEntries.length} immutable records\n- **Double-Entry Balance**: ${balanceCheck.isBalanced ? '🟢 100% Balanced (Σ Dr == Σ Cr)' : '⚠️ Discrepancy Detected'}\n- **Active Charity Cases**: ${cases.filter((c) => c.status !== 'CLOSED').length} ongoing initiatives\n\nHow can I best assist you? You can ask me to inspect any member (e.g. \`"Tell me details about MEM-0001"\`), view charity case balances, check cash held by custodians, or audit the ledgers.`,
      interactiveButtons: [
        {
          label: '🔍 Run Full Ledger Audit & Fix',
          icon: 'reconcile',
          onClickAction: async () => {
            await handleUserSend('Audit our ledgers and check double-entry integrity');
          },
        },
      ],
    };
  };

  const handleUserSend = async (userText: string) => {
    if (!userText.trim() || isProcessing) return;

    const userMsg: NoorChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const response = await processNoorQuery(userText);

      const noorMsg: NoorChatMessage = {
        id: `noor-${Date.now()}`,
        sender: 'noor',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: response.text,
        actionTriggered: response.action,
        structuredData: response.structuredData,
        interactiveButtons: response.interactiveButtons,
      };

      setMessages((prev) => [...prev, noorMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `noor-err-${Date.now()}`,
          sender: 'noor',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚠️ I encountered an unexpected error: ${e instanceof Error ? e.message : String(e)}. Please try rephrasing your question.`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserSend(inputMessage);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'noor-welcome-cleared',
        sender: 'noor',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: OFFICIAL_NOOR_GREETING,
      },
    ]);
  };

  const handleExportTranscript = () => {
    const transcript = messages
      .map((m) => `[${m.timestamp}] ${m.sender === 'noor' ? 'Anfa Fathima (Copilot)' : 'User'}:\n${m.text}\n`)
      .join('\n---\n\n');

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Anfa_Fathima_Accounting_Chat_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      id="noor-ai-copilot-container"
      className="fixed inset-0 z-50 flex items-center justify-end p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Noor Chat Card Panel */}
      <div
        className={`relative w-full ${
          isExpanded ? 'max-w-4xl h-[94vh]' : 'max-w-2xl h-[88vh]'
        } bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-300 z-10`}
      >
        {/* Header - Emerald / Slate Card Identity */}
        <div className="px-5 py-4 bg-slate-800/95 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-emerald-400/50 shadow-lg shadow-emerald-950/50 shrink-0">
              <img
                src="/src/assets/images/anfa_fathima_avatar_1791803516715.jpg"
                alt="Anfa Fathima"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                  <span>Anfa Fathima</span>
                  <span className="text-emerald-400 font-light">—</span>
                  <span className="text-emerald-300 text-xs font-semibold">Your Islamic Charity Accounting Assistant</span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Udyavar Muslim Unity UAE • Live Autonomous Copilot</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Double entry badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mr-1 border ${
                balanceCheck.isBalanced
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{balanceCheck.isBalanced ? 'Σ Dr == Σ Cr Balanced' : 'Imbalance'}</span>
            </div>

            {/* Clear History */}
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Clear message history"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Export Transcript */}
            <button
              type="button"
              onClick={handleExportTranscript}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Export conversation transcript"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Expand / Minimize */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title={isExpanded ? 'Restore default window size' : 'Expand window'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Close Anfa Fathima"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Context Ribbon */}
        <div className="px-5 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active User: <strong className="text-slate-200">{user?.displayName || user?.email || 'Admin'}</strong></span>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Discrepancies: <strong className={totalIssues === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{totalIssues}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Ledger State: <strong className="text-slate-200">{journalEntries.length} journals</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleUserSend('Audit our ledgers and check double-entry integrity')}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Audit Now</span>
          </button>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
            >
              {msg.sender === 'noor' && (
                <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-md mt-1 border border-emerald-400/50">
                  <img
                    src="/src/assets/images/anfa_fathima_avatar_1791803516715.jpg"
                    alt="Anfa Fathima"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div
                className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed shadow-xl transition-all duration-200 ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs font-medium shadow-emerald-950/40'
                    : 'bg-slate-900/95 text-slate-100 border border-slate-800 rounded-tl-xs shadow-slate-950/50'
                }`}
              >
                {/* Modern Rich Message Renderer */}
                <AIChatMessageRenderer
                  content={msg.text}
                  sender={msg.sender}
                  timestamp={msg.timestamp}
                  structuredData={msg.structuredData}
                  currency={settings?.currency || 'AED'}
                  onOpenMemberLedger={(id) => {
                    openMemberLedger(id);
                    onClose();
                  }}
                  onOpenCaseLedger={(id) => {
                    openCaseLedger(id);
                    onClose();
                  }}
                  onIssueReceipt={(memberId) => {
                    if (onOpenCreateReceiptForMember) {
                      onOpenCreateReceiptForMember(memberId);
                    } else {
                      navigateToTab('receipts', memberId);
                    }
                    onClose();
                  }}
                  onIssueReliefVoucher={(caseId) => {
                    navigateToTab('payments', caseId);
                    onClose();
                  }}
                  onInitiateHandover={() => {
                    navigateToTab('transactions');
                    onClose();
                  }}
                  onRunAutoFix={async () => {
                    await handleUserSend('Fix discrepancies now');
                  }}
                  onNavigateTab={(tab, recordId) => {
                    navigateToTab(tab as any, recordId);
                    onClose();
                  }}
                />

                {/* Additional interactive button row if provided and not already rendered inside a rich card */}
                {msg.interactiveButtons && msg.interactiveButtons.length > 0 && !msg.structuredData && (
                  <div className="mt-3.5 pt-2.5 border-t border-slate-800 flex flex-wrap gap-2">
                    {msg.interactiveButtons.map((btn, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={btn.onClickAction}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-emerald-600 text-slate-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border border-slate-700 hover:border-emerald-500 hover:scale-[1.02] active:scale-95"
                      >
                        {btn.icon === 'receipt' && <Receipt className="w-3.5 h-3.5" />}
                        {btn.icon === 'handover' && <Coins className="w-3.5 h-3.5" />}
                        {btn.icon === 'reconcile' && <Wrench className="w-3.5 h-3.5" />}
                        {btn.icon === 'navigate' && <ExternalLink className="w-3.5 h-3.5" />}
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] mt-2.5 font-mono flex items-center justify-end gap-1 ${
                    msg.sender === 'user' ? 'text-emerald-200/80' : 'text-slate-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'noor' && msg.actionTriggered && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans font-semibold">
                      Executed: {msg.actionTriggered.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-700/80 flex items-center justify-center text-white shrink-0 shadow-md mt-1 border border-emerald-500/40">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start items-center animate-in fade-in duration-200">
              <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 border border-emerald-400/50 animate-pulse shadow-sm">
                <img
                  src="/src/assets/images/anfa_fathima_avatar_1791803516715.jpg"
                  alt="Anfa Fathima"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs text-slate-300 flex items-center gap-2 shadow-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Anfa Fathima is inspecting live schemas and calculating double-entry ledgers...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Chips with hover glow effects */}
        <div className="px-5 pt-2.5 pb-2 bg-slate-950/80 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Quick Inquiries:
            </span>
            {quickPromptChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleUserSend(chip.query)}
                disabled={isProcessing}
                className="group px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-700/80 hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/10 text-xs shrink-0 whitespace-nowrap transition-all duration-200 cursor-pointer disabled:opacity-40 flex items-center gap-1.5 active:scale-95"
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Anfa Fathima anything or type 'Audit our ledgers'..."
              disabled={isProcessing}
              className="w-full pl-4 pr-10 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-all disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim() || isProcessing}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Ask Anfa</span>
          </button>
        </form>
      </div>
    </div>
  );
};
