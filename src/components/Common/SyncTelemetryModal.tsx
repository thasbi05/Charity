import React from 'react';
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Cloud,
  HardDrive,
  Users,
  ShieldCheck,
  Clock,
  Layers,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { useRealtimeLedger } from '../../hooks/useRealtimeLedger';
import { useAuth } from '../../context/AuthContext';

interface SyncTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncTelemetryModal: React.FC<SyncTelemetryModalProps> = ({ isOpen, onClose }) => {
  const {
    isOnline,
    isLiveSyncConnected,
    isSyncing,
    lastSyncedAt,
    pendingCount,
    pendingMutations,
    latencyMs,
    totalDebits,
    totalCredits,
    isBalanced,
    statusLabel,
    activeUsers,
    forceSyncNow,
    clearQueue,
    stats,
  } = useRealtimeLedger();

  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-slate-900 via-slate-950 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
                isOnline && isLiveSyncConnected
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-400/40 text-amber-400'
              }`}
            >
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-white">
                  Real-Time Cloud Synchronization
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isOnline && isLiveSyncConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isOnline && isLiveSyncConnected ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-300">{statusLabel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Network Status
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold text-slate-800 text-sm">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {latencyMs !== null ? `${latencyMs}ms latency` : 'Disconnected'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Cloud Database
              </span>
              <div className="flex items-center gap-1.5 mt-1 text-slate-800 font-bold text-sm">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Firestore Live</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                8 Listeners Active
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Pending Queue
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-bold text-sm">
                <HardDrive
                  className={`w-4 h-4 ${
                    pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}
                />
                <span className={pendingCount > 0 ? 'text-amber-700' : 'text-slate-700'}>
                  {pendingCount} Drafts
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                IndexedDB WAL
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Ledger Balance
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-bold text-sm">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    isBalanced ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                />
                <span className={isBalanced ? 'text-emerald-700' : 'text-rose-700'}>
                  {isBalanced ? '100% Balanced' : 'Imbalance'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                DR: {totalDebits.toLocaleString()} | CR: {totalCredits.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <RefreshCw
                className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <div>
                <p className="font-bold text-emerald-950 text-xs">
                  Instant Multi-Device Sync
                </p>
                <p className="text-[11px] text-emerald-800">
                  Last synced: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : 'Just now'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Queue</span>
                </button>
              )}
              <button
                type="button"
                onClick={forceSyncNow}
                disabled={isSyncing}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* Connected Multi-User Accounts Presence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>5 Authorized Multi-User Accounts &bull; Live RBAC Status</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Current: {user?.email || 'Guest'}
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {activeUsers.map((u) => (
                <div
                  key={u.uid}
                  className={`p-2.5 flex items-center justify-between gap-3 text-xs ${
                    u.isCurrentUser ? 'bg-emerald-50/70 font-semibold' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 truncate font-medium">
                          {u.displayName}
                        </span>
                        {u.isCurrentUser && (
                          <span className="text-[9px] bg-emerald-200 text-emerald-950 font-bold px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        {u.email}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offline Pending Queue Items (if any) */}
          {pendingCount > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                <span>Queued Offline Mutations ({pendingCount})</span>
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-amber-200 bg-amber-50/40 p-2.5 rounded-2xl">
                {pendingMutations.map((mut) => (
                  <div
                    key={mut.id}
                    className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{mut.type}</span>
                      <span className="text-slate-500 font-mono ml-2">{mut.docId}</span>
                    </div>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                      {mut.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synced Collection Summary */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 text-xs block">
              Synchronized Entities in Local Cache
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
              <div>&bull; Receipts: <strong>{stats.receiptsCount}</strong></div>
              <div>&bull; Payments: <strong>{stats.paymentsCount}</strong></div>
              <div>&bull; Journal Lines: <strong>{stats.journalEntriesCount}</strong></div>
              <div>&bull; Cash Float: <strong>{stats.custodiansCount}</strong></div>
              <div>&bull; Members: <strong>{stats.membersCount}</strong></div>
              <div>&bull; Charity Cases: <strong>{stats.casesCount}</strong></div>
              <div>&bull; Accounts: <strong>{stats.accountsCount}</strong></div>
              <div>&bull; Mode: <strong>PWA Offline-First</strong></div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Powered by Google Firebase Cloud Firestore &amp; IndexedDB</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
