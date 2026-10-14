import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, Check, X, Globe } from 'lucide-react';
import { ALL_COUNTRIES, POPULAR_COUNTRIES, CountryItem, findCountry } from '../../utils/countries';

interface CountrySelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (countryName: string, countryItem?: CountryItem) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  showDialCode?: boolean;
  showCurrency?: boolean;
  label?: string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'Select country...',
  className = '',
  disabled = false,
  required = false,
  showDialCode = false,
  showCurrency = false,
  label,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Match the currently selected country object
  const selectedCountry: CountryItem | undefined =
    findCountry(value) ||
    (value
      ? {
          name: value,
          code: '',
          dialCode: '',
          flag: '🌐',
          currency: 'AED',
          currencyName: '',
        }
      : undefined);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filter countries according to search input
  const filteredCountries = ALL_COUNTRIES.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q)
    );
  });

  const handleSelect = (c: CountryItem) => {
    onChange(c.name, c);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-[11px] font-semibold text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Selector Trigger Button */}
      <button
        type="button"
        id={selectId}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg flex items-center justify-between transition-colors text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-slate-400 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1">
          {selectedCountry ? (
            <>
              <span className="text-base leading-none shrink-0 select-none">
                {selectedCountry.flag || '🌐'}
              </span>
              <span className="truncate font-medium text-slate-900">
                {selectedCountry.name}
              </span>
              {showDialCode && selectedCountry.dialCode && (
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  ({selectedCountry.dialCode})
                </span>
              )}
              {showCurrency && selectedCountry.currency && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                  {selectedCountry.currency}
                </span>
              )}
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 truncate">{placeholder}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1 text-slate-400">
          {selectedCountry && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="p-0.5 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-xs max-w-sm sm:max-w-md w-full animate-in fade-in-50 zoom-in-95 duration-100"
          style={{ minWidth: '260px' }}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 240+ countries..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsOpen(false);
                  if (e.key === 'Enter' && filteredCountries.length > 0) {
                    e.preventDefault();
                    handleSelect(filteredCountries[0]);
                  }
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Popular Shortcut Chips */}
            {!search && (
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-[10px] text-slate-500 scrollbar-none">
                <span className="font-semibold text-[9px] uppercase tracking-wider text-slate-400 shrink-0 mr-0.5">
                  Popular:
                </span>
                {POPULAR_COUNTRIES.slice(0, 6).map((popName) => {
                  const popCountry = ALL_COUNTRIES.find((c) => c.name === popName);
                  if (!popCountry) return null;
                  const isPopSelected = selectedCountry?.name === popName;
                  return (
                    <button
                      key={popCountry.code}
                      type="button"
                      onClick={() => handleSelect(popCountry)}
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-medium shrink-0 flex items-center gap-1 transition-colors ${
                        isPopSelected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{popCountry.flag}</span>
                      <span>{popCountry.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Country Items List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 py-1">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No countries found matching "{search}"
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = selectedCountry?.name === country.name;
                return (
                  <div
                    key={country.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(country)}
                    className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 font-semibold text-emerald-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="text-base leading-none select-none shrink-0">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                      <span className="text-[10px] font-mono font-semibold px-1 rounded bg-slate-100 text-slate-500 shrink-0">
                        {country.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {showCurrency && country.currency && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                          {country.currency}
                        </span>
                      )}
                      {showDialCode && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {country.dialCode}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count indicator */}
          <div className="px-3 py-1 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Showing {filteredCountries.length} countries</span>
            <span>Total {ALL_COUNTRIES.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
