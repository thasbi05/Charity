import React from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  QrCode,
  MapPin,
  Phone,
  Calendar,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { Member, OrganizationSettings } from '../../types';
import { triggerPrint } from '../../utils/export';

interface MemberIdCardModalProps {
  member: Member | null;
  settings: OrganizationSettings;
  onClose: () => void;
}

export const MemberIdCardModal: React.FC<MemberIdCardModalProps> = ({
  member,
  settings,
  onClose,
}) => {
  if (!member) return null;

  const district =
    member.homeAddress?.district ||
    member.homeCountryAddress?.district ||
    'Udupi';
  const taluk =
    member.homeAddress?.taluk ||
    member.homeCountryAddress?.taluk ||
    member.homeCountryAddress?.city ||
    '';
  const village =
    member.homeAddress?.village ||
    member.homeCountryAddress?.villageArea ||
    member.homeCountryAddress?.area ||
    '';

  const karnatakaOrigin = [village, taluk, district, 'Karnataka, India']
    .filter(Boolean)
    .join(', ');

  const handlePrint = () => {
    triggerPrint('member-id-card-printable');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-bold font-display text-slate-900">
              Official Member Identity Badge
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Badge</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Canvas */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex items-center justify-center">
          <div
            id="member-id-card-printable"
            className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden text-slate-900 relative"
            style={{ minHeight: '260px' }}
          >
            {/* Card Header Strip */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-3.5 flex items-center justify-between gap-3 border-b-2 border-emerald-500">
              <div className="flex items-center gap-2.5">
                <img
                  src={settings.logoUrl || '/logo.svg'}
                  alt="Logo"
                  className="w-9 h-9 object-contain bg-white rounded-lg p-0.5 shadow-2xs shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-brand font-bold text-xs tracking-wider text-white truncate">
                    {settings.charityName || 'UDYAVAR MUSLIM UNITY UAE'}
                  </h3>
                  <p className="text-[9px] text-emerald-300 font-medium">
                    {settings.tagline || 'Charity & Community Welfare Relief • ESTD 2008'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {member.memberNumber}
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 grid grid-cols-12 gap-3.5 items-center">
              {/* Photo Area */}
              <div className="col-span-4 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-xl border-2 border-emerald-600/80 shadow-md bg-slate-50 overflow-hidden flex items-center justify-center relative p-0.5">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-slate-800 text-white flex items-center justify-center font-bold text-2xl rounded-lg">
                      {member.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span
                  className={`mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    member.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {member.status === 'active' ? 'Active Member' : 'Inactive'}
                </span>
              </div>

              {/* Member Details */}
              <div className="col-span-8 space-y-1.5 text-xs">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 leading-tight">
                    {member.fullName}
                  </h4>
                  {(member.fatherName || member.fatherHusbandName) && (
                    <p className="text-[10px] text-slate-500">
                      S/o {member.fatherName || member.fatherHusbandName}
                    </p>
                  )}
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-100 text-[10px]">
                  <div className="flex items-start gap-1 text-slate-700">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-semibold block text-[9px]">ORIGIN (KARNATAKA):</span>
                      <span className="font-medium text-slate-800">{karnatakaOrigin}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-700">
                    <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-mono font-medium">{member.mobileNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-600">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Member Since: <strong className="text-slate-800">{member.joinDate}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Footer Bar */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <QrCode className="w-5 h-5 text-slate-700" />
                <span>Verified Charity Member</span>
              </div>

              {settings.stampUrl ? (
                <img
                  src={settings.stampUrl}
                  alt="Official Seal"
                  className="w-7 h-7 object-contain rounded-full shadow-2xs"
                />
              ) : (
                <span className="font-brand font-bold text-emerald-800">UMU UAE</span>
              )}

              <div className="text-right">
                <span className="text-[8px] text-slate-400 block">Authorized Signature</span>
                {settings.signatureUrl ? (
                  <img
                    src={settings.signatureUrl}
                    alt="Signature"
                    className="h-4 max-w-[60px] object-contain ml-auto"
                  />
                ) : (
                  <span className="text-[9px] font-semibold text-slate-700">Managing Trustee</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          This digital identity badge can be printed, laminated, or saved for official verification.
        </div>
      </div>
    </div>
  );
};
