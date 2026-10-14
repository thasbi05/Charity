import React, { useState, useEffect } from 'react';
import {
  Mail,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Eye,
  X,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendEmailOtp,
    sendSignInLinkToRealEmail,
    verifyEmailOtp,
    loginAsDemoRole,
    logout,
  } = useAuth();

  const [tab, setTab] = useState<'otp' | 'password' | 'demo'>('otp');

  // OTP Form State
  const [otpEmail, setOtpEmail] = useState(user?.email || '');
  const [otpStep, setOtpStep] = useState<'input_email' | 'enter_code'>('input_email');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [generatedOtpHint, setGeneratedOtpHint] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState<number>(0);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  // Password Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerName, setRegisterName] = useState('');

  // Status / Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  if (!isOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!otpEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmittingOtp(true);
    try {
      const res = await sendEmailOtp(otpEmail.trim());
      setGeneratedOtpHint(res.otp);
      setOtpStep('enter_code');
      setOtpTimer(60);
      if (res.sent) {
        setSuccess(`6-digit verification code dispatched to real inbox (${otpEmail.trim()}) via ${res.provider}!`);
      } else {
        setSuccess(`6-digit verification code generated for ${otpEmail.trim()}. Displayed below for testing.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const handleSendRealEmailLink = async () => {
    setError(null);
    setSuccess(null);
    if (!otpEmail.trim()) {
      setError('Please enter your email address first.');
      return;
    }

    setIsSubmittingLink(true);
    try {
      const res = await sendSignInLinkToRealEmail(otpEmail.trim());
      setSuccess(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch real email link.');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!enteredOtp.trim() || enteredOtp.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsSubmittingOtp(true);
    try {
      await verifyEmailOtp(otpEmail.trim(), enteredOtp.trim());
      setSuccess('Successfully authenticated via Email OTP!');
      setTimeout(() => {
        onClose();
        setOtpStep('input_email');
        setEnteredOtp('');
        setGeneratedOtpHint(null);
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (isRegisterMode) {
        await registerWithEmail(emailInput, passwordInput, registerName || 'User');
        setSuccess('Account created and logged in!');
      } else {
        await loginWithEmail(emailInput, passwordInput);
        setSuccess('Logged in successfully!');
      }
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google sign-in error.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: UserRole) => {
    loginAsDemoRole(role);
    setSuccess(`Logged in as ${role}`);
    setTimeout(() => onClose(), 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">User Login &amp; Authentication</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Sign in with Email OTP, Google, or credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Session Banner if logged in */}
        {user && (
          <div className="px-5 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600">Active session:</span>
              <strong className="text-slate-900 font-semibold">{user.displayName}</strong>
              <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold uppercase">
                {user.role}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setTab('otp');
              setError(null);
            }}
            className={`py-3 px-2 text-center transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              tab === 'otp'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email OTP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('password');
              setError(null);
            }}
            className={`py-3 px-2 text-center transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              tab === 'password'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('demo');
              setError(null);
            }}
            className={`py-3 px-2 text-center transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              tab === 'demo'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staff Roles</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: EMAIL OTP LOGIN */}
          {tab === 'otp' && (
            <div className="space-y-4">
              {otpStep === 'input_email' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Organization or Personal Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        placeholder="e.g. udyavarmuslimunityuae@gmail.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Informational Callout: How OTP is received */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-emerald-900 text-xs">How is the OTP received?</p>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        When you click <strong>Send 6-Digit Email OTP</strong>, your 6-digit passcode appears on screen with a 1-click <strong>Auto-Fill</strong> button for instant testing.
                      </p>
                    </div>
                  </div>

                  {/* Quick Select from Common Organization Staff */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Quick Pick Staff / Admin Email:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOtpEmail('udyavarmuslimunityuae@gmail.com')}
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded text-slate-700 font-medium transition-colors"
                      >
                        udyavarmuslimunityuae@gmail.com (Super Admin)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpEmail('thasbi05@gmail.com')}
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded text-slate-700 font-medium transition-colors"
                      >
                        thasbi05@gmail.com (Admin)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpEmail('finance@charity-relief.org')}
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded text-slate-700 font-medium transition-colors"
                      >
                        finance@charity-relief.org (Staff)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpEmail('audit@charity-relief.org')}
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded text-slate-700 font-medium transition-colors"
                      >
                        audit@charity-relief.org (Auditor)
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingOtp}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit Email OTP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  {/* Real Email Inbox Magic Link Option */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleSendRealEmailLink}
                      disabled={isSubmittingLink || !otpEmail.trim()}
                      className="w-full py-2 px-3 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingLink ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          <span>Dispatching to Real Inbox...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Send Magic Link to Real Inbox (Firebase Auth)</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Delivers an actual sign-in link to your Gmail/Outlook inbox with 1-click login.
                    </p>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {/* Generated OTP Hint Notification (Simulated Email Dispatch) */}
                  {generatedOtpHint && (
                    <div className="p-3.5 rounded-xl bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          Email Dispatched Code
                        </span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                          Simulated Inbox
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-emerald-200">
                        <span className="text-xs text-slate-600">Verification Passcode:</span>
                        <strong className="text-base font-mono font-bold tracking-widest text-emerald-700">
                          {generatedOtpHint}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnteredOtp(generatedOtpHint)}
                        className="w-full py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors text-center cursor-pointer"
                      >
                        Auto-Fill Verification Code
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Enter 6-Digit Code for {otpEmail}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('input_email');
                          setEnteredOtp('');
                        }}
                        className="text-[11px] text-emerald-600 hover:underline"
                      >
                        Change Email
                      </button>
                    </div>

                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full px-3 py-2.5 text-center font-mono text-lg tracking-[0.5em] font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {otpTimer > 0 ? (
                        <>Resend code in <strong className="text-slate-800">{otpTimer}s</strong></>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          className="text-emerald-600 font-semibold hover:underline cursor-pointer"
                        >
                          Resend Code Now
                        </button>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-400">Valid for 10 minutes</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingOtp || enteredOtp.length !== 6}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Passcode...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify OTP &amp; Login</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL & PASSWORD LOGIN */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-3.5">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="e.g. Finance Officer"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : isRegisterMode ? 'Create Account' : 'Sign In with Password'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  {isRegisterMode ? 'Already have an account? Sign In' : 'Need an account? Register'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: DEMO ROLES / INSTANT TESTING */}
          {tab === 'demo' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 mb-2">
                Simulate or test system access across different role permission tiers:
              </p>

              <button
                type="button"
                onClick={() => handleDemoLogin('SUPER_ADMIN')}
                className="w-full p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Chief Super Administrator</p>
                    <p className="text-[10px] text-slate-500">Full system &amp; user management access</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('STAFF')}
                className="w-full p-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Finance &amp; Collection Staff</p>
                    <p className="text-[10px] text-slate-500">Issue receipts &amp; disburse charity relief</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('AUDITOR')}
                className="w-full p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Independent Board Auditor</p>
                    <p className="text-[10px] text-slate-500">Read-only financial statements &amp; audit trail</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* Social Google Login Divider */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Secured with 256-bit encryption &bull; Multi-Tenant RBAC Enabled
        </div>
      </div>
    </div>
  );
};
