import React from 'react';
import { ShieldAlert, LogIn, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface AuthSessionGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole | 'admin_only' | 'staff_or_admin';
  fallbackMessage?: string;
}

export const AuthSessionGuard: React.FC<AuthSessionGuardProps> = ({
  children,
  requiredRole,
  fallbackMessage,
}) => {
  const { user, loading, isAdmin, isStaff, openLoginModal } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium mt-3">Verifying authenticated session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow-xl border border-slate-200 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-emerald-400" />
        </div>
        <h3 className="font-bold text-slate-900 text-base">Authentication Required</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          You must sign in with your authorized registered organization credentials to access this section.
        </p>
        <button
          type="button"
          onClick={openLoginModal}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In With Credentials</span>
        </button>
      </div>
    );
  }

  // Check specific RBAC roles
  if (requiredRole === 'admin_only' && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-white rounded-2xl shadow-xl border border-rose-200 text-center animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-base">Administrative Access Restricted</h3>
        <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">
          {fallbackMessage ||
            `This module requires Administrator permissions. You are currently authenticated as "${user.displayName}" with role "${user.role?.toUpperCase()}".`}
        </p>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-left">
          <p className="font-semibold text-slate-700">RBAC Enforcement Active:</p>
          <p className="mt-0.5">Contact the Chief Administrator to request elevated privileges.</p>
        </div>
      </div>
    );
  }

  if (requiredRole === 'staff_or_admin' && !isAdmin && !isStaff) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 bg-white rounded-2xl shadow-xl border border-amber-200 text-center animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-900 text-base">Staff Custodian Access Required</h3>
        <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">
          {fallbackMessage ||
            'You are currently logged in as a Viewer / Auditor (read-only mode). Action buttons to create or mutate records are restricted.'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
