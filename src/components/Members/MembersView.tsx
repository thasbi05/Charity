import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  FileDown,
  Plus,
  Edit2,
  Eye,
  UserX,
  UserCheck,
  Trash2,
  Receipt,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  ArrowLeftRight,
  ArrowLeft,
  Coins,
  Building,
  CheckCircle2,
  Camera,
  Upload,
  IdCard,
  UserPlus,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { Member, MemberStatus } from '../../types';
import { formatCurrency } from '../../utils/numbering';
import { exportToCsv, triggerPrint } from '../../utils/export';
import { TransferHandoverModal } from '../Transactions/TransferHandoverModal';
import { CountrySelect } from '../Common/CountrySelect';
import { getCountryFlag } from '../../utils/countries';
import { MemberLink } from '../Common/ClickableEntity';
import { MemberLedgerTable } from '../Ledgers/MemberLedgerTable';
import { useNavigation } from '../../context/NavigationContext';
import { processImageFile, ALLOWED_IMAGE_TYPES } from '../../utils/imageUpload';
import { KARNATAKA_DISTRICTS, KARNATAKA_TALUKS } from '../../utils/karnatakaLocations';
import { MemberIdCardModal } from './MemberIdCardModal';

interface MembersViewProps {
  initialSelectedMemberId?: string;
  onOpenCreateReceiptForMember?: (memberId: string) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  initialSelectedMemberId,
  onOpenCreateReceiptForMember,
}) => {
  const {
    members,
    receipts,
    transactions,
    settings,
    addMember,
    updateMember,
    deactivateMember,
    deleteMember,
  } = useCharity();
  const { user } = useAuth();
  const { selectedMemberId, closeDrilldown, openMemberLedger, navigateToTab } = useNavigation();

  // Active member for dedicated Member Ledger view
  const activeDrilldownMember = useMemo(() => {
    const idToUse = selectedMemberId || initialSelectedMemberId;
    if (!idToUse) return null;
    return members.find((m) => m.id === idToUse || m.memberNumber === idToUse) || null;
  }, [selectedMemberId, initialSelectedMemberId, members]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [selectedMember, setSelectedMember] = useState<Member | null>(() => {
    if (initialSelectedMemberId) {
      return members.find((m) => m.id === initialSelectedMemberId) || null;
    }
    return null;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Transfer / Handover modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferMember, setTransferMember] = useState<Member | null>(null);

  // ID Card modal state
  const [idCardMember, setIdCardMember] = useState<Member | null>(null);

  // Profile Photo Upload State
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (file: File) => {
    try {
      setFormError('');
      const base64 = await processImageFile(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.88,
        maxFileSizeMb: 3,
      });
      setFormPhotoUrl(base64);
    } catch (err: any) {
      setFormError(err.message || 'Failed to process member photo.');
    }
  };

  // Form State: Personal Details & Father's Name (First-Class Field)
  const [formFullName, setFormFullName] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMonthlyAmount, setFormMonthlyAmount] = useState<number>(100);
  const [formStatus, setFormStatus] = useState<MemberStatus>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Strictly Separated Local Address (UAE / Residence)
  const [formLocalBuilding, setFormLocalBuilding] = useState('');
  const [formLocalFlat, setFormLocalFlat] = useState('');
  const [formLocalStreet, setFormLocalStreet] = useState('');
  const [formLocalArea, setFormLocalArea] = useState('');
  const [formLocalCity, setFormLocalCity] = useState('Dubai');
  const [formLocalEmirate, setFormLocalEmirate] = useState('Dubai');
  const [formLocalCountry, setFormLocalCountry] = useState('United Arab Emirates');
  const [formLocalPoBox, setFormLocalPoBox] = useState('');
  const [formLocalPhone, setFormLocalPhone] = useState('');

  // Form State: Strictly Separated Home Country Address (Karnataka, India)
  const [formHomeHouse, setFormHomeHouse] = useState('');
  const [formHomeStreet, setFormHomeStreet] = useState('');
  const [formHomeVillage, setFormHomeVillage] = useState('');
  const [formHomeTaluk, setFormHomeTaluk] = useState('Udupi');
  const [formHomeDistrict, setFormHomeDistrict] = useState<string>('Udupi');
  const [formHomeState, setFormHomeState] = useState('Karnataka');
  const [formHomeCountry, setFormHomeCountry] = useState('India');
  const [formHomePostalCode, setFormHomePostalCode] = useState('576101');
  const [formHomePhone, setFormHomePhone] = useState('');

  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch =
        !q ||
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.memberNumber || '').toLowerCase().includes(q) ||
        (m.mobileNumber || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        ((m.fatherName || m.fatherHusbandName || '').toLowerCase().includes(q)) ||
        (m.homeCountryAddress?.country && m.homeCountryAddress.country.toLowerCase().includes(q)) ||
        (m.localAddress?.country && m.localAddress.country.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [members, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormFullName('');
    setFormFatherName('');
    setFormMobile('');
    setFormEmail('');
    setFormJoinDate(new Date().toISOString().slice(0, 10));
    setFormMonthlyAmount(100);
    setFormStatus('active');
    setFormNotes('');
    setFormError('');

    // Local address reset
    setFormLocalBuilding('');
    setFormLocalFlat('');
    setFormLocalStreet('');
    setFormLocalArea('');
    setFormLocalCity('Dubai');
    setFormLocalEmirate('Dubai');
    setFormLocalCountry('United Arab Emirates');
    setFormLocalPoBox('');
    setFormLocalPhone('');

    // Home country address reset (Karnataka, India)
    setFormPhotoUrl('');
    setFormHomeHouse('');
    setFormHomeStreet('');
    setFormHomeVillage('');
    setFormHomeTaluk('Kapu (Kaup)');
    setFormHomeDistrict('Udupi');
    setFormHomeState('Karnataka');
    setFormHomeCountry('India');
    setFormHomePostalCode('576101');
    setFormHomePhone('');

    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setFormPhotoUrl(m.photoUrl || '');
    setFormFullName(m.fullName);
    setFormFatherName(m.fatherName || m.fatherHusbandName || '');
    setFormMobile(m.mobileNumber);
    setFormEmail(m.email || '');
    setFormJoinDate(m.joinDate || new Date().toISOString().slice(0, 10));
    setFormMonthlyAmount(m.monthlyContributionAmount || 0);
    setFormStatus(m.status);
    setFormNotes(m.notes || '');
    setFormError('');

    // Populate strictly separated Local Address
    setFormLocalBuilding(m.localAddress?.buildingVilla || m.localAddress?.building || '');
    setFormLocalFlat(m.localAddress?.flatRoom || m.localAddress?.flat || '');
    setFormLocalStreet(m.localAddress?.street || '');
    setFormLocalArea(m.localAddress?.area || '');
    setFormLocalCity(m.localAddress?.city || 'Dubai');
    setFormLocalEmirate(m.localAddress?.emirateState || m.localAddress?.stateOrEmirate || 'Dubai');
    setFormLocalCountry(m.localAddress?.country || 'United Arab Emirates');
    setFormLocalPoBox(m.localAddress?.poBox || m.localAddress?.postalCodeOrPoBox || '');
    setFormLocalPhone(m.localAddress?.localPhone || m.localAddress?.phone || m.mobileNumber || '');

    // Populate strictly separated Home Country Address (Karnataka, India)
    const savedDistrict = m.homeAddress?.district || m.homeCountryAddress?.district || 'Udupi';
    const savedTaluk = m.homeAddress?.taluk || m.homeCountryAddress?.taluk || m.homeCountryAddress?.city || 'Kapu (Kaup)';
    setFormHomeDistrict(savedDistrict);
    setFormHomeTaluk(savedTaluk);
    setFormHomeHouse(m.homeAddress?.house || m.homeCountryAddress?.houseBuilding || m.homeCountryAddress?.building || '');
    setFormHomeStreet(m.homeAddress?.street || m.homeCountryAddress?.street || '');
    setFormHomeVillage(m.homeAddress?.village || m.homeCountryAddress?.villageArea || m.homeCountryAddress?.area || '');
    setFormHomeState('Karnataka');
    setFormHomeCountry('India');
    setFormHomePostalCode(m.homeAddress?.pincode || m.homeCountryAddress?.postalCode || m.homeCountryAddress?.postalCodeOrPoBox || '576101');
    setFormHomePhone(m.homeCountryAddress?.homePhone || m.homeCountryAddress?.phone || '');

    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formFullName.trim()) {
      setFormError('Member full name is required.');
      return;
    }
    if (!formMobile.trim()) {
      setFormError('Mobile phone number is required.');
      return;
    }
    if (formMonthlyAmount < 0) {
      setFormError('Monthly contribution amount cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const localAddressData = {
        buildingVilla: formLocalBuilding.trim(),
        flatRoom: formLocalFlat.trim(),
        street: formLocalStreet.trim(),
        area: formLocalArea.trim(),
        city: formLocalCity.trim() || 'Dubai',
        emirateState: formLocalEmirate.trim() || 'Dubai',
        country: formLocalCountry.trim() || 'United Arab Emirates',
        poBox: formLocalPoBox.trim(),
        localPhone: formLocalPhone.trim() || formMobile.trim(),
        building: formLocalBuilding.trim(),
        flat: formLocalFlat.trim(),
        stateOrEmirate: formLocalEmirate.trim() || 'Dubai',
        postalCodeOrPoBox: formLocalPoBox.trim(),
        phone: formLocalPhone.trim() || formMobile.trim(),
      };

      const homeAddressObj = {
        country: 'India',
        state: 'Karnataka',
        district: formHomeDistrict.trim() || 'Udupi',
        taluk: formHomeTaluk.trim() || 'Udupi',
        village: formHomeVillage.trim(),
        house: formHomeHouse.trim(),
        street: formHomeStreet.trim(),
        pincode: formHomePostalCode.trim(),
      };

      const homeCountryAddressData = {
        houseBuilding: formHomeHouse.trim(),
        street: formHomeStreet.trim(),
        villageArea: formHomeVillage.trim(),
        city: formHomeTaluk.trim() || 'Udupi',
        district: formHomeDistrict.trim() || 'Udupi',
        taluk: formHomeTaluk.trim() || 'Udupi',
        stateProvince: 'Karnataka',
        country: 'India',
        postalCode: formHomePostalCode.trim(),
        pincode: formHomePostalCode.trim(),
        homePhone: formHomePhone.trim(),
        building: formHomeHouse.trim(),
        house: formHomeHouse.trim(),
        village: formHomeVillage.trim(),
        area: formHomeVillage.trim(),
        stateOrEmirate: 'Karnataka',
        postalCodeOrPoBox: formHomePostalCode.trim(),
        phone: formHomePhone.trim(),
      };

      const legacyAddressSummary = [
        formLocalBuilding.trim(),
        formLocalArea.trim(),
        formLocalCity.trim() || 'Dubai',
        formLocalCountry.trim() || 'UAE',
      ].filter(Boolean).join(', ');

      const memberPayload = {
        fullName: formFullName.trim(),
        fatherName: formFatherName.trim(),
        fatherHusbandName: formFatherName.trim(),
        mobileNumber: formMobile.trim(),
        email: formEmail.trim(),
        photoUrl: formPhotoUrl.trim(),
        localAddress: localAddressData,
        homeCountryAddress: homeCountryAddressData,
        homeAddress: homeAddressObj,
        address: legacyAddressSummary,
        joinDate: formJoinDate,
        monthlyContributionAmount: Number(formMonthlyAmount),
        status: formStatus,
        notes: formNotes.trim(),
      };

      if (editingMember) {
        await updateMember(editingMember.id, memberPayload);
        setSuccessMessage(`Member "${memberPayload.fullName}" updated successfully.`);
      } else {
        const newM = await addMember(memberPayload);
        setNewlyAddedId(newM.id);
        setSuccessMessage(`Member "${newM.fullName}" (${newM.memberNumber}) added successfully.`);
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save member record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const data = filteredMembers.map((m) => ({
      'Member Number': m.memberNumber,
      'Full Name': m.fullName,
      "Father's Name": m.fatherName || m.fatherHusbandName || '',
      'Mobile Number': m.mobileNumber,
      Email: m.email,
      'Local Address - Building': m.localAddress?.buildingVilla || m.localAddress?.building || '',
      'Local Address - Flat/Room': m.localAddress?.flatRoom || m.localAddress?.flat || '',
      'Local Address - Street': m.localAddress?.street || '',
      'Local Address - Area': m.localAddress?.area || '',
      'Local Address - City': m.localAddress?.city || '',
      'Local Address - Emirate/State': m.localAddress?.emirateState || m.localAddress?.stateOrEmirate || '',
      'Local Address - Country': m.localAddress?.country || '',
      'Local Address - PO Box': m.localAddress?.poBox || m.localAddress?.postalCodeOrPoBox || '',
      'Local Address - Phone': m.localAddress?.localPhone || m.localAddress?.phone || '',
      'Home Country - House/Building': m.homeCountryAddress?.houseBuilding || m.homeCountryAddress?.building || '',
      'Home Country - Street': m.homeCountryAddress?.street || '',
      'Home Country - Village/Area': m.homeCountryAddress?.villageArea || m.homeCountryAddress?.area || '',
      'Home Country - City': m.homeCountryAddress?.city || '',
      'Home Country - District': m.homeCountryAddress?.district || '',
      'Home Country - State/Province': m.homeCountryAddress?.stateProvince || m.homeCountryAddress?.stateOrEmirate || '',
      'Home Country - Country': m.homeCountryAddress?.country || '',
      'Home Country - Postal Code': m.homeCountryAddress?.postalCode || m.homeCountryAddress?.postalCodeOrPoBox || '',
      'Home Country - Phone': m.homeCountryAddress?.homePhone || m.homeCountryAddress?.phone || '',
      'Join Date': m.joinDate,
      'Monthly Contribution': m.monthlyContributionAmount,
      Status: m.status,
      'Total Contributed': m.totalContributed,
      'Receipts Count': m.receiptsCount,
      Notes: m.notes || '',
    }));
    exportToCsv('Charity_Members_List', data);
  };

  // Receipts history for the currently inspected member
  const memberReceipts = useMemo(() => {
    if (!selectedMember) return [];
    return receipts
      .filter((r) => r.memberId === selectedMember.id && r.status === 'valid')
      .sort((a, b) => (a.receiptDate < b.receiptDate ? 1 : -1));
  }, [receipts, selectedMember]);

  // Internal transfers and handovers involving the selected member
  const memberTransfers = useMemo(() => {
    if (!selectedMember) return [];
    return (transactions || [])
      .filter(
        (t) =>
          (t.debitMemberId === selectedMember.id || t.creditMemberId === selectedMember.id) &&
          t.status === 'valid'
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, selectedMember]);

  if (activeDrilldownMember) {
    return (
      <div id="member-ledger-drilldown-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => closeDrilldown()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>← Back to All Members</span>
          </button>
        </div>

        <MemberLedgerTable
          member={activeDrilldownMember}
          transactions={transactions}
          receipts={receipts}
          currency={settings.currency}
          showBreadcrumbs={true}
        />
      </div>
    );
  }

  return (
    <div id="members-view" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Charity Members Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain registered charity members, contact profiles, monthly pledge tiers, and contribution records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="members-export-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            id="members-print-btn"
            onClick={() => triggerPrint('members-view', 'Charity_Members_Register')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>

          {user?.role !== 'viewer' && (
            <button
              id="add-member-btn"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="member-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, member #, mobile, email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Status:
          </span>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              id="filter-all"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({members.length})
            </button>
            <button
              id="filter-active"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Active ({members.filter((m) => m.status === 'active').length})
            </button>
            <button
              id="filter-inactive"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inactive ({members.filter((m) => m.status === 'inactive').length})
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4 p-1 rounded hover:bg-emerald-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Member ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Father's Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-right">Monthly Pledge</th>
                <th className="py-3 px-4 text-right">Total Contributed</th>
                <th className="py-3 px-4 text-right">Cash in Hand</th>
                <th className="py-3 px-4 text-center">Receipts</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {members.length === 0 ? (
                      <div>
                        <p className="font-semibold text-slate-700">No members registered yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Click "+ Add Member" to register your first charity member.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-700">No members match your search criteria.</p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                          className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-semibold underline"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr
                    key={m.id}
                    id={`member-row-${m.memberNumber}`}
                    className={`transition-colors ${
                      m.id === newlyAddedId ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-800">
                      <MemberLink
                        memberId={m.id}
                        memberName={m.memberNumber}
                        memberNumber={m.memberNumber}
                        originBreadcrumb={[{ label: 'Members', tab: 'members' }]}
                        className="font-mono font-semibold text-emerald-800 hover:underline"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                          {m.photoUrl ? (
                            <img
                              src={m.photoUrl}
                              alt={m.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-500 uppercase">
                              {m.fullName.charAt(0) || 'M'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <MemberLink
                            memberId={m.id}
                            memberName={m.fullName}
                            memberNumber={m.memberNumber}
                            originBreadcrumb={[{ label: 'Members', tab: 'members' }]}
                            className="font-semibold text-slate-900 hover:text-emerald-700 truncate block"
                          />
                          <div className="text-[11px] text-slate-400">Joined: {m.joinDate}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {m.fatherName || m.fatherHusbandName || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{m.mobileNumber}</div>
                      {m.email && <div className="text-[11px] text-slate-400">{m.email}</div>}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(m.monthlyContributionAmount, settings.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      <MemberLink
                        memberId={m.id}
                        focusTab="ledger"
                        originBreadcrumb={[{ label: 'Members', tab: 'members' }]}
                        className="font-bold text-emerald-700 hover:underline"
                      >
                        {formatCurrency(m.totalContributed, settings.currency)}
                      </MemberLink>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.cashBalances && Object.values(m.cashBalances).some((v) => (v as number) > 0) ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {Object.entries(m.cashBalances).map(([cur, bal]) =>
                            (bal as number) > 0 ? (
                              <MemberLink
                                key={cur}
                                memberId={m.id}
                                focusTab="cash"
                                originBreadcrumb={[{ label: 'Members', tab: 'members' }]}
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                              >
                                {formatCurrency(bal as number, cur)}
                              </MemberLink>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {m.receiptsCount || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          m.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        {user?.role !== 'viewer' && (
                          <button
                            id={`handover-member-${m.memberNumber}`}
                            onClick={() => {
                              setTransferMember(m);
                              setIsTransferModalOpen(true);
                            }}
                            title="Handover / Transfer Cash (P2P or Bank Deposit)"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-cyan-700 transition-colors"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          id={`ledger-member-${m.memberNumber}`}
                          onClick={() => openMemberLedger(m.id, { originBreadcrumb: [{ label: 'Members', tab: 'members' }] })}
                          title="Open Member Financial Ledger"
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700 hover:text-emerald-900 transition-colors"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>

                        <button
                          id={`view-member-${m.memberNumber}`}
                          onClick={() => setSelectedMember(m)}
                          title="View Profile & Contact Info"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {user?.role !== 'viewer' && (
                          <button
                            id={`edit-member-${m.memberNumber}`}
                            onClick={() => handleOpenEdit(m)}
                            title="Edit Member Details"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {user?.role === 'administrator' && (
                          <>
                            <button
                              id={`invite-user-member-${m.memberNumber}`}
                              onClick={() => {
                                sessionStorage.setItem('invite_target_member_id', m.id);
                                navigateToTab('users');
                              }}
                              title="Invite / Grant System Login (Members Only)"
                              className="p-1.5 rounded hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>

                            <button
                              id={`toggle-status-member-${m.memberNumber}`}
                              onClick={() => deactivateMember(m.id)}
                              title={m.status === 'active' ? 'Deactivate Member' : 'Activate Member'}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-amber-700 transition-colors"
                            >
                              {m.status === 'active' ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>

                            {m.receiptsCount === 0 && (
                              <button
                                id={`delete-member-${m.memberNumber}`}
                                onClick={() => {
                                  if (confirm(`Permanently delete ${m.fullName}?`)) {
                                    deleteMember(m.id);
                                  }
                                }}
                                title="Delete Member"
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Profile Modal (Summary + Transaction History) (Section 4) */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            id="member-profile-modal"
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-xl text-white">
                  {selectedMember.fullName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-display text-white">
                      {selectedMember.fullName}
                    </h2>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                      {selectedMember.memberNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-300 font-medium">Father's Name:</span>{' '}
                    {selectedMember.fatherName || selectedMember.fatherHusbandName || '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const id = selectedMember.id;
                    setSelectedMember(null);
                    openMemberLedger(id, { originBreadcrumb: [{ label: 'Members', tab: 'members' }] });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Open Financial Ledger</span>
                </button>

                {user?.role !== 'viewer' && (
                  <button
                    onClick={() => {
                      setTransferMember(selectedMember);
                      setIsTransferModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold shadow-xs"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfer / Handover</span>
                  </button>
                )}

                {user?.role !== 'viewer' && onOpenCreateReceiptForMember && (
                  <button
                    onClick={() => {
                      onOpenCreateReceiptForMember(selectedMember.id);
                      setSelectedMember(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                  >
                    + Collect Receipt
                  </button>
                )}
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Member Summary Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Total Contributed
                  </span>
                  <p className="text-base font-bold font-display text-emerald-700 mt-0.5">
                    {formatCurrency(selectedMember.totalContributed, settings.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Monthly Pledge
                  </span>
                  <p className="text-base font-bold font-display text-slate-800 mt-0.5">
                    {formatCurrency(selectedMember.monthlyContributionAmount, settings.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Receipts Issued
                  </span>
                  <p className="text-base font-bold font-display text-slate-800 mt-0.5">
                    {selectedMember.receiptsCount || 0}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Status
                  </span>
                  <p className="mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        selectedMember.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {selectedMember.status}
                    </span>
                  </p>
                </div>
              </div>

              {/* Cash in Hand Custodian Balances (Multi-Currency) */}
              <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-cyan-700" />
                    <span className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
                      Cash-in-Hand Custodian Balances
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-800">
                    Peer-to-peer handovers, collections &amp; pending bank deposits
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">AED Custody Balance</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-cyan-950">
                      {formatCurrency(selectedMember.cashBalances?.['AED'] || 0, 'AED')}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">INR Custody Balance</span>
                    <span className="text-base sm:text-lg font-bold font-mono text-cyan-950">
                      {formatCurrency(selectedMember.cashBalances?.['INR'] || 0, 'INR')}
                    </span>
                  </div>
                  {Object.entries(selectedMember.cashBalances || {})
                    .filter(([cur]) => cur !== 'AED' && cur !== 'INR')
                    .map(([cur, bal]) => (
                      <div key={cur} className="bg-white p-3 rounded-lg border border-cyan-100 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase block">{cur} Custody Balance</span>
                        <span className="text-base sm:text-lg font-bold font-mono text-cyan-950">
                          {formatCurrency(bal as number, cur)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Personal Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Father's Name</p>
                      <p className="font-semibold text-slate-800">{selectedMember.fatherName || selectedMember.fatherHusbandName || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Mobile</p>
                      <p className="font-medium text-slate-800">{selectedMember.mobileNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Email</p>
                      <p className="font-medium text-slate-800">{selectedMember.email || 'None'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Join Date</p>
                      <p className="font-medium text-slate-800">{selectedMember.joinDate}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strictly Separated Addresses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Local Address (UAE / Residence) */}
                <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-4 text-xs">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-100">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                      Local Address (Residence / UAE)
                    </span>
                  </div>
                  <div className="space-y-2 text-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Building / Villa</span>
                        <span className="font-medium">{selectedMember.localAddress?.buildingVilla || selectedMember.localAddress?.building || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Flat / Room</span>
                        <span className="font-medium">{selectedMember.localAddress?.flatRoom || selectedMember.localAddress?.flat || '—'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Street</span>
                        <span className="font-medium">{selectedMember.localAddress?.street || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Area</span>
                        <span className="font-medium">{selectedMember.localAddress?.area || '—'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">City, State / Emirate</span>
                        <span className="font-medium">
                          {selectedMember.localAddress?.city || 'Dubai'}, {selectedMember.localAddress?.emirateState || selectedMember.localAddress?.stateOrEmirate || 'Dubai'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Country</span>
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="text-sm leading-none">{getCountryFlag(selectedMember.localAddress?.country)}</span>
                          <span>{selectedMember.localAddress?.country || 'United Arab Emirates'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">PO Box</span>
                        <span className="font-medium">{selectedMember.localAddress?.poBox || selectedMember.localAddress?.postalCodeOrPoBox || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Local Phone</span>
                        <span className="font-medium">{selectedMember.localAddress?.localPhone || selectedMember.localAddress?.phone || selectedMember.mobileNumber}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Home Country Address (Origin) */}
                <div className="border border-sky-200 bg-sky-50/20 rounded-xl p-4 text-xs">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-sky-100">
                    <Building className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-sky-950 text-xs uppercase tracking-wider">
                      Home Country Address (Permanent / Origin)
                    </span>
                  </div>
                  <div className="space-y-2 text-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">House / Building</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.houseBuilding || selectedMember.homeCountryAddress?.building || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Street</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.street || '—'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Village / Area</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.villageArea || selectedMember.homeCountryAddress?.area || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">City / District</span>
                        <span className="font-medium">
                          {selectedMember.homeCountryAddress?.city || '—'}
                          {selectedMember.homeCountryAddress?.district ? `, ${selectedMember.homeCountryAddress.district}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">State / Province</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.stateProvince || selectedMember.homeCountryAddress?.stateOrEmirate || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Country</span>
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="text-sm leading-none">{getCountryFlag(selectedMember.homeCountryAddress?.country)}</span>
                          <span>{selectedMember.homeCountryAddress?.country || 'India'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Postal Code</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.postalCode || selectedMember.homeCountryAddress?.postalCodeOrPoBox || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Home Phone</span>
                        <span className="font-medium">{selectedMember.homeCountryAddress?.homePhone || selectedMember.homeCountryAddress?.phone || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedMember.notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg text-xs text-amber-900">
                  <span className="font-semibold">Notes: </span>
                  {selectedMember.notes}
                </div>
              )}

              {/* Member Transaction History (Section 4) */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Member Contribution Receipts ({memberReceipts.length})</span>
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberReceipts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                            No receipts recorded for this member yet.
                          </td>
                        </tr>
                      ) : (
                        memberReceipts.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono">{r.receiptDate}</td>
                            <td className="py-2 px-3 font-mono font-semibold text-emerald-700">
                              {r.receiptNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{r.contributionAccountName}</td>
                            <td className="py-2 px-3 text-slate-700">{r.paymentMethod}</td>
                            <td className="py-2 px-3 text-right">
                              <div className="font-bold text-slate-900">
                                {formatCurrency(r.amount, r.currency || settings.currency)}
                              </div>
                              {r.currency && r.currency !== settings.currency && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  ≈ {formatCurrency(r.baseAmount || r.amount, settings.currency)}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-xs">
                              {r.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Internal Transfers & Handovers Involving This Member */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-cyan-600" />
                  <span>Internal Cash Handovers &amp; Transfers ({memberTransfers.length})</span>
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Txn #</th>
                        <th className="py-2.5 px-3">Direction</th>
                        <th className="py-2.5 px-3">Counterparty</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                            No internal transfers or cash handovers recorded for this member yet.
                          </td>
                        </tr>
                      ) : (
                        memberTransfers.map((t) => {
                          const isReceiver = t.debitMemberId === selectedMember.id;
                          const counterpartyName = isReceiver
                            ? t.creditMemberName || t.creditAccountName || t.creditEntityName || 'Other'
                            : t.debitMemberName || t.debitAccountName || t.debitEntityName || 'Other';
                          const counterpartyType = isReceiver
                            ? t.creditMemberId
                              ? 'Custodian / Member'
                              : 'Bank/Cash Account'
                            : t.debitMemberId
                            ? 'Custodian / Member'
                            : 'Bank/Cash Account';

                          const isContribHandover = t.type === 'Contribution Handover' || Boolean(t.financialClassification);

                          return (
                            <tr key={t.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono">{t.date}</td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                                {t.transactionNumber}
                              </td>
                              <td className="py-2 px-3">
                                {isReceiver ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    Received Cash (Custodian)
                                  </span>
                                ) : isContribHandover ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-100 text-cyan-800"
                                    title="Contribution handed over to custodian"
                                  >
                                    Contribution Handed to Custodian
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                    Transferred Cash (Handover)
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-800">{counterpartyName}</div>
                                <div className="text-[10px] text-slate-400">{counterpartyType}</div>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div
                                  className={`font-bold font-mono ${
                                    isReceiver
                                      ? 'text-emerald-700'
                                      : isContribHandover
                                      ? 'text-cyan-800'
                                      : 'text-amber-800'
                                  }`}
                                >
                                  {isReceiver ? '+' : isContribHandover ? '' : '-'}
                                  {formatCurrency(t.originalAmount || t.amount, t.currency || settings.currency)}
                                </div>
                                {t.currency && t.currency !== settings.currency && (
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    ≈ {formatCurrency(t.amount, settings.currency)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-500 truncate max-w-xs" title={t.description}>
                                {t.description}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            id="member-form-modal"
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold font-display text-slate-900">
                  {editingMember ? `Edit Member (${editingMember.memberNumber})` : 'Register New Charity Member'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete personal details, Father's Name, and strictly separated addresses.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* SECTION 1: Personal Details & Photo */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    1. Personal Details &amp; Custodianship
                  </h3>
                </div>

                {/* Member Profile Photo Upload Block */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Circular Avatar Preview */}
                  <div className="relative group shrink-0">
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDragEnter={() => setIsPhotoDragging(true)}
                      onDragLeave={() => setIsPhotoDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPhotoDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                      className={`w-20 h-20 rounded-full border-2 transition-all overflow-hidden flex items-center justify-center relative shadow-xs ${
                        isPhotoDragging
                          ? 'border-emerald-500 bg-emerald-100/60 scale-105'
                          : 'border-slate-300 bg-white hover:border-emerald-400'
                      }`}
                    >
                      {formPhotoUrl ? (
                        <img
                          src={formPhotoUrl}
                          alt="Member Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100">
                          <Users className="w-8 h-8 text-slate-400 stroke-1" />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">No Photo</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-2 border-white cursor-pointer transition-transform hover:scale-110"
                      title="Upload Member Photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Photo Actions & Guidance */}
                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{formPhotoUrl ? 'Change Photo' : 'Upload Member Photo'}</span>
                      </button>

                      {formPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setFormPhotoUrl('')}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Upload member portrait or passport photo. Auto-compressed for ID badges, financial ledger, and member registers.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      id="input-member-fullname"
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="e.g. Mohammed Al-Mansoor"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Father's Name <span className="text-slate-400 text-[10px] font-normal">(First-class field)</span>
                    </label>
                    <input
                      type="text"
                      id="input-member-father"
                      value={formFatherName}
                      onChange={(e) => setFormFatherName(e.target.value)}
                      placeholder="e.g. Rashid Al-Mansoor"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      id="input-member-mobile"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      placeholder="e.g. +971 50 123 4567"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="input-member-email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. member@charity.org"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Join Date
                    </label>
                    <input
                      type="date"
                      id="input-member-joindate"
                      value={formJoinDate}
                      onChange={(e) => setFormJoinDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Pledge ({settings.currency}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      required
                      id="input-member-monthlyamount"
                      value={formMonthlyAmount}
                      onChange={(e) => setFormMonthlyAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Membership Status
                    </label>
                    <select
                      id="input-member-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as MemberStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Local Address (Strictly Separated) */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    2. Local Address (Residence / UAE) — Strictly Separated
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Building / Villa
                    </label>
                    <input
                      type="text"
                      id="input-local-building"
                      value={formLocalBuilding}
                      onChange={(e) => setFormLocalBuilding(e.target.value)}
                      placeholder="e.g. Al-Dhiyafa Tower 2"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Flat / Room
                    </label>
                    <input
                      type="text"
                      id="input-local-flat"
                      value={formLocalFlat}
                      onChange={(e) => setFormLocalFlat(e.target.value)}
                      placeholder="e.g. Apt 402"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Street
                    </label>
                    <input
                      type="text"
                      id="input-local-street"
                      value={formLocalStreet}
                      onChange={(e) => setFormLocalStreet(e.target.value)}
                      placeholder="e.g. 2nd December St"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Area
                    </label>
                    <input
                      type="text"
                      id="input-local-area"
                      value={formLocalArea}
                      onChange={(e) => setFormLocalArea(e.target.value)}
                      placeholder="e.g. Satwa / Al Barsha"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      id="input-local-city"
                      value={formLocalCity}
                      onChange={(e) => setFormLocalCity(e.target.value)}
                      placeholder="e.g. Dubai"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Emirate / State
                    </label>
                    <input
                      type="text"
                      id="input-local-emirate"
                      value={formLocalEmirate}
                      onChange={(e) => setFormLocalEmirate(e.target.value)}
                      placeholder="e.g. Dubai / Abu Dhabi / Sharjah"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="relative">
                    <CountrySelect
                      id="input-local-country"
                      label="Country"
                      value={formLocalCountry}
                      onChange={(countryName) => setFormLocalCountry(countryName)}
                      placeholder="Select local country..."
                      showDialCode
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      PO Box
                    </label>
                    <input
                      type="text"
                      id="input-local-pobox"
                      value={formLocalPoBox}
                      onChange={(e) => setFormLocalPoBox(e.target.value)}
                      placeholder="e.g. 12345"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Local Phone
                    </label>
                    <input
                      type="tel"
                      id="input-local-phone"
                      value={formLocalPhone}
                      onChange={(e) => setFormLocalPhone(e.target.value)}
                      placeholder="e.g. 04 123 4567"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Home Country Address (Permanent / Origin) — Karnataka, India */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/20 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-sky-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-sky-600" />
                    <h3 className="text-xs font-bold text-sky-950 uppercase tracking-wider">
                      3. Home Country Address (Permanent / Origin) — Karnataka, India
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-200 flex items-center gap-1">
                      <span>🇮🇳</span>
                      <span>India (+91)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                      Karnataka State
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Country (Locked) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Country <span className="text-[10px] text-slate-400 font-normal">(Locked)</span>
                    </label>
                    <div className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium flex items-center gap-1.5 select-none cursor-not-allowed">
                      <span>🇮🇳</span>
                      <span>India (+91)</span>
                    </div>
                  </div>

                  {/* State (Locked) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      State <span className="text-[10px] text-slate-400 font-normal">(Locked)</span>
                    </label>
                    <div className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium flex items-center justify-between select-none cursor-not-allowed">
                      <span>Karnataka</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">KA</span>
                    </div>
                  </div>

                  {/* District (Karnataka Coastal & Key Districts) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      District <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="input-home-district"
                      value={formHomeDistrict}
                      onChange={(e) => {
                        const newDist = e.target.value;
                        setFormHomeDistrict(newDist);
                        const availableTaluks = KARNATAKA_TALUKS[newDist] || ['Other / Custom'];
                        setFormHomeTaluk(availableTaluks[0] || 'Udupi');
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    >
                      {KARNATAKA_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Taluk / Town (Dynamic Select) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Taluk / Town <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="input-home-taluk"
                      value={formHomeTaluk}
                      onChange={(e) => setFormHomeTaluk(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    >
                      {(KARNATAKA_TALUKS[formHomeDistrict] || ['Other / Custom']).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Village / Area */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Village / Area
                    </label>
                    <input
                      type="text"
                      id="input-home-village"
                      value={formHomeVillage}
                      onChange={(e) => setFormHomeVillage(e.target.value)}
                      placeholder="e.g. Udyavara, Katapady, Malpe, Korangrapady, Vaddarse"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* House / Compound Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      House / Compound Name
                    </label>
                    <input
                      type="text"
                      id="input-home-house"
                      value={formHomeHouse}
                      onChange={(e) => setFormHomeHouse(e.target.value)}
                      placeholder="e.g. Baitul Aman, House #42"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* Street / Landmark */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Street / Landmark
                    </label>
                    <input
                      type="text"
                      id="input-home-street"
                      value={formHomeStreet}
                      onChange={(e) => setFormHomeStreet(e.target.value)}
                      placeholder="e.g. Mosque Road, Jamia Mohalla"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  {/* PIN Code */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      PIN Code (6-digit)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      id="input-home-postal"
                      value={formHomePostalCode}
                      onChange={(e) => setFormHomePostalCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 576101"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Home Phone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Home Landline / Contact
                    </label>
                    <input
                      type="tel"
                      id="input-home-phone"
                      value={formHomePhone}
                      onChange={(e) => setFormHomePhone(e.target.value)}
                      placeholder="e.g. +91 820 2520000"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Administrative Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Remarks &amp; Notes
                </label>
                <textarea
                  rows={2}
                  id="input-member-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Special requests, pledge frequency, remarks..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="submit-member-btn"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingMember ? 'Update Member' : 'Register Member'}
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
          setTransferMember(null);
        }}
        initialSenderMemberId={transferMember?.id}
      />
    </div>
  );
};
