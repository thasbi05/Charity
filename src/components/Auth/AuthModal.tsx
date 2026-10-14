import React from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoginPage } from './LoginPage';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useAuth();

  if (!isLoginModalOpen) return null;

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl">
        <button
          type="button"
          onClick={closeLoginModal}
          className="absolute right-4 top-4 z-20 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-sm"
          aria-label="Close login dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <LoginPage isModal onSuccess={closeLoginModal} />
      </div>
    </div>
  );
};

// Aliased export for compatibility with AuthModal imports
export const AuthModal = LoginModal;
