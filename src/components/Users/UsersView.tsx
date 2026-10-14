import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Eye,
  UserPlus,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
  Trash2,
  X,
  Mail,
  RotateCcw,
  Edit2,
  Save,
  Check,
  Camera,
  Upload,
  User,
  Sparkles,
  Copy,
  Send,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCharity } from '../../context/CharityContext';
import { UserRole } from '../../types';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { EditProfileModal } from '../Common/EditProfileModal';
import { processImageFile } from '../../utils/imageUpload';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastActive: string;
  photoUrl?: string;
  memberId?: string;
  memberNumber?: string;
}

const DEFAULT_USERS: OrgUser[] = [
  {
    id: 'usr_super_admin',
    name: 'Chief Administrator (UMU)',
    email: 'udyavarmuslimunityuae@gmail.com',
    role: 'administrator',
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: 'usr_admin_thasbi',
    name: 'Administrator (Thasbi)',
    email: 'thasbi05@gmail.com',
    role: 'administrator',
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: 'usr_staff_treasurer',
    name: 'Treasurer / Cash Custodian',
    email: 'finance@udyavarmuslimunity.org',
    role: 'staff',
    status: 'active',
    lastActive: '15 mins ago',
  },
  {
    id: 'usr_staff_relief',
    name: 'Relief & Assistance Coordinator',
    email: 'relief@udyavarmuslimunity.org',
    role: 'staff',
    status: 'active',
    lastActive: '2 hours ago',
  },
  {
    id: 'usr_auditor_board',
    name: 'Independent Board Auditor',
    email: 'audit@udyavarmuslimunity.org',
    role: 'viewer',
    status: 'active',
    lastActive: 'Yesterday',
  },
];

export const UsersView: React.FC = () => {
  const { user, isAdmin, updateProfile, setUserPassword } = useAuth();
  const { members, recordAuditLog } = useCharity();

  // Load persisted organization users or initialize defaults
  const [users, setUsers] = useState<OrgUser[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('charity_organization_users');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_USERS;
  });

  // Profile Edit State (for the active logged-in user in the card)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(user?.displayName || '');
  const [profileEmailInput, setProfileEmailInput] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'profile' | 'security'>('profile');

  // Password Management Dialog State
  const [passwordTargetUser, setPasswordTargetUser] = useState<OrgUser | null>(null);
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [showTargetPassword, setShowTargetPassword] = useState(false);
  const [isSavingTargetPassword, setIsSavingTargetPassword] = useState(false);
  const [targetPasswordSuccess, setTargetPasswordSuccess] = useState<string | null>(null);
  const [isCopiedCredentials, setIsCopiedCredentials] = useState(false);
  const [requireChangeNextLogin, setRequireChangeNextLogin] = useState(false);

  // Invite Form State (Restricted to Registered Members Only)
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [inviteForm, setInviteForm] = useState<{
    memberId: string;
    memberNumber: string;
    name: string;
    email: string;
    role: UserRole;
    photoUrl: string;
  }>({
    memberId: '',
    memberNumber: '',
    name: '',
    email: '',
    role: 'staff',
    photoUrl: '',
  });

  // Edit User in Table State (Allows editing details and photo for any user)
  const [editingTargetUser, setEditingTargetUser] = useState<OrgUser | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserRole, setEditingUserRole] = useState<UserRole>('staff');
  const [editingUserPhoto, setEditingUserPhoto] = useState('');
  const [isUploadingUserPhoto, setIsUploadingUserPhoto] = useState(false);
  const editUserPhotoInputRef = useRef<HTMLInputElement>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<OrgUser | null>(null);

  // Check for pre-selected member invite from MembersView
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const targetMemberId = sessionStorage.getItem('invite_target_member_id');
      if (targetMemberId && members.length > 0) {
        const found = members.find((m) => m.id === targetMemberId);
        if (found) {
          setSelectedMemberId(found.id);
          setInviteForm({
            memberId: found.id,
            memberNumber: found.memberNumber,
            name: found.fullName,
            email: found.email || '',
            role: 'staff',
            photoUrl: found.photoUrl || '',
          });
          setIsInviteOpen(true);
        }
        sessionStorage.removeItem('invite_target_member_id');
      }
    }
  }, [members]);

  // Sync to local storage
  const saveUsers = (updatedList: OrgUser[]) => {
    setUsers(updatedList);
    if (typeof window !== 'undefined') {
      localStorage.setItem('charity_organization_users', JSON.stringify(updatedList));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAdmin) {
      setErrorMessage('Access restricted: Only the Chief Administrator can invite organization users.');
      return;
    }

    if (!selectedMemberId) {
      setErrorMessage('Membership policy restriction: You must select a registered Member of Udyavar Muslim Unity UAE to invite as a system user.');
      return;
    }

    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      setErrorMessage('Please provide both user name and registered email address.');
      return;
    }

    const email = inviteForm.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      setErrorMessage('A user with this email address already exists in the organization.');
      return;
    }

    const newUser: OrgUser = {
      id: `usr_${Date.now()}`,
      name: inviteForm.name.trim(),
      email,
      role: inviteForm.role,
      status: 'active',
      lastActive: 'Invited just now',
      memberId: inviteForm.memberId,
      memberNumber: inviteForm.memberNumber,
      photoUrl: inviteForm.photoUrl || undefined,
    };

    const nextUsers = [...users, newUser];
    saveUsers(nextUsers);

    // Save to Firestore users collection
    try {
      await setDoc(doc(db, 'users', newUser.id), {
        uid: newUser.id,
        email: newUser.email,
        displayName: newUser.name,
        role: newUser.role,
        photoURL: newUser.photoUrl,
        memberId: newUser.memberId,
        memberNumber: newUser.memberNumber,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Firestore user save notice:', e);
    }

    setIsInviteOpen(false);
    setSelectedMemberId('');
    setInviteForm({
      memberId: '',
      memberNumber: '',
      name: '',
      email: '',
      role: 'staff',
      photoUrl: '',
    });
    setSuccessMessage(`Member "${newUser.name}" successfully granted ${newUser.role.toUpperCase()} system access.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleSaveEditedTargetUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTargetUser) return;
    setErrorMessage(null);

    const cleanName = editingUserName.trim();
    const cleanEmail = editingUserEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      setErrorMessage('Full name and email address cannot be empty.');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === editingTargetUser.id) {
        return {
          ...u,
          name: cleanName,
          email: cleanEmail,
          role: editingUserRole,
          photoUrl: editingUserPhoto || undefined,
        };
      }
      return u;
    });

    saveUsers(updated);

    // If this edited user is the current logged-in user, update their auth session too!
    if (user && (user.uid === editingTargetUser.id || user.email.toLowerCase() === editingTargetUser.email.toLowerCase())) {
      await updateProfile({
        displayName: cleanName,
        email: cleanEmail,
        photoURL: editingUserPhoto || undefined,
      });
    }

    // Save to Firestore users collection
    try {
      await setDoc(
        doc(db, 'users', editingTargetUser.id),
        {
          displayName: cleanName,
          email: cleanEmail,
          role: editingUserRole,
          photoURL: editingUserPhoto || undefined,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore user update notice:', e);
    }

    setEditingTargetUser(null);
    setSuccessMessage(`User "${cleanName}" details and photo updated successfully.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    if (!isAdmin) {
      setErrorMessage('Permission denied: Only administrators can modify roles.');
      return;
    }

    const updated = users.map((item) =>
      item.id === userId ? { ...item, role: newRole } : item
    );
    saveUsers(updated);
    const target = users.find((u) => u.id === userId);
    setSuccessMessage(`Updated role permissions for ${target?.name || 'user'} to ${newRole.toUpperCase()}.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSaveTargetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    setErrorMessage(null);
    setTargetPasswordSuccess(null);

    const cleanPass = targetNewPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return;
    }

    setIsSavingTargetPassword(true);
    try {
      await setUserPassword(passwordTargetUser.email, cleanPass, requireChangeNextLogin);

      // Record administrative reset in Audit Logs with timestamp and Super Admin identifier
      try {
        await recordAuditLog(
          'update',
          'Security / User Management',
          passwordTargetUser.id,
          `Super Admin (${user?.displayName || user?.email || 'Chief Admin'}) reset password for user "${passwordTargetUser.name}" (${passwordTargetUser.email}). Require change next login: ${requireChangeNextLogin ? 'Yes' : 'No'}.`
        );
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }

      setTargetPasswordSuccess(`Password successfully saved for ${passwordTargetUser.name}!`);
      setSuccessMessage(`Password updated for ${passwordTargetUser.name}. They can now sign in immediately.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user password.');
    } finally {
      setIsSavingTargetPassword(false);
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$!';
    let pass = 'UMU@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTargetNewPassword(pass);
    setShowTargetPassword(true);
  };

  const handleSaveActiveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!profileNameInput.trim() || !profileEmailInput.trim()) {
      setErrorMessage('Full name and email address cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({
        displayName: profileNameInput.trim(),
        email: profileEmailInput.trim().toLowerCase(),
      });

      // Update the user in the organization table if present
      const updated = users.map((u) => {
        if (u.id === user?.uid || u.email.toLowerCase() === user?.email.toLowerCase()) {
          return {
            ...u,
            name: profileNameInput.trim(),
            email: profileEmailInput.trim().toLowerCase(),
          };
        }
        return u;
      });
      saveUsers(updated);

      setIsEditingProfile(false);
      setSuccessMessage('Your profile name and email were updated successfully across the platform!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !isAdmin) return;

    const targetUser = userToDelete;
    const remainingUsers = users.filter((u) => u.id !== targetUser.id);
    saveUsers(remainingUsers);

    // Remove from Firestore
    try {
      await deleteDoc(doc(db, 'users', targetUser.id));
    } catch (e) {
      console.warn('Firestore delete user notice:', e);
    }

    setUserToDelete(null);
    setSuccessMessage(`User "${targetUser.name}" (${targetUser.email}) was permanently removed.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const PERMISSIONS = [
    {
      feature: 'Dashboard & Financial Analytics',
      admin: true,
      staff: true,
      viewer: true,
    },
    {
      feature: 'View Members & Contribution Records',
      admin: true,
      staff: true,
      viewer: true,
    },
    {
      feature: 'Add & Edit Members',
      admin: true,
      staff: true,
      viewer: false,
    },
    {
      feature: 'Issue Contribution Receipts',
      admin: true,
      staff: true,
      viewer: false,
    },
    {
      feature: 'Record Charity Assistance & Disbursements',
      admin: true,
      staff: false,
      viewer: false,
    },
    {
      feature: 'Peer Custodian Cash Float Handovers',
      admin: true,
      staff: true,
      viewer: false,
    },
    {
      feature: 'Void / Reverse Receipts & Transactions',
      admin: true,
      staff: false,
      viewer: false,
    },
    {
      feature: 'Manage Chart of Accounts & GL',
      admin: true,
      staff: false,
      viewer: false,
    },
    {
      feature: 'Audit Logs & Verification Checks',
      admin: true,
      staff: false,
      viewer: true,
    },
    {
      feature: 'Organization Legal Identity & Branding',
      admin: true,
      staff: false,
      viewer: false,
    },
    {
      feature: 'Manage & Assign User Roles',
      admin: true,
      staff: false,
      viewer: false,
    },
  ];

  return (
    <div id="users-view-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900">
            User Management &amp; Role-Based Access Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Admin governance: invite official staff emails, assign roles (Admin, Custodian, Auditor), and dispatch password resets.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdmin && (
            <button
              id="btn-add-user-open"
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Organization User</span>
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Current Active Authenticated Session Badge & Edit Profile Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        {isEditingProfile ? (
          <form onSubmit={handleSaveActiveProfile} className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Edit Your Profile Name &amp; Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name / Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="e.g. Chief Administrator (UMU)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={profileEmailInput}
                  onChange={(e) => setProfileEmailInput(e.target.value)}
                  placeholder="e.g. udyavarmuslimunityuae@gmail.com"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-sm overflow-hidden shrink-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'UM'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-base">
                    {user?.displayName && user.displayName !== 'unknown'
                      ? user.displayName
                      : 'Authorized User'}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user?.role === 'administrator'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : user?.role === 'staff'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {user?.role || 'Staff'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-edit-active-profile"
                onClick={() => {
                  setActiveProfileTab('profile');
                  setIsEditProfileModalOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Edit your display name, email, and photo avatar"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Edit Details &amp; Photo</span>
              </button>

              <button
                type="button"
                id="btn-reset-active-password"
                onClick={() => {
                  setActiveProfileTab('security');
                  setIsEditProfileModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset your password or view security info"
              >
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reset Password</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 border-l border-slate-200 pl-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>RBAC Active</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Users Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Authorized Organization Staff ({users.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Only Administrator accounts have permission to add, modify, or revoke staff access.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">User / Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const isChiefAdmin = u.email === 'udyavarmuslimunityuae@gmail.com';
                const isCurrentSelf = user?.email?.toLowerCase() === u.email.toLowerCase();

                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                            u.role === 'administrator'
                              ? 'bg-emerald-600'
                              : u.role === 'staff'
                              ? 'bg-blue-600'
                              : 'bg-amber-600'
                          }`}
                        >
                          {u.photoUrl ? (
                            <img
                              src={u.photoUrl}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span>{u.name}</span>
                          {u.memberNumber && (
                            <span className="ml-1.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {u.memberNumber}
                            </span>
                          )}
                        </div>
                        {isChiefAdmin && (
                          <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                            CHIEF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-xs whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === 'administrator'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : u.role === 'staff'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {u.role === 'administrator' && <ShieldCheck className="w-3 h-3" />}
                        {u.role === 'staff' && <UserCheck className="w-3 h-3" />}
                        {u.role === 'viewer' && <Eye className="w-3 h-3" />}
                        <span className="capitalize">{u.role}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.lastActive}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit User Details & Photo Button */}
                        {isAdmin && (
                          <button
                            type="button"
                            id={`edit-user-btn-${u.id}`}
                            onClick={() => {
                              setEditingTargetUser(u);
                              setEditingUserName(u.name);
                              setEditingUserEmail(u.email);
                              setEditingUserRole(u.role);
                              setEditingUserPhoto(u.photoUrl || '');
                            }}
                            title={`Edit details and photo for ${u.name}`}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Edit Details</span>
                          </button>
                        )}

                        {/* Manage / Reset Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordTargetUser(u);
                            setTargetNewPassword('');
                            setTargetPasswordSuccess(null);
                            setIsCopiedCredentials(false);
                          }}
                          title={`Manage or reset password for ${u.name}`}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                          <Key className="w-3 h-3 text-indigo-500" />
                          <span>Reset Password</span>
                        </button>

                        {/* Role Selector (Admin only) */}
                        {isAdmin && !isChiefAdmin && (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                          >
                            <option value="administrator">Administrator</option>
                            <option value="staff">Staff / Custodian</option>
                            <option value="viewer">Auditor / Viewer</option>
                          </select>
                        )}

                        {/* Delete User Button */}
                        {isAdmin && !isChiefAdmin && !isCurrentSelf && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            title={`Revoke access for "${u.name}"`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role-Based Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Strict Role-Based Access Control (RBAC) Matrix</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enforced across application UI, validation layers, and Firestore security rules.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">Feature / Module</th>
                <th className="py-3 px-4 text-center font-bold text-emerald-800">Administrator</th>
                <th className="py-3 px-4 text-center font-bold text-blue-800">Finance Staff / Custodian</th>
                <th className="py-3 px-4 text-center font-bold text-amber-800">Board Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PERMISSIONS.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">{p.feature}</td>
                  <td className="py-3 px-4 text-center">
                    {p.admin ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.staff ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.viewer ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Organization User Modal (Restricted: Registered Members Only) */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Invite Organization User (Registered Members Only)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Grant system role to a verified organization member
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteOpen(false);
                  setSelectedMemberId('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-5 space-y-4">
              {/* Member Restriction Notice */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Governance Rule Enforced: </span>
                  System user logins (Administrator, Cash Custodian, Auditor) may only be assigned to registered members in the organization roster.
                </div>
              </div>

              {/* Registered Member Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Registered Member <span className="text-rose-500">* (Required)</span>
                </label>
                <select
                  id="invite-member-select"
                  required
                  value={selectedMemberId}
                  onChange={(e) => {
                    const memId = e.target.value;
                    setSelectedMemberId(memId);
                    const chosen = members.find((m) => m.id === memId);
                    if (chosen) {
                      setInviteForm({
                        memberId: chosen.id,
                        memberNumber: chosen.memberNumber,
                        name: chosen.fullName,
                        email: chosen.email || '',
                        role: inviteForm.role,
                        photoUrl: chosen.photoUrl || '',
                      });
                    } else {
                      setInviteForm({
                        memberId: '',
                        memberNumber: '',
                        name: '',
                        email: '',
                        role: inviteForm.role,
                        photoUrl: '',
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium text-slate-800"
                >
                  <option value="">
                    -- Select Member from Organization Directory ({members.length} Members) --
                  </option>
                  {members.map((m) => {
                    const isAlreadyUser = users.some(
                      (u) =>
                        (m.email && u.email.toLowerCase() === m.email.toLowerCase()) ||
                        (u.memberId && u.memberId === m.id)
                    );
                    return (
                      <option key={m.id} value={m.id}>
                        {m.memberNumber} • {m.fullName} {m.email ? `(${m.email})` : ''}{' '}
                        {isAlreadyUser ? '• Already Invited' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Member Card Preview (if selected) */}
              {selectedMemberId && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-emerald-600">
                    {inviteForm.photoUrl ? (
                      <img
                        src={inviteForm.photoUrl}
                        alt={inviteForm.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{inviteForm.name ? inviteForm.name.charAt(0).toUpperCase() : 'M'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {inviteForm.name}
                      </p>
                      <span className="font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {inviteForm.memberNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Verified Member of Udyavar Muslim Unity UAE
                    </p>
                  </div>
                </div>
              )}

              {/* Login Email Address Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Email for Login <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    id="invite-user-email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="e.g. member@udyavarmuslimunity.org"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  This email will be used for authentication and password resets.
                </p>
              </div>

              {/* Assigned Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Permission Role <span className="text-rose-500">*</span>
                </label>
                <select
                  id="invite-user-role"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as UserRole })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium"
                >
                  <option value="administrator">Administrator (Full Accounting &amp; User Control)</option>
                  <option value="staff">Staff / Cash Custodian (Receipts &amp; Float Handovers)</option>
                  <option value="viewer">Auditor / Viewer (Read-only Ledgers &amp; Statements)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setSelectedMemberId('');
                  }}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberId}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Grant Access &amp; Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization User & Photo Modal (For Admin Editing Any User Row) */}
      {editingTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Edit User Details &amp; Photo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Update profile, role, and avatar for {editingTargetUser.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTargetUser} className="p-5 space-y-4">
              {/* Photo Upload for this User */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative group shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-md flex items-center justify-center text-slate-600 font-bold text-lg">
                    {editingUserPhoto ? (
                      <img
                        src={editingUserPhoto}
                        alt={editingUserName || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{editingUserName ? editingUserName.charAt(0).toUpperCase() : 'U'}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => editUserPhotoInputRef.current?.click()}
                    disabled={isUploadingUserPhoto}
                    className="absolute bottom-0 right-0 p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow border-2 border-white cursor-pointer"
                    title="Change Photo"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">User Photo</p>
                  <p className="text-[11px] text-slate-500 mb-2">Upload PNG, JPG or WEBP</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={editUserPhotoInputRef}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingUserPhoto(true);
                        try {
                          const base64 = await processImageFile(file, {
                            maxWidth: 400,
                            maxHeight: 400,
                            quality: 0.85,
                          });
                          setEditingUserPhoto(base64);
                        } catch (err: any) {
                          setErrorMessage(err.message || 'Failed to process photo.');
                        } finally {
                          setIsUploadingUserPhoto(false);
                          if (editUserPhotoInputRef.current) {
                            editUserPhotoInputRef.current.value = '';
                          }
                        }
                      }}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editUserPhotoInputRef.current?.click()}
                      disabled={isUploadingUserPhoto}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-slate-500" />
                      <span>{isUploadingUserPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                    </button>
                    {editingUserPhoto && (
                      <button
                        type="button"
                        onClick={() => setEditingUserPhoto('')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name / Display Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editingUserName}
                    onChange={(e) => setEditingUserName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={editingUserEmail}
                    onChange={(e) => setEditingUserEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Permission Role
                </label>
                <select
                  value={editingUserRole}
                  onChange={(e) => setEditingUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-medium"
                >
                  <option value="administrator">Administrator (Full Access &amp; User Control)</option>
                  <option value="staff">Staff / Custodian (Receipts &amp; Custody Floats)</option>
                  <option value="viewer">Auditor / Viewer (Read-only Ledgers &amp; Statements)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTargetUser(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Active Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        initialTab={activeProfileTab}
        onSuccess={() => {
          setSuccessMessage('Profile name and photo updated successfully!');
          setTimeout(() => setSuccessMessage(null), 3000);
        }}
      />

      {/* Target User Password Management Modal */}
      {passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Reset &amp; Set Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {passwordTargetUser.name} &bull; <span className="font-mono">{passwordTargetUser.email}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {targetPasswordSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Password Successfully Saved!</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">{targetPasswordSuccess}</p>
                    <p className="text-[10px] text-emerald-700 mt-1">
                      The user can now use this password immediately on the login screen.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Email: ${passwordTargetUser.email}\nPassword: ${targetNewPassword}`
                        );
                        setIsCopiedCredentials(true);
                        setTimeout(() => setIsCopiedCredentials(false), 2500);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 text-[11px] font-bold shadow-2xs hover:bg-emerald-100/50 cursor-pointer"
                    >
                      {isCopiedCredentials ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopiedCredentials ? 'Copied to Clipboard!' : 'Copy Login Credentials'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CARD: SET PASSWORD DIRECTLY (STRICT ADMINISTRATIVE CONTROL) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-600 rounded-lg text-white shrink-0 mt-0.5 shadow-xs">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Set New Password on User's Behalf</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Manually configure a secure password for this user. This updates their credential record immediately.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveTargetUserPassword} className="space-y-3.5 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        New Password (min 6 characters) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Generate Strong Password</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showTargetPassword ? 'text' : 'password'}
                        required
                        value={targetNewPassword}
                        onChange={(e) => setTargetNewPassword(e.target.value)}
                        placeholder="Enter or generate new password"
                        className="w-full pl-8 pr-8 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white font-mono"
                      />
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <button
                        type="button"
                        onClick={() => setShowTargetPassword(!showTargetPassword)}
                        className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 cursor-pointer"
                      >
                        {showTargetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Require Password Change on Next Login Checkbox */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-800">
                      <input
                        type="checkbox"
                        checked={requireChangeNextLogin}
                        onChange={(e) => setRequireChangeNextLogin(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="font-bold">Require password change on next login</span>
                    </label>
                    <p className="text-[10px] text-slate-500 pl-6 leading-relaxed">
                      If checked, the user will be prompted to select a new private password immediately upon their next successful sign-in.
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingTargetPassword || !targetNewPassword}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingTargetPassword ? 'Saving Password...' : 'Save & Apply New Password'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Revoke Organization Access</h3>
                  <p className="text-[11px] text-slate-500">Revoke permissions &amp; credentials</p>
                </div>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-950">Confirm Permanent Removal</p>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">
                    Are you sure you want to remove <strong>{userToDelete.name}</strong> ({userToDelete.email})? They will immediately lose authorization to log in and interact with organization ledgers.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Revocation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
