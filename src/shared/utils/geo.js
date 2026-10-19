const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(from, to) {
  const [fromLng, fromLat] = from.coordinates;
  const [toLng, toLat] = to.coordinates;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasMovedSignificantly(from, to, thresholdMeters = 20) {
  if (!from?.coordinates || !to?.coordinates) return true;
  return haversineDistanceKm(from, to) * 1000 >= thresholdMeters;
}

