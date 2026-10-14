import React from 'react';
import {
  Keyboard,
  X,
  Search,
  PlusCircle,
  HeartHandshake,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Receipt,
  FileText,
  Landmark,
  BookOpen,
  PieChart,
  Sparkles,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const metaKey = isMac ? '⌘' : 'Ctrl';

  const SHORTCUT_GROUPS = [
    {
      title: 'Administrator Quick Actions',
      shortcuts: [
        {
          keys: ['Alt', 'N'],
          description: 'Toggle Anfa Fathima — Islamic Charity Accounting Assistant',
          icon: Sparkles,
        },
        {
          keys: [`${metaKey}`, 'K'],
          description: 'Open Global Search (search members, receipts, vouchers)',
          icon: Search,
        },
        {
          keys: [`${metaKey}`, 'N'],
          description: 'Issue New Contribution Receipt',
          icon: PlusCircle,
        },
        {
          keys: ['Alt', 'P'],
          secondaryKeys: [`${metaKey}`, 'Shift', 'N'],
          description: 'Record Charity Relief Payment Voucher',
          icon: HeartHandshake,
        },
        {
          keys: ['?'],
          secondaryKeys: ['Shift', '/'],
          description: 'Toggle Keyboard Shortcuts Reference Guide',
          icon: Keyboard,
        },
        {
          keys: [`${metaKey}`, '['],
          secondaryKeys: [`${metaKey}`, 'B'],
          description: 'Toggle Sidebar Navigation (Collapse / Expand)',
          icon: LayoutDashboard,
        },
        {
          keys: ['Esc'],
          description: 'Close any active dialog or modal window',
          icon: X,
        },
      ],
    },
    {
      title: 'Direct Module Navigation',
      shortcuts: [
        {
          keys: ['Alt', '1'],
          description: 'Dashboard (Analytics, Cash Liquidity, Overdue Alert)',
          icon: LayoutDashboard,
        },
        {
          keys: ['Alt', '2'],
          description: 'Members Directory & Status',
          icon: Users,
        },
        {
          keys: ['Alt', '3'],
          description: 'Monthly Contribution Grid (12-Month Matrix)',
          icon: CalendarCheck,
        },
        {
          keys: ['Alt', '4'],
          description: 'Receipts Register & Printing',
          icon: Receipt,
        },
        {
          keys: ['Alt', '5'],
          description: 'Charity Relief Payments Register',
          icon: FileText,
        },
        {
          keys: ['Alt', '6'],
          description: 'Chart of Accounts (Double-entry GL)',
          icon: BookOpen,
        },
        {
          keys: ['Alt', '7'],
          description: 'Cash & Bank Balances & Reconciliation',
          icon: Landmark,
        },
        {
          keys: ['Alt', '8'],
          description: 'Transactions Journal & General Ledger',
          icon: BookOpen,
        },
        {
          keys: ['Alt', '9'],
          description: 'Financial Reports (P&L, Trial Balance)',
          icon: PieChart,
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold font-display text-slate-900 text-base sm:text-lg">
                Keyboard Shortcuts Reference
              </h3>
              <p className="text-xs text-slate-500">
                Speed up charity operations with global hotkeys.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </h4>

              <div className="grid grid-cols-1 gap-2">
                {group.shortcuts.map((sc, sIdx) => {
                  const Icon = sc.icon;
                  return (
                    <div
                      key={sIdx}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-md bg-white text-slate-600 shadow-2xs border border-slate-200/60 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs sm:text-sm text-slate-800 font-medium truncate">
                          {sc.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {sc.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <kbd className="px-2 py-1 rounded bg-white text-slate-800 border border-slate-300 shadow-2xs font-mono text-xs font-bold">
                              {k}
                            </kbd>
                            {kIdx < sc.keys.length - 1 && (
                              <span className="text-slate-400 text-xs">+</span>
                            )}
                          </React.Fragment>
                        ))}

                        {sc.secondaryKeys && (
                          <>
                            <span className="text-slate-300 text-xs mx-1">or</span>
                            {sc.secondaryKeys.map((k, kIdx) => (
                              <React.Fragment key={kIdx}>
                                <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-mono text-[11px] font-semibold">
                                  {k}
                                </kbd>
                                {kIdx < sc.secondaryKeys!.length - 1 && (
                                  <span className="text-slate-400 text-[10px]">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-700 font-bold">?</kbd> anytime to reopen this guide.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
