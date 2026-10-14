import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Wrench,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  DollarSign,
  HelpCircle,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  CornerDownLeft,
  Mic,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { FinancialEngineService } from '../../services/financialEngineService';
import { formatCurrency } from '../../utils/numbering';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  actionTriggered?: 'scan' | 'repair' | 'navigation';
  metadata?: {
    isSuccess?: boolean;
    quickStats?: {
      totalIssues?: number;
      isBalanced?: boolean;
      totalDebits?: number;
      totalCredits?: number;
    };
  };
}

interface AccountingAICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const AccountingAICopilotModal: React.FC<AccountingAICopilotModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
}) => {
  const {
    journalEntries,
    accounts,
    custodians,
    charityCases,
    members,
    receipts,
    payments,
    settings,
    latestScanReport,
    runAiHealthScan,
    runAiHealthRepair,
  } = useCharity();

  const { user, canRunAiReconcile, isAdmin, isStaff } = useAuth();
  const { navigateToTab } = useNavigation();

  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Financial Engine calculations for live context
  const engine = FinancialEngineService.getInstance();
  const balanceCheck = engine.validateBalance(journalEntries);
  const totalIssues =
    (latestScanReport?.totalIssues ?? 0) +
    (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `👋 Greetings ${user?.name ? user.name.split(' ')[0] : 'Colleague'}! I am your **Autonomous Financial Copilot & Ledger Auditor**. 

I have live reactive access to your double-entry journals, custodian float accounts, charity allocations, and double-entry rules.

Ask me about discrepancies, step-by-step transaction instructions, or instruct me to run instant integrity repairs.`,
    },
  ]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (initialQuery && initialQuery.trim()) {
        handleUserSend(initialQuery.trim());
      }
    }
  }, [isOpen]);

  const quickActionChips = [
    { label: '🔍 Audit all ledgers now', query: 'Audit all ledgers now and report any discrepancies' },
    { label: '💡 How to record a peer cash handover?', query: 'How do I record a peer cash handover between custodians?' },
    { label: '📊 Explain my current Balance Sheet', query: 'Explain my current balance sheet and verify debits vs credits' },
    { label: '🛠️ Fix any active discrepancy', query: 'Run AI integrity repair and reconcile all accounts' },
    { label: '❓ How to record a 100 AED donation?', query: 'How do I record a 100 AED donation for a charity case?' },
  ];

  /**
   * Domain-Specific Accounting AI Response Generator
   * Uses real reactive state from CharityContext and FinancialEngineService
   */
  const processQueryWithAccountingEngine = async (query: string): Promise<{ text: string; action?: 'scan' | 'repair' | 'navigation' }> => {
    const q = query.toLowerCase().trim();

    // 1. RECONCILE / AUTO-FIX COMMAND
    if (
      q.includes('reconcile') ||
      q.includes('auto-fix') ||
      q.includes('autofix') ||
      q.includes('fix any active') ||
      q.includes('repair') ||
      q.includes('solve discrepancy')
    ) {
      if (!canRunAiReconcile) {
        return {
          text: `⚠️ **Permission Notice**: Only Administrators have permission to execute automatic double-entry journal repairs. You are currently logged in as **${user?.role?.toUpperCase()}** (${user?.name}).\n\nPlease switch to the **Admin** account (admin@charityledger.org) in the top-right profile switcher to execute atomic repairs.`,
        };
      }

      try {
        const scan = latestScanReport || runAiHealthScan();
        const repairResult = await runAiHealthRepair(scan);
        const postScan = runAiHealthScan();
        const postBalance = engine.validateBalance(journalEntries);

        return {
          action: 'repair',
          text: `✅ **Automated AI Reconcile Completed Successfully!**

- **Repairs Applied**: ${repairResult.repairedCount} discrepancy adjustments
- **Journal Self-Healing Entries**: ${repairResult.correctionsCreated} balanced entries generated
- **Current Balance**: ${postBalance.isBalanced ? '🟢 Perfect Double-Entry Match (Σ Dr == Σ Cr)' : '⚠️ Warning: Imbalance remains'}
- **Active Issues Remaining**: ${postScan.totalIssues}

All balances across Cash Custodians, General Ledgers, and Case allocations have been updated live across all connected devices.`,
        };
      } catch (err) {
        return {
          text: `❌ Error executing automatic repair: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // 2. AUDIT / INTEGRITY SCAN COMMAND
    if (
      q.includes('audit') ||
      q.includes('scan') ||
      q.includes('verify') ||
      q.includes('check health') ||
      q.includes('integrity') ||
      q.includes('health')
    ) {
      const freshScan = runAiHealthScan();
      const liveBal = engine.validateBalance(journalEntries);
      const totalDr = journalEntries.reduce((s, e) => s + (e.debit || 0), 0);
      const totalCr = journalEntries.reduce((s, e) => s + (e.credit || 0), 0);

      const statusIcon = liveBal.isBalanced && freshScan.totalIssues === 0 ? '🟢' : '⚠️';

      let details = `${statusIcon} **Real-Time Ledger Audit Report**:

- **Double-Entry Status**: ${liveBal.isBalanced ? 'Balanced & Mathematical Equality verified' : 'Imbalance Detected'}
- **Total Debits (Σ Dr)**: ${formatCurrency(totalDr, settings.currency)}
- **Total Credits (Σ Cr)**: ${formatCurrency(totalCr, settings.currency)}
- **Imbalance Delta**: ${formatCurrency(Math.abs(totalDr - totalCr), settings.currency)}
- **Diagnostic Anomalies Found**: ${freshScan.totalIssues}
- **Total Journal Entries**: ${journalEntries.length}`;

      if (freshScan.issues.length > 0) {
        details += `\n\n**Detected Discrepancies**:`;
        freshScan.issues.slice(0, 4).forEach((issue, idx) => {
          details += `\n${idx + 1}. **[${issue.category}]**: ${issue.description} *(Severity: ${issue.severity})*`;
        });
        if (freshScan.issues.length > 4) {
          details += `\n*...and ${freshScan.issues.length - 4} more. Click "System Diagnostics" in the drawer to view all.*`;
        }
        details += `\n\n👉 *You can type \`"Fix discrepancies now"\` to trigger autonomous self-healing.*`;
      } else {
        details += `\n\n🎉 **All ledgers are in pristine health!** Zero ghost transactions, all custodian floats match their journal history, and multi-currency conversions are intact.`;
      }

      return { text: details, action: 'scan' };
    }

    // 3. EXPLAIN BALANCE SHEET / CURRENT BALANCES
    if (
      q.includes('balance sheet') ||
      q.includes('balanced') ||
      q.includes('debit') ||
      q.includes('credit') ||
      q.includes('current balance')
    ) {
      const totalDr = journalEntries.reduce((s, e) => s + (e.debit || 0), 0);
      const totalCr = journalEntries.reduce((s, e) => s + (e.credit || 0), 0);
      const isBal = Math.abs(totalDr - totalCr) < 0.01;

      let msg = `📊 **Balance Sheet & Double-Entry Integrity Breakdown**:

- **Total Assets & Expenses (Debit Side)**: ${formatCurrency(totalDr, settings.currency)}
- **Total Liabilities & Equity/Income (Credit Side)**: ${formatCurrency(totalCr, settings.currency)}
- **Equation**: Assets = Liabilities + Equity
- **Validation**: ${isBal ? '✅ Σ Debits = Σ Credits exactly match.' : '⚠️ Mathematical difference of ' + formatCurrency(Math.abs(totalDr - totalCr), settings.currency)}

**Active Custodian Floats**:`;

      custodians.forEach((c) => {
        msg += `\n- **${c.name}**: ${formatCurrency(c.balance, settings.currency)}`;
      });

      msg += `\n\nAll transactions are immutable and logged with chronological sequence numbers to maintain a verifiable audit trail.`;
      return { text: msg };
    }

    // 4. WHY IS CUSTODY BALANCE SHOWING X INSTEAD OF Y?
    if (
      q.includes('custody') ||
      q.includes('custodian') ||
      q.includes('showing') ||
      q.includes('why is') ||
      q.includes('tariq') ||
      q.includes('rasheed')
    ) {
      let custReport = `💼 **Custodian Cash Float Analysis**:

Each Custodian operates a physical cash holding account governed by strict double-entry vouchers:
1. **Receipt Issued (Cash Collected)**: 
   - Dr \`1010 - Custodian Cash Float\` (+ increases cash held)
   - Cr \`4010 - Charity Contributions\`
2. **Peer Custody Handover**:
   - Dr \`1010 - Receiving Custodian\`
   - Cr \`1010 - Transferring Custodian\`
3. **Disbursement to Beneficiary**:
   - Dr \`5010 - Charity Case Relief Expense\`
   - Cr \`1010 - Custodian Cash Float\` (- decreases cash held)

**Current Real-Time Balances**:`;

      custodians.forEach((c) => {
        custReport += `\n• **${c.name}**: ${formatCurrency(c.balance, settings.currency)}`;
      });

      custReport += `\n\nIf a custodian's balance differs from physical cash counted, check for pending transfers that haven't been accepted yet, or click **"Scan with AI"** to see if an unallocated entry exists.`;
      return { text: custReport };
    }

    // 5. STEP-BY-STEP GUIDANCE: DONATION / RECEIPT
    if (
      q.includes('how do i record') ||
      q.includes('donation') ||
      q.includes('receipt') ||
      q.includes('heart surgery') ||
      q.includes('member due')
    ) {
      return {
        text: `📝 **Step-by-Step: Recording a Contribution Receipt**

To record a donation (e.g. 100 AED for a specific Charity Case or General Dues):

1. **Open New Receipt Dialog**:
   - Click the green **"+ New Receipt"** button in the top navigation bar or press keyboard shortcut **[N]**.
2. **Select Contributor**:
   - Choose the Member/Donor from the dropdown, or enter a Walk-in Donor name.
3. **Assign Charity Fund / Case**:
   - Select the target initiative (e.g. *"Medical Emergency - Heart Surgery"* or *"Monthly Member Dues"*).
4. **Select Custodian / Payment Method**:
   - Pick the Staff Custodian who received physical cash (e.g. *Tariq Mahmood*), or select *Direct Bank Transfer*.
5. **Enter Amount & Currency**:
   - Enter amount in AED (system automatically supports INR conversions if configured).
6. **Save & Print**:
   - Click **"Generate Receipt & Post Entry"**. 

**Double-Entry Impact**:
- **Debit (+)**: \`1010 - Cash with Custodian [Name]\`
- **Credit (+)**: \`4010 - Donor Contributions [Case Name]\`

The receipt is assigned an auto-incrementing serial number (e.g. \`RCPT-2026-00042\`) and synced live to all devices.`,
      };
    }

    // 6. STEP-BY-STEP GUIDANCE: PEER CASH HANDOVER
    if (
      q.includes('handover') ||
      q.includes('transfer cash') ||
      q.includes('custodian to custodian') ||
      q.includes('peer')
    ) {
      return {
        text: `🤝 **Step-by-Step: Recording a Peer Cash Handover**

When one custodian hands over physical charity funds to another:

1. **Navigate to Custodians View**:
   - In the sidebar, select **"Cash & Bank"** or **"Custodians"**.
2. **Click "Transfer Float" / "Peer Handover"**:
   - Click the **"New Handover"** button at the top of the Custodian register.
3. **Specify Transferring & Receiving Parties**:
   - **From**: The custodian surrendering cash (e.g. *Tariq Mahmood*).
   - **To**: The custodian taking custody (e.g. *Abdul Rasheed*).
4. **Enter Amount & Verification Note**:
   - Enter the exact AED cash handed over and specify handoff location or receipt reference.
5. **Confirm Transfer**:
   - Both custodians receive immediate notifications and their balances update in real-time.

**Double-Entry Impact**:
- **Debit (+)**: \`1010 - Cash with Abdul Rasheed\`
- **Credit (-)**: \`1010 - Cash with Tariq Mahmood\`

Net Organization Cash remains exactly unchanged; liability shifts atomically between custodians.`,
      };
    }

    // 7. KEYBOARD SHORTCUTS & SYSTEM HELP
    if (q.includes('shortcut') || q.includes('keyboard') || q.includes('hotkey')) {
      return {
        text: `⌨️ **Productivity Keyboard Shortcuts**:

- **[?]** or **[Shift + /]**: Open Universal Keyboard Shortcuts Cheat Sheet
- **[/]**: Global Spotlight Search across receipts, members, and cases
- **[N]**: Open New Receipt Creation Modal
- **[P]**: Open New Payment / Disbursement Modal
- **[D]**: Toggle System Diagnostics & AI Reconcile Drawer
- **[Esc]**: Close any open drawer, modal, or copilot window

You can press **[?]** anytime to view the complete list!`,
      };
    }

    // 8. MULTI-CURRENCY CONVERSION (AED / INR)
    if (q.includes('aed') || q.includes('inr') || q.includes('currency') || q.includes('conversion') || q.includes('rate')) {
      return {
        text: `💱 **Multi-Currency Accounting (AED & INR)**:

The system natively maintains primary accounting in **AED (UAE Dirham)** with real-time conversion into **INR (Indian Rupee)** for overseas cross-border beneficiaries:
- **Base Currency**: AED
- **Configured Exchange Rate**: 1 AED ≈ 22.80 INR (customizable in *Settings*)
- **Auto-Calculated Receipts**: Whenever you enter an AED donation, the printable receipt displays both AED and the equivalent INR amount.
- **Foreign Exchange Variance**: Any rate fluctuation upon final bank wire transfer is automatically posted to \`5090 - Forex Gain / Loss\` so your primary ledger never falls out of balance.`,
      };
    }

    // 9. DEFAULT SMART RESPONSE
    return {
      text: `🤖 I analyzed your question regarding **"${query}"** in the context of the active charity ledger.

Here is what you can do:
1. **Examine Live Health**: We currently have **${totalIssues} active discrepancies** and our double-entry is **${balanceCheck.isBalanced ? 'Balanced' : 'Imbalanced'}**.
2. **Execute Reconcile**: Type \`"Reconcile now"\` or click the auto-fix chip below.
3. **Transaction Help**: Ask me specifically how to record receipts, member dues, expenses, or peer handovers.
4. **Navigation**: Ask me to take you to *"Balance Sheet"*, *"Monthly Status"*, or *"Audit Logs"*.

Feel free to ask any specific accounting question!`,
    };
  };

  const handleUserSend = async (userText: string) => {
    if (!userText.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      // Small realistic processing latency
      await new Promise((resolve) => setTimeout(resolve, 350));
      const response = await processQueryWithAccountingEngine(userText);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: response.text,
        actionTriggered: response.action,
        metadata: {
          isSuccess: true,
          quickStats: {
            totalIssues,
            isBalanced: balanceCheck.isBalanced,
          },
        },
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚠️ An error occurred while processing your request: ${e instanceof Error ? e.message : String(e)}`,
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

  if (!isOpen) return null;

  return (
    <div
      id="ai-copilot-modal-container"
      className="fixed inset-0 z-50 flex items-center justify-end p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Copilot Card Panel */}
      <div
        className={`relative w-full ${
          isExpanded ? 'max-w-3xl h-[92vh]' : 'max-w-xl h-[85vh]'
        } bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-300 z-10`}
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 border border-emerald-400/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base tracking-tight">AI Accounting Copilot</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Ledger State
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Self-Governing Financial Auditor & Accounting Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Health pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mr-2 border ${
                balanceCheck.isBalanced
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
                  : 'bg-rose-950/60 text-rose-300 border-rose-600/40'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{balanceCheck.isBalanced ? 'Balanced' : 'Imbalanced'}</span>
            </div>

            {/* Expand / Minimize */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title={isExpanded ? 'Restore default size' : 'Expand full panel'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Close Copilot"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time metrics ribbon */}
        <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Active User:{' '}
              <strong className="text-slate-200">
                {user?.name || 'Admin'} ({user?.role?.toUpperCase() || 'ADMIN'})
              </strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Total Issues:{' '}
              <strong className={totalIssues === 0 ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                {totalIssues}
              </strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Journals: <strong className="text-slate-200">{journalEntries.length} entries</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleUserSend('Audit all ledgers now and report any discrepancies')}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Re-scan
          </button>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              } animate-in fade-in duration-200`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-xs font-medium'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-xs whitespace-pre-line'
                }`}
              >
                {/* Text Formatting with basic bold parsing */}
                <div>{msg.text}</div>

                <div
                  className={`text-[10px] mt-2 font-mono flex items-center justify-end gap-1 ${
                    msg.sender === 'user' ? 'text-emerald-200/80' : 'text-slate-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'assistant' && msg.actionTriggered && (
                    <span className="ml-2 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-sans font-semibold">
                      Action executed: {msg.actionTriggered.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 shadow-sm mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/40 flex items-center justify-center text-emerald-300 shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl rounded-tl-xs px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Auditing ledger state and preparing guidance...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Chips */}
        <div className="px-5 pt-2 pb-1 bg-slate-950/60 border-t border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Suggested:
            </span>
            {quickActionChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleUserSend(chip.query)}
                disabled={isProcessing}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 text-xs shrink-0 whitespace-nowrap transition-all cursor-pointer disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
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
              placeholder="Ask anything or type 'Reconcile ledgers'..."
              disabled={isProcessing}
              className="w-full pl-4 pr-10 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all disabled:opacity-50"
            />
            {/* Voice microphone placeholder icon */}
            <button
              type="button"
              title="Voice input (dictation mode placeholder)"
              onClick={() => {
                setInputMessage('Audit all ledgers now');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors p-1 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim() || isProcessing}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
