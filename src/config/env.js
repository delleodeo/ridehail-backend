import 'dotenv/config';
import { z } from 'zod';

const developmentSecrets = {
  access: 'development-access-secret-change-me-32-chars',
  refresh: 'development-refresh-secret-change-me-32-chars',
  csrf: 'development-csrf-secret-change-me-32-characters',
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27018/rydora?replicaSet=rs0'),
  JWT_ACCESS_SECRET: z.string().min(32).default(developmentSecrets.access),
  JWT_REFRESH_SECRET: z.string().min(32).default(developmentSecrets.refresh),
  CSRF_SECRET: z.string().min(32).default(developmentSecrets.csrf),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
  REFRESH_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default('7d'),
  ROUTING_BASE_URL: z.url().default('https://router.project-osrm.org/route/v1/driving'),
  GEOCODING_BASE_URL: z.url().default('https://nominatim.openstreetmap.org'),
  SHARED_ROUTE_COMPATIBILITY_KM: z.coerce.number().positive().default(5),
  ROADSIDE_SIGNAL_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  ROADSIDE_PICKUP_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
  ROADSIDE_SIGNAL_RADIUS_KM: z.coerce.number().min(1).max(20).default(8),
  SERVICE_NAME: z.string().default('rydora-api'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(parsed.error)}`);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  Object.values(developmentSecrets).some((secret) =>
    [parsed.data.JWT_ACCESS_SECRET, parsed.data.JWT_REFRESH_SECRET, parsed.data.CSRF_SECRET].includes(
      secret,
    ),
  )
) {
  throw new Error('Production security secrets must be explicitly configured.');
}

export const env = Object.freeze(parsed.data);

