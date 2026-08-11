import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/adminLayout.jsx';
import { AdminCardSkeleton, AdminErrorBanner } from '../../components/adminAsyncState.jsx';
import { getDashboard, getStatistics, getAlerts, getActivity, classifyAdminError } from '../../services/adminService';

const RANGE_OPTIONS = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: '90d', label: 'Últimos 90 días' },
  { key: '1y', label: 'Este año' },
];

function TrendChart({ points }) {
  const width = 800;
  const height = 260;

  if (!points || points.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-sm text-on-surface-variant bg-surface-container-lowest/50 rounded-xl border border-dashed border-outline-variant/50">
        <span className="material-symbols-outlined text-3xl mb-2 opacity-50">monitoring</span>
        No hay datos suficientes para graficar este periodo.
      </div>
    );
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const norm = (val) => {
    if (max === min) return height / 2;
    return height - ((val - min) / (max - min)) * (height - 60) - 30; // Más padding superior/inferior
  };

  const chartPoints = points.map((val, i) => [i * step, norm(val)]);

  // Línea curva más suave usando bezier (simplificado)
  const linePath = chartPoints
    .map(([x, y], i) => {
      if (i === 0) return `M ${x},${y}`;
      const [prevX, prevY] = chartPoints[i - 1];
      const cp1x = prevX + (x - prevX) / 3;
      const cp2x = x - (x - prevX) / 3;
      return `C ${cp1x},${prevY} ${cp2x},${y} ${x},${y}`;
    })
    .join(' ');

  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const highlightIdx = new Set([
    Math.round(chartPoints.length * 0.3),
    Math.round(chartPoints.length * 0.7),
  ]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eab308" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path d={areaPath} fill="url(#trendGradient)" />
      <path d={linePath} fill="none" stroke="#eab308" strokeWidth="3" filter="url(#glow)" />
      {chartPoints.map(([x, y], i) => (
        highlightIdx.has(i) && (
          <g key={i}>
            <circle cx={x} cy={y} r="8" fill="#eab308" fillOpacity="0.2" />
            <circle cx={x} cy={y} r="4" fill="#1f2937" stroke="#eab308" strokeWidth="2.5" />
          </g>
        )
      ))}
    </svg>
  );
}

function fmtNumber(n) {
  const scalar = extractScalar(n);
  if (scalar === null || scalar === undefined) return '—';
  return Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(scalar);
}

function fmtCurrency(n) {
  const scalar = extractScalar(n);
  if (scalar === null || scalar === undefined) return '—';
  return `$${Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(scalar)}`;
}

function fmtPct(n) {
  if (n === null || n === undefined) return null;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
}

function fmtCount(val) {
  if (val === null || val === undefined) return '—';
  const n = typeof val === 'object' ? val.total : val;
  if (n === null || n === undefined) return '—';
  return Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

function getBookingsChangePct(summary) {
  if (summary?.bookingsChangePct != null) return summary.bookingsChangePct;
  if (typeof summary?.bookings === 'object' && summary.bookings?.growth != null) {
    return summary.bookings.growth;
  }
  return undefined;
}

function extractScalar(val, keys = ['value', 'score', 'percent', 'average', 'total']) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    for (const k of keys) {
      if (val[k] !== undefined && val[k] !== null) return val[k];
    }
    return null;
  }
  return val;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== '') return obj[k];
  }
  return undefined;
}

function alertTitle(a) { return pick(a, ['title', 'name', 'label', 'subject']) || 'Alerta del sistema'; }
function alertMessage(a) { return pick(a, ['description', 'message', 'detail', 'text', 'body']); }
function alertTime(a) { return pick(a, ['detectedAt', 'time', 'createdAt', 'timestamp', 'date']); }
function alertSeverity(a) { return pick(a, ['severity', 'level', 'priority', 'type']); }
function activityTitle(a) { return pick(a, ['title', 'description', 'action', 'summary', 'name']) || 'Actividad'; }
function activityTime(a) { return pick(a, ['timeAgo', 'time', 'createdAt', 'timestamp', 'date']); }
function activityAuthor(a) { return pick(a, ['author', 'user', 'userName', 'by']); }

function AdminDashboard({ onNavigate }) {
  const [range, setRange] = useState('30d');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);

  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [chart, setChart] = useState({ label: '', points: [], labels: [] });

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const [dashboardData, alertsData, activityData] = await Promise.all([
        getDashboard(),
        getAlerts(),
        getActivity(),
      ]);
      setSummary(dashboardData);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
    } catch (err) {
      setErrorInfo(classifyAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChart = useCallback(async (selectedRange) => {
    setChartLoading(true);
    try {
      const data = await getStatistics(selectedRange);
      setChart(data);
    } catch (err) {
      setChart({ label: '', points: [], labels: [] });
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadChart(range); }, [range, loadChart]);

  const selectRange = (key) => {
    setRange(key);
    setRangeMenuOpen(false);
  };

  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)?.label || chart.label || '';
  const criticalAlerts = alerts.filter((a) => alertSeverity(a) === 'critical' || a.critical).length;
  const bookingsChangePct = extractScalar(getBookingsChangePct(summary));

  return (
    <AdminLayout activePage="admin-dashboard" onNavigate={onNavigate}>

      {/* Header Principal */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-on-surface mb-2">Visión General</h1>
        <p className="text-sm text-on-surface-variant font-medium">
          Métricas clave y estado de la plataforma de TraveXperience.
        </p>
      </div>

      {errorInfo && (
        <div className="mb-6">
          <AdminErrorBanner {...errorInfo} onNavigate={onNavigate} onRetry={loadOverview} />
        </div>
      )}

      {/* Tarjetas de Estadísticas Vivas */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <AdminCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Usuarios */}
          <div className="bg-surface border border-solid border-outline-variant/30 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-outline-variant/60 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-solid border-blue-500/20">
                <span className="material-symbols-outlined text-blue-500 text-[22px]">group</span>
              </div>
              {fmtPct(extractScalar(summary?.activeUsersChangePct)) && (
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${extractScalar(summary.activeUsersChangePct) >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-error/10 text-error'}`}>
                  {extractScalar(summary.activeUsersChangePct) >= 0 ? <span className="material-symbols-outlined text-[14px]">trending_up</span> : <span className="material-symbols-outlined text-[14px]">trending_down</span>}
                  {fmtPct(extractScalar(summary.activeUsersChangePct))}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Usuarios Activos</p>
            <p className="text-3xl font-black text-on-surface">{fmtNumber(summary?.activeUsers)}</p>
          </div>

          {/* Ingresos */}
          <div className="bg-surface border border-solid border-outline-variant/30 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-outline-variant/60 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center border border-solid border-green-500/20">
                <span className="material-symbols-outlined text-green-500 text-[22px]">account_balance_wallet</span>
              </div>
              {fmtPct(extractScalar(summary?.totalRevenueChangePct)) && (
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${extractScalar(summary.totalRevenueChangePct) >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-error/10 text-error'}`}>
                  {extractScalar(summary.totalRevenueChangePct) >= 0 ? <span className="material-symbols-outlined text-[14px]">trending_up</span> : <span className="material-symbols-outlined text-[14px]">trending_down</span>}
                  {fmtPct(extractScalar(summary.totalRevenueChangePct))}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ingresos Totales</p>
            <p className="text-3xl font-black text-on-surface">{fmtCurrency(summary?.totalRevenue)}</p>
          </div>

          {/* Reservas */}
          <div className="bg-surface border border-solid border-outline-variant/30 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-outline-variant/60 hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center border border-solid border-purple-500/20">
                <span className="material-symbols-outlined text-purple-400 text-[22px]">calendar_month</span>
              </div>
              {fmtPct(bookingsChangePct) && (
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${bookingsChangePct >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-error/10 text-error'}`}>
                  {bookingsChangePct >= 0 ? <span className="material-symbols-outlined text-[14px]">trending_up</span> : <span className="material-symbols-outlined text-[14px]">trending_down</span>}
                  {fmtPct(bookingsChangePct)}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Reservas</p>
            <p className="text-3xl font-black text-on-surface">{fmtCount(summary?.bookings)}</p>
          </div>

          {/* Satisfacción */}
          <div className="bg-surface-container-high border border-solid border-yellow-500/30 rounded-2xl p-6 shadow-md relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-yellow-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center border border-solid border-yellow-500/30">
                  <span className="material-symbols-outlined text-yellow-500 text-[22px]">stars</span>
                </div>
                {extractScalar(summary?.satisfactionGoal) != null && (
                  <span className="text-xs font-bold text-on-surface-variant bg-surface px-2.5 py-1 rounded-md border border-solid border-outline-variant/30">
                    Meta: <span className="text-on-surface">{extractScalar(summary?.satisfactionGoal)}%</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">Satisfacción</p>
              <p className="text-3xl font-black text-on-surface">{extractScalar(summary?.satisfaction) != null ? `${extractScalar(summary?.satisfaction)}%` : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico + Destinos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
        
        <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-8 gap-4">
            <div>
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">show_chart</span>
                Tendencia de Reservas
              </h3>
              <p className="text-xs font-medium text-on-surface-variant mt-1">Comparativa de volumen de {rangeLabel.toLowerCase()}</p>
            </div>
            
            {/* Selector de Rango Moderno */}
            <div className="relative z-20">
              <button
                onClick={() => setRangeMenuOpen((prev) => !prev)}
                className="px-4 py-2.5 bg-surface-container border border-solid border-outline-variant/50 rounded-xl text-xs font-bold text-on-surface cursor-pointer flex items-center gap-2 hover:border-yellow-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
                {rangeLabel}
                <span className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${rangeMenuOpen ? 'rotate-180 text-yellow-500' : 'text-on-surface-variant'}`}>expand_more</span>
              </button>
              
              {rangeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-high border border-solid border-outline-variant/40 rounded-xl shadow-xl overflow-hidden animate-scale-in origin-top-right">
                  {RANGE_OPTIONS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => selectRange(d.key)}
                      className={`w-full text-left px-4 py-3 text-xs font-bold border-none cursor-pointer transition-colors flex items-center justify-between ${
                        d.key === range ? 'bg-yellow-500/10 text-yellow-500' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                      }`}
                    >
                      {d.label}
                      {d.key === range && <span className="material-symbols-outlined text-[16px]">check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {chartLoading ? (
            <div className="w-full h-64 rounded-2xl bg-surface-container-low animate-pulse" />
          ) : (
            <div className="relative">
              <TrendChart points={chart.points} />
              <div className="flex justify-between mt-4 px-2">
                {(chart.labels || []).map((label, i) => (
                  <span key={`${label}-${i}`} className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-yellow-500">location_on</span>
            <h3 className="text-lg font-bold text-on-surface">Destinos Top</h3>
          </div>
          
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-high animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-2/3 bg-surface-container-high rounded animate-pulse" />
                    <div className="h-2 w-full bg-surface-container-high rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (summary?.destinosPopulares || []).length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/50 mb-2">map</span>
              <p className="text-xs text-on-surface-variant">Aún no hay suficientes datos<br/>de reservas para mostrar destinos.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {summary.destinosPopulares.map((d, i) => (
                <div key={d.id || d.name || i} className="flex items-center gap-4 group">
                  {d.img ? (
                    <img src={d.img} alt={d.name} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-solid border-outline-variant/30">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">image</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-bold text-on-surface truncate group-hover:text-yellow-500 transition-colors">{d.name}</span>
                      <span className="text-xs font-black text-on-surface ml-2 shrink-0">{d.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas + Línea de Tiempo de Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Alertas */}
        <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-error">campaign</span>
              <h3 className="text-lg font-bold">Alertas del Sistema</h3>
            </div>
            {criticalAlerts > 0 && (
              <span className="bg-error text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm shadow-error/20 animate-pulse">
                {criticalAlerts} {criticalAlerts === 1 ? 'Crítica' : 'Críticas'}
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-surface-container-high animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-surface-container-lowest/50 rounded-2xl border border-dashed border-outline-variant/50">
              <span className="material-symbols-outlined text-4xl text-green-500 mb-2">task_alt</span>
              <p className="text-sm font-bold text-on-surface">Todo en orden</p>
              <p className="text-xs text-on-surface-variant">No hay alertas activas en el sistema.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {alerts.map((a, i) => {
                const isCritical = alertSeverity(a) === 'critical' || a.critical;
                const isWarning = alertSeverity(a) === 'warning';
                
                // Tonos más refinados y borde izquierdo fuerte para jerarquía visual
                const tone = isCritical
                  ? { bg: 'bg-error/5', border: 'border-error/20 border-l-error', text: 'text-error', icon: a.icon || 'error' }
                  : isWarning
                  ? { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20 border-l-yellow-500', text: 'text-yellow-500', icon: a.icon || 'warning' }
                  : { bg: 'bg-blue-500/5', border: 'border-blue-500/20 border-l-blue-500', text: 'text-blue-500', icon: a.icon || 'info' };
                
                return (
                  <div key={a.id || i} className={`border border-solid border-l-4 rounded-xl p-4 transition-all hover:bg-surface-container-lowest ${tone.bg} ${tone.border}`}>
                    <div className={`flex items-center gap-2 mb-1.5 ${tone.text}`}>
                      <span className="material-symbols-outlined text-[20px]">{tone.icon}</span>
                      <h4 className="text-sm font-bold text-on-surface">{alertTitle(a)}</h4>
                    </div>
                    {alertMessage(a) && (
                      <p className="text-xs text-on-surface-variant leading-relaxed mb-2.5 ml-7">{alertMessage(a)}</p>
                    )}
                    {alertTime(a) && (
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider ml-7 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        {alertTime(a)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actividad Reciente (Estilo Timeline) */}
        <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-2 text-on-surface mb-6">
            <span className="material-symbols-outlined text-yellow-500">history</span>
            <h3 className="text-lg font-bold">Bitácora de Actividad</h3>
          </div>
          
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-3/4 bg-surface-container-high rounded animate-pulse" />
                    <div className="h-2 w-1/3 bg-surface-container-high rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-surface-container-lowest/50 rounded-2xl border border-dashed border-outline-variant/50">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-2">hourglass_empty</span>
              <p className="text-sm font-bold text-on-surface">Sin movimientos recientes</p>
              <p className="text-xs text-on-surface-variant">La actividad del equipo aparecerá aquí.</p>
            </div>
          ) : (
            <div className="relative pl-4 flex-1">
              {/* Línea vertical del timeline conectando los puntos */}
              <div className="absolute top-4 bottom-4 left-8 w-[2px] bg-surface-container-high" />
              
              <div className="space-y-6">
                {activity.map((item, i) => (
                  <div key={item.id || i} className="relative flex items-start gap-4 group">
                    <div className="relative z-10 w-9 h-9 rounded-full bg-surface-container border-2 border-solid border-surface text-on-surface-variant flex items-center justify-center shrink-0 group-hover:bg-yellow-500 group-hover:text-black transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">{item.icon || 'edit_note'}</span>
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-bold text-on-surface leading-tight mb-1 group-hover:text-yellow-500 transition-colors">
                        {activityTitle(item)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-on-surface-variant">
                        {activityAuthor(item) && (
                          <span className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-md text-on-surface">
                            <span className="material-symbols-outlined text-[12px]">person</span>
                            {activityAuthor(item)}
                          </span>
                        )}
                        {activityTime(item) && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {activityTime(item)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminDashboard;