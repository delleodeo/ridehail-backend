import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ServiceArea } from './serviceArea.model.js';

export function toGeoJsonPoint(point) {
  return { type: 'Point', coordinates: [...point.coordinates] };
}

export function buildActiveServiceAreaFilter(point) {
  return {
    isActive: true,
    geometry: mongoose.trusted({
      $geoIntersects: { $geometry: toGeoJsonPoint(point) },
    }),
  };
}

export async function isInsideActiveServiceArea(point) {
  const match = await ServiceArea.exists(buildActiveServiceAreaFilter(point));
  return Boolean(match);
}

export async function assertLocationsInServiceArea(pickup, dropoff) {
  const [pickupAllowed, dropoffAllowed] = await Promise.all([
    isInsideActiveServiceArea(pickup),
    isInsideActiveServiceArea(dropoff),
  ]);
  if (!pickupAllowed || !dropoffAllowed) {
    throw new AppError('Pickup and drop-off must be inside the configured service area.', {
      statusCode: 422,
      code: 'OUTSIDE_SERVICE_AREA',
      details: { pickupAllowed, dropoffAllowed },
    });
  }
}

export function selectShortestRoadRoute(routes) {
  if (!Array.isArray(routes)) return null;
  return routes.reduce((shortest, candidate) => {
    if (!Number.isFinite(candidate?.distance) || candidate.distance < 0) return shortest;
    if (!shortest || candidate.distance < shortest.distance) return candidate;
    return shortest;
  }, null);
}

export async function getRoadRoute(pickup, dropoff) {
  const from = pickup.coordinates.join(',');
  const to = dropoff.coordinates.join(',');
  const url = new URL(`${env.ROUTING_BASE_URL}/${from};${to}`);
  url.searchParams.set('alternatives', '3');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'RYDORA/0.1 local-development' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Routing provider returned ${response.status}`);
    const body = await response.json();
    const route = selectShortestRoadRoute(body.routes);
    if (!route) throw new Error('Routing provider returned no route');
    return {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry,
      source: 'road_network_shortest_available',
    };
  } catch (error) {
    logger.warn({ err: error }, 'Road routing unavailable; using minimum-fare fallback');
    return {
      distanceKm: null,
      durationMinutes: null,
      geometry: null,
      source: 'unavailable',
    };
  }
}

export async function searchLocations(query) {
  const url = new URL('/search', env.GEOCODING_BASE_URL);
  url.searchParams.set('q', `${query}, Victoria, Oriental Mindoro, Philippines`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'ph');
  const response = await fetch(url, {
    headers: { 'user-agent': 'RYDORA/0.1 local-development' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new AppError('Location search is temporarily unavailable.', {
      statusCode: 502,
      code: 'GEOCODING_UNAVAILABLE',
    });
  }
  const body = await response.json();
  return body.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    type: 'Point',
    coordinates: [Number(item.lon), Number(item.lat)],
  }));
}


