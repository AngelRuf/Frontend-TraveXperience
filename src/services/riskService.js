import { api } from './apiClient';

const SEVERITIES = new Set(['bajo', 'moderado', 'alto']);

function normalizeRisk(raw) {
  if (!raw) return null;
  const coordinates = raw.location?.coordinates || raw.coordinates;
  const rawLat = coordinates?.length === 2 ? coordinates[1] : raw.lat;
  const rawLng = coordinates?.length === 2 ? coordinates[0] : raw.lng;
  const lat = rawLat == null ? null : Number(rawLat);
  const lng = rawLng == null ? null : Number(rawLng);
  const severity = String(raw.severity ?? raw.level ?? raw.riskLevel ?? '').toLowerCase();
  const status = String(raw.status ?? '').toLowerCase();

  if (!SEVERITIES.has(severity) || ['closed', 'resolved', 'inactive', 'expired'].includes(status)) return null;

  return {
    id: raw._id || raw.id || `${raw.type || 'risk'}-${lat}-${lng}`,
    title: raw.title || raw.name || 'Alerta de riesgo',
    type: raw.type || raw.category || 'Riesgo natural o vial',
    severity,
    description: raw.description || raw.details || '',
    recommendation: raw.recommendation || raw.safetyRecommendation || raw.actions || '',
    municipality: raw.municipality || raw.locationName || '',
    lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
    lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
    updatedAt: raw.updatedAt || raw.observedAt || raw.createdAt || null,
    expiresAt: raw.expiresAt || null,
    source: raw.source || raw.issuingAgency || null,
    status: status || 'active',
  };
}

export async function getNearbyRisks({ lat, lng, radius = 50000, municipality } = {}) {
  if (lat == null || lng == null) return [];
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });
  if (municipality) params.set('municipality', municipality);

  const response = await api.get(`/risks/nearby?${params.toString()}`, { auth: false });
  const list = Array.isArray(response)
    ? response
    : response?.risks || response?.results || response?.data?.risks || [];

  return list.map(normalizeRisk).filter(Boolean);
}
