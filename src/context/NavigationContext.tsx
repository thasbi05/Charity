import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NavTab } from '../components/Sidebar';
import { useCharity } from './CharityContext';

export interface BreadcrumbItem {
  id?: string;
  label: string;
  tab?: NavTab | string;
  recordId?: string;
  recordType?: 'member' | 'case' | 'custodian' | 'transaction' | 'report';
  isCurrent?: boolean;
  onClick?: () => void;
  subLabel?: string;
}

export type MemberLedgerFocusTab = 'ledger' | 'cash' | 'profile';
export type SettingsSubTab = 'organization' | 'members' | 'users' | 'templates' | 'firms';

export interface NavigationContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  settingsSubTab: SettingsSubTab;
  setSettingsSubTab: (tab: SettingsSubTab) => void;
  openOrganizationSettings: () => void;
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: React.Dispatch<React.SetStateAction<BreadcrumbItem[]>>;
  
  // Drilldown entity states
  selectedMemberId: string | null;
  selectedCustodianId: string | null;
  selectedCaseId: string | null;
  selectedTransactionId: string | null;
  editingTransactionId: string | null;
  memberLedgerFocusTab?: MemberLedgerFocusTab;

  // Navigation actions
  navigateToTab: (tab: NavTab | string, recordId?: string) => void;
  openMemberLedger: (
    memberId: string,
    options?: {
      originBreadcrumb?: BreadcrumbItem[];
      focusTab?: MemberLedgerFocusTab;
      memberName?: string;
    }
  ) => void;
  openCaseLedger: (
    caseId: string,
    options?: {
      originBreadcrumb?: BreadcrumbItem[];
      caseTitle?: string;
      caseNumber?: string;
    }
  ) => void;
  openCustodianLedger: (
    memberId: string,
    options?: {
      originBreadcrumb?: BreadcrumbItem[];
      memberName?: string;
    }
  ) => void;
  openTransactionDetails: (
    transactionIdOrNumber: string,
    options?: {
      originBreadcrumb?: BreadcrumbItem[];
    }
  ) => void;
  closeTransactionDetails: () => void;
  openTransactionEditor: (
    transactionIdOrNumber: string,
    options?: {
      originBreadcrumb?: BreadcrumbItem[];
    }
  ) => void;
  closeTransactionEditor: () => void;
  closeDrilldown: () => void;
  onBreadcrumbClick: (index: number) => void;
  goBack: () => void;
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  custodians: 'Cash Custodians',
  cases: 'Charity Cases',
  'monthly-status': 'Monthly Status Matrix',
  receipts: 'Receipts & Contributions',
  payments: 'Disbursements & Relief',
  reports: 'Financial Reports',
  'trial-balance': 'Trial Balance',
  'balance-sheet': 'Balance Sheet',
  'chart-of-accounts': 'Chart of Accounts',
  'cash-bank': 'Cash & Bank Accounts',
  'journal-ledger': 'General Journal',
  'audit-logs': 'Audit Trail',
  settings: 'Organization Settings',
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { members, cases } = useCharity();

  const [activeTab, setActiveTabState] = useState<NavTab>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('organization');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'Dashboard', tab: 'dashboard', isCurrent: true },
  ]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedCustodianId, setSelectedCustodianId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [memberLedgerFocusTab, setMemberLedgerFocusTab] = useState<'ledger' | 'cash' | 'profile'>('ledger');

  // Normalize tab names
  const normalizeTab = useCallback((tab: string): NavTab => {
    if (tab === 'monthly') return 'monthly-status';
    if (tab === 'accounts') return 'chart-of-accounts';
    if (tab === 'cashbank') return 'cash-bank';
    if (tab === 'audit') return 'audit-logs';
    return tab as NavTab;
  }, []);

  const setActiveTab = useCallback((tab: NavTab | string) => {
    const normalized = normalizeTab(tab);
    setActiveTabState(normalized);
  }, [normalizeTab]);

  // Dynamic Lookup Helpers
  const getMemberName = useCallback((id: string): string => {
    const found = members.find((m) => m.id === id || m.memberNumber === id);
    return found ? found.fullName : id;
  }, [members]);

  const getCaseTitle = useCallback((id: string): string => {
    const found = cases.find((c) => c.id === id || c.caseNumber === id);
    return found ? found.title : id;
  }, [cases]);

  // Sync with window.location.hash for record traceability and browser Back/Forward
  const updateHash = useCallback(
    (hashPath: string) => {
      if (typeof window !== 'undefined') {
        const currentHash = window.location.hash.replace(/^#/, '');
        if (currentHash !== hashPath) {
          window.location.hash = hashPath;
        }
      }
    },
    []
  );

  // Navigate to standard tab
  const navigateToTab = useCallback(
    (tab: NavTab | string, recordId?: string) => {
      const targetTab = normalizeTab(tab);
      setActiveTabState(targetTab);
      setSelectedMemberId(null);
      setSelectedCustodianId(null);
      setSelectedCaseId(null);

      if (targetTab === 'dashboard') {
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard', isCurrent: true },
        ]);
      } else {
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          {
            label: TAB_LABELS[targetTab] || (targetTab.charAt(0).toUpperCase() + targetTab.slice(1).replace('-', ' ')),
            tab: targetTab,
            isCurrent: true,
          },
        ]);
      }

      updateHash(targetTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [normalizeTab, updateHash]
  );

  // Open specific Member Ledger: Dashboard -> Members -> [Member Name] -> Member Ledger
  const openMemberLedger = useCallback(
    (
      memberId: string,
      options?: {
        originBreadcrumb?: BreadcrumbItem[];
        focusTab?: 'ledger' | 'cash' | 'profile';
        memberName?: string;
      }
    ) => {
      setSelectedMemberId(memberId);
      setSelectedCustodianId(null);
      setSelectedCaseId(null);
      setMemberLedgerFocusTab(options?.focusTab || 'ledger');
      setActiveTabState('members');

      const memberName = options?.memberName || getMemberName(memberId);

      let origin = options?.originBreadcrumb;
      if (!origin || origin.length === 0) {
        origin = [
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Members', tab: 'members' },
        ];
      } else if (origin[0].label !== 'Dashboard') {
        origin = [{ label: 'Dashboard', tab: 'dashboard' }, ...origin];
      }

      setBreadcrumbs([
        ...origin,
        {
          label: memberName,
          recordType: 'member',
          recordId: memberId,
        },
        {
          label: 'Member Ledger',
          isCurrent: true,
        },
      ]);

      updateHash(`members/${memberId}/ledger`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [getMemberName, updateHash]
  );

  // Open specific Charity Case Ledger: Dashboard -> Charity Cases -> [Case Title] -> Case Ledger
  const openCaseLedger = useCallback(
    (
      caseId: string,
      options?: {
        originBreadcrumb?: BreadcrumbItem[];
        caseTitle?: string;
        caseNumber?: string;
      }
    ) => {
      setSelectedCaseId(caseId);
      setSelectedMemberId(null);
      setSelectedCustodianId(null);
      setActiveTabState('cases');

      const caseTitle = options?.caseTitle || getCaseTitle(caseId);

      let origin = options?.originBreadcrumb;
      if (!origin || origin.length === 0) {
        origin = [
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Charity Cases', tab: 'cases' },
        ];
      } else if (origin[0].label !== 'Dashboard') {
        origin = [{ label: 'Dashboard', tab: 'dashboard' }, ...origin];
      }

      setBreadcrumbs([
        ...origin,
        {
          label: caseTitle,
          recordType: 'case',
          recordId: caseId,
        },
        {
          label: 'Case Ledger',
          isCurrent: true,
        },
      ]);

      updateHash(`charity-cases/${caseId}/ledger`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [getCaseTitle, updateHash]
  );

  // Open Custodian Ledger: Dashboard -> Cash Custodians -> [Custodian Name] -> Cash Ledger
  const openCustodianLedger = useCallback(
    (
      memberId: string,
      options?: {
        originBreadcrumb?: BreadcrumbItem[];
        memberName?: string;
      }
    ) => {
      setSelectedMemberId(memberId);
      setSelectedCustodianId(memberId);
      setSelectedCaseId(null);
      setMemberLedgerFocusTab('cash');
      setActiveTabState('custodians');

      const custodianName = options?.memberName || getMemberName(memberId);

      let origin = options?.originBreadcrumb;
      if (!origin || origin.length === 0) {
        origin = [
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Cash Custodians', tab: 'custodians' },
        ];
      } else if (origin[0].label !== 'Dashboard') {
        origin = [{ label: 'Dashboard', tab: 'dashboard' }, ...origin];
      }

      setBreadcrumbs([
        ...origin,
        {
          label: custodianName,
          recordType: 'custodian',
          recordId: memberId,
        },
        {
          label: 'Cash Ledger',
          isCurrent: true,
        },
      ]);

      updateHash(`cash-custodians/${memberId}/ledger`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [getMemberName, updateHash]
  );

  // Open Transaction Details Modal
  const openTransactionDetails = useCallback(
    (
      transactionIdOrNumber: string,
      options?: {
        originBreadcrumb?: BreadcrumbItem[];
      }
    ) => {
      setSelectedTransactionId(transactionIdOrNumber);
    },
    []
  );

  const closeTransactionDetails = useCallback(() => {
    setSelectedTransactionId(null);
  }, []);

  const openTransactionEditor = useCallback(
    (
      transactionIdOrNumber: string,
      options?: {
        originBreadcrumb?: BreadcrumbItem[];
      }
    ) => {
      setEditingTransactionId(transactionIdOrNumber);
    },
    []
  );

  const closeTransactionEditor = useCallback(() => {
    setEditingTransactionId(null);
  }, []);

  const openOrganizationSettings = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedCustodianId(null);
    setSelectedCaseId(null);
    setActiveTabState('settings');
    setSettingsSubTab('organization');
    setBreadcrumbs([
      { label: 'Dashboard', tab: 'dashboard' },
      { label: 'Organization Settings', tab: 'settings' },
      { label: 'Profile & Branding', isCurrent: true },
    ]);
    updateHash('settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateHash]);

  const closeDrilldown = useCallback(() => {
    setSelectedMemberId(null);
    setSelectedCustodianId(null);
    setSelectedCaseId(null);
    
    if (activeTab === 'dashboard') {
      setBreadcrumbs([{ label: 'Dashboard', tab: 'dashboard', isCurrent: true }]);
    } else {
      setBreadcrumbs([
        { label: 'Dashboard', tab: 'dashboard' },
        { label: TAB_LABELS[activeTab] || activeTab, tab: activeTab, isCurrent: true },
      ]);
    }
  }, [activeTab]);

  // Handle Breadcrumb clicks: clicking any level takes user directly back to that level
  const onBreadcrumbClick = useCallback(
    (index: number) => {
      const item = breadcrumbs[index];
      if (!item) return;

      if (index === breadcrumbs.length - 1) return; // already here

      if (item.onClick) {
        item.onClick();
        return;
      }

      // If clicked Dashboard
      if (item.tab === 'dashboard' || index === 0) {
        setSelectedMemberId(null);
        setSelectedCustodianId(null);
        setSelectedCaseId(null);
        setActiveTabState('dashboard');
        setBreadcrumbs([{ label: 'Dashboard', tab: 'dashboard', isCurrent: true }]);
        updateHash('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // If clicked on Tab level (e.g. "Cash Custodians", "Members", "Charity Cases")
      if (item.tab && !item.recordId) {
        const norm = normalizeTab(item.tab);
        setSelectedMemberId(null);
        setSelectedCustodianId(null);
        setSelectedCaseId(null);
        setActiveTabState(norm);
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          { label: TAB_LABELS[norm] || item.label, tab: norm, isCurrent: true },
        ]);
        updateHash(norm);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // If clicked on a custodian name
      if (item.recordType === 'custodian' && item.recordId) {
        setSelectedMemberId(item.recordId);
        setSelectedCustodianId(item.recordId);
        setMemberLedgerFocusTab('cash');
        setActiveTabState('custodians');
        setBreadcrumbs(breadcrumbs.slice(0, index + 1).map((b, i) => ({
          ...b,
          isCurrent: i === index,
        })));
        return;
      }

      // If clicked on a member name
      if (item.recordType === 'member' && item.recordId) {
        setSelectedMemberId(item.recordId);
        setSelectedCustodianId(null);
        setActiveTabState('members');
        setBreadcrumbs(breadcrumbs.slice(0, index + 1).map((b, i) => ({
          ...b,
          isCurrent: i === index,
        })));
        return;
      }

      // If clicked on a case title
      if (item.recordType === 'case' && item.recordId) {
        setSelectedCaseId(item.recordId);
        setActiveTabState('cases');
        setBreadcrumbs(breadcrumbs.slice(0, index + 1).map((b, i) => ({
          ...b,
          isCurrent: i === index,
        })));
        return;
      }

      // Fallback for sub-routes or reports
      if (item.tab) {
        setSelectedMemberId(null);
        setSelectedCustodianId(null);
        setSelectedCaseId(null);
        setActiveTabState(normalizeTab(item.tab));
      }

      setBreadcrumbs(breadcrumbs.slice(0, index + 1).map((b, i) => ({
        ...b,
        isCurrent: i === index,
      })));
    },
    [breadcrumbs, normalizeTab, updateHash]
  );

  // Go back one level in the breadcrumb hierarchy
  const goBack = useCallback(() => {
    if (breadcrumbs.length > 1) {
      onBreadcrumbClick(breadcrumbs.length - 2);
    }
  }, [breadcrumbs, onBreadcrumbClick]);

  // Listen for browser URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash) return;

      // Match /members/:id/ledger
      const memberMatch = hash.match(/^members\/([^/]+)(\/ledger)?$/);
      if (memberMatch) {
        const mId = memberMatch[1];
        const mName = getMemberName(mId);
        setSelectedMemberId(mId);
        setSelectedCustodianId(null);
        setActiveTabState('members');
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Members', tab: 'members' },
          { label: mName, recordType: 'member', recordId: mId },
          { label: 'Member Ledger', isCurrent: true },
        ]);
        return;
      }

      // Match /cash-custodians/:id/ledger
      const custMatch = hash.match(/^cash-custodians\/([^/]+)(\/ledger)?$/);
      if (custMatch) {
        const cId = custMatch[1];
        const cName = getMemberName(cId);
        setSelectedMemberId(cId);
        setSelectedCustodianId(cId);
        setMemberLedgerFocusTab('cash');
        setActiveTabState('custodians');
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Cash Custodians', tab: 'custodians' },
          { label: cName, recordType: 'custodian', recordId: cId },
          { label: 'Cash Ledger', isCurrent: true },
        ]);
        return;
      }

      // Match /charity-cases/:id/ledger
      const caseMatch = hash.match(/^(?:charity-cases|cases)\/([^/]+)(\/ledger)?$/);
      if (caseMatch) {
        const cId = caseMatch[1];
        const cTitle = getCaseTitle(cId);
        setSelectedCaseId(cId);
        setActiveTabState('cases');
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Charity Cases', tab: 'cases' },
          { label: cTitle, recordType: 'case', recordId: cId },
          { label: 'Case Ledger', isCurrent: true },
        ]);
        return;
      }

      // Match standard tab e.g. #reports/balance-sheet or #reports
      if (hash.startsWith('reports/balance-sheet')) {
        setActiveTabState('reports');
        setBreadcrumbs([
          { label: 'Dashboard', tab: 'dashboard' },
          { label: 'Financial Reports', tab: 'reports' },
          { label: 'Balance Sheet', isCurrent: true },
        ]);
        return;
      }

      const simpleTab = hash.split('/')[0];
      if (simpleTab) {
        const norm = normalizeTab(simpleTab);
        setActiveTabState(norm);
        if (norm === 'dashboard') {
          setBreadcrumbs([{ label: 'Dashboard', tab: 'dashboard', isCurrent: true }]);
        } else {
          setBreadcrumbs([
            { label: 'Dashboard', tab: 'dashboard' },
            { label: TAB_LABELS[norm] || norm, tab: norm, isCurrent: true },
          ]);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (window.location.hash) {
      handleHashChange();
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [getCaseTitle, getMemberName, normalizeTab]);

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        settingsSubTab,
        setSettingsSubTab,
        openOrganizationSettings,
        breadcrumbs,
        setBreadcrumbs,
        selectedMemberId,
        selectedCustodianId,
        selectedCaseId,
        selectedTransactionId,
        editingTransactionId,
        memberLedgerFocusTab,
        navigateToTab,
        openMemberLedger,
        openCaseLedger,
        openCustodianLedger,
        openTransactionDetails,
        closeTransactionDetails,
        openTransactionEditor,
        closeTransactionEditor,
        closeDrilldown,
        onBreadcrumbClick,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

