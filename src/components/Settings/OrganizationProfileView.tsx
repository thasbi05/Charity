import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Sparkles,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Hash,
  Phone,
  Mail,
  Globe,
  MapPin,
  Stamp,
  FileSignature,
  RotateCcw,
  Eye,
  ShieldCheck,
  Lock,
  Layers,
  Palette,
  ExternalLink,
} from 'lucide-react';
import { useCharity } from '../../context/CharityContext';
import { useAuth } from '../../context/AuthContext';
import { OrganizationSettings } from '../../types';
import { CountrySelect } from '../Common/CountrySelect';
import { processImageFile, ALLOWED_IMAGE_TYPES } from '../../utils/imageUpload';

interface OrganizationProfileViewProps {
  onSaved?: () => void;
}

export const OrganizationProfileView: React.FC<OrganizationProfileViewProps> = ({ onSaved }) => {
  const { settings, updateSettings, activeCharity, isDefaultCharity } = useCharity();
  const { user } = useAuth();

  // Role check: Administrator check
  const isAdmin =
    user?.role === 'administrator' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'CHARITY_ADMIN' ||
    !user?.role ||
    user?.role === ('admin' as any);

  // Helper to ensure consistent, clean form draft initialization
  const createFormStateFromSettings = (s: OrganizationSettings): OrganizationSettings => ({
    ...s,
    charityName: s.charityName || 'Udyavar Muslim Unity UAE',
    tagline: s.tagline ?? '',
    country: s.country || 'United Arab Emirates',
    logoUrl: s.logoUrl || '/logo.svg',
    stampUrl: s.stampUrl ?? '',
    signatureUrl: s.signatureUrl ?? '',
    signatoryName: s.signatoryName ?? '',
    signatoryDesignation: s.signatoryDesignation ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    stateEmirate: s.stateEmirate ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    emailFrom: s.emailFrom || 'Udyavar Muslim Unity UAE <onboarding@resend.dev>',
    website: s.website ?? '',
    socialLink: s.socialLink ?? '',
    registrationNumber: s.registrationNumber ?? '',
  });

  // Form State
  const [formData, setFormData] = useState<OrganizationSettings>(() =>
    createFormStateFromSettings(settings)
  );

  // Drag states
  const [isLogoDragging, setIsLogoDragging] = useState(false);
  const [isStampDragging, setIsStampDragging] = useState(false);
  const [isSignatureDragging, setIsSignatureDragging] = useState(false);

  // Preview dark/light mode for logo transparent check
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');

  // Status & notifications
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for hidden inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const isDirtyRef = useRef(false);

  // Centralized input change handler ensuring two-way binding and dirty state tracking
  const handleInputChange = (
    field: keyof OrganizationSettings,
    valueOrEvent: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | any
  ) => {
    isDirtyRef.current = true;
    setIsDirty(true);
    const value =
      valueOrEvent && typeof valueOrEvent === 'object' && 'target' in valueOrEvent
        ? valueOrEvent.target.value
        : valueOrEvent;

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Sync state when active charity or settings change from database ONLY when user has not edited
  useEffect(() => {
    if (!isDirtyRef.current) {
      setFormData(createFormStateFromSettings(settings));
    }
  }, [settings]);

  // Generic File Upload Handler
  const handleFileUpload = async (
    file: File,
    target: 'logo' | 'stamp' | 'signature'
  ) => {
    try {
      setErrorMessage('');
      isDirtyRef.current = true;
      setIsDirty(true);
      const base64Data = await processImageFile(file, {
        maxWidth: target === 'signature' ? 500 : target === 'stamp' ? 400 : 380,
        maxHeight: target === 'signature' ? 250 : target === 'stamp' ? 400 : 200,
        quality: 0.88,
      });

      if (target === 'logo') {
        setFormData((prev) => ({ ...prev, logoUrl: base64Data }));
      } else if (target === 'stamp') {
        setFormData((prev) => ({ ...prev, stampUrl: base64Data }));
      } else if (target === 'signature') {
        setFormData((prev) => ({ ...prev, signatureUrl: base64Data }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload image.');
    }
  };

  // Drag and Drop Helper
  const createDropHandler =
    (target: 'logo' | 'stamp' | 'signature') =>
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (target === 'logo') setIsLogoDragging(false);
      if (target === 'stamp') setIsStampDragging(false);
      if (target === 'signature') setIsSignatureDragging(false);

      if (!isAdmin) return;

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileUpload(file, target);
      }
    };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Reset to default UMU Vector Emblem
  const handleResetToOfficialEmblem = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, logoUrl: '/logo.svg' }));
  };

  const handleRemoveLogo = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
  };

  const handleRemoveStamp = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, stampUrl: '' }));
  };

  const handleRemoveSignature = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, signatureUrl: '' }));
  };

  // Save changes
  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage('');
    setSuccessMessage('');

    if (!isAdmin) {
      setErrorMessage('Permission denied: Only administrators can modify organization identity.');
      return;
    }

    if (!formData.charityName || !formData.charityName.trim()) {
      setErrorMessage('Organization Legal Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payloadToSave: OrganizationSettings = {
        ...formData,
        charityName: formData.charityName.trim(),
        tagline: (formData.tagline || '').trim(),
        registrationNumber: (formData.registrationNumber || '').trim(),
        country: formData.country || 'United Arab Emirates',
        city: (formData.city || '').trim(),
        stateEmirate: (formData.stateEmirate || '').trim(),
        phone: (formData.phone || '').trim(),
        email: (formData.email || '').trim(),
        website: (formData.website || '').trim(),
        socialLink: (formData.socialLink || '').trim(),
        address: (formData.address || '').trim(),
        signatoryName: (formData.signatoryName || '').trim(),
        signatoryDesignation: (formData.signatoryDesignation || '').trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateSettings(payloadToSave);

      // Immediately keep local draft synchronized with the saved payload
      setFormData(payloadToSave);
      isDirtyRef.current = false;
      setIsDirty(false);

      // Update local storage cached logo & settings explicitly so no old values linger
      if (typeof window !== 'undefined') {
        try {
          if (payloadToSave.logoUrl && payloadToSave.logoUrl !== '/logo.svg') {
            localStorage.setItem('charity_cached_logo', payloadToSave.logoUrl);
          } else {
            localStorage.removeItem('charity_cached_logo');
          }
          localStorage.setItem('charity_cached_settings', JSON.stringify(payloadToSave));
        } catch {
          // ignore quota
        }
      }

      setSuccessMessage('Organization Details & Legal Identity saved successfully! All member receipts, charity aid vouchers, and ledger headers are immediately updated.');
      if (onSaved) {
        onSaved();
      }
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save organization profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Notice for Non-Admins */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold block">View-Only Access</span>
            You are viewing the organization profile. Administrative privileges are required to update organization branding, logos, official stamps, and contact records.
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Brand Identity Preview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-slate-700 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Building2 className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center shrink-0 border border-emerald-400/30">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt={formData.charityName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {formData.registrationNumber || 'UMU-UAE-ESTD2008'}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  {formData.city || 'Dubai'}, {formData.country || 'UAE'}
                </span>
              </div>
              <h1 className="font-brand font-bold text-lg sm:text-2xl text-white tracking-wide truncate mt-1">
                {formData.charityName || 'Organization Name'}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-200/90 font-medium truncate mt-0.5">
                {formData.tagline || 'Charity & Community Welfare Relief'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
            <div className="text-right hidden sm:block text-xs text-slate-300 space-y-0.5 border-l border-slate-700/80 pl-4">
              <p className="text-[11px] text-slate-400">Official Contact</p>
              <p className="font-mono">{formData.phone}</p>
              <p className="text-emerald-300 truncate max-w-[200px]">{formData.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Quick Status & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved Draft Changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Settings Synced with Database
            </span>
          )}
          <span className="text-xs text-slate-500 hidden md:inline">
            Persisted values propagate instantly across all receipts, vouchers, and statements.
          </span>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e)}
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Changes...' : 'Save All Details'}</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: LOGO & MEDIA UPLOAD SYSTEM */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-emerald-600" />
                <span>Brand Assets & Official Seals</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload official vector or raster logos, round organizational stamps, and verified digital signatures for PDF synchronization.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-medium hidden sm:inline">Preview:</span>
              <button
                type="button"
                onClick={() => setPreviewTheme(previewTheme === 'light' ? 'dark' : 'light')}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>{previewTheme === 'light' ? 'Light Bg' : 'Dark Bg'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Slot 1: Primary Logo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Organization Logo</span>
                  <span className="text-rose-500">*</span>
                </label>
                {formData.logoUrl && (
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={() => setIsLogoDragging(true)}
                onDragLeave={() => setIsLogoDragging(false)}
                onDrop={createDropHandler('logo')}
                className={`relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center min-h-[160px] text-center ${
                  isLogoDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-slate-400'
                } ${previewTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}
              >
                {formData.logoUrl ? (
                  <div className="flex flex-col items-center space-y-2">
                    <img
                      src={formData.logoUrl}
                      alt="Logo Preview"
                      className="max-h-24 max-w-[170px] object-contain"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formData.logoUrl.startsWith('data:') ? 'Custom Upload' : formData.logoUrl}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-medium">Drag & drop logo here</p>
                    <p className="text-[10px] text-slate-400">PNG, JPG, WEBP, SVG up to 4MB</p>
                  </div>
                )}

                <input
                  ref={logoInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'logo');
                  }}
                  className="hidden"
                  disabled={!isAdmin}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={!isAdmin}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{formData.logoUrl ? 'Change' : 'Upload'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToOfficialEmblem}
                  disabled={!isAdmin}
                  title="Restore official UMU crest emblem"
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reset UMU Crest</span>
                </button>

                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={!isAdmin}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                    title="Remove custom logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Slot 2: Official Organization Round Stamp */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Official Round Stamp / Seal</span>
                </label>
                {formData.stampUrl ? (
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Uploaded
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Default CSS Stamp</span>
                )}
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={() => setIsStampDragging(true)}
                onDragLeave={() => setIsStampDragging(false)}
                onDrop={createDropHandler('stamp')}
                className={`relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center min-h-[160px] text-center ${
                  isStampDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-slate-400'
                } bg-slate-50`}
              >
                {formData.stampUrl ? (
                  <div className="flex flex-col items-center space-y-2">
                    <img
                      src={formData.stampUrl}
                      alt="Stamp Preview"
                      className="w-24 h-24 object-contain rounded-full border border-slate-200 shadow-2xs bg-white p-1"
                    />
                    <span className="text-[10px] text-slate-500">Official Stamp Image</span>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-emerald-700/60 bg-emerald-50/40 flex flex-col items-center justify-center p-2 text-center shrink-0">
                    <span className="text-[8px] uppercase font-bold text-emerald-950 tracking-wider">
                      Official Seal
                    </span>
                    <span className="text-[7px] text-emerald-700 font-semibold">UMU UAE</span>
                    <span className="text-[6.5px] text-slate-400 font-mono mt-0.5">ESTD 2008</span>
                  </div>
                )}

                <input
                  ref={stampInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'stamp');
                  }}
                  className="hidden"
                  disabled={!isAdmin}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => stampInputRef.current?.click()}
                  disabled={!isAdmin}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{formData.stampUrl ? 'Change Stamp' : 'Upload Stamp'}</span>
                </button>

                {formData.stampUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveStamp}
                    disabled={!isAdmin}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                    title="Remove uploaded stamp (reverts to standard circular seal)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Slot 3: Authorized Signatory Signature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSignature className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Authorized Signatory Signature</span>
                </label>
                {formData.signatureUrl ? (
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">Blank Line</span>
                )}
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={() => setIsSignatureDragging(true)}
                onDragLeave={() => setIsSignatureDragging(false)}
                onDrop={createDropHandler('signature')}
                className={`relative rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center min-h-[160px] text-center ${
                  isSignatureDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-slate-400'
                } bg-slate-50`}
              >
                {formData.signatureUrl ? (
                  <div className="flex flex-col items-center space-y-1.5">
                    <img
                      src={formData.signatureUrl}
                      alt="Signature Preview"
                      className="max-h-16 max-w-[160px] object-contain"
                    />
                    <div className="w-32 border-b border-slate-400" />
                    <span className="text-[10px] font-bold text-slate-700">
                      {formData.signatoryName || 'Authorized Signatory'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 text-slate-400">
                    <FileSignature className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <div className="w-32 mx-auto border-b border-dashed border-slate-400" />
                    <p className="text-[10px] text-slate-400">Transparent PNG recommended</p>
                  </div>
                )}

                <input
                  ref={signatureInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'signature');
                  }}
                  className="hidden"
                  disabled={!isAdmin}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={!isAdmin}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{formData.signatureUrl ? 'Change' : 'Upload'}</span>
                </button>

                {formData.signatureUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    disabled={!isAdmin}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                    title="Remove uploaded signature"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: ORGANIZATION DETAILS & CONTACT FORM */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Organization Details & Legal Identity</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These details form the official legal header rendered on all Member Contribution Receipts, Charity Aid Vouchers, and Ledger Statements.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Organization Legal Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Organization Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={formData.charityName ?? ''}
                onChange={(e) => handleInputChange('charityName', e)}
                placeholder="e.g. Udyavar Muslim Unity UAE"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-brand font-semibold text-slate-900 disabled:bg-slate-50"
              />
            </div>

            {/* Tagline / Subtitle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.tagline ?? ''}
                onChange={(e) => handleInputChange('tagline', e)}
                placeholder="e.g. Charity & Community Welfare Relief • ESTD 2008"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
              />
            </div>

            {/* Registration / Trust / License Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registration / Trust / License #
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.registrationNumber ?? ''}
                  onChange={(e) => handleInputChange('registrationNumber', e)}
                  placeholder="e.g. UMU-UAE-ESTD2008"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Country / Operating Territory */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Country / Operating Territory
              </label>
              <CountrySelect
                value={formData.country || 'United Arab Emirates'}
                onChange={(c) => handleInputChange('country', c)}
                disabled={!isAdmin}
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                City / Emirate
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.city ?? ''}
                onChange={(e) => handleInputChange('city', e)}
                placeholder="e.g. Dubai"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
              />
            </div>

            {/* Official Contact Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Contact Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.phone ?? ''}
                  onChange={(e) => handleInputChange('phone', e)}
                  placeholder="e.g. +971 50 123 4567"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Official Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  disabled={!isAdmin}
                  value={formData.email ?? ''}
                  onChange={(e) => handleInputChange('email', e)}
                  placeholder="e.g. udyavarmuslimunityuae@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Email From (Outbound Sender Identity) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Email From (Sender Header)</span>
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Resend / SMTP</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.emailFrom ?? ''}
                  onChange={(e) => handleInputChange('emailFrom', e)}
                  placeholder="e.g. Udyavar Muslim Unity UAE <onboarding@resend.dev>"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Outbound sender address for authentication OTPs and notifications.
              </p>
            </div>

            {/* Website / Web Portal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Website / Web Portal
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.website ?? ''}
                  onChange={(e) => handleInputChange('website', e)}
                  placeholder="e.g. www.udyavarmuslimunity.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Social Link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Social Link / Channel
              </label>
              <div className="relative">
                <ExternalLink className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.socialLink ?? ''}
                  onChange={(e) => handleInputChange('socialLink', e)}
                  placeholder="e.g. https://instagram.com/udyavarmuslimunityuae"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Physical Office Address */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Physical Office Address / Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  rows={2}
                  disabled={!isAdmin}
                  value={formData.address ?? ''}
                  onChange={(e) => handleInputChange('address', e)}
                  placeholder="Street / Community Building, P.O. Box 2008, Dubai, United Arab Emirates"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 disabled:bg-slate-50 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SIGNATORY & TRUSTEE DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-600" />
              <span>Official Signatory Metadata</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These details are printed directly beneath the signature block on payment vouchers, relief disbursements, and receipts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Authorized Signatory Full Name
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.signatoryName ?? ''}
                onChange={(e) => handleInputChange('signatoryName', e)}
                placeholder="e.g. Managing Trustee / Treasurer"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Signatory Designation / Role
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.signatoryDesignation ?? ''}
                onChange={(e) => handleInputChange('signatoryDesignation', e)}
                placeholder="e.g. Authorized Financial Signatory"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* SAVE CHANGES SUBMIT BAR */}
        {isAdmin && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Unsaved Changes Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  All Changes Persisted &amp; Up to Date
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e)}
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Organization Profile & Branding'}</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
