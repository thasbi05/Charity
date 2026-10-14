import React, { useState } from 'react';
import {
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  Eye,
  Building,
  Keyboard,
  ChevronDown,
  Check,
  Plus,
  X,
  AlertCircle,
  Trash2,
  Palette,
  Wifi,
  WifiOff,
  LogOut,
  User,
  LogIn,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCharity } from '../context/CharityContext';
import { useNavigation } from '../context/NavigationContext';
import { useRealtimeLedger } from '../hooks/useRealtimeLedger';
import { SyncTelemetryModal } from './Common/SyncTelemetryModal';
import { UserProfileDropdown } from './Common/UserProfileDropdown';
import { UserRole } from '../types';
import { NavTab } from './Sidebar';
import { CountrySelect } from './Common/CountrySelect';
import { getCountryCurrency, getCountryDialCode } from '../utils/countries';
import { PWAInstallButton } from './Common/PWAInstallButton';

interface TopbarProps {
  currentTab?: NavTab;
  onNavigate?: (tab: NavTab) => void;
  setIsMobileOpen?: (open: boolean) => void;
  onToggleMobileSidebar?: () => void;
  openGlobalSearch?: () => void;
  onOpenSearch?: () => void;
  openCreateReceipt?: () => void;
  onOpenNewReceipt?: () => void;
  openCreatePayment?: () => void;
  onOpenNewPayment?: () => void;
  openShortcutsHelp?: () => void;
  onOpenShortcutsHelp?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onNavigate,
  setIsMobileOpen,
  onToggleMobileSidebar,
  openGlobalSearch,
  onOpenSearch,
  openCreateReceipt,
  onOpenNewReceipt,
  openCreatePayment,
  onOpenNewPayment,
  openShortcutsHelp,
  onOpenShortcutsHelp,
}) => {
  const { user, openLoginModal, logout } = useAuth();
  const { openOrganizationSettings } = useNavigation();
  const { settings, charities, activeCharityId, activeCharity, switchCharity, addCharity, deleteCharity } =
    useCharity();

  const { isOnline, isLiveSyncConnected, pendingCount } = useRealtimeLedger();
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isAdmin =
    user?.role === 'administrator' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'CHARITY_ADMIN' ||
    !user?.role ||
    user?.role === ('admin' as any);

  const [isCharityMenuOpen, setIsCharityMenuOpen] = useState(false);
  const [isAddCharityOpen, setIsAddCharityOpen] = useState(false);
  const [newCharityName, setNewCharityName] = useState('');
  const [newCharityCountry, setNewCharityCountry] = useState('United Arab Emirates');
  const [newCharityReg, setNewCharityReg] = useState('');
  const [newCharityCurrency, setNewCharityCurrency] = useState('AED');
  const [newCharityEmail, setNewCharityEmail] = useState('');
  const [newCharityPhone, setNewCharityPhone] = useState('');
  const [newCharityAddress, setNewCharityAddress] = useState('');
  const [isCreatingCharity, setIsCreatingCharity] = useState(false);
  const [charityError, setCharityError] = useState('');

  const handleToggleMobile = () => {
    if (typeof onToggleMobileSidebar === 'function') {
      onToggleMobileSidebar();
    } else if (typeof setIsMobileOpen === 'function') {
      setIsMobileOpen(true);
    }
  };

  const handleGlobalSearch = () => {
    if (typeof openGlobalSearch === 'function') openGlobalSearch();
    if (typeof onOpenSearch === 'function') onOpenSearch();
  };

  const handleCreateReceipt = () => {
    if (typeof openCreateReceipt === 'function') openCreateReceipt();
    if (typeof onOpenNewReceipt === 'function') onOpenNewReceipt();
  };

  const handleCreatePayment = () => {
    if (typeof openCreatePayment === 'function') openCreatePayment();
    if (typeof onOpenNewPayment === 'function') onOpenNewPayment();
  };

  const handleShortcutsHelp = () => {
    if (typeof openShortcutsHelp === 'function') openShortcutsHelp();
    if (typeof onOpenShortcutsHelp === 'function') onOpenShortcutsHelp();
  };

  return (
    <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Quick Navigation */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <button
          id="topbar-mobile-menu-btn"
          onClick={handleToggleMobile}
          className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs text-xs font-semibold shrink-0 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4 text-emerald-400" />
          <span>Menu</span>
        </button>

        {/* Quick Nav Dropdown on Mobile / Small Screens */}
        {onNavigate && (
          <select
            value={currentTab || 'dashboard'}
            onChange={(e) => onNavigate(e.target.value as NavTab)}
            className="md:hidden text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0"
            aria-label="Select section"
          >
            <option value="dashboard">Dashboard</option>
            <option value="members">Members</option>
            <option value="monthly-status">Monthly Matrix</option>
            <option value="receipts">Receipts</option>
            <option value="payments">Payments</option>
            <option value="chart-of-accounts">Chart of Accounts</option>
            <option value="cash-bank">Cash & Bank</option>
            <option value="transactions">Transactions</option>
            <option value="reports">Reports</option>
            <option value="settings">Settings</option>
          </select>
        )}

        {/* Global Search button */}
        <button
          id="topbar-search-btn"
          onClick={handleGlobalSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-500 text-xs transition-colors border border-slate-200/80 w-44 sm:w-64"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate text-left flex-1">Search records...</span>
          <kbd className="px-1 py-0.5 text-[9px] font-mono font-semibold text-slate-500 bg-white border border-slate-300 rounded shadow-2xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Action Buttons, Shortcuts & Role Selector */}
      <div className="flex items-center gap-2.5">
        {/* Help & Documentation Center / Shortcuts Button */}
        <button
          id="topbar-shortcuts-btn"
          onClick={handleShortcutsHelp}
          title="Help, Double-Entry Guide & Keyboard Shortcuts (Press ?)"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 text-xs font-medium cursor-pointer"
        >
          <Keyboard className="w-4 h-4 text-emerald-600" />
          <span className="hidden xl:inline text-xs font-semibold">Help & Docs</span>
          <kbd className="hidden lg:inline-block font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
            ?
          </kbd>
        </button>

        {/* PWA / WPA Install Link Button */}
        <PWAInstallButton variant="topbar" />

        {/* Multi-Charity Organization Switcher */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              id="topbar-charity-switcher-btn"
              onClick={() => setIsCharityMenuOpen(!isCharityMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Switch Charity Organization"
            >
              <img
                src={activeCharity?.logoUrl || settings?.logoUrl || '/logo-emblem.svg'}
                alt="Logo"
                className="w-4 h-4 rounded-full object-contain shrink-0 bg-white"
              />
              <span className="font-brand max-w-[120px] sm:max-w-[170px] truncate tracking-wide font-bold">
                {activeCharity?.charityName || settings.charityName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            </button>

            {isCharityMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsCharityMenuOpen(false)}
                />
                <div
                  id="charity-switcher-dropdown"
                  className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Organizations ({charities.length})
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-medium">
                      Multi-Tenant
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto py-1">
                    {charities.map((c) => {
                      const isCurrent = c.id === activeCharityId;
                      const canDelete = user?.role === 'administrator' && !isCurrent && charities.length > 1 && c.id !== 'default' && c.id !== charities[0]?.id;
                      return (
                        <div
                          key={c.id}
                          className={`w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                            isCurrent ? 'bg-emerald-50/70 text-emerald-950 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          <button
                            id={`switch-charity-${c.id}`}
                            type="button"
                            onClick={() => {
                              switchCharity(c.id);
                              setIsCharityMenuOpen(false);
                            }}
                            className="min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <p className="text-xs truncate font-medium">{c.charityName}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {c.registrationNumber ? `Reg: ${c.registrationNumber} • ` : ''}
                              {c.currency}
                            </p>
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to remove organization "${c.charityName}"?`)) {
                                    try {
                                      await deleteCharity(c.id);
                                    } catch (err: any) {
                                      alert(err.message || 'Failed to delete charity.');
                                    }
                                  }
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete this organization profile"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isAdmin && (
                    <div className="p-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <button
                        id="btn-dropdown-edit-branding"
                        onClick={() => {
                          setIsCharityMenuOpen(false);
                          openOrganizationSettings();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Edit Profile & Branding</span>
                      </button>

                      <button
                        id="btn-register-new-charity"
                        onClick={() => {
                          setIsCharityMenuOpen(false);
                          setIsAddCharityOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Register New Charity</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <button
              id="topbar-edit-org-branding-btn"
              onClick={openOrganizationSettings}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Edit Organization Profile & Branding"
            >
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span>Branding</span>
            </button>
          )}
        </div>

        {/* Live Sync Status Indicator (Clickable for Telemetry) */}
        <button
          id="topbar-live-sync-indicator"
          onClick={() => setIsSyncModalOpen(true)}
          title="Click to view Real-Time Multi-Device Cloud Sync Telemetry"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
            isOnline && isLiveSyncConnected && pendingCount === 0
              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isOnline && isLiveSyncConnected && pendingCount === 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </>
            )}
          </span>
          <span className="hidden lg:inline font-semibold">
            {isOnline && isLiveSyncConnected && pendingCount === 0
              ? '🟢 Live Sync Connected'
              : pendingCount > 0
              ? `🟠 Offline Mode (${pendingCount} Queued)`
              : '🟠 Offline Mode'}
          </span>
          <span className="lg:hidden text-[11px] font-bold">
            {isOnline && isLiveSyncConnected && pendingCount === 0 ? '🟢 Live' : '🟠 Offline'}
          </span>
        </button>

        {/* User Profile & Hardened Session Menu */}
        <div className="relative">
          <button
            id="topbar-user-profile-btn"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
            title="Active User Account Details & Role"
          >
            <div
              className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                user?.role === 'administrator'
                  ? 'bg-emerald-600'
                  : user?.role === 'staff'
                  ? 'bg-blue-600'
                  : 'bg-amber-600'
              }`}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="leading-tight truncate max-w-[120px] font-bold text-[11px]">
                {user?.displayName && user.displayName !== 'unknown'
                  ? user.displayName
                  : 'Authorized User'}
              </span>
              <span className="text-[9px] text-slate-500 uppercase leading-none font-semibold">
                {user?.role || 'Staff'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          <UserProfileDropdown
            isOpen={isUserMenuOpen}
            onClose={() => setIsUserMenuOpen(false)}
          />
        </div>
      </div>

      {/* Register New Charity Organization Modal */}
      {isAddCharityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Register New Charity Organization</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCharityOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCharityError('');
                if (!newCharityName.trim()) {
                  setCharityError('Charity Organization name is required.');
                  return;
                }
                setIsCreatingCharity(true);
                try {
                  const newOrg = await addCharity({
                    charityName: newCharityName.trim(),
                    country: newCharityCountry.trim() || 'United Arab Emirates',
                    registrationNumber: newCharityReg.trim(),
                    currency: newCharityCurrency.trim() || 'AED',
                    email: newCharityEmail.trim(),
                    phone: newCharityPhone.trim(),
                    address: newCharityAddress.trim(),
                  });
                  switchCharity(newOrg.id);
                  setIsAddCharityOpen(false);
                  setNewCharityName('');
                  setNewCharityCountry('United Arab Emirates');
                  setNewCharityReg('');
                  setNewCharityEmail('');
                  setNewCharityPhone('');
                  setNewCharityAddress('');
                } catch (err: any) {
                  setCharityError(err.message || 'Failed to register new charity.');
                } finally {
                  setIsCreatingCharity(false);
                }
              }}
              className="p-5 space-y-3"
            >
              {charityError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{charityError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Charity Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="new-charity-name"
                  value={newCharityName}
                  onChange={(e) => setNewCharityName(e.target.value)}
                  placeholder="e.g. Udyavar Muslim Unity UAE - Chapter"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Country / Operating Region <span className="text-rose-500">*</span>
                </label>
                <CountrySelect
                  id="new-charity-country"
                  value={newCharityCountry}
                  onChange={(countryName, countryItem) => {
                    setNewCharityCountry(countryName);
                    const suggestedCurrency = countryItem?.currency || getCountryCurrency(countryName);
                    if (suggestedCurrency) {
                      setNewCharityCurrency(suggestedCurrency);
                    }
                    const dial = countryItem?.dialCode || getCountryDialCode(countryName);
                    if (!newCharityPhone || newCharityPhone.trim().startsWith('+')) {
                      setNewCharityPhone(`${dial} `);
                    }
                  }}
                  showDialCode
                  showCurrency
                  placeholder="Select operating country..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration No.
                  </label>
                  <input
                    type="text"
                    id="new-charity-reg"
                    value={newCharityReg}
                    onChange={(e) => setNewCharityReg(e.target.value)}
                    placeholder="e.g. NGO-2024-998"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating Currency <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="new-charity-currency"
                    value={newCharityCurrency}
                    onChange={(e) => setNewCharityCurrency(e.target.value.toUpperCase())}
                    placeholder="e.g. AED, USD, GBP, PKR"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    id="new-charity-email"
                    value={newCharityEmail}
                    onChange={(e) => setNewCharityEmail(e.target.value)}
                    placeholder="info@udyavarmuslimunity.org"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="new-charity-phone"
                    value={newCharityPhone}
                    onChange={(e) => setNewCharityPhone(e.target.value)}
                    placeholder="+971 4 123 4567"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Address
                </label>
                <input
                  type="text"
                  id="new-charity-address"
                  value={newCharityAddress}
                  onChange={(e) => setNewCharityAddress(e.target.value)}
                  placeholder="Dubai, United Arab Emirates"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCharityOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCharity}
                  id="submit-create-charity-btn"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingCharity ? 'Creating...' : 'Register Charity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Real-Time Cloud Sync & Offline Telemetry Modal */}
      <SyncTelemetryModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
      />
    </header>
  );
};
