import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  X,
  AlertCircle,
  Building,
  CheckCircle2,
  ArrowLeftRight,
  Coins,
  Users,
  BookOpen,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { CashAccount } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { FinancialLedgerService, convertToBaseCurrency, isReceiptValid } from '../../services/financialLedgerService';
import { TransferHandoverModal } from '../Transactions/TransferHandoverModal';
import { MemberLink } from '../Common/ClickableEntity';

export const CashBankView: React.FC = () => {
  const {
    cashAccounts: rawCashAccounts,
    members,
    receipts,
    payments,
    transactions,
    cases,
    settings,
    addCashAccount,
    updateCashAccount,
    cashHoldings,
  } = useCharity();
  const { user } = useAuth();
  const { openMemberLedger } = useNavigation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CashAccount | null>(null);

  // Transfer / Handover Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMemberId, setTransferMemberId] = useState<string | undefined>(undefined);

  // Filter out removed accounts
  const cashAccounts = useMemo(() => {
    return (rawCashAccounts || []).filter((c) => {
      const n = (c.name || '').toLowerCase();
      const b = (c.bankName || '').toLowerCase();
      return (
        !n.includes('emirates nbd') &&
        !n.includes('dubai islamic bank') &&
        !b.includes('emirates nbd') &&
        !b.includes('dubai islamic bank')
      );
    });
  }, [rawCashAccounts]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<CashAccount['type']>('bank');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNum, setFormAccountNum] = useState('');
  const [formOpeningBal, setFormOpeningBal] = useState<number>(0);
  const [formCode, setFormCode] = useState('1010');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Custodians computed from Single Source of Truth
  const custodianData = useMemo(() => {
    return FinancialLedgerService.getCashCustodians(
      members || [],
      transactions || [],
      receipts || [],
      payments || [],
      cases || [],
      cashHoldings || [],
      settings.exchangeRateInrToAed || 0.0440123
    );
  }, [members, transactions, receipts, payments, cases, cashHoldings, settings.exchangeRateInrToAed]);

  // Total member AED custody cash held
  const totalAedCustody = useMemo(() => {
    return custodianData.totalCashHeldByCurrency['AED'] || 0;
  }, [custodianData]);

  // Total member INR custody cash held
  const totalInrCustody = useMemo(() => {
    return custodianData.totalCashHeldByCurrency['INR'] || 0;
  }, [custodianData]);

  // Total liquidity converted to base currency (Bank Accounts + Physical Cash in Custody)
  const totalLiquidity = useMemo(() => {
    const bankBalance = cashAccounts.reduce((sum, c) => {
      const rate = (c as any).exchangeRate || (c.currency === 'INR' ? 0.04401 : 1);
      return sum + convertToBaseCurrency(c.currentBalance || 0, c.currency, rate, settings.currency || 'AED');
    }, 0);
    return Number((bankBalance + custodianData.totalCashHeld).toFixed(2));
  }, [cashAccounts, custodianData.totalCashHeld, settings.currency]);

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setFormName('');
    setFormType('bank');
    setFormBankName('');
    setFormAccountNum('');
    setFormOpeningBal(0);
    setFormCode('1020');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CashAccount) => {
    setEditingAccount(c);
    setFormName(c.name);
    setFormType(c.type);
    setFormBankName(c.bankName || '');
    setFormAccountNum(c.accountNumber || '');
    setFormOpeningBal(c.openingBalance || 0);
    setFormCode(c.accountCode);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Account name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await updateCashAccount(editingAccount.id, {
          name: formName.trim(),
          type: formType,
          bankName: formBankName.trim() || undefined,
          accountNumber: formAccountNum.trim() || undefined,
          accountCode: formCode.trim(),
        });
      } else {
        await addCashAccount({
          name: formName.trim(),
          type: formType,
          bankName: formBankName.trim() || undefined,
          accountNumber: formAccountNum.trim() || undefined,
          openingBalance: Number(formOpeningBal) || 0,
          accountCode: formCode.trim(),
          isActive: true,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="cash-bank-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Cash & Bank Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain charity bank accounts, cash drawers, and track real-time liquidity and reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Total Liquidity
            </span>
            <span className="text-xl font-display font-bold text-emerald-700">
              {formatCurrency(totalLiquidity, settings.currency)}
            </span>
          </div>

          {user?.role !== 'viewer' && (
            <button
              id="transfer-deposit-btn"
              onClick={() => {
                setTransferMemberId(undefined);
                setIsTransferModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Internal Transfer / Handover</span>
            </button>
          )}

          {user?.role === 'administrator' && (
            <button
              id="add-cash-account-btn"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Financial Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cashAccounts.map((ca) => {
          // Calculate inflows for this account
          const inflows = receipts
            .filter((r) => r.cashBankAccountId === ca.id && r.status === 'valid')
            .reduce((sum, r) => sum + r.amount, 0);

          // Calculate outflows for this account
          const outflows = payments
            .filter((p) => p.cashBankAccountId === ca.id && p.status === 'valid')
            .reduce((sum, p) => sum + p.amount, 0);

          return (
            <div
              key={ca.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                        ca.type === 'bank'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {ca.type === 'bank' ? (
                        <Landmark className="w-6 h-6" />
                      ) : (
                        <Wallet className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">
                        {ca.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ca.bankName ? `${ca.bankName} • ` : ''}GL {ca.accountCode}
                      </p>
                    </div>
                  </div>

                  {user?.role === 'administrator' && (
                    <button
                      onClick={() => handleOpenEdit(ca)}
                      title="Edit Account Details"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {ca.accountNumber && (
                  <div className="mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
                    <span className="text-[10px] text-slate-400 block uppercase font-sans">
                      Account / IBAN Number:
                    </span>
                    {ca.accountNumber}
                  </div>
                )}

                {/* Current Balance */}
                <div className="my-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Current Balance
                  </span>
                  <div className="text-2xl font-bold font-display text-slate-900 mt-0.5">
                    {formatCurrency(ca.currentBalance, settings.currency)}
                  </div>
                </div>
              </div>

              {/* Math Equation Reconciliation: Opening + Inflows - Outflows (Section 12) */}
              <div className="pt-4 border-t border-slate-100 text-[11px] space-y-1 text-slate-500">
                <div className="flex justify-between">
                  <span>Opening Balance:</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(ca.openingBalance, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Total Received:
                  </span>
                  <span className="font-semibold">
                    +{formatCurrency(inflows, settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span className="flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" /> Total Disbursed:
                  </span>
                  <span className="font-semibold">
                    -{formatCurrency(outflows, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Cash Custodians (Cash-in-Hand Across Currencies) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900">
                Member Cash Custodians &amp; Peer Handover Pools
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-currency cash held by charity members from peer-to-peer handovers and collections pending bank deposit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-cyan-50/60 border border-cyan-200 px-3.5 py-1.5 rounded-xl text-right">
              <span className="text-[10px] font-bold text-cyan-800 uppercase block">Total Member AED Cash</span>
              <span className="text-base font-bold font-mono text-cyan-950">{formatCurrency(totalAedCustody, 'AED')}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-200 px-3.5 py-1.5 rounded-xl text-right">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Total Member INR Cash</span>
              <span className="text-base font-bold font-mono text-amber-950">{formatCurrency(totalInrCustody, 'INR')}</span>
            </div>
          </div>
        </div>

        {custodianData.custodians.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No charity members currently hold custody cash. All funds are deposited in bank or cash accounts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Member ID</th>
                  <th className="py-2.5 px-3">Member Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">AED Custody Balance</th>
                  <th className="py-2.5 px-3 text-right">INR Custody Balance</th>
                  <th className="py-2.5 px-3 text-right">Converted Total (Base)</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {custodianData.custodians.map((c) => {
                  const aedBal = c.cashInHandByCurrency?.['AED'] || 0;
                  const inrBal = c.cashInHandByCurrency?.['INR'] || 0;
                  const inrRate = settings.exchangeRateInrToAed || 0.0440123;
                  // Strict Single Source of Truth selector formula: (aedBal * 1.0) + (inrBal * fxRateINR)
                  const convertedTotal = FinancialLedgerService.calculateCustodianBaseBalance(c.cashInHandByCurrency, inrRate);

                  return (
                    <tr key={c.memberId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        <MemberLink
                          memberId={c.memberId || c.memberNumber}
                          memberName={c.memberName}
                          memberNumber={c.memberNumber}
                          focusTab="ledger"
                          originBreadcrumb={[{ label: 'Cash & Bank Accounts', tab: 'cash-bank' }]}
                          className="font-mono text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer transition-colors"
                        >
                          {c.memberNumber}
                        </MemberLink>
                      </td>
                      <td className="py-2.5 px-3">
                        <MemberLink
                          memberId={c.memberId || c.memberNumber}
                          memberName={c.memberName}
                          memberNumber={c.memberNumber}
                          focusTab="ledger"
                          originBreadcrumb={[{ label: 'Cash & Bank Accounts', tab: 'cash-bank' }]}
                          className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                        >
                          {c.memberName}
                        </MemberLink>
                        {c.allocatedPurpose && (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[200px]" title={c.allocatedPurpose}>
                            {c.allocatedPurpose}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{c.phone || '-'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-mono font-bold ${
                            aedBal > 0 ? 'text-cyan-900' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(aedBal, 'AED')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-mono font-bold ${
                            inrBal > 0 ? 'text-amber-900' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(inrBal, 'INR')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono font-bold text-emerald-800">
                          {formatCurrency(convertedTotal, 'AED')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openMemberLedger(c.memberId || c.memberNumber, {
                                memberName: c.memberName,
                                focusTab: 'ledger',
                                originBreadcrumb: [{ label: 'Cash & Bank Accounts', tab: 'cash-bank' }],
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200"
                            title={`Open dedicated transaction ledger for ${c.memberName}`}
                          >
                            <BookOpen className="w-3 h-3 text-emerald-700" />
                            <span>Ledger</span>
                          </button>
                          {user?.role !== 'viewer' && (
                            <button
                              onClick={() => {
                                setTransferMemberId(c.memberId);
                                setIsTransferModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Handover / Deposit</span>
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
        )}
      </div>

      {/* Add / Edit Financial Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold font-display text-slate-900">
                {editingAccount ? `Edit ${editingAccount.name}` : 'Add Cash or Bank Account'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dubai Islamic Bank (Welfare Acc)"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="petty_cash">Petty Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GL Account Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. 1010"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {formType === 'bank' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      placeholder="e.g. Dubai Islamic Bank"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Number / IBAN
                    </label>
                    <input
                      type="text"
                      value={formAccountNum}
                      onChange={(e) => setFormAccountNum(e.target.value)}
                      placeholder="e.g. AE12 0330 0000 1234 5678 901"
                      className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Balance ({settings.currency})
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formOpeningBal}
                    onChange={(e) => setFormOpeningBal(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingAccount ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Cash Transfer / Member Handover Modal */}
      <TransferHandoverModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferMemberId(undefined);
        }}
        initialSenderMemberId={transferMemberId}
      />
    </div>
  );
};
