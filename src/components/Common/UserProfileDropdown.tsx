import React, { useState } from 'react';
import {
  LogOut,
  Settings,
  ShieldCheck,
  UserCheck,
  Eye,
  KeyRound,
  ExternalLink,
  Edit2,
  Camera,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { EditProfileModal } from './EditProfileModal';

interface UserProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const { navigateToTab, openOrganizationSettings } = useNavigation();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'security'>('profile');

  if (!isOpen) return null;

  const roleBadgeStyle =
    user?.role === 'administrator'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : user?.role === 'staff'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-amber-100 text-amber-800 border-amber-300';

  const roleIcon =
    user?.role === 'administrator' ? (
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
    ) : user?.role === 'staff' ? (
      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <Eye className="w-3.5 h-3.5 text-amber-600" />
    );

  const roleDescription =
    user?.role === 'administrator'
      ? 'Full unrestricted administration & accounting governance'
      : user?.role === 'staff'
      ? 'Staff & Cash Custodian (Receipts & Float Handover)'
      : 'Compliance Auditor (Read-only view of ledgers & statements)';

  return (
    <>
      {/* Backdrop */}
      <div
        id="user-profile-dropdown-backdrop"
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Hardened User Profile Dropdown Menu */}
      <div
        id="user-profile-dropdown"
        className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
      >
        {/* Active Account Identity Card */}
        <div className="px-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* Avatar Photo */}
            <div className="relative shrink-0">
              <div
                className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm shadow-xs border border-slate-200 ${
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
                  <span>
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="font-bold text-slate-900 text-sm truncate leading-tight">
                  {user?.displayName && user.displayName !== 'unknown'
                    ? user.displayName
                    : 'Authorized User'}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border shrink-0 ${roleBadgeStyle}`}
                >
                  {roleIcon}
                  <span>{user?.role || 'Staff'}</span>
                </span>
              </div>
              <p className="text-slate-500 font-mono text-[11px] truncate mt-0.5">
                {user?.email && user.email !== 'unknown'
                  ? user.email
                  : 'user@udyavarmuslimunity.org'}
              </p>
            </div>
          </div>

          {/* Quick Edit Profile & Reset Password Buttons */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              id="dropdown-edit-profile-btn"
              onClick={() => {
                setProfileModalTab('profile');
                setIsEditProfileOpen(true);
              }}
              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
              title="Edit display name, email, or profile photo"
            >
              <Edit2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Edit Details &amp; Photo</span>
            </button>

            <button
              type="button"
              id="dropdown-change-password-btn"
              onClick={() => {
                setProfileModalTab('security');
                setIsEditProfileOpen(true);
              }}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
              title="Change your account password securely"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Change Password</span>
            </button>
          </div>

          <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-snug">
            {roleDescription}
          </div>
        </div>

        {/* Account & Security Quick Links */}
        <div className="py-1 px-2 space-y-0.5">
          {isAdmin && (
            <button
              type="button"
              id="dropdown-user-mgmt-btn"
              onClick={() => {
                navigateToTab('users');
                onClose();
              }}
              className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>User Management &amp; Roles</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              id="dropdown-org-settings-btn"
              onClick={() => {
                openOrganizationSettings();
                onClose();
              }}
              className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Organization Identity &amp; Branding</span>
              </span>
            </button>
          )}

          <button
            type="button"
            id="dropdown-audit-logs-btn"
            onClick={() => {
              navigateToTab('audit-logs');
              onClose();
            }}
            className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-500" />
              <span>Immutable Audit Logs</span>
            </span>
          </button>
        </div>

        {/* Secure Sign Out Action */}
        <div className="pt-2 px-3 border-t border-slate-100">
          <button
            type="button"
            id="dropdown-signout-btn"
            onClick={async () => {
              onClose();
              await logout();
            }}
            className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Securely</span>
          </button>
        </div>
      </div>

      {/* Edit Profile & Photo Dialog */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  );
};
