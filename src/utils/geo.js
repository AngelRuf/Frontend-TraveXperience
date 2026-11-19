export function haversineDistance(lat1, lng1, lat2, lng2) {
  const coordinates = [lat1, lng1, lat2, lng2].map(Number);
  if (!coordinates.every(Number.isFinite)) return null;

  const [latitude1, longitude1, latitude2, longitude2] = coordinates;
  const radiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const arc =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * radiusMeters * Math.asin(Math.sqrt(arc));
}

export function formatDistance(meters) {
  const value = Number(meters);
  if (meters === undefined || meters === null || !Number.isFinite(value)) return '';
  return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}
