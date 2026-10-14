import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FolderHeart,
  Scale,
  Copy,
  Check,
  Receipt,
  FileText,
  ArrowRight,
  ExternalLink,
  Coins,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Award,
  Wallet,
  TrendingUp,
  Tag,
  HandCoins,
  HeartHandshake,
} from 'lucide-react';
import { formatCurrency } from '../../utils/numbering';

export interface StructuredCardData {
  type: 'member_detail' | 'case_list' | 'case_detail' | 'custodian_balances' | 'ledger_audit' | 'balance_sheet';
  data?: any;
}

interface AIChatMessageRendererProps {
  content: string;
  sender: 'user' | 'noor';
  timestamp?: string;
  structuredData?: StructuredCardData;
  currency?: string;
  onOpenMemberLedger?: (memberId: string) => void;
  onOpenCaseLedger?: (caseId: string) => void;
  onIssueReceipt?: (memberId?: string, caseId?: string) => void;
  onIssueReliefVoucher?: (caseId?: string) => void;
  onInitiateHandover?: () => void;
  onRunAutoFix?: () => void;
  onNavigateTab?: (tab: string, recordId?: string) => void;
}

export const AIChatMessageRenderer: React.FC<AIChatMessageRendererProps> = ({
  content,
  sender,
  timestamp,
  structuredData,
  currency = 'AED',
  onOpenMemberLedger,
  onOpenCaseLedger,
  onIssueReceipt,
  onIssueReliefVoucher,
  onInitiateHandover,
  onRunAutoFix,
  onNavigateTab,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper to parse tables in markdown if detected
  const parsedTables = useMemo(() => {
    // Check if content has markdown tables: lines starting with |
    const lines = content.split('\n');
    const tableBlocks: Array<{ start: number; end: number; headers: string[]; rows: string[][] }> = [];
    let currentTable: { start: number; headers: string[]; rows: string[][] } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Check if it's a separator line e.g. | :--- | :--- |
        const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

        if (!currentTable) {
          currentTable = { start: index, headers: cells, rows: [] };
        } else if (isSeparator) {
          // ignore separator line
        } else {
          currentTable.rows.push(cells);
        }
      } else {
        if (currentTable) {
          tableBlocks.push({ ...currentTable, end: index - 1 });
          currentTable = null;
        }
      }
    });

    if (currentTable) {
      tableBlocks.push({ ...currentTable, end: lines.length - 1 });
    }

    return tableBlocks;
  }, [content]);

  // Detect Member Profile Pattern
  const memberProfileCard = useMemo(() => {
    if (structuredData?.type === 'member_detail' && structuredData.data) {
      return structuredData.data;
    }

    if (content.includes('Member Profile:') || content.includes('**Member ID**')) {
      const nameMatch = content.match(/Member Profile:\s*([^\n\r#]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'Tariq Mansoor';

      const idMatch = content.match(/Member ID\W+`?([A-Z0-9-]+)`?/i);
      const memberNumber = idMatch ? idMatch[1] : 'MEM-0001';

      const phoneMatch = content.match(/Mobile Phone\W+([^\n\r|]+)/i);
      const phone = phoneMatch ? phoneMatch[1].trim() : '+971 50 123 4567';

      const pledgeMatch = content.match(/Monthly Pledge\W+([^\n\r|/]+)/i);
      const pledge = pledgeMatch ? pledgeMatch[1].trim() : 'AED 500.00';

      const lifetimeMatch = content.match(/Lifetime Contributions\W+\*\*([^*]+)\*\*/i);
      const lifetime = lifetimeMatch ? lifetimeMatch[1].trim() : 'AED 0.00';

      const arrearsMatch = content.match(/Outstanding Arrears\W+([^\n\r|]+)/i);
      const arrearsText = arrearsMatch ? arrearsMatch[1].replace(/[*_]/g, '').trim() : '';

      const isUpToDate = arrearsText.toLowerCase().includes('up-to-date') || arrearsText.includes('0.00');

      // Month dues status matrix
      const duesMatch = content.match(/Monthly Dues Status\W+Paid:\s*\*?([^\n\r|*]+)\*?/i);
      const paidStr = duesMatch ? duesMatch[1].trim() : '';

      return {
        fullName: name,
        memberNumber,
        phone,
        pledge,
        lifetime,
        arrearsText: arrearsText || (isUpToDate ? '0.00 AED (Fully Up-To-Date)' : '5,000.00 AED (Overdue)'),
        isUpToDate,
        paidSummary: paidStr,
      };
    }
    return null;
  }, [content, structuredData]);

  // Detect Active Charity Cases Pattern
  const charityCasesCard = useMemo(() => {
    if (structuredData?.type === 'case_list' && structuredData.data) {
      return structuredData.data;
    }

    if (
      content.includes('Active Charity Cases') ||
      (content.includes('Case ID') && content.includes('Beneficiary') && content.includes('Goal'))
    ) {
      // Extract rows from table
      const caseRows: Array<{
        code: string;
        title: string;
        beneficiary: string;
        goal: string;
        collected: string;
        disbursed: string;
        remaining: string;
        category: string;
      }> = [];

      const lines = content.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.includes('`CASE-')) {
          const cells = trimmed
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim().replace(/[*_`]/g, ''));

          if (cells.length >= 4) {
            const code = cells[0];
            const titleFull = cells[1] || '';
            const beneficiaryMatch = titleFull.match(/\(([^)]+)\)/);
            const beneficiary = beneficiaryMatch ? beneficiaryMatch[1] : 'Beneficiary';
            const title = titleFull.replace(/\([^)]+\)/, '').trim();

            const goal = cells[2] || '0';
            const collected = cells[3] || '0';
            const disbursed = cells[4] || '0';
            const remaining = cells[5] || '0';

            let category = 'Medical & Relief';
            if (title.toLowerCase().includes('roof') || title.toLowerCase().includes('house')) category = 'Shelter';
            else if (title.toLowerCase().includes('dialysis') || title.toLowerCase().includes('cancer') || title.toLowerCase().includes('surgery')) category = 'Medical Aid';
            else if (title.toLowerCase().includes('education') || title.toLowerCase().includes('school')) category = 'Education';

            caseRows.push({
              code,
              title: title || 'Charity Assistance Case',
              beneficiary,
              goal,
              collected,
              disbursed,
              remaining,
              category,
            });
          }
        }
      });

      if (caseRows.length > 0) {
        return caseRows;
      }
    }
    return null;
  }, [content, structuredData]);

  // Detect Custodian Cash Float Pattern
  const custodianFloatCard = useMemo(() => {
    if (structuredData?.type === 'custodian_balances' && structuredData.data) {
      return structuredData.data;
    }

    if (content.includes('Custodian Cash Float') || (content.includes('Custodian Name') && content.includes('Balance (AED)'))) {
      const custodians: Array<{
        name: string;
        memberNumber: string;
        aed: string;
        inr: string;
        verified: boolean;
      }> = [];

      const lines = content.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && (trimmed.includes('MEM-') || trimmed.includes('AED') || trimmed.includes('₹'))) {
          const cells = trimmed
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim().replace(/[*_`]/g, ''));

          if (cells.length >= 3 && !cells[0].toLowerCase().includes('custodian name') && !cells[0].includes('---')) {
            custodians.push({
              name: cells[0],
              memberNumber: cells[1] || 'MEM-0001',
              aed: cells[2] || '0.00 AED',
              inr: cells[3] && cells[3] !== '—' ? cells[3] : '',
              verified: (cells[4] || '').toLowerCase().includes('verified') || (cells[4] || '').toLowerCase().includes('reconciled'),
            });
          }
        }
      });

      if (custodians.length > 0) {
        return custodians;
      }
    }
    return null;
  }, [content, structuredData]);

  // Detect Ledger Audit & Balance Sheet Summary Pattern
  const ledgerAuditCard = useMemo(() => {
    if (structuredData?.type === 'ledger_audit' && structuredData.data) {
      return structuredData.data;
    }

    if (
      content.includes('Double-Entry Ledger Audit') ||
      content.includes('Double-Entry Invariant') ||
      content.includes('Σ Dr == Σ Cr')
    ) {
      const drMatch = content.match(/Total Debits[^\n\r|]*\|\s*([^\n\r|]+)/i);
      const crMatch = content.match(/Total Credits[^\n\r|]*\|\s*([^\n\r|]+)/i);
      const diffMatch = content.match(/Difference \/ Variance[^\n\r|]*\|\s*([^\n\r|]+)/i);
      const countMatch = content.match(/Total Journal Records[^\n\r|]*\|\s*([^\n\r|]+)/i);
      const issuesMatch = content.match(/Diagnostic Anomalies Found[^\n\r|]*\|\s*([^\n\r|]+)/i);

      const debits = drMatch ? drMatch[1].replace(/[*_]/g, '').trim() : 'AED 80.00';
      const credits = crMatch ? crMatch[1].replace(/[*_]/g, '').trim() : 'AED 80.00';
      const diff = diffMatch ? diffMatch[1].replace(/[*_]/g, '').trim() : '0.00 AED';
      const count = countMatch ? countMatch[1].replace(/[*_]/g, '').trim() : '12';
      const issues = issuesMatch ? issuesMatch[1].replace(/[*_]/g, '').trim() : '0 issue(s)';

      const isBalanced =
        content.includes('Balanced & Equal') ||
        content.includes('100% balanced') ||
        diff.startsWith('0') ||
        diff.includes('0.00');

      return {
        debits,
        credits,
        diff,
        count,
        issues,
        isBalanced,
      };
    }
    return null;
  }, [content, structuredData]);

  // Standard user message styling
  if (sender === 'user') {
    return <div className="text-white text-sm leading-relaxed">{content}</div>;
  }

  // Pre-calculate months for Member Dues Matrix (Jan-Dec 2026)
  const monthsGrid = [
    { name: 'Jan', key: '2026-01' },
    { name: 'Feb', key: '2026-02' },
    { name: 'Mar', key: '2026-03' },
    { name: 'Apr', key: '2026-04' },
    { name: 'May', key: '2026-05' },
    { name: 'Jun', key: '2026-06' },
    { name: 'Jul', key: '2026-07' },
    { name: 'Aug', key: '2026-08' },
    { name: 'Sep', key: '2026-09' },
    { name: 'Oct', key: '2026-10' },
    { name: 'Nov', key: '2026-11' },
    { name: 'Dec', key: '2026-12' },
  ];

  return (
    <div className="space-y-3.5 text-slate-200">
      {/* 1. RICH CARD: Member Detail Card */}
      {memberProfileCard && (
        <div className="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-xl transition-all relative overflow-hidden group">
          {/* Subtle gradient glow backdrop */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header Row: Avatar, Member Info, Copy Button */}
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-950/40 shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-emerald-300 font-bold font-display text-sm">
                  {memberProfileCard.fullName.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold font-display text-white text-base">
                    {memberProfileCard.fullName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    {memberProfileCard.memberNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active Member
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {memberProfileCard.phone}
                  </span>
                  <span>•</span>
                  <span>Pledge: <strong className="text-slate-200">{memberProfileCard.pledge}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Copy Action */}
            <button
              type="button"
              onClick={() => handleCopy(memberProfileCard.memberNumber, 'member-id')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Member ID"
            >
              {copiedKey === 'member-id' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Financial Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3.5">
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Lifetime Given
              </span>
              <span className="text-sm font-bold text-emerald-300 font-mono mt-0.5 block">
                {memberProfileCard.lifetime}
              </span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Outstanding Arrears
              </span>
              <span
                className={`text-sm font-bold font-mono mt-0.5 block ${
                  memberProfileCard.isUpToDate ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {memberProfileCard.arrearsText}
              </span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Dues Compliance
              </span>
              <span className="text-xs font-semibold text-slate-300 mt-1 block">
                {memberProfileCard.isUpToDate ? '🟢 Current Month Paid' : '⚠️ Pending Settlement'}
              </span>
            </div>
          </div>

          {/* Dues Matrix Mini-Grid (2026 Fiscal Calendar) */}
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 mb-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                2026 Contribution Dues Matrix:
              </span>
              <span className="text-[11px] text-slate-400">
                {memberProfileCard.isUpToDate ? 'All verified' : 'Requires collection'}
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {monthsGrid.map((m, idx) => {
                // If member paid summary includes this month or if up-to-date
                const isPaid = memberProfileCard.isUpToDate
                  ? idx <= 9
                  : memberProfileCard.paidSummary?.includes(m.key);
                return (
                  <div
                    key={m.key}
                    className={`flex flex-col items-center justify-center p-1 rounded-lg border text-[10px] font-mono transition-all ${
                      isPaid
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    <span className="font-bold">{m.name}</span>
                    <span className="text-[8px] mt-0.5">{isPaid ? '✓' : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => {
                if (onIssueReceipt) onIssueReceipt(memberProfileCard.memberNumber);
                else if (onNavigateTab) onNavigateTab('receipts', memberProfileCard.memberNumber);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Issue Contribution Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenMemberLedger) onOpenMemberLedger(memberProfileCard.memberNumber);
                else if (onNavigateTab) onNavigateTab('members', memberProfileCard.memberNumber);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>View Member Ledger</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. RICH CARD: Active Charity Cases Stack */}
      {charityCasesCard && charityCasesCard.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-300 flex items-center gap-2">
              <FolderHeart className="w-4 h-4 text-emerald-400" />
              <span>Active Beneficiary Relief Cases ({charityCasesCard.length})</span>
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
              GL 2100 Segregated
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {charityCasesCard.map((item, idx) => {
              const goalNum = parseFloat(item.goal.replace(/[^0-9.]/g, '')) || 1;
              const collectedNum = parseFloat(item.collected.replace(/[^0-9.]/g, '')) || 0;
              const progressPct = Math.min(100, Math.round((collectedNum / goalNum) * 100));

              return (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 shadow-xl transition-all group"
                >
                  {/* Top Row: Case Code tag, Category Badge, Status Pill */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-800 text-emerald-300 border border-slate-700 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-emerald-400" />
                        {item.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-950/50 text-teal-300 border border-teal-800/40">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-700/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active Relief
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.code, `case-${idx}`)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy Case ID"
                      >
                        {copiedKey === `case-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Middle Row: Case Title + Beneficiary */}
                  <div className="my-3">
                    <h4 className="font-bold font-display text-white text-sm group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Beneficiary: <strong className="text-slate-200">{item.beneficiary}</strong></span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1.5 my-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/70">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">
                        Collected: <strong className="text-emerald-300">{currency} {item.collected}</strong>
                      </span>
                      <span className="text-slate-400">
                        Target: <strong className="text-white">{currency} {item.goal}</strong>
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{progressPct}% funded</span>
                      <span>Remaining: <strong className="text-amber-400">{currency} {item.remaining}</strong></span>
                    </div>
                  </div>

                  {/* Bottom Row: Quick Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCaseLedger) onOpenCaseLedger(item.code);
                        else if (onNavigateTab) onNavigateTab('cases', item.code);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FolderHeart className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open Case Ledger</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onIssueReliefVoucher) onIssueReliefVoucher(item.code);
                        else if (onNavigateTab) onNavigateTab('payments');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      <span>Issue Relief Voucher</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. RICH CARD: Custodian Cash Float Cards */}
      {custodianFloatCard && custodianFloatCard.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-slate-300 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>Physical Cash Custodians &amp; Trust Safes</span>
            </span>
            <span className="text-[11px] text-slate-400">Double-Entry Custody (GL 1010)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {custodianFloatCard.map((cust, idx) => (
              <div
                key={idx}
                className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-xs border border-slate-700">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm">{cust.name}</h4>
                      <span className="text-[10px] font-mono text-slate-400">{cust.memberNumber}</span>
                    </div>
                  </div>

                  {/* Discrepancy indicator */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                      cust.verified
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                    }`}
                  >
                    {cust.verified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>Audit Pending</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Balances Pill Tags */}
                <div className="flex items-center gap-2 flex-wrap bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 font-mono font-bold text-xs">
                    {cust.aed}
                  </span>
                  {cust.inr && (
                    <span className="px-2.5 py-1 rounded-lg bg-teal-950/60 text-teal-300 border border-teal-700/50 font-mono font-bold text-xs">
                      {cust.inr}
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onInitiateHandover) onInitiateHandover();
                    else if (onNavigateTab) onNavigateTab('transactions');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 hover:border-emerald-500 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Initiate Peer Handover</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. RICH CARD: Ledger Audit & Balance Sheet Visual Summary */}
      {ledgerAuditCard && (
        <div className="bg-slate-900/95 border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold font-display text-white text-sm sm:text-base">
                  Double-Entry Ledger Invariant Check
                </h3>
                <p className="text-xs text-slate-400">Autonomous Islamic Audit &amp; Balance Verification</p>
              </div>
            </div>

            {/* Status Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                ledgerAuditCard.isBalanced
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-emerald-950/50'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-rose-950/50'
              }`}
            >
              {ledgerAuditCard.isBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>✓ 100% Balanced</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                  <span>⚠️ Out of Balance</span>
                </>
              )}
            </span>
          </div>

          {/* Visual Balance Scale Card */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Debits (Σ Dr)
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-300">
                {ledgerAuditCard.debits}
              </div>
            </div>

            <div className="space-y-1 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Credits (Σ Cr)
              </span>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-300">
                {ledgerAuditCard.credits}
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Mathematical Invariant: <strong>Σ Dr == Σ Cr</strong></span>
              <span>Variance: <strong className={ledgerAuditCard.isBalanced ? 'text-emerald-400' : 'text-rose-400'}>{ledgerAuditCard.diff}</strong></span>
            </div>
          </div>

          {/* Metrics & Auto-Fix Action */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Journals: <strong className="text-slate-200">{ledgerAuditCard.count}</strong></span>
              <span>•</span>
              <span>Anomalies: <strong className={ledgerAuditCard.isBalanced ? 'text-emerald-400' : 'text-amber-400'}>{ledgerAuditCard.issues}</strong></span>
            </div>

            {!ledgerAuditCard.isBalanced && (
              <button
                type="button"
                onClick={onRunAutoFix}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Run 1-Click Auto-Fix</span>
              </button>
            )}

            {ledgerAuditCard.isBalanced && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('balance-sheet')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>View Balance Sheet</span>
                <ExternalLink className="w-3 h-3 text-emerald-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. GENERAL MARKDOWN RENDERING FOR TEXT & NON-CARD RESPONSES */}
      {/* If this was a custom card, only render any remaining text notes outside the table */}
      <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-white prose-p:leading-relaxed prose-code:font-mono prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-300">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Clean table fallback in case a standard markdown table is present
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 shadow-md">
                <table className="w-full text-left text-xs text-slate-200 divide-y divide-slate-700/80">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-slate-800/95 font-semibold text-emerald-300 uppercase tracking-wider text-[11px]">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr className="hover:bg-slate-800/50 transition-colors">{children}</tr>
            ),
            th: ({ children }) => <th className="px-3 py-2.5 font-bold">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 text-slate-300">{children}</td>,
            p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-200">{children}</p>,
            h3: ({ children }) => (
              <h3 className="text-base font-bold text-white mt-3 mb-1.5 flex items-center gap-2">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-sm font-bold text-emerald-300 mt-2.5 mb-1">{children}</h4>
            ),
            ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 text-slate-300 my-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 text-slate-300 my-2">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            code: ({ children }) => (
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-xs border border-slate-700/60">
                {children}
              </code>
            ),
          }}
        >
          {/* If we already rendered a dedicated rich card, suppress the raw table block so it doesn't double print */}
          {memberProfileCard || charityCasesCard || custodianFloatCard || ledgerAuditCard
            ? content
                .split('\n')
                .filter((line) => {
                  const t = line.trim();
                  // Filter out raw table lines since the card renders them natively
                  return !t.startsWith('|');
                })
                .join('\n')
                .replace(/###\s*[👤📋💼🔍📊].*?\n/g, '') // remove redundant duplicate titles
                .trim()
            : content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
