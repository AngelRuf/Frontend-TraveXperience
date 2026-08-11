import React, { useEffect, useState } from 'react';
import { getWeather } from '../services/weatherService';

/**
 * WeatherWidget – ícono + temperatura + descripción, en formato compacto.
 *
 * Se degrada con gracia: mientras carga muestra un pequeño skeleton, y si
 * el clima no está disponible (sin coordenadas, error de red, backend caído,
 * etc.) simplemente no renderiza nada, para no romper el layout del resto
 * de la página.
 *
 * Props:
 *   - lat, lng: coordenadas del lugar. Si faltan, el widget no se muestra.
 *   - size: 'md' (por defecto) | 'sm' — variante más pequeña para tarjetas.
 *   - className: clases extra para posicionar el widget en su contenedor.
 */
function WeatherWidget({ lat, lng, size = 'md', className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const hasCoords = lat !== undefined && lat !== null && lng !== undefined && lng !== null;
    if (!hasCoords) {
      setStatus('error');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    getWeather({ lat, lng })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus('error');
          return;
        }
        setWeather(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  // Degradación con gracia: sin datos de clima, no mostramos nada.
  if (status === 'error') return null;

  const isSmall = size === 'sm';

  if (status === 'idle' || status === 'loading') {
    return (
      <div
        className={`animate-pulse bg-surface-container rounded-full ${
          isSmall ? 'h-6 w-16' : 'h-8 w-28'
        } ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-low border border-outline-variant/40 ${
        isSmall ? 'px-2.5 py-1' : 'px-3.5 py-1.5'
      } ${className}`}
      title={weather.city ? `Clima en ${weather.city}` : 'Clima actual'}
    >
      <span className={`material-symbols-outlined text-secondary ${isSmall ? 'text-[14px]' : 'text-[18px]'}`}>
        {weather.icon}
      </span>
      <span className={`font-bold text-primary whitespace-nowrap ${isSmall ? 'text-xs' : 'text-sm'}`}>
        {weather.temperature}°C
      </span>
      {weather.description && (
        <span
          className={`text-on-surface-variant capitalize whitespace-nowrap font-medium ${
            isSmall ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {weather.description}
        </span>
      )}
    </div>
  );
}

export default WeatherWidget;
