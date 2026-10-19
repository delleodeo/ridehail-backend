import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from './database.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { Driver } from '../modules/drivers/driver.model.js';
import { Vehicle } from '../modules/drivers/vehicle.model.js';
import { FareSettings } from '../modules/fares/fareSettings.model.js';
import { ServiceArea } from '../modules/locations/serviceArea.model.js';
import { User } from '../modules/users/user.model.js';
import {
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
  RIDE_TYPE,
  ROLES,
} from '../shared/constants.js';

if (env.NODE_ENV === 'production') {
  throw new Error('Development seed data cannot be loaded in production.');
}

const seedPassword = process.env.SEED_PASSWORD ?? 'RydoraDemo!2026';

async function upsertUser({ email, firstName, lastName, role, phone }) {
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  return User.findOneAndUpdate(
    { email },
    {
      $set: { firstName, lastName, role, phone, accountStatus: 'active', passwordHash },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
}

async function seed() {
  await connectDatabase();
  const admin = await upsertUser({
    email: 'admin@rydora.local',
    firstName: 'Rydora',
    lastName: 'Administrator',
    role: ROLES.ADMIN,
    phone: '+639170000001',
  });
  const commuter = await upsertUser({
    email: 'commuter@rydora.local',
    firstName: 'Maria',
    lastName: 'Santos',
    role: ROLES.COMMUTER,
    phone: '+639170000002',
  });
  const driverUser = await upsertUser({
    email: 'driver@rydora.local',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    role: ROLES.DRIVER,
    phone: '+639170000003',
  });

  const driver = await Driver.findOneAndUpdate(
    { userId: driverUser._id },
    {
      $set: {
        approvalStatus: DRIVER_APPROVAL.APPROVED,
        availabilityStatus: DRIVER_AVAILABILITY.OFFLINE,
        currentLocation: { type: 'Point', coordinates: [121.2788, 13.1734] },
        lastLocationUpdate: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const vehicle = await Vehicle.findOneAndUpdate(
    { driverId: driver._id },
    {
      $set: {
        plateNumber: 'RYD-1001',
        bodyNumber: 'VIC-001',
        maximumPassengerCapacity: 3,
        vehicleStatus: 'active',
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  driver.vehicleId = vehicle._id;
  await driver.save();

  const fares = [
    {
      rideType: RIDE_TYPE.SHARED,
      minimumFare: 15,
      baseFare: 18,
      baseDistanceKm: 2,
      perKilometerRate: 4,
      sharedPassengerDiscountRate: 0.2,
    },
    {
      rideType: RIDE_TYPE.NON_SHARED,
      minimumFare: 60,
      baseFare: 60,
      baseDistanceKm: 2,
      perKilometerRate: 12,
      sharedPassengerDiscountRate: 0,
    },
  ];
  for (const fare of fares) {
    await FareSettings.findOneAndUpdate(
      { rideType: fare.rideType, isActive: true },
      { $set: { ...fare, effectiveFrom: new Date('2026-01-01'), updatedBy: admin._id } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }

  await ServiceArea.findOneAndUpdate(
    { name: 'Victoria Development Service Area' },
    {
      $set: {
        isActive: true,
        updatedBy: admin._id,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [121.2, 13.09],
              [121.36, 13.09],
              [121.36, 13.25],
              [121.2, 13.25],
              [121.2, 13.09],
            ],
          ],
        },
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );

  logger.info(
    {
      accounts: [admin.email, commuter.email, driverUser.email],
      seedPassword,
    },
    'Development seed completed',
  );
}

seed()
  .catch((error) => {
    logger.error({ err: error }, 'Development seed failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());

