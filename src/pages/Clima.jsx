import React, { useEffect, useState } from 'react';
import { SIERRA_NORTE_MUNICIPALITIES } from '../data/sierraNorteMunicipalities.js';
import { getWeather, getWeatherForecast } from '../services/weatherService.js';

function Clima() {
  const [municipalityId, setMunicipalityId] = useState(SIERRA_NORTE_MUNICIPALITIES[0].id);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('loading');
  const [forecastStatus, setForecastStatus] = useState('loading');

  const municipality = SIERRA_NORTE_MUNICIPALITIES.find((item) => item.id === municipalityId);

  useEffect(() => {
    let active = true;
    setWeather(null);
    setForecast([]);
    setCurrentStatus('loading');
    setForecastStatus('loading');

    getWeather({ lat: municipality.lat, lng: municipality.lng, city: municipality.name })
      .then((data) => {
        if (!active) return;
        setWeather(data);
        setCurrentStatus(data ? 'ready' : 'error');
      })
      .catch(() => {
        if (active) setCurrentStatus('error');
      });

    getWeatherForecast({ lat: municipality.lat, lng: municipality.lng })
      .then((data) => {
        if (!active) return;
        setForecast(data);
        setForecastStatus(data.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (active) setForecastStatus('unavailable');
      });

    return () => {
      active = false;
    };
  }, [municipality]);

  const alerts = weather?.alerts || [];

  return (
    <main className="min-h-screen bg-background text-on-background px-4 sm:px-8 pt-28 pb-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary">
            <span className="material-symbols-outlined text-base">partly_cloudy_day</span>
            Sierra Norte de Puebla
          </span>
          <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-on-surface">Clima y pronóstico</h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Consulta las condiciones antes de salir a carretera o a un sendero.
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
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Ahora en {municipality.name}
            </h2>
            {currentStatus === 'loading' && (
              <p className="mt-6 text-sm text-on-surface-variant" role="status">Consultando condiciones actuales…</p>
            )}
            {currentStatus === 'error' && (
              <p className="mt-6 rounded-xl bg-error/10 p-4 text-sm text-error" role="alert">
                No fue posible consultar el clima actual. Revisa tu conexión e inténtalo de nuevo.
              </p>
            )}
            {currentStatus === 'ready' && weather && (
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="material-symbols-outlined text-5xl text-secondary">{weather.icon}</span>
                  <span className="text-6xl font-black text-on-surface">{weather.temperature}°</span>
                  <div>
                    <p className="capitalize font-bold text-on-surface">{weather.description || 'Condición actual'}</p>
                    {weather.feelsLike != null && (
                      <p className="text-sm text-on-surface-variant">Sensación térmica {Math.round(weather.feelsLike)}°C</p>
                    )}
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <WeatherMetric label="Probabilidad de lluvia" value={weather.rainProbability == null ? 'Sin dato' : `${weather.rainProbability}%`} icon="rainy" />
                  <WeatherMetric label="Humedad" value={weather.humidity == null ? 'Sin dato' : `${weather.humidity}%`} icon="humidity_percentage" />
                  <WeatherMetric label="Neblina" value={weather.fog ? 'Reportada' : 'Sin reporte'} icon="foggy" />
                </div>
                {weather.cached && (
                  <p className="mt-4 text-xs font-semibold text-on-surface-variant">
                    El backend indica que esta lectura proviene de caché.
                  </p>
                )}
                {weather.observedAt && (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Observado: {new Date(weather.observedAt).toLocaleString('es-MX')}
                  </p>
                )}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-6 sm:p-8 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Alertas meteorológicas</h2>
            {alerts.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {alerts.map((alert, index) => (
                  <li key={alert.id || index} className="rounded-xl border border-error/30 bg-error/5 p-4">
                    <p className="font-bold text-error">{alert.title || alert.event || 'Alerta climática'}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">{alert.description || alert.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                El servicio actual no proporcionó alertas oficiales. Esta pantalla no infiere ni inventa alertas de seguridad.
              </p>
            )}
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-on-surface">Pronóstico</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Por ubicación seleccionada</p>
            </div>
            {forecastStatus === 'ready' && (
              <span className="text-xs font-semibold text-on-surface-variant">{forecast.length} periodos</span>
            )}
          </div>
          {forecastStatus === 'loading' && (
            <p className="mt-5 text-sm text-on-surface-variant" role="status">Cargando pronóstico…</p>
          )}
          {forecastStatus === 'unavailable' && (
            <p className="mt-5 rounded-xl bg-surface-container-high p-4 text-sm text-on-surface-variant" role="status">
              El pronóstico extendido requiere que el backend publique <code>GET /weather/forecast?lat=&amp;lng=</code>.
            </p>
          )}
          {forecastStatus === 'empty' && (
            <p className="mt-5 text-sm text-on-surface-variant">No hay periodos de pronóstico disponibles.</p>
          )}
          {forecastStatus === 'ready' && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {forecast.map((item, index) => (
                <article key={`${item.date || 'forecast'}-${index}`} className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-xs font-bold text-on-surface-variant">
                    {item.date ? new Date(item.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : `Periodo ${index + 1}`}
                  </p>
                  <span className="material-symbols-outlined mt-3 text-2xl text-secondary">{item.icon}</span>
                  <p className="mt-1 capitalize text-sm font-bold text-on-surface">{item.description || 'Pronóstico'}</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {item.minTemperature ?? '—'}° / {item.maxTemperature ?? '—'}°C
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Lluvia: {item.rainProbability == null ? 'Sin dato' : `${item.rainProbability}%`}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function WeatherMetric({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <span className="material-symbols-outlined text-xl text-secondary">{icon}</span>
      <p className="mt-2 text-xs text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-black text-on-surface">{value}</p>
    </div>
  );
}

export default Clima;
