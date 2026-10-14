import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Filter,
  Download,
  FileDown,
  Edit2,
  Power,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { getAccountAppModule } from '../../utils/defaults';

const APP_MODULE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  membership: { label: 'Member Dues', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  donations: { label: 'Donations & Aid Funds', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  charity_assistance: { label: 'Charity Aid', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  admin_expense: { label: 'Admin & Operations', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  banking: { label: 'Cash & Banking', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  assets: { label: 'Fixed Assets', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  liabilities: { label: 'Liabilities', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  fund_equity: { label: 'Fund Equity', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  general: { label: 'General Ledger', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const ChartOfAccountsView: React.FC = () => {
  const {
    accounts,
    transactions,
    settings,
    addAccount,
    updateAccount,
    deactivateAccount,
    syncStandardAccounts,
  } = useCharity();
  const { user } = useAuth();

  const canManage = !user || user.role === 'administrator' || user.role === 'SUPER_ADMIN' || user.role === 'CHARITY_ADMIN' || user.role === 'staff' || user.role === 'STAFF';

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AccountType>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-sync standard accounts if empty
  useEffect(() => {
    if (accounts.length === 0 && !isSyncing) {
      handleSyncStandardAccounts();
    }
  }, [accounts.length]);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AccountType>('Expense');
  const [formAppModule, setFormAppModule] = useState<string>('charity_assistance');
  const [formParentCode, setFormParentCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account type badges & color coding
  const TYPE_COLORS: Record<AccountType, string> = {
    Asset: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Liability: 'bg-amber-50 text-amber-800 border-amber-200',
    'Fund/Equity': 'bg-purple-50 text-purple-800 border-purple-200',
    Income: 'bg-blue-50 text-blue-800 border-blue-200',
    Expense: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchesType = typeFilter === 'all' || a.type === typeFilter;
      const accountModule = a.appModule || getAccountAppModule(a.code);
      const matchesModule = moduleFilter === 'all' || accountModule === moduleFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (a.code && a.code.toLowerCase().includes(q)) ||
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (accountModule && accountModule.toLowerCase().includes(q));

      return matchesType && matchesModule && matchesSearch;
    });
  }, [accounts, typeFilter, moduleFilter, searchQuery]);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setFormCode('');
    setFormName('');
    setFormType('Expense');
    setFormAppModule('charity_assistance');
    setFormParentCode('');
    setFormDescription('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (a: Account) => {
    setEditingAccount(a);
    setFormCode(a.code);
    setFormName(a.name);
    setFormType(a.type);
    setFormAppModule(a.appModule || getAccountAppModule(a.code));
    setFormParentCode(a.parentCode || '');
    setFormDescription(a.description || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSyncStandardAccounts = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncStandardAccounts();
      setSyncFeedback({
        type: 'success',
        message: `Standard Chart of Accounts successfully aligned with charity app features! Added ${res.added} standard accounts and updated ${res.updated} accounts.`,
      });
      setTimeout(() => setSyncFeedback(null), 8000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Account synchronization failed: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError('Account code is required.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Account name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, {
          name: formName.trim(),
          type: formType,
          appModule: formAppModule || getAccountAppModule(editingAccount.code),
          parentCode: formParentCode.trim() || undefined,
          description: formDescription.trim() || undefined,
        });
      } else {
        await addAccount({
          code: formCode.trim(),
          name: formName.trim(),
          type: formType,
          appModule: formAppModule || getAccountAppModule(formCode.trim()),
          parentCode: formParentCode.trim() || undefined,
          description: formDescription.trim() || undefined,
          isActive: true,
        });
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const data = filteredAccounts.map((a) => ({
      'Account Code': a.code,
      'Account Name': a.name,
      Type: a.type,
      'App Module': APP_MODULE_CONFIG[a.appModule || getAccountAppModule(a.code)]?.label || 'General',
      'Parent Account': a.parentCode || '',
      'Current Balance': a.balance || 0,
      Status: a.isActive ? 'Active' : 'Inactive',
      Description: a.description || '',
    }));
    exportToCsv('Chart_of_Accounts', data);
  };

  return (
    <div id="chart-of-accounts-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Chart of Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            General Ledger structure configured for Charity Assistance, Member Dues, Public Donations, and Operations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button
              id="sync-coa-btn"
              onClick={handleSyncStandardAccounts}
              disabled={isSyncing}
              title="Ensure all standard app accounts (relief categories, member dues, operating costs) are initialized"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync App Accounts'}</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => triggerPrint('chart-of-accounts-view', 'Chart_of_Accounts')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>

          {canManage && (
            <button
              id="add-account-btn"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* App Module Quick Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium whitespace-nowrap mr-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" /> Module:
        </span>
        {[
          { id: 'all', label: 'All Modules' },
          { id: 'charity_assistance', label: '🤝 Charity Aid (5000s)' },
          { id: 'admin_expense', label: '🏢 Admin & Operations (6000s)' },
          { id: 'membership', label: '💳 Member Dues (4010)' },
          { id: 'donations', label: '🎁 Donations & Grants (4020+)' },
          { id: 'banking', label: '🏦 Cash & Banks (1010-1030)' },
          { id: 'fund_equity', label: '⚖️ Fund Equity (3000s)' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setModuleFilter(m.id)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap border ${
              moduleFilter === m.id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, account name, category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          {(['all', 'Asset', 'Liability', 'Fund/Equity', 'Income', 'Expense'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-4">App Module</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Parent Code</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-500">
                      <BookOpen className="w-10 h-10 mb-3 text-slate-300" />
                      {accounts.length === 0 ? (
                        <>
                          <p className="font-semibold text-slate-800 text-sm mb-1">Chart of Accounts Not Initialized</p>
                          <p className="text-xs text-slate-500 mb-4">
                            Standard financial accounts (Relief Aid, Member Dues, Public Donations, Operations) have not been loaded yet.
                          </p>
                          <button
                            onClick={handleSyncStandardAccounts}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Loading Accounts...' : 'Load Standard Chart of Accounts'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-800 text-sm mb-1">No matching accounts found</p>
                          <p className="text-xs text-slate-500 mb-4">
                            No accounts match your current filter or search criteria.
                          </p>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setTypeFilter('all');
                              setModuleFilter('all');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Clear All Filters
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((a) => {
                  const moduleKey = a.appModule || getAccountAppModule(a.code);
                  const moduleMeta = APP_MODULE_CONFIG[moduleKey] || APP_MODULE_CONFIG.general;

                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !a.isActive ? 'bg-slate-50 opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                        {a.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{a.name}</span>
                          {a.isSystem && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 font-mono px-1 py-0.2 rounded border border-slate-200">
                              System
                            </span>
                          )}
                        </div>
                        {a.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{a.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${moduleMeta.badgeClass}`}
                        >
                          {moduleMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            TYPE_COLORS[a.type]
                          }`}
                        >
                          {a.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {a.parentCode || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        {formatCurrency(a.balance, settings.currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            a.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {a.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right no-print">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(a)}
                              title="Edit Account Details"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!a.isSystem && (
                              <button
                                onClick={() => deactivateAccount(a.id)}
                                title={a.isActive ? 'Deactivate Account' : 'Activate Account'}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-700 transition-colors"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold font-display text-slate-900">
                {editingAccount ? `Edit Account (${editingAccount.code})` : 'Create New Chart Account'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAccount}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. 5090"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    1xxx=Asset, 2xxx=Liab, 3xxx=Equity, 4xxx=Income, 5xxx=Exp, 6xxx=Admin
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                  >
                    <option value="Asset">Asset (1xxx)</option>
                    <option value="Liability">Liability (2xxx)</option>
                    <option value="Fund/Equity">Equity / Fund (3xxx)</option>
                    <option value="Income">Income (4xxx)</option>
                    <option value="Expense">Expense (5xxx / 6xxx)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    App Module Alignment
                  </label>
                  <select
                    value={formAppModule}
                    onChange={(e) => setFormAppModule(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                  >
                    <option value="charity_assistance">Charity Assistance (Direct Relief)</option>
                    <option value="admin_expense">Administrative & Operating Expenses</option>
                    <option value="membership">Member Monthly Dues</option>
                    <option value="donations">Donations & Public Relief Funds</option>
                    <option value="banking">Cash & Bank Accounts</option>
                    <option value="assets">Fixed & Capital Assets</option>
                    <option value="liabilities">Current & Long-Term Liabilities</option>
                    <option value="fund_equity">General & Restricted Fund Equity</option>
                    <option value="general">General Ledger</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Orphan Educational Aid"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Parent Account Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formParentCode}
                    onChange={(e) => setFormParentCode(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Purpose of this ledger account..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

