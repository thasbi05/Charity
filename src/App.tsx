import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CharityProvider } from './context/CharityContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { HelpDocumentationModal } from './components/HelpDocumentationModal';
import { LoginPage } from './components/Auth/LoginPage';
import { LoginModal } from './components/Auth/LoginModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import { DashboardView } from './components/Dashboard/DashboardView';
import { MembersView } from './components/Members/MembersView';
import { MonthlyContributionMatrix } from './components/Members/MonthlyContributionMatrix';
import { ReceiptsView } from './components/Receipts/ReceiptsView';
import { PaymentsView } from './components/Payments/PaymentsView';
import { ChartOfAccountsView } from './components/Accounts/ChartOfAccountsView';
import { CashBankView } from './components/Accounts/CashBankView';
import { TransactionsLedgerView } from './components/Transactions/TransactionsLedgerView';
import { ReportsView } from './components/Reports/ReportsView';
import { TrialBalanceReport } from './components/Reports/TrialBalanceReport';
import { BalanceSheetReport } from './components/Reports/BalanceSheetReport';
import { UsersView } from './components/Users/UsersView';
import { SettingsView } from './components/Settings/SettingsView';
import { AuditLogsView } from './components/Audit/AuditLogsView';
import { CasesView } from './components/Cases/CasesView';
import { JournalLedgerView } from './components/Journal/JournalLedgerView';
import { CashCustodiansView } from './components/Custodians/CashCustodiansView';
import { BreadcrumbsBar } from './components/Navigation/BreadcrumbsBar';
import { UnifiedAddTransactionModal } from './components/Transactions/UnifiedAddTransactionModal';
import { TransactionDetailsModal } from './components/Transactions/TransactionDetailsModal';
import { UnifiedEditTransactionModal } from './components/Transactions/UnifiedEditTransactionModal';
import { DiagnosticDrawer } from './components/Financial/DiagnosticDrawer';
import { FloatingDiagnosticNotification } from './components/Financial/FloatingDiagnosticNotification';
import { FloatingAICopilotLauncher } from './components/Financial/FloatingAICopilotLauncher';
import { NoorAICopilot } from './components/Financial/NoorAICopilot';
import { AuthSessionGuard } from './components/Auth/AuthSessionGuard';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    activeTab,
    setActiveTab,
    navigateToTab,
    selectedMemberId,
    openMemberLedger,
    openCaseLedger,
    editingTransactionId,
    closeTransactionEditor,
  } = useNavigation();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('charity_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isDiagnosticsDrawerOpen, setIsDiagnosticsDrawerOpen] = useState(false);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState(false);

  // Cross-module states
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | undefined>(undefined);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | undefined>(undefined);
  const [memberIdForReceipt, setMemberIdForReceipt] = useState<string | undefined>(undefined);
  const [isNewReceiptOpen, setIsNewReceiptOpen] = useState(false);
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);

  const handleNavigate = (tab: NavTab | string, recordId?: string) => {
    let targetTab = tab as NavTab;
    if (tab === 'monthly') targetTab = 'monthly-status';
    if (tab === 'accounts') targetTab = 'chart-of-accounts';
    if (tab === 'cashbank') targetTab = 'cash-bank';
    if (tab === 'audit') targetTab = 'audit-logs';

    if (recordId) {
      if (targetTab === 'receipts') {
        setSelectedReceiptId(recordId);
        setIsNewReceiptOpen(false);
      } else if (targetTab === 'payments') {
        setSelectedPaymentId(recordId);
        setIsNewPaymentOpen(false);
      } else if (targetTab === 'members') {
        openMemberLedger(recordId);
        setIsMobileSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      } else if (targetTab === 'cases') {
        openCaseLedger(recordId);
        setIsMobileSidebarOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    navigateToTab(targetTab, recordId);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCreateReceipt = (memberId?: string) => {
    setMemberIdForReceipt(memberId);
    setSelectedReceiptId(undefined);
    setIsNewReceiptOpen(true);
    setActiveTab('receipts');
  };

  const handleOpenCreatePayment = () => {
    setSelectedPaymentId(undefined);
    setIsNewPaymentOpen(true);
    setActiveTab('payments');
  };

  // Global Keyboard Shortcuts (Ctrl+K, Ctrl+N, Alt+P, Ctrl+[, Alt+1..9, ?, Esc)
  useKeyboardShortcuts({
    onToggleSearch: () => setIsSearchOpen((prev) => !prev),
    onNewReceipt: () => handleOpenCreateReceipt(),
    onNewPayment: () => handleOpenCreatePayment(),
    onToggleHelp: () => setIsShortcutsHelpOpen((prev) => !prev),
    onToggleSidebar: () => {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        if (typeof window !== 'undefined') {
          localStorage.setItem('charity_sidebar_collapsed', String(next));
        }
        return next;
      });
    },
    onNavigate: (tab) => handleNavigate(tab),
    onCloseModals: () => {
      setIsSearchOpen(false);
      setIsShortcutsHelpOpen(false);
      setIsNewReceiptOpen(false);
      setIsNewPaymentOpen(false);
      setIsCopilotModalOpen(false);
    },
    onToggleNoor: () => setIsCopilotModalOpen((prev) => !prev),
  });

  const handleSelectReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setIsNewReceiptOpen(false);
    setActiveTab('receipts');
  };

  const handleSelectPayment = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setIsNewPaymentOpen(false);
    setActiveTab('payments');
  };

  const handleSelectMember = (memberId: string) => {
    openMemberLedger(memberId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading Charity Accounting...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={activeTab}
        setCurrentTab={handleNavigate}
        activeTab={activeTab}
        onTabChange={handleNavigate}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        onOpenDiagnostics={() => setIsDiagnosticsDrawerOpen(true)}
        onToggleCollapse={() => {
          setIsSidebarCollapsed((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
              localStorage.setItem('charity_sidebar_collapsed', String(next));
            }
            return next;
          });
        }}
      />

      {/* Main Content Area - dynamically adjusts width smoothly */}
      <div
        id="app-main-content-wrapper"
        style={{ transition: 'all 0.3s ease-in-out' }}
        className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
      >
        {/* Topbar */}
        <Topbar
          currentTab={activeTab}
          onNavigate={handleNavigate}
          setIsMobileOpen={setIsMobileSidebarOpen}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          openGlobalSearch={() => setIsSearchOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          openCreateReceipt={() => handleOpenCreateReceipt()}
          onOpenNewReceipt={() => handleOpenCreateReceipt()}
          openCreatePayment={() => handleOpenCreatePayment()}
          onOpenNewPayment={() => handleOpenCreatePayment()}
          openShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
        />

        {/* Global Dynamic Breadcrumb Navigation Bar */}
        <BreadcrumbsBar />

        {/* Dynamic View Content */}
        <main className="flex-1 pb-12">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              openCreateReceipt={(memberId) => handleOpenCreateReceipt(memberId)}
              openCreatePayment={() => handleOpenCreatePayment()}
              onOpenCreateReceipt={(memberId) => handleOpenCreateReceipt(memberId)}
              onOpenCreatePayment={() => handleOpenCreatePayment()}
              onSelectReceipt={handleSelectReceipt}
              onSelectPayment={handleSelectPayment}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              initialSelectedMemberId={selectedMemberId}
              onOpenCreateReceiptForMember={(memberId) => handleOpenCreateReceipt(memberId)}
            />
          )}

          {activeTab === 'custodians' && <CashCustodiansView />}

          {activeTab === 'cases' && <CasesView />}

          {(activeTab === 'monthly-status' || activeTab === ('monthly' as NavTab)) && (
            <MonthlyContributionMatrix
              onOpenCreateReceiptForMember={(memberId) => handleOpenCreateReceipt(memberId)}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsView
              initialSelectedReceiptId={selectedReceiptId}
              initialMemberIdForReceipt={memberIdForReceipt}
              isCreateOpen={isNewReceiptOpen}
              onCloseCreate={() => setIsNewReceiptOpen(false)}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsView
              initialSelectedPaymentId={selectedPaymentId}
              isCreateOpen={isNewPaymentOpen}
              onCloseCreate={() => setIsNewPaymentOpen(false)}
            />
          )}

          {activeTab === 'journal' && <JournalLedgerView />}

          {(activeTab === 'chart-of-accounts' || activeTab === ('accounts' as NavTab)) && (
            <ChartOfAccountsView />
          )}

          {(activeTab === 'cash-bank' || activeTab === ('cashbank' as NavTab)) && (
            <CashBankView />
          )}

          {activeTab === 'transactions' && <TransactionsLedgerView />}

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'trial-balance' && <TrialBalanceReport />}

          {activeTab === 'balance-sheet' && <BalanceSheetReport />}

          {activeTab === 'users' && (
            <AuthSessionGuard
              requiredRole="admin_only"
              fallbackMessage="Only the Chief Administrator has authority to invite staff, modify user roles, or manage system access."
            >
              <UsersView />
            </AuthSessionGuard>
          )}

          {activeTab === 'settings' && (
            <AuthSessionGuard
              requiredRole="admin_only"
              fallbackMessage="Only Administrators have permission to modify Organization Legal Identity, accounting configurations, or system templates."
            >
              <SettingsView />
            </AuthSessionGuard>
          )}

          {(activeTab === 'audit-logs' || activeTab === ('audit' as NavTab)) && (
            <AuditLogsView />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* In-App Help, Documentation & Accounting Knowledge Center Modal */}
      <HelpDocumentationModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />

      {/* Non-Intrusive Floating Top Notification when discrepancies detected */}
      <FloatingDiagnosticNotification
        onOpenDrawer={() => setIsDiagnosticsDrawerOpen(true)}
      />

      {/* Dedicated System Health & AI Reconcile Slide-Over Drawer */}
      <DiagnosticDrawer
        isOpen={isDiagnosticsDrawerOpen}
        onClose={() => setIsDiagnosticsDrawerOpen(false)}
      />

      {/* Global Transaction Details Modal */}
      <TransactionDetailsModal />

      {/* Universal Transaction Editor Modal */}
      <UnifiedEditTransactionModal
        transactionIdentifier={editingTransactionId}
        isOpen={Boolean(editingTransactionId)}
        onClose={closeTransactionEditor}
      />

      {/* Central Multi-User Authentication & Switcher Modal */}
      <LoginModal />

      {/* Global Floating AI Accounting Copilot Launcher Button */}
      <FloatingAICopilotLauncher
        onOpenCopilot={() => setIsCopilotModalOpen(true)}
      />

      {/* Noor — Islamic Charity Accounting Assistant Modal */}
      <NoorAICopilot
        isOpen={isCopilotModalOpen}
        onClose={() => setIsCopilotModalOpen(false)}
        onOpenCreateReceiptForMember={(memId) => handleOpenCreateReceipt(memId)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CharityProvider>
        <NavigationProvider>
          <MainLayout />
        </NavigationProvider>
      </CharityProvider>
    </AuthProvider>
  );
}
