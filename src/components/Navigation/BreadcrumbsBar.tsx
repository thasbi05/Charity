import React from 'react';
import {
  ChevronRight,
  Home,
  ArrowLeft,
  Wallet,
  Users,
  HeartHandshake,
  FileBarChart2,
  Receipt,
  FileText,
  Building,
  ShieldCheck,
  Settings,
  Layers,
} from 'lucide-react';
import { useNavigation, BreadcrumbItem } from '../../context/NavigationContext';

interface BreadcrumbsBarProps {
  className?: string;
}

export const BreadcrumbsBar: React.FC<BreadcrumbsBarProps> = ({ className = '' }) => {
  const { breadcrumbs, onBreadcrumbClick, goBack } = useNavigation();

  if (!breadcrumbs || breadcrumbs.length <= 1) {
    return null;
  }

  // Choose appropriate icon for breadcrumb items
  const getItemIcon = (crumb: BreadcrumbItem, index: number) => {
    if (index === 0 || crumb.tab === 'dashboard') {
      return <Home className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0" />;
    }
    if (crumb.recordType === 'custodian' || crumb.tab === 'custodians' || crumb.label.includes('Cash')) {
      return <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    }
    if (crumb.recordType === 'member' || crumb.tab === 'members') {
      return <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    if (crumb.recordType === 'case' || crumb.tab === 'cases') {
      return <HeartHandshake className="w-3.5 h-3.5 text-purple-600 shrink-0" />;
    }
    if (crumb.tab === 'reports' || crumb.recordType === 'report' || crumb.label.includes('Sheet') || crumb.label.includes('Report')) {
      return <FileBarChart2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    }
    if (crumb.tab === 'receipts') {
      return <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    if (crumb.tab === 'chart-of-accounts' || crumb.tab === 'cash-bank') {
      return <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
    if (crumb.tab === 'journal-ledger') {
      return <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    }
    if (crumb.tab === 'audit-logs') {
      return <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
    if (crumb.tab === 'settings') {
      return <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
    if (crumb.tab === 'monthly-status') {
      return <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
    }
    return null;
  };

  const isDeepDrilldown = breadcrumbs.length > 2;

  return (
    <nav
      id="global-breadcrumbs-bar"
      aria-label="Breadcrumb Navigation"
      className={`w-full bg-white/90 border-b border-slate-200/80 backdrop-blur-xs py-2 px-4 sm:px-6 lg:px-8 transition-all z-20 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 min-w-0">
        {/* Navigation Trail with Back button */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar py-0.5">
          {breadcrumbs.length > 1 && (
            <>
              <button
                type="button"
                onClick={goBack}
                title="Go back to previous level"
                aria-label="Go back to previous level"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-colors shadow-2xs shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />
            </>
          )}

          <ol className="flex items-center flex-nowrap sm:flex-wrap gap-1.5 min-w-0 text-xs">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const icon = getItemIcon(crumb, idx);

              return (
                <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5 min-w-0 shrink-0">
                  {idx > 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 mx-0.5" aria-hidden="true" />
                  )}

                  {isLast ? (
                    <span
                      aria-current="page"
                      title={crumb.label}
                      className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 rounded-lg max-w-[200px] sm:max-w-[320px] truncate shadow-2xs"
                    >
                      {icon}
                      <span className="truncate">{crumb.label}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBreadcrumbClick(idx)}
                      title={`Navigate back to ${crumb.label}`}
                      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70 transition-colors font-medium max-w-[160px] sm:max-w-[240px] truncate cursor-pointer"
                    >
                      {icon}
                      <span className="truncate group-hover:underline">{crumb.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Right Info / Direct reset */}
        {isDeepDrilldown && (
          <div className="hidden md:flex items-center gap-2 shrink-0 text-xs text-slate-400">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono font-medium text-slate-600">
              Depth: {breadcrumbs.length} levels
            </span>
          </div>
        )}
      </div>
    </nav>
  );
};

