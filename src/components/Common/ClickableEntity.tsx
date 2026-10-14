import React from 'react';
import { User, HeartHandshake, FileText, Wallet, ExternalLink, FileEdit } from 'lucide-react';
import { useNavigation, BreadcrumbItem, MemberLedgerFocusTab } from '../../context/NavigationContext';
import { formatCurrency } from '../../utils/numbering';

interface MemberLinkProps {
  memberId?: string;
  memberName?: string;
  memberNumber?: string;
  className?: string;
  showIcon?: boolean;
  showMemberNumber?: boolean;
  focusTab?: MemberLedgerFocusTab;
  originBreadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export const MemberLink: React.FC<MemberLinkProps> = ({
  memberId,
  memberName,
  memberNumber,
  className = '',
  showIcon = false,
  showMemberNumber = false,
  focusTab = 'ledger',
  originBreadcrumb,
  children,
}) => {
  const { openMemberLedger, openCustodianLedger } = useNavigation();

  if (!memberId) {
    return <span className={className}>{children || memberName || '—'}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const resolvedName = memberName || (typeof children === 'string' ? children : undefined);
    if (focusTab === 'cash') {
      openCustodianLedger(memberId, {
        originBreadcrumb,
        memberName: resolvedName,
      });
    } else {
      openMemberLedger(memberId, {
        focusTab: focusTab as MemberLedgerFocusTab,
        originBreadcrumb,
        memberName: resolvedName,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Open financial ledger for ${memberName || memberNumber || 'Member'}`}
      className={`inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-emerald-700 hover:underline transition-colors text-left group cursor-pointer ${className}`}
    >
      {showIcon && <User className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />}
      <span>{children || memberName || memberNumber || 'View Member'}</span>
      {showMemberNumber && memberNumber && (
        <span className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-600">
          ({memberNumber})
        </span>
      )}
    </button>
  );
};

interface CaseLinkProps {
  caseId?: string;
  caseTitle?: string;
  caseName?: string;
  caseNumber?: string;
  className?: string;
  showIcon?: boolean;
  showCaseNumber?: boolean;
  originBreadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export const CaseLink: React.FC<CaseLinkProps> = ({
  caseId,
  caseTitle,
  caseName,
  caseNumber,
  className = '',
  showIcon = false,
  showCaseNumber = false,
  originBreadcrumb,
  children,
}) => {
  const { openCaseLedger } = useNavigation();

  const titleText = children || caseTitle || caseName || caseNumber || '—';

  if (!caseId) {
    return <span className={className}>{titleText}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const resolvedTitle = caseTitle || caseName || (typeof children === 'string' ? children : undefined);
    openCaseLedger(caseId, {
      originBreadcrumb,
      caseTitle: resolvedTitle,
      caseNumber,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Open charity case ledger for ${caseTitle || caseName || caseNumber || 'Case'}`}
      className={`inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-purple-700 hover:underline transition-colors text-left group cursor-pointer ${className}`}
    >
      {showIcon && <HeartHandshake className="w-3.5 h-3.5 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />}
      <span>{titleText}</span>
      {showCaseNumber && caseNumber && (
        <span className="text-[10px] font-mono text-purple-700 group-hover:underline">
          [{caseNumber}]
        </span>
      )}
    </button>
  );
};

interface TransactionLinkProps {
  transactionId?: string;
  transactionNumber?: string;
  className?: string;
  showIcon?: boolean;
  originBreadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export const TransactionLink: React.FC<TransactionLinkProps> = ({
  transactionId,
  transactionNumber,
  className = '',
  showIcon = false,
  originBreadcrumb,
  children,
}) => {
  const { openTransactionEditor } = useNavigation();
  const idToOpen = transactionId || transactionNumber;

  if (!idToOpen) {
    return <span className={className}>{children || transactionNumber || '—'}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTransactionEditor(idToOpen, { originBreadcrumb });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Click to edit transaction [${transactionNumber || idToOpen}]`}
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline transition-colors text-left cursor-pointer group ${className}`}
    >
      {showIcon ? (
        <FileEdit className="w-3 h-3 text-cyan-600/80 group-hover:text-cyan-900 shrink-0" />
      ) : null}
      <span className="group-hover:text-cyan-950">{children || transactionNumber || idToOpen}</span>
    </button>
  );
};

interface CustodianLinkProps {
  memberId?: string;
  memberName?: string;
  memberNumber?: string;
  amount?: number;
  currency?: string;
  className?: string;
  originBreadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export const CustodianLink: React.FC<CustodianLinkProps> = ({
  memberId,
  memberName,
  memberNumber,
  amount,
  currency = 'AED',
  className = '',
  originBreadcrumb,
  children,
}) => {
  const { openCustodianLedger } = useNavigation();

  if (!memberId) {
    return <span className={className}>{children || memberName || '—'}</span>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const resolvedName = memberName || (typeof children === 'string' ? children : undefined);
    openCustodianLedger(memberId, {
      originBreadcrumb,
      memberName: resolvedName,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`View physical cash custody breakdown for ${memberName || 'Custodian'}`}
      className={`inline-flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-700 hover:underline transition-colors text-left cursor-pointer ${className}`}
    >
      <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span>{children || memberName || 'Custodian'}</span>
      {amount !== undefined && (
        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold ml-1">
          {formatCurrency(amount, currency)}
        </span>
      )}
    </button>
  );
};
