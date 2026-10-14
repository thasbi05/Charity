import React from 'react';
import { useCharity } from '../../context/CharityContext';

interface DocumentLogoWatermarkProps {
  /**
   * Optional custom logo URL. If not provided, falls back to active charity logo,
   * uploaded organization branding logo, or default emblem '/logo.svg'.
   */
  logoUrl?: string;

  /**
   * Whether to display the watermark. Defaults to template or global settings (enabled by default).
   */
  showWatermark?: boolean;

  /**
   * Watermark opacity between 0.02 and 0.20. Default is 0.06 (6%).
   */
  opacity?: number;

  /**
   * Sizing scale presets: 'sm' (260px), 'md' (340px - default), 'lg' (420px).
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Custom CSS classes.
   */
  className?: string;
}

/**
 * Universal Document Logo Watermark Component
 *
 * Renders a centered, faint, non-intrusive organization logo watermark across
 * all downloadable PDFs, preview modals, and browser printouts (@media print).
 *
 * Specifications:
 * - Positioned dead-center behind content (z-index: 0, pointer-events: none)
 * - Faint subtle opacity (default 6% / 0.06) ensuring all text and tables remain sharp and readable
 * - Native support for html2canvas, jsPDF, and browser print engines
 */
export const DocumentLogoWatermark: React.FC<DocumentLogoWatermarkProps> = ({
  logoUrl,
  showWatermark,
  opacity,
  size = 'md',
  className = '',
}) => {
  const { settings, activeCharity } = useCharity();

  // Resolve whether watermark should be shown (default true)
  const isEnabled =
    showWatermark !== undefined
      ? showWatermark
      : settings.showWatermark !== false;

  if (!isEnabled) {
    return null;
  }

  // Resolve logo image source
  const resolvedLogo =
    logoUrl ||
    activeCharity?.logoUrl ||
    settings.logoUrl ||
    '/logo.svg';

  // Opacity: default 0.06 (6%), clamped between 0.02 and 0.25
  const rawOpacity =
    opacity !== undefined
      ? opacity
      : settings.watermarkOpacity !== undefined
      ? settings.watermarkOpacity
      : 0.06;

  const resolvedOpacity = Math.max(0.02, Math.min(0.25, rawOpacity));

  const sizeWidth =
    size === 'sm' ? '260px' : size === 'lg' ? '420px' : '340px';

  return (
    <div
      className={`document-watermark pointer-events-none absolute inset-0 flex items-center justify-center select-none overflow-hidden z-0 ${className}`}
      style={{
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      <img
        src={resolvedLogo}
        alt=""
        className="object-contain filter grayscale-[15%] transition-opacity duration-150"
        style={{
          width: sizeWidth,
          maxWidth: '44%',
          maxHeight: '44%',
          opacity: resolvedOpacity,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        onError={(e) => {
          // If custom logo fails to load (e.g. broken path), fallback to default vector emblem
          const target = e.currentTarget;
          if (target.src !== `${window.location.origin}/logo.svg`) {
            target.src = '/logo.svg';
          }
        }}
      />
    </div>
  );
};
