import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Filter,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  FileDown,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Building,
  ArrowLeft,
  Pencil,
  Wallet,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { CharityCase, CaseType, CaseStatus } from '../../types';
import { CASE_TYPES } from '../../utils/defaults';
import { formatCurrency } from '../../utils/numbering';
import { UnifiedAddTransactionModal } from '../Transactions/UnifiedAddTransactionModal';
import { PrintableVoucherModal } from '../Vouchers/PrintableVoucherModal';
import { CaseLedgerTable } from '../Ledgers/CaseLedgerTable';
import { MemberLink, TransactionLink, CaseLink } from '../Common/ClickableEntity';
import { useNavigation } from '../../context/NavigationContext';
import { isReceiptValid } from '../../services/financialLedgerService';

export const CasesView: React.FC = () => {
  const { cases, receipts, payments, transactions, settings, addCase, updateCase } = useCharity();
  const { selectedCaseId, closeDrilldown, openCaseLedger, openTransactionEditor } = useNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected case for detailed view
  const [selectedCase, setSelectedCase] = useState<CharityCase | null>(null);
  const [caseDetailTab, setCaseDetailTab] = useState<'LEDGER' | 'ARCHIVE'>('LEDGER');

  // Active case for dedicated Case Ledger drilldown view
  const activeDrilldownCase = useMemo(() => {
    if (selectedCaseId) {
      return cases.find((c) => c.id === selectedCaseId || c.caseNumber === selectedCaseId) || null;
    }
    return null;
  }, [selectedCaseId, cases]);

  // New Case Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CaseType>('Medical');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newApprovedAmount, setNewApprovedAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<'INR' | 'AED'>('INR');
  const [newExchangeRate, setNewExchangeRate] = useState<string>('0.0441');
  const [newVendor, setNewVendor] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [savingCase, setSavingCase] = useState(false);

  // Edit Case Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CharityCase | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<CaseType>('Medical');
  const [editBeneficiary, setEditBeneficiary] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editApprovedAmount, setEditApprovedAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState<'INR' | 'AED'>('INR');
  const [editExchangeRate, setEditExchangeRate] = useState<string>('0.0441');
  const [editVendor, setEditVendor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<CaseStatus>('OPEN');
  const [updatingCase, setUpdatingCase] = useState(false);

  // Quick Action Modal
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionClass, setTransactionClass] = useState<'SPECIAL_CONTRIBUTION' | 'CHARITY_ASSISTANCE'>('SPECIAL_CONTRIBUTION');
  const [transactionCaseId, setTransactionCaseId] = useState<string>('');

  // Selected voucher for print
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<{
    type: 'Receipt' | 'Payment';
    data: any;
  } | null>(null);

  // Overall KPIs (normalized to organization base currency, e.g. AED)
  const kpis = useMemo(() => {
    let totalApproved = 0;
    let totalCollected = 0;
    let totalDisbursed = 0;
    let inrCasesCount = 0;

    cases.forEach((c) => {
      const isINR = c.currency === 'INR';
      if (isINR) inrCasesCount++;
      const rate = isINR ? (c.exchangeRate || 0.0441) : 1;
      const baseApproved = c.baseApprovedAmount || ((c.approvedAmount || 0) * rate);
      const baseCollected = isINR ? ((c.collectedAmount || 0) * rate) : (c.collectedAmount || 0);
      const baseDisbursed = isINR ? ((c.disbursedAmount || 0) * rate) : (c.disbursedAmount || 0);

      totalApproved += baseApproved;
      totalCollected += baseCollected;
      totalDisbursed += baseDisbursed;
    });

    const netCaseBalance = totalCollected - totalDisbursed;
    return { totalApproved, totalCollected, totalDisbursed, netCaseBalance, inrCasesCount };
  }, [cases]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const sTerm = searchTerm.toLowerCase();
      const matchesSearch =
        (c.title && c.title.toLowerCase().includes(sTerm)) ||
        (c.caseNumber && c.caseNumber.toLowerCase().includes(sTerm)) ||
        (c.beneficiaryName && c.beneficiaryName.toLowerCase().includes(sTerm)) ||
        (c.hospitalOrVendor && c.hospitalOrVendor.toLowerCase().includes(sTerm));
      const matchesType = typeFilter === 'ALL' || c.caseType === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [cases, searchTerm, typeFilter, statusFilter]);

  // Case details helpers
  const caseDonations = useMemo(() => {
    if (!selectedCase) return [];
    return receipts.filter((r) => (r.caseId === selectedCase.id || (r as any).linkedCaseId === selectedCase.id) && isReceiptValid(r.status));
  }, [selectedCase, receipts]);

  const caseDisbursements = useMemo(() => {
    if (!selectedCase) return [];
    return payments.filter((p) => p.caseId === selectedCase.id);
  }, [selectedCase, payments]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newApprovedAmount);
    if (!amountNum || amountNum <= 0) return;

    const rate = newCurrency === 'INR' ? (parseFloat(newExchangeRate) || 0.0441) : 1;
    const baseApprovedAmount = newCurrency === 'INR' ? Number((amountNum * rate).toFixed(2)) : amountNum;

    try {
      setSavingCase(true);
      await addCase({
        title: newTitle,
        caseType: newType,
        description: newDescription,
        beneficiaryName: newBeneficiary,
        beneficiaryPhone: newPhone,
        beneficiaryAddress: newAddress,
        beneficiaryIdentificationNumber: newIdNumber,
        approvedAmount: amountNum,
        requestedAmount: amountNum,
        targetAmount: amountNum,
        currency: newCurrency,
        exchangeRate: rate,
        baseApprovedAmount: baseApprovedAmount,
        hospitalOrVendor: newVendor,
        status: 'OPEN',
      });
      setIsAddModalOpen(false);
      // Reset form
      setNewTitle('');
      setNewBeneficiary('');
      setNewPhone('');
      setNewAddress('');
      setNewIdNumber('');
      setNewApprovedAmount('');
      setNewVendor('');
      setNewDescription('');
      setNewCurrency('INR');
      setNewExchangeRate('0.0441');
    } catch (err) {
      console.error('Error creating case:', err);
    } finally {
      setSavingCase(false);
    }
  };

  const handleOpenEditCase = (c: CharityCase) => {
    setEditingCase(c);
    setEditTitle(c.title || '');
    setEditType(c.caseType || 'Medical');
    setEditBeneficiary(c.beneficiaryName || '');
    setEditPhone(c.beneficiaryPhone || '');
    setEditAddress(c.beneficiaryAddress || '');
    setEditIdNumber(c.beneficiaryIdentificationNumber || c.beneficiaryNationalId || '');
    setEditApprovedAmount(String(c.approvedAmount || c.targetAmount || ''));
    setEditCurrency((c.currency as 'INR' | 'AED') || 'INR');
    setEditExchangeRate(String(c.exchangeRate || 0.0441));
    setEditVendor(c.hospitalOrVendor || '');
    setEditDescription(c.description || '');
    setEditStatus(c.status || 'OPEN');
    setIsEditModalOpen(true);
  };

  const handleUpdateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    const amountNum = parseFloat(editApprovedAmount);
    if (!amountNum || amountNum <= 0) return;

    const rate = editCurrency === 'INR' ? (parseFloat(editExchangeRate) || 0.0441) : 1;
    const baseApprovedAmount = editCurrency === 'INR' ? Number((amountNum * rate).toFixed(2)) : amountNum;

    try {
      setUpdatingCase(true);
      await updateCase(editingCase.id, {
        title: editTitle,
        caseType: editType,
        description: editDescription,
        beneficiaryName: editBeneficiary,
        beneficiaryPhone: editPhone,
        beneficiaryAddress: editAddress,
        beneficiaryIdentificationNumber: editIdNumber,
        approvedAmount: amountNum,
        requestedAmount: amountNum,
        targetAmount: amountNum,
        currency: editCurrency,
        exchangeRate: rate,
        baseApprovedAmount: baseApprovedAmount,
        hospitalOrVendor: editVendor,
        status: editStatus,
      });
      setIsEditModalOpen(false);
      setEditingCase(null);
      if (selectedCase && selectedCase.id === editingCase.id) {
        setSelectedCase({
          ...selectedCase,
          title: editTitle,
          caseType: editType,
          description: editDescription,
          beneficiaryName: editBeneficiary,
          beneficiaryPhone: editPhone,
          beneficiaryAddress: editAddress,
          beneficiaryIdentificationNumber: editIdNumber,
          approvedAmount: amountNum,
          requestedAmount: amountNum,
          targetAmount: amountNum,
          currency: editCurrency,
          exchangeRate: rate,
          baseApprovedAmount: baseApprovedAmount,
          hospitalOrVendor: editVendor,
          status: editStatus,
        });
      }
    } catch (err) {
      console.error('Error updating case:', err);
    } finally {
      setUpdatingCase(false);
    }
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'OPEN':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium">OPEN</span>;
      case 'IN_PROGRESS':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">IN PROGRESS</span>;
      case 'FULLY_FUNDED':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-medium">FULLY FUNDED</span>;
      case 'DISBURSED':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">DISBURSED</span>;
      case 'CLOSED':
        return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">CLOSED</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">{status}</span>;
    }
  };

  if (selectedCaseId && activeDrilldownCase) {
    return (
      <div id="case-ledger-drilldown-view" className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => closeDrilldown()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>← Back to All Charity Cases</span>
          </button>
        </div>

        <CaseLedgerTable
          charityCase={activeDrilldownCase}
          transactions={transactions}
          receipts={receipts}
          currency={activeDrilldownCase.currency || settings.currency}
          showBreadcrumbs={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <HeartHandshake className="h-7 w-7 text-emerald-600" />
            Designated Charity Cases
          </h1>
          <p className="text-sm text-slate-500">
            Strict restricted-fund accounting: each donation & assistance payment is locked to its approved case
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Register New Case
        </button>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Approved Budget
            </span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatCurrency(kpis.totalApproved, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {cases.length} charitable initiatives
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Total Funds Collected
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">
            {formatCurrency(kpis.totalCollected, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {kpis.totalApproved > 0
              ? `${Math.round((kpis.totalCollected / kpis.totalApproved) * 100)}% of target raised`
              : '0%'}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Direct Relief Disbursed
            </span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-700">
            {formatCurrency(kpis.totalDisbursed, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-blue-600">
            Paid directly to hospitals & vendors
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">
              Restricted Cash Reserve
            </span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-700">
            {formatCurrency(kpis.netCaseBalance, settings.currency)}
          </div>
          <div className="mt-1 text-xs text-purple-600">
            Net collected awaiting disbursement
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by case number, title, beneficiary, or hospital..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CASE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="FULLY_FUNDED">Fully Funded</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCases.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <HeartHandshake className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No charity cases found</h3>
            <p className="mt-1 text-xs text-slate-500">
              Create your first designated case to begin tracking restricted donations and relief payouts.
            </p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const pctCollected = c.approvedAmount > 0 ? Math.min(100, Math.round((c.collectedAmount / c.approvedAmount) * 100)) : 0;
            const pctDisbursed = c.approvedAmount > 0 ? Math.min(100, Math.round((c.disbursedAmount / c.approvedAmount) * 100)) : 0;
            const remainingBudget = Math.max(0, c.approvedAmount - c.disbursedAmount);

            return (
              <div
                key={c.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CaseLink
                        caseId={c.id}
                        caseNumber={c.caseNumber}
                        originBreadcrumb={[{ label: 'Cases', tab: 'cases' }]}
                        className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md hover:bg-emerald-100 transition-colors"
                      />
                      {c.currency === 'INR' ? (
                        <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300/80 px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                          <span className="text-xs">₹</span> INR Case
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          AED Case
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(c.status)}
                      <button
                        type="button"
                        onClick={() => handleOpenEditCase(c)}
                        title="Edit Case Details & Currency"
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mt-3 font-bold text-slate-900 text-base line-clamp-1 group-hover:text-emerald-700 transition-colors">
                    <CaseLink
                      caseId={c.id}
                      caseTitle={c.title}
                      originBreadcrumb={[{ label: 'Cases', tab: 'cases' }]}
                      className="text-slate-900 hover:text-emerald-700 font-bold"
                    />
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description || 'Restricted case relief initiative'}
                  </p>

                  {/* Beneficiary & Hospital */}
                  <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">Beneficiary:</span>
                      <span className="font-bold text-slate-800">{c.beneficiaryName}</span>
                    </div>
                    {c.hospitalOrVendor && (
                      <div className="flex justify-between text-slate-600">
                        <span className="font-medium">Facility / Hospital:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[160px]">
                          {c.hospitalOrVendor}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">Category:</span>
                      <span className="font-medium text-slate-700">{c.caseType}</span>
                    </div>
                  </div>

                  {/* Financial Progress Bars */}
                  <div className="mt-4 space-y-3">
                    {/* Collection Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">Funds Raised:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(c.collectedAmount, c.currency)} / {formatCurrency(c.approvedAmount, c.currency)}
                        </span>
                      </div>
                      {c.currency === 'INR' && (
                        <div className="text-[10px] text-slate-400 text-right font-mono -mt-0.5 mb-1">
                          ≈ AED {((c.collectedAmount || 0) * (c.exchangeRate || 0.0441)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / AED {((c.approvedAmount || 0) * (c.exchangeRate || 0.0441)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pctCollected}%` }}
                        />
                      </div>
                    </div>

                    {/* Disbursement Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">Relief Disbursed:</span>
                        <span className="font-mono font-bold text-blue-700">
                          {formatCurrency(c.disbursedAmount, c.currency)}
                        </span>
                      </div>
                      {c.currency === 'INR' && (
                        <div className="text-[10px] text-slate-400 text-right font-mono -mt-0.5 mb-1">
                          ≈ AED {((c.disbursedAmount || 0) * (c.exchangeRate || 0.0441)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${pctDisbursed}%` }}
                        />
                      </div>
                    </div>

                    {/* Contributions Received Breakdown List */}
                    {(() => {
                      const caseReceipts = receipts.filter(
                        (r) => (r.caseId === c.id || (r as any).linkedCaseId === c.id) && isReceiptValid(r.status)
                      );

                      return (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                            <span className="flex items-center gap-1 text-slate-800">
                              <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Contributions Received ({caseReceipts.length})</span>
                            </span>
                            <span className="font-mono text-emerald-700 font-semibold">
                              {formatCurrency(
                                caseReceipts.reduce((sum, r) => sum + (r.currency === c.currency ? r.amount : (r.baseCurrencyAmount || r.amount)), 0),
                                c.currency
                              )}
                            </span>
                          </div>

                          {caseReceipts.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic bg-slate-50/80 rounded px-2 py-1 text-center">
                              No member payments recorded yet.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                              {caseReceipts.map((cr) => (
                                <div
                                  key={cr.id}
                                  className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-100 text-[10px]"
                                >
                                  <div className="min-w-0 pr-1.5">
                                    <div className="font-semibold text-slate-800 truncate">
                                      {cr.memberName}
                                    </div>
                                    <div className="text-[9px] text-emerald-700 flex items-center gap-0.5 font-medium truncate">
                                      <Wallet className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      <span>
                                        Held by {cr.custodianMemberName || (cr.cashBankAccountName?.startsWith('Cash in Hand') ? cr.cashBankAccountName.replace('Cash in Hand - ', '') : cr.cashBankAccountName)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono font-bold text-slate-900">
                                    {formatCurrency(cr.amount, cr.currency || c.currency)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openCaseLedger(c.id, { originBreadcrumb: [{ label: 'Cases', tab: 'cases' }] })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 cursor-pointer"
                  >
                    Audit Details
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Record Donation button */}
                    <button
                      onClick={() => {
                        setTransactionCaseId(c.id);
                        setTransactionClass('SPECIAL_CONTRIBUTION');
                        setTransactionModalOpen(true);
                      }}
                      className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      + Donate
                    </button>

                    {/* Disburse Assistance button */}
                    <button
                      onClick={() => {
                        setTransactionCaseId(c.id);
                        setTransactionClass('CHARITY_ASSISTANCE');
                        setTransactionModalOpen(true);
                      }}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Disburse Aid
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    {selectedCase.caseNumber}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">{selectedCase.title}</h2>
                  {selectedCase.currency === 'INR' ? (
                    <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shadow-2xs">
                      ₹ INR Case
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      AED Case
                    </span>
                  )}
                  {getStatusBadge(selectedCase.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Beneficiary: <strong>{selectedCase.beneficiaryName}</strong> • Facility: <strong>{selectedCase.hospitalOrVendor || 'N/A'}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditCase(selectedCase)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Case & Currency</span>
                </button>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Tab Selector */}
              <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCaseDetailTab('LEDGER')}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                    caseDetailTab === 'LEDGER'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Case Financial Ledger (Chronological)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCaseDetailTab('ARCHIVE')}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                    caseDetailTab === 'ARCHIVE'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Itemized Donations & Relief Vouchers</span>
                </button>
              </div>

              {/* TAB 1: FULL CASE FINANCIAL LEDGER */}
              {caseDetailTab === 'LEDGER' && (
                <CaseLedgerTable
                  charityCase={selectedCase}
                  transactions={transactions}
                  receipts={receipts}
                  currency={selectedCase.currency || settings.currency}
                />
              )}

              {/* TAB 2: ITEMIZED DONATIONS & RELIEF DISBURSEMENTS */}
              {caseDetailTab === 'ARCHIVE' && (
                <div className="space-y-6">
                  {/* Financial Status Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Target Budget</span>
                      <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                        {formatCurrency(selectedCase.approvedAmount, selectedCase.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                      <span className="text-[11px] font-semibold text-emerald-800 uppercase">Total Collected</span>
                      <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                        {formatCurrency(selectedCase.collectedAmount, selectedCase.currency)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5">
                      <span className="text-[11px] font-semibold text-blue-800 uppercase">Total Disbursed</span>
                      <div className="text-xl font-extrabold text-blue-700 mt-0.5">
                        {formatCurrency(selectedCase.disbursedAmount, selectedCase.currency)}
                      </div>
                    </div>
                  </div>

              {/* Linked Donations (Special Contributions) */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Donor Contributions ({caseDonations.length})</span>
                  <span className="text-emerald-700 font-mono">
                    Total: {formatCurrency(selectedCase.collectedAmount, selectedCase.currency)}
                  </span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Receipt #</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Contributor (Who Paid)</th>
                        <th className="px-3 py-2 text-left">Holding Custodian (Who Holds Cash)</th>
                        <th className="px-3 py-2 text-left">Method</th>
                        <th className="px-3 py-2 text-right">Amount Paid</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caseDonations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">
                            No special donations recorded for this case yet.
                          </td>
                        </tr>
                      ) : (
                        caseDonations.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-medium text-slate-900">
                              <TransactionLink
                                transactionId={d.id}
                                transactionNumber={d.receiptNumber}
                                originBreadcrumb={[{ label: 'Cases', tab: 'cases' }]}
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-600">{d.receiptDate}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              <MemberLink
                                memberId={d.memberId}
                                memberName={d.memberName}
                                memberNumber={d.memberNumber}
                                originBreadcrumb={[{ label: 'Cases', tab: 'cases' }]}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1 font-medium text-emerald-800">
                                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{d.custodianMemberName || (d.cashBankAccountName?.startsWith('Cash in Hand') ? d.cashBankAccountName.replace('Cash in Hand - ', '') : d.cashBankAccountName)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{d.paymentMethod}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(d.amount, d.currency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openTransactionEditor(d.id)}
                                  title={`Edit Receipt [${d.receiptNumber}]`}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => setSelectedVoucherForPrint({ type: 'Receipt', data: d })}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200 cursor-pointer"
                                  title="Download Receipt Voucher PDF"
                                >
                                  <FileDown className="h-3 w-3 text-emerald-600" /> Voucher
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Assistance Relief Payouts */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Assistance Disbursements ({caseDisbursements.length})</span>
                  <span className="text-blue-700 font-mono">
                    Total: {formatCurrency(selectedCase.disbursedAmount, selectedCase.currency)}
                  </span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Payment Voucher #</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Payee / Facility</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caseDisbursements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">
                            No relief assistance disbursed for this case yet.
                          </td>
                        </tr>
                      ) : (
                        caseDisbursements.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-medium text-slate-900">
                              <TransactionLink
                                transactionId={p.id}
                                transactionNumber={p.paymentNumber}
                                originBreadcrumb={[{ label: 'Cases', tab: 'cases' }]}
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-600">{p.paymentDate}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{p.payeeName}</td>
                            <td className="px-3 py-2 text-slate-600">{p.charityCategory}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(p.amount, p.currency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openTransactionEditor(p.id)}
                                  title={`Edit Payment Voucher [${p.paymentNumber}]`}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => setSelectedVoucherForPrint({ type: 'Payment', data: p })}
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200 cursor-pointer"
                                  title="Download Payment Voucher PDF"
                                >
                                  <FileDown className="h-3 w-3 text-emerald-600" /> Voucher
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Modal: Register New Charity Case */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Register New Charity Case</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Case Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Heart Surgery Support for Brother Ahmed"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Case Target Currency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Case Target Currency <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Most aid paid in INR (₹)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    id="btn-case-curr-inr"
                    onClick={() => setNewCurrency('INR')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      newCurrency === 'INR'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-base font-extrabold text-amber-600">₹</span>
                    <div className="text-left">
                      <div>INR (₹) Indian Rupee</div>
                      <div className="text-[10px] font-normal text-slate-500">Relief Aid / Beneficiary Payouts</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    id="btn-case-curr-aed"
                    onClick={() => setNewCurrency('AED')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      newCurrency === 'AED'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-xs font-extrabold text-slate-700">AED</span>
                    <div className="text-left">
                      <div>AED (د.إ) UAE Dirham</div>
                      <div className="text-[10px] font-normal text-slate-500">Treasury Base Currency</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Case Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as CaseType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Approved Target Amount ({newCurrency === 'INR' ? 'INR ₹' : 'AED'}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className={`text-xs font-bold ${newCurrency === 'INR' ? 'text-amber-600 font-mono text-sm' : 'text-slate-500'}`}>
                        {newCurrency === 'INR' ? '₹' : 'AED'}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      id="input-case-approved-amount"
                      value={newApprovedAmount}
                      onChange={(e) => setNewApprovedAmount(e.target.value)}
                      placeholder={newCurrency === 'INR' ? 'e.g. 150000' : 'e.g. 15000'}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Currency Equivalent Preview & Rate Config */}
              {newCurrency === 'INR' && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span>Base Currency Budget Equivalent (AED)</span>
                    </span>
                    <span className="font-mono font-extrabold text-sm text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md">
                      ≈ AED {((parseFloat(newApprovedAmount) || 0) * (parseFloat(newExchangeRate) || 0.0441)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600 pt-1 border-t border-amber-200/60">
                    <span className="text-[11px]">Exchange Rate (1 INR to AED):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-500">1 ₹ =</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={newExchangeRate}
                        onChange={(e) => setNewExchangeRate(e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-amber-300 rounded bg-white font-mono text-right"
                      />
                      <span className="text-[11px] font-mono text-slate-500">AED</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800 italic">
                    * Direct relief disbursements, hospital payouts, and donor receipts for this case will default to INR (₹) with automatic real-time double-entry conversion into treasury accounts.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBeneficiary}
                    onChange={(e) => setNewBeneficiary(e.target.value)}
                    placeholder="Full name of beneficiary"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary Phone
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+971 50 ... or +91 ..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hospital / Vendor / Contractor
                  </label>
                  <input
                    type="text"
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    placeholder="e.g. Dubai Hospital or Apollo Clinic"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary ID / Passport # / Aadhaar
                  </label>
                  <input
                    type="text"
                    value={newIdNumber}
                    onChange={(e) => setNewIdNumber(e.target.value)}
                    placeholder="e.g. 784-1988-... or Aadhaar #"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description & Case Background
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Medical summary, condition, verification notes, and payment mode..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCase}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingCase ? 'Creating...' : `Register Case in ${newCurrency === 'INR' ? 'INR (₹)' : 'AED'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Charity Case & Currency */}
      {isEditModalOpen && editingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Charity Case Details & Currency</h2>
                <p className="text-xs text-slate-500">{editingCase.caseNumber} • {editingCase.title}</p>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCase(null);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCaseSubmit} className="overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Case Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Edit Currency Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Case Target Currency <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    INR payments supported
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditCurrency('INR')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      editCurrency === 'INR'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-base font-extrabold text-amber-600">₹</span>
                    <div className="text-left">
                      <div>INR (₹) Indian Rupee</div>
                      <div className="text-[10px] font-normal text-slate-500">Relief Aid / Beneficiary Payouts</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCurrency('AED')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      editCurrency === 'AED'
                        ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-xs font-extrabold text-slate-700">AED</span>
                    <div className="text-left">
                      <div>AED (د.إ) UAE Dirham</div>
                      <div className="text-[10px] font-normal text-slate-500">Treasury Base Currency</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as CaseType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  >
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CaseStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none font-semibold"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="FULLY_FUNDED">Fully Funded</option>
                    <option value="DISBURSED">Disbursed</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target ({editCurrency === 'INR' ? '₹ INR' : 'AED'}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className={`text-xs font-bold ${editCurrency === 'INR' ? 'text-amber-600 font-mono text-sm' : 'text-slate-500'}`}>
                        {editCurrency === 'INR' ? '₹' : 'AED'}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={editApprovedAmount}
                      onChange={(e) => setEditApprovedAmount(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Converted Equivalent & Exchange Rate */}
              {editCurrency === 'INR' && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span>Base Budget Equivalent (AED)</span>
                    </span>
                    <span className="font-mono font-extrabold text-sm text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-md">
                      ≈ AED {((parseFloat(editApprovedAmount) || 0) * (parseFloat(editExchangeRate) || 0.0441)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600 pt-1 border-t border-amber-200/60">
                    <span className="text-[11px]">Exchange Rate (1 INR to AED):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-500">1 ₹ =</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={editExchangeRate}
                        onChange={(e) => setEditExchangeRate(e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-amber-300 rounded bg-white font-mono text-right"
                      />
                      <span className="text-[11px] font-mono text-slate-500">AED</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editBeneficiary}
                    onChange={(e) => setEditBeneficiary(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hospital / Vendor / Contractor
                  </label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Beneficiary ID / Passport # / Aadhaar
                  </label>
                  <input
                    type="text"
                    value={editIdNumber}
                    onChange={(e) => setEditIdNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description & Case Background
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCase(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCase}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {updatingCase ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal (Donate / Disburse) */}
      {transactionModalOpen && (
        <UnifiedAddTransactionModal
          isOpen={transactionModalOpen}
          onClose={() => setTransactionModalOpen(false)}
          defaultClassification={transactionClass}
          preselectedCaseId={transactionCaseId}
        />
      )}

      {/* Printable Voucher Modal */}
      {selectedVoucherForPrint && (
        <PrintableVoucherModal
          type={selectedVoucherForPrint.type}
          data={selectedVoucherForPrint.data}
          onClose={() => setSelectedVoucherForPrint(null)}
        />
      )}
    </div>
  );
};
