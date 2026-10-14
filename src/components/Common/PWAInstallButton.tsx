import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'topbar' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'topbar',
}) => {
  const { isInstalled } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If already running standalone, we can still allow them to open the modal for link sharing / QR code if clicked
  if (variant === 'topbar') {
    return (
      <>
        <button
          id="btn-pwa-install-topbar"
          onClick={() => setIsModalOpen(true)}
          title={isInstalled ? 'PWA Installed • Share App Link' : 'Install PWA / Mobile App'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-white" />
          <span className="hidden sm:inline">PWA App</span>
        </button>
        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          id="btn-pwa-install-sidebar"
          onClick={() => setIsModalOpen(true)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">Install PWA / App</span>
        </button>
        <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        id="btn-pwa-install-generic"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>Install PWA Link</span>
      </button>
      <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
