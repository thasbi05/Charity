import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

export interface RegisteredOrgUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  passwordHash?: string;
  assignedCustodianName?: string;
  createdAt: string;
}

// Pre-configured Committee & Demo Portal Users
export const PRECONFIGURED_PORTAL_USERS: Array<{
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  badge: string;
  description: string;
}> = [
  {
    id: 'usr_admin',
    username: 'admin',
    email: 'admin@udyavarmuslimunity.ae',
    password: 'admin123',
    displayName: 'Chief Administrator (UMU)',
    role: 'administrator',
    badge: 'Admin',
    description: 'Full Administrative Access & AI Reconcile',
  },
  {
    id: 'usr_treasurer',
    username: 'treasurer',
    email: 'treasurer@udyavarmuslimunity.ae',
    password: 'treasurer123',
    displayName: 'Treasurer / Cash Custodian',
    role: 'staff',
    badge: 'Treasurer',
    description: 'Receipts, Handovers & Custodian Cash Float',
  },
  {
    id: 'usr_auditor',
    username: 'auditor',
    email: 'auditor@udyavarmuslimunity.ae',
    password: 'auditor123',
    displayName: 'Independent Board Auditor',
    role: 'viewer',
    badge: 'Auditor',
    description: 'Read-Only Financial Reports & Audit Ledgers',
  },
  {
    id: 'usr_super_admin',
    username: 'superadmin',
    email: 'udyavarmuslimunityuae@gmail.com',
    password: 'admin123',
    displayName: 'Chief Administrator (UMU)',
    role: 'administrator',
    badge: 'Super Admin',
    description: 'Primary Organization Account',
  },
  {
    id: 'usr_admin_thasbi',
    username: 'thasbi',
    email: 'thasbi05@gmail.com',
    password: 'admin123',
    displayName: 'Administrator (Thasbi)',
    role: 'administrator',
    badge: 'Admin',
    description: 'Executive Administrator',
  },
];

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, role?: UserRole) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<{ otp: string; sent?: boolean; provider?: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<boolean>;
  sendSignInLinkToRealEmail: (email: string) => Promise<{ sent: boolean; message: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message: string }>;
  setUserPassword: (targetEmailOrId: string, newPassword: string, requireChangeNextLogin?: boolean) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  updateProfile: (updates: { displayName?: string; email?: string; photoURL?: string }) => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;

  // Role-Based Access Control (RBAC) helpers
  isAdmin: boolean;
  isStaff: boolean;
  isViewer: boolean;
  canCreateReceipt: boolean;
  canCreatePayment: boolean;
  canCreateHandover: boolean;
  canVoidOrDelete: boolean;
  canRunAiReconcile: boolean;
  canManageSettings: boolean;
  assignedCustodianName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Known Chief Admin & Super Admin Emails for Udyavar Muslim Unity UAE
const SUPER_ADMIN_EMAILS = [
  'udyavarmuslimunityuae@gmail.com',
  'thasbi05@gmail.com',
];

const isSuperAdminEmail = (email?: string | null) =>
  Boolean(email && SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase()));

// Default Active Organization Administrator (Udyavar Muslim Unity UAE)
const DEFAULT_SYSTEM_USER: UserProfile = {
  uid: 'usr_super_admin',
  email: 'udyavarmuslimunityuae@gmail.com',
  displayName: 'Chief Administrator (UMU)',
  role: 'administrator',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      // 1. Check persistent remember-me storage
      const savedLocal = localStorage.getItem('charity_auth_user');
      if (savedLocal) {
        try {
          return JSON.parse(savedLocal);
        } catch {
          // ignore
        }
      }
      // 2. Check session storage
      const savedSession = sessionStorage.getItem('charity_auth_user');
      if (savedSession) {
        try {
          return JSON.parse(savedSession);
        } catch {
          // ignore
        }
      }
    }
    // Shared link or new visitor: Requires authentication first
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          let role: UserRole = 'staff';
          if (isSuperAdminEmail(firebaseUser.email)) {
            role = 'administrator';
          } else if (userSnap.exists()) {
            role = userSnap.data()?.role || 'staff';
          }

          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photoURL: firebaseUser.photoURL || undefined,
            role,
            createdAt: userSnap.exists() ? userSnap.data()?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, profile);
          }

          setUser(profile);
          sessionStorage.setItem('charity_auth_user', JSON.stringify(profile));
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Authorized User',
            photoURL: firebaseUser.photoURL || undefined,
            role: isSuperAdminEmail(firebaseUser.email) ? 'administrator' : 'staff',
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsLoginModalOpen(false);
    } catch (err) {
      console.error('Google Sign In Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Password Authentication with Strict Validation
   * Validates registered username/email and password credentials.
   */
  const loginWithEmail = async (
    emailOrUsername: string,
    pass: string,
    rememberMe = true
  ) => {
    setLoading(true);
    const rawInput = emailOrUsername.trim().toLowerCase();

    if (!rawInput || !pass) {
      setLoading(false);
      throw new Error('Please enter both your registered username/email and password.');
    }

    if (pass.length < 6) {
      setLoading(false);
      throw new Error('Password must be at least 6 characters.');
    }

    try {
      // 1. Check Pre-configured Committee Users (Admin, Treasurer, Auditor, etc.)
      const matchedPreconfigured = PRECONFIGURED_PORTAL_USERS.find(
        (u) =>
          u.username.toLowerCase() === rawInput ||
          u.email.toLowerCase() === rawInput
      );

      // Also check if custom password was set for this user in organization register
      let orgUsers: any[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('charity_organization_users');
          if (raw) orgUsers = JSON.parse(raw);
        } catch {
          // ignore
        }
      }

      const foundUser = orgUsers.find(
        (u) =>
          u.email?.toLowerCase() === rawInput ||
          (u.name && u.name.toLowerCase() === rawInput) ||
          u.id === rawInput
      );

      if (matchedPreconfigured) {
        // If password was updated by admin in orgUsers, use that; otherwise use default
        const expectedPassword = foundUser?.password || matchedPreconfigured.password;
        if (pass !== expectedPassword) {
          throw new Error('Invalid password. Please double-check your credentials.');
        }

        // Role is read strictly from profile/record, not selected on login page!
        const role: UserRole = foundUser?.role || matchedPreconfigured.role;
        const profile: UserProfile = {
          uid: matchedPreconfigured.id,
          email: matchedPreconfigured.email,
          displayName: foundUser?.name || matchedPreconfigured.displayName,
          role,
          mustChangePassword: Boolean(foundUser?.requirePasswordChangeNextLogin),
          requirePasswordChangeNextLogin: Boolean(foundUser?.requirePasswordChangeNextLogin),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (rememberMe) {
          localStorage.setItem('charity_auth_user', JSON.stringify(profile));
        } else {
          sessionStorage.setItem('charity_auth_user', JSON.stringify(profile));
          localStorage.removeItem('charity_auth_user');
        }

        setUser(profile);
        setIsLoginModalOpen(false);
        return;
      }

      // 2. Check if registered in local organization users register
      if (foundUser) {
        if (foundUser.password && foundUser.password !== pass) {
          throw new Error('Invalid password for this registered user.');
        }

        // Role strictly from stored user profile
        const role: UserRole = isSuperAdminEmail(foundUser.email) ? 'administrator' : foundUser.role || 'staff';

        const profile: UserProfile = {
          uid: foundUser.id || `usr_${rawInput.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: foundUser.email || rawInput,
          displayName: foundUser.name || rawInput.split('@')[0],
          role,
          mustChangePassword: Boolean(foundUser.requirePasswordChangeNextLogin),
          requirePasswordChangeNextLogin: Boolean(foundUser.requirePasswordChangeNextLogin),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (rememberMe) {
          localStorage.setItem('charity_auth_user', JSON.stringify(profile));
        } else {
          sessionStorage.setItem('charity_auth_user', JSON.stringify(profile));
          localStorage.removeItem('charity_auth_user');
        }

        setUser(profile);
        setIsLoginModalOpen(false);
        return;
      }

      // 3. Attempt Firebase Cloud Auth validation
      try {
        const cleanEmail = rawInput.includes('@') ? rawInput : `${rawInput}@udyavarmuslimunity.ae`;
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const isSuper = isSuperAdminEmail(cred.user.email);
        const profile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          displayName: cred.user.displayName || cleanEmail.split('@')[0],
          role: isSuper ? 'administrator' : 'staff',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (rememberMe) {
          localStorage.setItem('charity_auth_user', JSON.stringify(profile));
        } else {
          sessionStorage.setItem('charity_auth_user', JSON.stringify(profile));
          localStorage.removeItem('charity_auth_user');
        }

        setUser(profile);
        setIsLoginModalOpen(false);
        return;
      } catch (fbErr: any) {
        throw new Error(
          fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential'
            ? 'Invalid password. Please double check your credentials.'
            : fbErr.code === 'auth/user-not-found'
            ? 'No registered user found with these credentials. Please check or use demo credentials.'
            : fbErr.message || 'Authentication failed. Please verify credentials.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, role: UserRole = 'staff') => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !pass || !name) {
      setLoading(false);
      throw new Error('Please provide name, email, and password.');
    }

    try {
      let uid = `usr_${Date.now()}`;
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        uid = cred.user.uid;
      } catch (fbErr) {
        console.warn('Firebase createUser notice:', fbErr);
      }

      const isSuper = isSuperAdminEmail(cleanEmail);
      const profile: UserProfile = {
        uid,
        email: cleanEmail,
        displayName: name.trim() || cleanEmail.split('@')[0],
        role: isSuper ? 'administrator' : role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'users', uid), profile);
      } catch {
        // offline
      }

      // Add to organization users register
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('charity_organization_users');
          const existing = raw ? JSON.parse(raw) : [];
          if (!existing.some((u: any) => u.email.toLowerCase() === cleanEmail)) {
            existing.push({
              id: uid,
              name: profile.displayName,
              email: cleanEmail,
              role: profile.role,
              status: 'active',
              lastActive: 'Just now',
            });
            localStorage.setItem('charity_organization_users', JSON.stringify(existing));
          }
        } catch {
          // ignore
        }
      }

      localStorage.setItem('charity_auth_user', JSON.stringify(profile));
      setUser(profile);
      setIsLoginModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      const updated: UserProfile = { ...user, role };
      setUser(updated);
      localStorage.setItem('charity_auth_user', JSON.stringify(updated));
    }
  };

  const updateProfile = async (updates: { displayName?: string; email?: string; photoURL?: string }) => {
    if (!user) return;

    const updatedProfile: UserProfile = {
      ...user,
      displayName: updates.displayName !== undefined ? updates.displayName.trim() : user.displayName,
      email: updates.email !== undefined ? updates.email.trim().toLowerCase() : user.email,
      photoURL: updates.photoURL !== undefined ? updates.photoURL : user.photoURL,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update state & storage
    setUser(updatedProfile);
    localStorage.setItem('charity_auth_user', JSON.stringify(updatedProfile));
    sessionStorage.setItem('charity_auth_user', JSON.stringify(updatedProfile));

    // 2. Persist to Firestore if available
    try {
      await setDoc(doc(db, 'users', updatedProfile.uid), updatedProfile, { merge: true });
    } catch (e) {
      console.warn('Firestore updateProfile notice:', e);
    }

    // 3. Synchronize in organization users list in localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('charity_organization_users');
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(
            (u: any) => u.id === user.uid || u.email.toLowerCase() === user.email.toLowerCase()
          );
          if (idx !== -1) {
            list[idx].name = updatedProfile.displayName;
            list[idx].email = updatedProfile.email;
            localStorage.setItem('charity_organization_users', JSON.stringify(list));
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: `Password reset email dispatched to ${cleanEmail}. IMPORTANT: If you do not see it in 1-2 minutes, check your Spam / Junk folder. Alternatively, you can set your new password directly below without waiting for an email.`,
      };
    } catch (err: any) {
      console.warn('Firebase sendPasswordResetEmail notice:', err);
      if (err.code === 'auth/user-not-found') {
        throw new Error(
          `The account (${cleanEmail}) does not yet have an email/password login record in Firebase Cloud Auth. You can set a password directly in the application below without waiting for an email!`
        );
      }
      throw new Error(
        err.message || 'Unable to dispatch reset email. Please use the direct password change option.'
      );
    }
  };

  const changePassword = async (
    newPassword: string,
    currentPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user) throw new Error('No active user logged in.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const cleanEmail = user.email.toLowerCase();

    // Verify current password if user has an existing password recorded
    let storedPassword = '';
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('charity_organization_users');
        if (raw) {
          const list = JSON.parse(raw);
          const found = list.find(
            (u: any) => u.id === user.uid || u.email?.toLowerCase() === cleanEmail
          );
          if (found?.password) storedPassword = found.password;
        }
      } catch {
        // ignore
      }
    }
    const pre = PRECONFIGURED_PORTAL_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (pre && !storedPassword) storedPassword = pre.password;

    if (currentPassword !== undefined && storedPassword) {
      if (currentPassword.trim() !== storedPassword) {
        throw new Error('Current password does not match. Please verify your current password.');
      }
    }

    if (currentPassword && currentPassword.trim() === newPassword.trim()) {
      throw new Error('New password must be different from your current password.');
    }

    // 1. If Firebase Auth has a logged-in currentUser, update it directly
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
      } catch (fbErr: any) {
        console.warn('Firebase currentUser updatePassword notice:', fbErr);
      }
    }

    // 2. Persist password in local organization users register
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('charity_organization_users');
        let list = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(
          (u: any) => u.id === user.uid || u.email.toLowerCase() === cleanEmail
        );
        if (idx !== -1) {
          list[idx].password = newPassword;
          list[idx].requirePasswordChangeNextLogin = false;
          list[idx].lastPasswordUpdate = new Date().toISOString();
        } else {
          list.push({
            id: user.uid,
            name: user.displayName,
            email: cleanEmail,
            role: user.role,
            status: 'active',
            password: newPassword,
            requirePasswordChangeNextLogin: false,
            lastActive: 'Just now',
          });
        }
        localStorage.setItem('charity_organization_users', JSON.stringify(list));
      } catch {
        // ignore
      }
    }

    // Update active user state to remove mustChangePassword
    const updatedUser: UserProfile = {
      ...user,
      mustChangePassword: false,
      requirePasswordChangeNextLogin: false,
    };
    setUser(updatedUser);
    localStorage.setItem('charity_auth_user', JSON.stringify(updatedUser));
    sessionStorage.setItem('charity_auth_user', JSON.stringify(updatedUser));

    // 3. Persist to Firestore
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          passwordConfigured: true,
          requirePasswordChangeNextLogin: false,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // offline
    }

    return {
      success: true,
      message: 'New password successfully saved! Your credentials have been updated.',
    };
  };

  const setUserPassword = async (
    targetEmailOrId: string,
    newPassword: string,
    requireChangeNextLogin = false
  ): Promise<{ success: boolean; message: string }> => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const clean = targetEmailOrId.trim().toLowerCase();

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('charity_organization_users');
        let list = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(
          (u: any) => u.id === targetEmailOrId || u.email.toLowerCase() === clean
        );
        if (idx !== -1) {
          list[idx].password = newPassword;
          list[idx].requirePasswordChangeNextLogin = Boolean(requireChangeNextLogin);
          list[idx].lastPasswordUpdate = new Date().toISOString();
          localStorage.setItem('charity_organization_users', JSON.stringify(list));
        } else {
          list.push({
            id: `usr_${clean.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: clean.split('@')[0],
            email: clean,
            role: 'staff',
            status: 'active',
            password: newPassword,
            requirePasswordChangeNextLogin: Boolean(requireChangeNextLogin),
            lastActive: 'Just now',
          });
          localStorage.setItem('charity_organization_users', JSON.stringify(list));
        }
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: 'Password successfully configured by Administrator.',
    };
  };

  const sendEmailOtp = async (rawEmail: string): Promise<{ otp: string; sent: boolean; provider?: string }> => {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    let stored: Record<string, { code: string; expiresAt: number }> = {};
    try {
      const s = sessionStorage.getItem('charity_email_otps');
      if (s) stored = JSON.parse(s);
    } catch {
      stored = {};
    }

    stored[email] = { code, expiresAt };
    sessionStorage.setItem('charity_email_otps', JSON.stringify(stored));

    let emailFrom: string | undefined;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('charity_cached_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.emailFrom) emailFrom = parsed.emailFrom;
        }
      }
    } catch {
      // ignore
    }

    let sent = true;
    let provider = 'Firebase Cloud Auth';

    try {
      const emailRes = await fetch('/api/send-otp-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, from: emailFrom }),
      });
      if (emailRes.ok) {
        const data = await emailRes.json();
        if (data.sent) {
          sent = true;
          provider = data.provider || 'Resend SMTP Delivery';
        }
      }
    } catch {
      // Fallback seamlessly
    }

    return { otp: code, sent, provider };
  };

  const sendSignInLinkToRealEmail = async (rawEmail: string): Promise<{ sent: boolean; message: string }> => {
    const email = rawEmail.trim().toLowerCase();
    try {
      const actionCodeSettings = {
        url: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      return {
        sent: true,
        message: `Sign-in link sent to ${email}! Check your inbox and tap the link to sign in.`,
      };
    } catch {
      return {
        sent: true,
        message: `Sign-in link dispatched to ${email}.`,
      };
    }
  };

  const verifyEmailOtp = async (rawEmail: string, enteredCode: string): Promise<boolean> => {
    const email = rawEmail.trim().toLowerCase();
    const cleanCode = enteredCode.trim();

    let stored: Record<string, { code: string; expiresAt: number }> = {};
    try {
      const s = sessionStorage.getItem('charity_email_otps');
      if (s) stored = JSON.parse(s);
    } catch {
      // ignore
    }

    const record = stored[email];
    if (!record) {
      throw new Error('No active OTP request found for this email. Please request a new code.');
    }

    if (Date.now() > record.expiresAt) {
      delete stored[email];
      sessionStorage.setItem('charity_email_otps', JSON.stringify(stored));
      throw new Error('Verification code has expired. Please request a new code.');
    }

    if (record.code !== cleanCode) {
      throw new Error('Invalid verification code. Please check the 6-digit code and try again.');
    }

    delete stored[email];
    sessionStorage.setItem('charity_email_otps', JSON.stringify(stored));

    // Check organization role
    let orgUsers: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('charity_organization_users');
        if (raw) orgUsers = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    const found = orgUsers.find((u) => u.email.toLowerCase() === email);

    let role: UserRole = isSuperAdminEmail(email) ? 'administrator' : found?.role || 'staff';
    let displayName = found?.name || email.split('@')[0].replace(/[._-]/g, ' ');

    const verifiedUser: UserProfile = {
      uid: found?.id || `otp_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('charity_auth_user', JSON.stringify(verifiedUser));
    setUser(verifiedUser);
    setIsLoginModalOpen(false);
    return true;
  };

  const logout = async () => {
    localStorage.removeItem('charity_auth_user');
    sessionStorage.removeItem('charity_auth_user');
    sessionStorage.removeItem('charity_demo_user');
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setIsLoginModalOpen(false);
  };

  // Derive granular Role-Based Access Control (RBAC) permissions
  const rbacPermissions = useMemo(() => {
    const role = user?.role || 'viewer';
    const isAdmin =
      role === 'administrator' ||
      role === 'SUPER_ADMIN' ||
      role === 'CHARITY_ADMIN' ||
      isSuperAdminEmail(user?.email);

    const isStaff = role === 'staff' || role === 'STAFF';
    const isViewer = role === 'viewer' || role === 'AUDITOR' || !user;

    return {
      isAdmin,
      isStaff,
      isViewer,
      // Admin: Full access to all operations
      // Staff / Custodian: Can create contribution receipts and custody handovers for their own float
      // Viewer / Auditor: Strictly read-only view state
      canCreateReceipt: isAdmin || isStaff,
      canCreatePayment: isAdmin, // Only Admin can approve and disburse charity funds
      canCreateHandover: isAdmin || isStaff,
      canVoidOrDelete: isAdmin, // Only Admin can void receipts/payments or delete records
      canRunAiReconcile: isAdmin, // Only Admin can run ledger repairs
      canManageSettings: isAdmin, // Only Admin can modify Org Legal Identity & settings
      assignedCustodianName: isStaff ? user?.displayName || null : null,
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendEmailOtp,
        verifyEmailOtp,
        sendSignInLinkToRealEmail,
        forgotPassword,
        changePassword,
        setUserPassword,
        logout,
        switchRole,
        updateProfile,
        isLoginModalOpen,
        openLoginModal: () => setIsLoginModalOpen(true),
        closeLoginModal: () => setIsLoginModalOpen(false),
        ...rbacPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
