import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  HeartHandshake,
  BookOpen,
  Landmark,
  ArrowLeftRight,
  CalendarCheck,
  FileBarChart2,
  ShieldCheck,
  Settings,
  History,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Wallet,
  Scale,
  Download,
  HeartPulse,
  ShieldAlert,
  Users as UsersIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCharity } from '../context/CharityContext';
import { PWAInstallButton } from './Common/PWAInstallButton';
import { FinancialEngineService } from '../services/financialEngineService';

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
  | 'trial-balance'
  | 'balance-sheet'
  | 'users'
  | 'audit-logs'
  | 'settings';

interface SidebarProps {
  currentTab?: NavTab;
  setCurrentTab?: (tab: NavTab) => void;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  isSidebarCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  setIsSidebarCollapsed?: (collapsed: boolean) => void;
  onToggleCollapse?: () => void;
  onOpenDiagnostics?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  activeTab,
  onTabChange,
  isMobileOpen,
  setIsMobileOpen,
  onCloseMobile,
  isCollapsed: controlledCollapsed,
  isSidebarCollapsed,
  setIsCollapsed: controlledSetIsCollapsed,
  setIsSidebarCollapsed,
  onToggleCollapse,
  onOpenDiagnostics,
}) => {
  const { user, logout, openLoginModal } = useAuth();
  const { settings, journalEntries, latestScanReport } = useCharity();

  // Compute live ledger discrepancy count using FinancialEngineService
  const balanceCheck = React.useMemo(() => {
    return FinancialEngineService.getInstance().validateBalance(journalEntries || []);
  }, [journalEntries]);

  const discrepancyCount =
    (latestScanReport?.totalIssues ?? 0) +
    (balanceCheck.isBalanced ? 0 : balanceCheck.imbalancedEntries.length);

  // Internal collapsed state fallback (synchronized with localStorage)
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('charity_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const isCollapsed =
    typeof isSidebarCollapsed === 'boolean'
      ? isSidebarCollapsed
      : typeof controlledCollapsed === 'boolean'
      ? controlledCollapsed
      : internalCollapsed;

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    if (typeof onToggleCollapse === 'function') {
      onToggleCollapse();
    }
    if (typeof controlledSetIsCollapsed === 'function') {
      controlledSetIsCollapsed(nextState);
    }
    if (typeof setIsSidebarCollapsed === 'function') {
      setIsSidebarCollapsed(nextState);
    }
    setInternalCollapsed(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('charity_sidebar_collapsed', String(nextState));
    }
  };

  const selectedTab = currentTab || activeTab || 'dashboard';

  const handleSelectTab = (tab: NavTab) => {
    if (typeof setCurrentTab === 'function') {
      setCurrentTab(tab);
    }
    if (typeof onTabChange === 'function') {
      onTabChange(tab);
    }
    if (typeof setIsMobileOpen === 'function') {
      setIsMobileOpen(false);
    }
    if (typeof onCloseMobile === 'function') {
      onCloseMobile();
    }
  };

  const handleCloseMobile = () => {
    if (typeof setIsMobileOpen === 'function') {
      setIsMobileOpen(false);
    }
    if (typeof onCloseMobile === 'function') {
      onCloseMobile();
    }
  };

  const [isReportsExpanded, setIsReportsExpanded] = useState(true);

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    roleRequired?: string;
    subItems?: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[];
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'custodians', label: 'Cash Custodians', icon: Wallet },
    { id: 'cases', label: 'Charity Cases', icon: HeartHandshake },
    { id: 'receipts', label: 'Receipts / Contributions', icon: ReceiptText },
    { id: 'payments', label: 'Payments & Expenses', icon: Landmark },
    { id: 'monthly-status', label: 'Monthly Dues Matrix', icon: CalendarCheck },
    { id: 'journal', label: 'General Journal Ledger', icon: Layers },
    { id: 'transactions', label: 'Transactions Ledger', icon: ArrowLeftRight },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'cash-bank', label: 'Cash & Bank', icon: Landmark },
    {
      id: 'reports',
      label: 'Financial Reports',
      icon: FileBarChart2,
      subItems: [
        { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
        { id: 'balance-sheet', label: 'Balance Sheet', icon: Landmark },
        { id: 'reports', label: 'All Reports & Ledgers', icon: FileBarChart2 },
      ],
    },
    { id: 'users', label: 'Users & Roles', icon: ShieldCheck },
    { id: 'audit-logs', label: 'Audit Logs', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderNavButton = (item: (typeof navItems)[0]) => {
    const Icon = item.icon;
    const isReportsParent = item.id === 'reports';
    const active =
      selectedTab === item.id ||
      (isReportsParent && (selectedTab === 'trial-balance' || selectedTab === 'balance-sheet'));

    if (isCollapsed) {
      return (
        <div key={item.id} className="relative group flex justify-center py-0.5">
          <button
            id={`nav-btn-${item.id}`}
            onClick={() => handleSelectTab(item.id)}
            title={item.label}
            aria-label={item.label}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
              active
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
          </button>

          {/* Floating Hover Tooltip with Pointer Arrow */}
          <div
            role="tooltip"
            className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-800 flex items-center gap-2 top-1/2 -translate-y-1/2"
          >
            <span>{item.label}</span>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-950 border-l border-b border-slate-800 rotate-45 pointer-events-none" />
          </div>
        </div>
      );
    }

    if (isReportsParent && item.subItems) {
      return (
        <div key={item.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <button
              id={`nav-btn-${item.id}`}
              onClick={() => handleSelectTab('reports')}
              className={`flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === 'reports'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : active
                  ? 'text-emerald-400 bg-slate-800/60 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReportsExpanded((prev) => !prev)}
              aria-label="Toggle Financial Reports submenu"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isReportsExpanded ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>
          </div>

          {/* Sub-Items Dropdown */}
          {isReportsExpanded && (
            <div className="pl-6 pr-1 space-y-1 border-l-2 border-slate-800 ml-5 py-0.5">
              {item.subItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = selectedTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    id={`nav-btn-${sub.id}`}
                    onClick={() => handleSelectTab(sub.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isSubActive
                        ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        id={`nav-btn-${item.id}`}
        onClick={() => handleSelectTab(item.id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={handleCloseMobile}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        className={`fixed lg:sticky top-0 left-0 bottom-0 lg:bottom-auto lg:h-screen z-50 lg:z-30 shrink-0 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 shadow-xl lg:shadow-none transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Area: Organization Brand Header & Collapse Toggle */}
        <div
          className={`border-b border-slate-800 transition-all duration-300 ease-in-out ${
            isCollapsed
              ? 'p-2.5 flex flex-col items-center gap-2'
              : 'p-4 sm:p-5 flex items-center justify-between gap-3'
          }`}
        >
          {isCollapsed ? (
            <>
              {/* Collapsed Logo */}
              <img
                src="/logo-emblem.svg"
                alt="UMU Logo"
                title={settings.charityName}
                onClick={handleToggleCollapse}
                className="w-10 h-10 rounded-full object-contain bg-white p-0.5 shadow-sm shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
              />

              {/* Expand Toggle Button (▶) with Tooltip */}
              <div className="relative group">
                <button
                  id="sidebar-expand-toggle-btn"
                  onClick={handleToggleCollapse}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                  className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-800 transition-colors border border-slate-700/80 shadow-2xs group"
                >
                  <ChevronRight className="w-4 h-4 group-hover:scale-110 transition-transform text-emerald-400" />
                </button>
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-800 top-1/2 -translate-y-1/2 flex items-center gap-1"
                >
                  <span>Expand sidebar</span>
                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-950 border-l border-b border-slate-800 rotate-45 pointer-events-none" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Expanded Brand Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={settings.logoUrl || '/logo-emblem.svg'}
                  alt="Logo"
                  className="w-12 h-12 rounded-lg object-contain bg-white p-0.5 shadow-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="font-brand font-bold text-sm sm:text-base text-white tracking-wide truncate leading-tight">
                    {settings.charityName}
                  </h1>
                  <p className="text-[11px] text-emerald-400 font-semibold tracking-wider uppercase truncate mt-0.5">
                    UAE • ESTD 2008
                  </p>
                </div>
              </div>

              {/* Collapse Toggle Button (◀) */}
              <button
                id="sidebar-collapse-toggle-btn"
                onClick={handleToggleCollapse}
                title="Collapse sidebar (◀)"
                aria-label="Collapse sidebar"
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700 shrink-0 group"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </>
          )}
        </div>

        {/* Navigation Items */}
        <nav
          className={`flex-1 transition-all duration-300 ease-in-out ${
            isCollapsed ? 'px-2 py-3 overflow-visible space-y-1' : 'px-3 py-4 overflow-y-auto space-y-1'
          }`}
        >
          {/* Group 1: Main Operations */}
          {isCollapsed ? (
            <div className="h-1 my-1" />
          ) : (
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider transition-opacity duration-200">
              Main Operations
            </div>
          )}
          {navItems.slice(0, 6).map(renderNavButton)}

          {/* Group 2: Accounting & General Ledger */}
          {isCollapsed ? (
            <div className="my-2 border-t border-slate-800/80 mx-1.5" />
          ) : (
            <div className="px-3 pt-5 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider transition-opacity duration-200">
              Accounting & General Ledger
            </div>
          )}
          {navItems.slice(6, 11).map(renderNavButton)}

          {/* Group 3: Administration & Security */}
          {isCollapsed ? (
            <div className="my-2 border-t border-slate-800/80 mx-1.5" />
          ) : (
            <div className="px-3 pt-5 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider transition-opacity duration-200">
              Administration & Security
            </div>
          )}
          {navItems.slice(11, 13).map(renderNavButton)}

          {/* System Diagnostics & AI Reconcile Sidebar Item */}
          {isCollapsed ? (
            <div className="relative group flex justify-center py-0.5">
              <button
                id="nav-btn-diagnostics-collapsed"
                type="button"
                onClick={onOpenDiagnostics}
                title="System Diagnostics & AI Reconcile"
                aria-label="System Diagnostics & AI Reconcile"
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  discrepancyCount > 0
                    ? 'text-red-400 hover:text-white hover:bg-red-950/40 border border-red-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <HeartPulse className={`w-5 h-5 shrink-0 ${discrepancyCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
                {/* iOS Notification Badge for Collapsed View */}
                {discrepancyCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-lg border-2 border-slate-900 animate-pulse">
                    {discrepancyCount > 99 ? '99+' : discrepancyCount}
                  </span>
                ) : (
                  <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                )}
              </button>

              <div
                role="tooltip"
                className="absolute left-full ml-3 px-3 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-800 flex items-center gap-2 top-1/2 -translate-y-1/2"
              >
                <span>System Diagnostics & AI Reconcile</span>
                {discrepancyCount > 0 ? (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-bold">
                    {discrepancyCount}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 rounded-full text-[10px] font-bold">
                    Healthy
                  </span>
                )}
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-950 border-l border-b border-slate-800 rotate-45 pointer-events-none" />
              </div>
            </div>
          ) : (
            <button
              id="nav-btn-diagnostics"
              type="button"
              onClick={onOpenDiagnostics}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                discrepancyCount > 0
                  ? 'bg-red-950/30 text-red-200 border border-red-500/30 hover:bg-red-950/50 hover:text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <HeartPulse
                  className={`w-4 h-4 shrink-0 ${
                    discrepancyCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                  }`}
                />
                <span className="truncate">System Diagnostics & AI Reconcile</span>
              </div>

              {/* iOS style Notification Badge */}
              {discrepancyCount > 0 ? (
                <span className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-600 text-white rounded-full text-[11px] font-bold shadow-xs">
                    {discrepancyCount}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Healthy</span>
                </span>
              )}
            </button>
          )}

          {/* Settings */}
          {navItems.slice(13, 14).map(renderNavButton)}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="border-t border-slate-800 bg-slate-950/50 transition-all duration-300 ease-in-out">
          {isCollapsed ? (
            <div className="p-2.5 flex flex-col items-center gap-2.5">
              {/* User Avatar with Tooltip */}
              <div
                className="relative group cursor-pointer"
                title={`${user?.displayName || 'User'} (${user?.role})`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs uppercase shadow-xs hover:ring-2 hover:ring-emerald-500 transition-all">
                  {user?.displayName ? user.displayName.slice(0, 2) : 'AD'}
                </div>

                <div
                  role="tooltip"
                  className="absolute left-full ml-3 px-3 py-2 bg-slate-950 text-white text-xs rounded-md shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-800 top-1/2 -translate-y-1/2"
                >
                  <p className="font-bold text-white leading-tight">{user?.displayName || 'User'}</p>
                  <p className="text-[10px] text-emerald-400 uppercase font-semibold tracking-wider mt-0.5">
                    {user?.role}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{user?.email}</p>
                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-950 border-l border-b border-slate-800 rotate-45 pointer-events-none" />
                </div>
              </div>

              {/* Logout Button with Tooltip */}
              <div className="relative group">
                <button
                  id="sidebar-logout-btn-collapsed"
                  onClick={logout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <div
                  role="tooltip"
                  className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-md shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-800 top-1/2 -translate-y-1/2 flex items-center gap-1"
                >
                  <span>Sign Out</span>
                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-950 border-l border-b border-slate-800 rotate-45 pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {user?.displayName ? user.displayName.slice(0, 2) : 'AD'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.displayName || 'User'}
                    </p>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="sidebar-switch-user-btn"
                    onClick={openLoginModal}
                    title="Switch User / 5 Cloud Accounts"
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <UsersIcon className="w-4 h-4" />
                  </button>
                  <button
                    id="sidebar-logout-btn"
                    onClick={logout}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 truncate mb-2.5">
                {user?.email}
              </p>

              {/* Install PWA Link Button in Sidebar */}
              <div className="pt-2 border-t border-slate-800/80">
                <PWAInstallButton variant="sidebar" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
