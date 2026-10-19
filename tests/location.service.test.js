import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  buildActiveServiceAreaFilter,
  getRoadRoute,
  selectShortestRoadRoute,
  toGeoJsonPoint,
} from '../src/modules/locations/location.service.js';

describe('service-area geometry', () => {
  it('removes application metadata before using a location as GeoJSON geometry', () => {
    expect(
      toGeoJsonPoint({
        type: 'Point',
        coordinates: [121.24482788834821, 13.196517954852665],
        label: 'Current location',
        address: 'Poblacion, Victoria, Oriental Mindoro',
      }),
    ).toEqual({
      type: 'Point',
      coordinates: [121.24482788834821, 13.196517954852665],
    });
  });

  it('returns a coordinate copy instead of sharing mutable request data', () => {
    const input = { type: 'Point', coordinates: [121.2788, 13.1734] };
    const geometry = toGeoJsonPoint(input);
    geometry.coordinates[0] = 0;
    expect(input.coordinates[0]).toBe(121.2788);
  });

  it('preserves the server-owned geospatial selector when filters are sanitized', () => {
    const filter = buildActiveServiceAreaFilter({
      type: 'Point',
      coordinates: [121.2788, 13.1734],
    });

    mongoose.sanitizeFilter(filter);

    expect(filter.geometry).toMatchObject({
      $geoIntersects: {
        $geometry: { type: 'Point', coordinates: [121.2788, 13.1734] },
      },
    });
    expect(filter.geometry).not.toHaveProperty('$eq');
  });

  it('selects the shortest valid road alternative by distance', () => {
    const routes = [
      { distance: 4200, duration: 480, geometry: { type: 'LineString', coordinates: [] } },
      { distance: 3600, duration: 540, geometry: { type: 'LineString', coordinates: [] } },
      { distance: 3900, duration: 450, geometry: { type: 'LineString', coordinates: [] } },
    ];

    expect(selectShortestRoadRoute(routes)).toBe(routes[1]);
  });

  it('requests alternatives and returns the shortest route geometry', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(new URL(url));
      return {
        ok: true,
        async json() {
          return {
            routes: [
              {
                distance: 2500,
                duration: 300,
                geometry: { type: 'LineString', coordinates: [[121.2, 13.1], [121.3, 13.2]] },
              },
              {
                distance: 1800,
                duration: 360,
                geometry: { type: 'LineString', coordinates: [[121.2, 13.1], [121.25, 13.15], [121.3, 13.2]] },
              },
            ],
          };
        },
      };
    };

    try {
      const route = await getRoadRoute(
        { coordinates: [121.2, 13.1] },
        { coordinates: [121.3, 13.2] },
      );

      expect(requestedUrls[0].searchParams.get('alternatives')).toBe('3');
      expect(requestedUrls[0].searchParams.get('geometries')).toBe('geojson');
      expect(route).toEqual({
        distanceKm: 1.8,
        durationMinutes: 6,
        geometry: {
          type: 'LineString',
          coordinates: [[121.2, 13.1], [121.25, 13.15], [121.3, 13.2]],
        },
        source: 'road_network_shortest_available',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
