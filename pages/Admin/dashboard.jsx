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
      <div className="w-full h-64 flex items-center justify-center text-sm text-on-surface-variant">
        No hay datos suficientes para graficar este periodo.
      </div>
    );
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const norm = (val) => {
    if (max === min) return height / 2;
    return height - ((val - min) / (max - min)) * (height - 40) - 20;
  };

  const chartPoints = points.map((val, i) => [i * step, norm(val)]);

  const linePath = chartPoints
    .map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`))
    .join(' ');

  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const highlightIdx = new Set([
    Math.round(chartPoints.length * 0.3),
    Math.round(chartPoints.length * 0.7),
  ]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-secondary-container)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-secondary-container)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trendGradient)" />
      <path d={linePath} fill="none" stroke="var(--color-secondary)" strokeWidth="2.5" />
      {chartPoints.map(([x, y], i) => (
        highlightIdx.has(i) && (
          <circle key={i} cx={x} cy={y} r="4" fill="var(--color-secondary)" />
        )
      ))}
    </svg>
  );
}

function fmtNumber(n) {
  if (n === null || n === undefined) return '—';
  return Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

function fmtCurrency(n) {
  if (n === null || n === undefined) return '—';
  return `$${Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(n)}`;
}

function fmtPct(n) {
  if (n === null || n === undefined) return null;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
}

// Acepta tanto un número simple como un objeto { total, newThisMonth, growth }
// y siempre devuelve un string seguro para renderizar en JSX.
function fmtCount(val) {
  if (val === null || val === undefined) return '—';
  const n = typeof val === 'object' ? val.total : val;
  if (n === null || n === undefined) return '—';
  return Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
}

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
  const criticalAlerts = alerts.filter((a) => (a.severity || a.level) === 'critical' || a.critical).length;

  // Soporta que bookingsChangePct venga directo en summary o anidado dentro de bookings.growth
  const bookingsChangePct = summary?.bookingsChangePct ?? (
    typeof summary?.bookings === 'object' ? summary.bookings.growth : undefined
  );

  return (
    <AdminLayout activePage="admin-dashboard" onNavigate={onNavigate}>

      {errorInfo && (
        <div className="mb-6">
          <AdminErrorBanner {...errorInfo} onNavigate={onNavigate} onRetry={loadOverview} />
        </div>
      )}

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <AdminCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface text-[20px]">group</span>
              </div>
              {fmtPct(summary?.activeUsersChangePct) && (
                <span className={`text-sm font-bold flex items-center gap-0.5 ${summary.activeUsersChangePct >= 0 ? 'text-green-600' : 'text-error'}`}>
                  {fmtPct(summary.activeUsersChangePct)}
                  <span className="material-symbols-outlined text-[16px]">{summary.activeUsersChangePct >= 0 ? 'trending_up' : 'trending_down'}</span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Usuarios Activos</p>
            <p className="text-3xl font-bold text-on-surface">{fmtNumber(summary?.activeUsers)}</p>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface text-[20px]">account_balance_wallet</span>
              </div>
              {fmtPct(summary?.totalRevenueChangePct) && (
                <span className={`text-sm font-bold flex items-center gap-0.5 ${summary.totalRevenueChangePct >= 0 ? 'text-green-600' : 'text-error'}`}>
                  {fmtPct(summary.totalRevenueChangePct)}
                  <span className="material-symbols-outlined text-[16px]">{summary.totalRevenueChangePct >= 0 ? 'trending_up' : 'trending_down'}</span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ingresos Totales</p>
            <p className="text-3xl font-bold text-on-surface">{fmtCurrency(summary?.totalRevenue)}</p>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface text-[20px]">calendar_month</span>
              </div>
              {fmtPct(bookingsChangePct) && (
                <span className={`text-sm font-bold flex items-center gap-0.5 ${bookingsChangePct >= 0 ? 'text-green-600' : 'text-error'}`}>
                  {fmtPct(bookingsChangePct)}
                  <span className="material-symbols-outlined text-[16px]">{bookingsChangePct >= 0 ? 'trending_up' : 'trending_down'}</span>
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Reservas</p>
            <p className="text-3xl font-bold text-on-surface">{fmtCount(summary?.bookings)}</p>
          </div>

          <div className="bg-primary rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 rounded-lg bg-on-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary-container text-[20px]">stars</span>
              </div>
              {summary?.satisfactionGoal != null && (
                <span className="text-xs font-semibold text-on-primary/70">Meta: {summary.satisfactionGoal}%</span>
              )}
            </div>
            <p className="text-xs font-bold text-on-primary/70 uppercase tracking-wider mb-1">Satisfacción</p>
            <p className="text-3xl font-bold text-secondary-container">{summary?.satisfaction != null ? `${summary.satisfaction}%` : '—'}</p>
          </div>
        </div>
      )}

      {/* Chart + Destinos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 mb-6">
        <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-on-surface mb-1">Tendencia de Reservas</h3>
              <p className="text-xs text-on-surface-variant">Métricas de rendimiento de {rangeLabel.toLowerCase()}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setRangeMenuOpen((prev) => !prev)}
                className="px-4 py-2 bg-surface-container-low rounded-lg text-xs font-bold text-on-surface border-none cursor-pointer flex items-center gap-1.5"
              >
                {rangeLabel}
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
              {rangeMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-surface border border-solid border-outline-variant/40 rounded-xl shadow-lg overflow-hidden z-10">
                  {RANGE_OPTIONS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => selectRange(d.key)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold border-none cursor-pointer transition-colors ${
                        d.key === range ? 'bg-primary/10 text-primary' : 'bg-transparent text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {chartLoading ? (
            <div className="w-full h-64 rounded-xl bg-surface-container-low animate-pulse" />
          ) : (
            <>
              <TrendChart points={chart.points} />
              <div className="flex justify-between mt-2 px-1">
                {(chart.labels || []).map((label, i) => (
                  <span key={`${label}-${i}`} className="text-[11px] text-on-surface-variant font-medium">{label}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-on-surface mb-5">Destinos Populares</h3>
          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 rounded-lg bg-surface-container-high animate-pulse" />
              ))}
            </div>
          ) : (summary?.destinosPopulares || []).length === 0 ? (
            <p className="text-xs text-on-surface-variant">Aún no hay datos de destinos populares.</p>
          ) : (
            <div className="space-y-5">
              {summary.destinosPopulares.map((d, i) => (
                <div key={d.id || d.name || i} className="flex items-center gap-3">
                  {d.img && <img src={d.img} alt={d.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-bold text-on-surface truncate">{d.name}</span>
                      <span className="text-sm font-bold text-on-surface ml-2 shrink-0">{d.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-secondary-container rounded-full" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-error">warning</span>
              <h3 className="text-lg font-bold">Alertas del Sistema</h3>
            </div>
            {criticalAlerts > 0 && (
              <span className="bg-error/10 text-error text-xs font-bold px-3 py-1 rounded-full">{criticalAlerts} críticos</span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-surface-container-high animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No hay alertas activas.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a, i) => {
                const isCritical = (a.severity || a.level) === 'critical' || a.critical;
                return (
                  <div
                    key={a.id || i}
                    className={`border border-solid rounded-xl p-4 ${isCritical ? 'bg-error/5 border-error/20' : 'bg-secondary-fixed/10 border-secondary/20'}`}
                  >
                    <div className={`flex items-center gap-2 mb-1.5 ${isCritical ? 'text-error' : 'text-secondary'}`}>
                      <span className="material-symbols-outlined text-[18px]">{a.icon || (isCritical ? 'dns' : 'database')}</span>
                      <h4 className={`text-sm font-bold ${isCritical ? '' : 'text-on-surface'}`}>{a.title}</h4>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed mb-2">{a.description || a.message}</p>
                    <p className="text-[11px] text-on-surface-variant/60 font-medium">{a.detectedAt || a.time}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-on-surface mb-5">Actividad Reciente</h3>
          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-surface-container-high animate-pulse" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No hay actividad reciente.</p>
          ) : (
            <div className="space-y-5">
              {activity.map((item, i) => (
                <div key={item.id || i} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{item.icon || 'edit_note'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface leading-snug">{item.title || item.description}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{[item.timeAgo || item.time, item.author].filter(Boolean).join(' • ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminDashboard;
