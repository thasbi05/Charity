import React, { useState } from 'react';
import {
  Mail,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Smartphone,
  ShieldAlert,
  LogIn,
  X,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCharity } from '../../context/CharityContext';
import { PWAInstallModal } from '../Common/PWAInstallModal';

interface LoginPageProps {
  onSuccess?: () => void;
  isModal?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, isModal = false }) => {
  const { loginWithEmail } = useAuth();
  const { settings, activeCharity } = useCharity();

  // Active organization identity
  const organizationName =
    activeCharity?.charityName ||
    settings?.charityName ||
    'Udyavar Muslim Unity UAE';

  const organizationLogo =
    activeCharity?.logoUrl ||
    settings?.logoUrl ||
    '/logo-emblem.svg';

  // Form Fields
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Informational Forgot Password dialog
  const [showForgotPasswordNotice, setShowForgotPasswordNotice] = useState(false);

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // PWA Modal
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = emailOrUsername.trim();
    if (!cleanIdentifier || !password.trim()) {
      setError('Please provide your authorized username/email and password.');
      return;
    }

    setLoading(true);
    try {
      // Role is derived directly from user profile on authentication
      await loginWithEmail(cleanIdentifier, password, rememberMe);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden my-auto transition-all">
      {/* Header: Organization Identity */}
      <div className="p-6 sm:p-7 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative border-b border-emerald-900/40">
        <div className="flex items-start gap-4">
          <div className="w-13 h-13 rounded-2xl bg-white p-1.5 shadow-lg shrink-0 border border-emerald-400/30 flex items-center justify-center">
            <img
              src={organizationLogo}
              alt={organizationName}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight leading-snug">
              {organizationName}
            </h1>
            <p className="text-emerald-300 text-xs sm:text-[13px] font-medium leading-relaxed mt-1">
              Financial Transparency &amp; Charity Ledger Management System
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Protected Accounting Portal &bull; Secure PWA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Login Form Body */}
      <div className="p-6 sm:p-7 space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Field 1: Username / Email */}
          <div>
            <label
              htmlFor="login-username-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Username / Email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="login-username-input"
                type="text"
                required
                autoFocus
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="admin@udyavarmuslimunity.ae or username"
                className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Field 2: Password with Show/Hide and Restricted Forgot Password trigger */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password-input"
                className="text-xs font-semibold text-slate-700"
              >
                Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPasswordNotice(true)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline font-semibold cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Keep me signed in */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-slate-700 font-medium">Keep me signed in on this device</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            id="login-submit-btn"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-slate-950/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Validating Credentials...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>Sign In to Accounting Portal</span>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Real-time Cloud Sync &bull; 256-bit SSL</span>
        </div>
        <button
          type="button"
          onClick={() => setIsPwaModalOpen(true)}
          className="text-emerald-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install PWA App</span>
        </button>
      </div>

      {/* Strict Administrative Forgot Password Informational Modal */}
      {showForgotPasswordNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                  Administrative Access Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordNotice(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <p className="font-bold">Password resets are restricted for security.</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Automated public password recovery has been disabled to safeguard charity ledger records.
                </p>
              </div>

              <p className="leading-relaxed text-slate-600">
                Please contact the <strong>Super Admin / Chief Administrator</strong> to reset your credentials. The Administrator can issue a secure password directly from the User Management panel.
              </p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Official Support Contact:
                </span>
                <p className="font-mono text-xs font-bold text-slate-900 select-all">
                  udyavarmuslimunityuae@gmail.com
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForgotPasswordNotice(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Understood &bull; Return to Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {isPwaModalOpen && (
        <PWAInstallModal
          isOpen={isPwaModalOpen}
          onClose={() => setIsPwaModalOpen(false)}
        />
      )}
    </div>
  );

  if (isModal) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {content}
    </div>
  );
};
