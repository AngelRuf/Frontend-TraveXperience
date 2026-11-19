import React, { useEffect, useState } from 'react';
import { SIERRA_NORTE_MUNICIPALITIES } from '../data/sierraNorteMunicipalities.js';
import { getNearbyRisks } from '../services/riskService.js';

const SEVERITY_STYLE = {
  bajo: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  moderado: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  alto: 'border-error/30 bg-error/10 text-error',
};

function ZonasRiesgo() {
  const [municipalityId, setMunicipalityId] = useState(SIERRA_NORTE_MUNICIPALITIES[0].id);
  const [risks, setRisks] = useState([]);
  const [status, setStatus] = useState('loading');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const municipality = SIERRA_NORTE_MUNICIPALITIES.find((item) => item.id === municipalityId);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setRisks([]);
    setStatus('loading');
    getNearbyRisks({
      lat: municipality.lat,
      lng: municipality.lng,
      municipality: municipality.name,
      radius: 50000,
    })
      .then((items) => {
        if (!active) return;
        setRisks(items);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [municipality]);

  return (
    <main className="min-h-screen bg-background text-on-background px-4 sm:px-8 pt-28 pb-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-error">
              <span className="material-symbols-outlined text-base">warning</span>
              Seguridad para viajeros
            </span>
            <h1 className="mt-3 text-3xl md:text-4xl font-black text-on-surface">Zonas de riesgo y alertas</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Consulta avisos viales y naturales reportados para planear tu recorrido con precaución.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-xs font-bold text-on-surface-variant">
            Municipio
            <select
              value={municipalityId}
              onChange={(event) => setMunicipalityId(event.target.value)}
              className="min-w-56 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface"
            >
              {SIERRA_NORTE_MUNICIPALITIES.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </header>

        {!online && (
          <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-800 dark:text-amber-200" role="status">
            Sin conexión: cualquier aviso almacenado puede estar desactualizado. Confirma las condiciones con autoridades locales antes de viajar.
          </div>
        )}

        {status === 'loading' && (
          <p className="rounded-2xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant" role="status">
            Consultando alertas reportadas…
          </p>
        )}
        {status === 'error' && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-on-surface-variant" role="alert">
            <p className="font-bold text-on-surface">No se pudieron consultar zonas de riesgo.</p>
            <p className="mt-2">
              No se muestran alertas inventadas. El servicio requiere <code>GET /risks/nearby?lat=&amp;lng=&amp;radius=</code> con avisos verificados y su fecha de actualización.
            </p>
          </div>
        )}
        {status === 'ready' && risks.length === 0 && (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
            El servicio no reportó alertas para esta consulta. Esto no sustituye los avisos oficiales ni confirma que todas las rutas estén seguras.
          </div>
        )}
        {status === 'ready' && risks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {risks.map((risk) => (
              <article key={risk.id} className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 sm:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">{risk.type}</p>
                    <h2 className="mt-2 text-lg font-black text-on-surface">{risk.title}</h2>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black uppercase ${SEVERITY_STYLE[risk.severity]}`}>
                    {risk.severity}
                  </span>
                </div>
                {(risk.municipality || risk.source) && (
                  <p className="mt-3 text-xs font-semibold text-on-surface-variant">
                    {[risk.municipality, risk.source].filter(Boolean).join(' · ')}
                  </p>
                )}
                {risk.description && <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{risk.description}</p>}
                {risk.recommendation && (
                  <div className="mt-4 rounded-2xl bg-surface-container-low p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-on-surface">Recomendación</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{risk.recommendation}</p>
                  </div>
                )}
                <p className="mt-4 text-xs text-on-surface-variant">
                  Actualizado: {risk.updatedAt ? new Date(risk.updatedAt).toLocaleString('es-MX') : 'fecha no informada'}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default ZonasRiesgo;
