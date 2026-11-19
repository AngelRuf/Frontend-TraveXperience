import React, { useEffect, useRef, useState } from 'react';
import { searchAddresses } from '../services/osmService';

/**
 * Autocompletado de direcciones 100 % gratuito (OpenStreetMap vía Photon).
 * Sustituye a <Autocomplete> de @react-google-maps/api.
 *
 * Props:
 *  - value / onChange(texto)  → texto del input (controlado por el padre)
 *  - onSelect({ lat, lng, address, name }) → cuando el usuario elige una sugerencia
 *  - onBlur, placeholder, className → pasan directo al <input>
 */
export default function AddressAutocomplete({ value, onChange, onSelect, onBlur, placeholder, className }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return undefined;
    }
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!value || value.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const list = await searchAddresses(value, { signal: controller.signal });
        setResults(list);
        setOpen(list.length > 0);
      } catch (err) {
        if (err?.name !== 'AbortError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timerRef.current);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (item) => {
    justSelectedRef.current = true;
    setOpen(false);
    setResults([]);
    onSelect?.({ lat: item.lat, lng: item.lng, address: item.address, name: item.name });
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={onChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={onBlur}
      />
      {loading && (
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant animate-spin pointer-events-none">
          progress_activity
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-2xl p-1.5 m-0 list-none">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left bg-transparent border-none cursor-pointer hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-yellow-500 mt-0.5">location_on</span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-on-surface truncate">{item.name || item.address.split(',')[0]}</span>
                  <span className="block text-xs text-on-surface-variant truncate">{item.address}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 pt-1 pb-0.5 text-[10px] text-on-surface-variant/70">© OpenStreetMap contributors</li>
        </ul>
      )}
    </div>
  );
}
