import React, { useState } from 'react';
import {
  Download,
  Share2,
  Copy,
  Check,
  Smartphone,
  Monitor,
  X,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios' | 'desktop'>(
    isIOS ? 'ios' : 'android'
  );

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const installed = await install();
      if (installed) {
        onClose();
      }
    }
  };

  // Generate simple QR code data URI or SVG for mobile scanning
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    appUrl
  )}&margin=8`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-linear-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Install Progressive Web App (PWA)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
                  WPA / PWA
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Fast, offline-ready desktop and mobile app experience.
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

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">App Already Installed!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You are currently running the Progressive Web App in standalone mode.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Direct Install CTA (Chromium / Desktop / Android) */}
              {isInstallable && (
                <div className="p-4 rounded-xl bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        Browser Install Ready
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Add to your home screen or desktop application launcher.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerInstall}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Now</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Share / Copy WPA Link Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                Direct Application Link (WPA / PWA URL)
              </span>
              <span className="text-[11px] text-slate-500">Live URL</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-700 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* QR Code & Mobile Instructions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
            <div className="w-28 h-28 bg-slate-100 rounded-lg border border-slate-200 p-1 shrink-0 flex items-center justify-center shadow-2xs">
              <img
                src={qrApiUrl}
                alt="App QR Code"
                className="w-full h-full object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="space-y-1.5 text-center sm:text-left min-w-0">
              <h4 className="text-xs font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Scan to Open on Mobile Device
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Scan with your smartphone camera to open the application, then install to your home screen for full offline and standalone capabilities.
              </p>
            </div>
          </div>

          {/* Device Tabs for Step-by-Step Instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800">
                Installation Instructions by Device:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveDeviceTab('android')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeDeviceTab === 'android'
                      ? 'bg-emerald-100 text-emerald-800 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setActiveDeviceTab('ios')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeDeviceTab === 'ios'
                      ? 'bg-emerald-100 text-emerald-800 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  iOS / iPhone
                </button>
                <button
                  onClick={() => setActiveDeviceTab('desktop')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeDeviceTab === 'desktop'
                      ? 'bg-emerald-100 text-emerald-800 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Desktop
                </button>
              </div>
            </div>

            {activeDeviceTab === 'android' && (
              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Google Chrome on Android:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Open this link in Chrome on your phone.</li>
                  <li>Tap the <strong>three dots menu (⋮)</strong> at the top right.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Confirm the prompt. The app icon will appear alongside your native apps.</li>
                </ol>
              </div>
            )}

            {activeDeviceTab === 'ios' && (
              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  Safari on iPhone / iPad:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Open this link in <strong>Safari</strong>.</li>
                  <li>Tap the <strong>Share</strong> button (square with arrow pointing up) in the bottom navigation bar.</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>"Add"</strong> in the top-right corner.</li>
                </ol>
              </div>
            )}

            {activeDeviceTab === 'desktop' && (
              <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-purple-600" />
                  Chrome, Edge, or Brave Desktop:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>Look for the <strong>Install icon (monitor with down arrow)</strong> in the right side of the browser URL address bar.</li>
                  <li>Click <strong>"Install"</strong> to install as a standalone window.</li>
                  <li>Launch directly from your Windows Start Menu, Mac Applications, or Taskbar.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted &amp; Secure PWA</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
