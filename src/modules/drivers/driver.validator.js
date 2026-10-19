import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid booking ID.');

export const availabilitySchema = z.object({
  body: z.object({ status: z.enum(['available', 'offline']) }),
  params: z.object({}),
  query: z.object({}),
});

export const nearbyDriversSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    longitude: z.coerce.number().min(-180).max(180),
    latitude: z.coerce.number().min(-90).max(90),
    limit: z.coerce.number().int().min(1).max(20).default(10),
    radiusKm: z.coerce.number().min(0.5).max(20).default(8),
  }),
});

export const locationUpdateSchema = z.object({
  body: z.object({
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const driverBookingSchema = z.object({
  body: z.object({}),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const vehicleSchema = z.object({
  body: z.object({
    plateNumber: z.string().trim().min(3).max(20),
    bodyNumber: z.string().trim().min(1).max(30),
    maximumPassengerCapacity: z.number().int().min(1).max(8),
  }),
  params: z.object({}),
  query: z.object({}),
});

