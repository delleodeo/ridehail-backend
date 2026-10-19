import { describe, expect, it, vi } from 'vitest';
import { BookingService } from '../src/modules/bookings/booking.service.js';
import { BOOKING_STATUS } from '../src/shared/constants.js';
import { AppError } from '../src/shared/errors/AppError.js';

class AtomicMemoryBookingRepository {
  constructor() {
    this.booking = {
      _id: 'booking-1',
      status: BOOKING_STATUS.SEARCHING,
      assignedDriverId: null,
    };
  }

  async acceptAtomically({ driverUserId }) {
    await Promise.resolve();
    if (
      this.booking.status !== BOOKING_STATUS.SEARCHING ||
      this.booking.assignedDriverId
    ) {
      throw new AppError('This booking is unavailable.', {
        statusCode: 409,
        code: 'BOOKING_UNAVAILABLE',
      });
    }
    this.booking = {
      ...this.booking,
      status: BOOKING_STATUS.ACCEPTED,
      assignedDriverId: driverUserId,
    };
    return { ...this.booking };
  }
}

describe('BookingService critical behavior', () => {
  it('persists the authoritative route geometry when creating a booking', async () => {
    const geometry = {
      type: 'LineString',
      coordinates: [[121.2, 13.1], [121.25, 13.15], [121.3, 13.2]],
    };
    const repository = {
      create: vi.fn().mockResolvedValue({ booking: { _id: 'booking-1' }, created: true }),
    };
    const service = new BookingService({
      repository,
      roadsidePickupChecker: vi.fn().mockResolvedValue(false),
      serviceAreaValidator: vi.fn().mockResolvedValue(undefined),
      routeProvider: vi.fn().mockResolvedValue({
        distanceKm: 1.8,
        durationMinutes: 6,
        geometry,
        source: 'road_network_shortest_available',
      }),
      fareEstimator: vi.fn().mockResolvedValue({ amount: 15, fareSettingsId: 'fare-1' }),
      eventPublisher: vi.fn(),
    });

    await service.create(
      {
        rideType: 'shared',
        passengerCount: 1,
        pickupLocation: { type: 'Point', coordinates: [121.2, 13.1], label: 'Pickup' },
        dropoffLocation: { type: 'Point', coordinates: [121.3, 13.2], label: 'Drop-off' },
      },
      { commuterId: 'commuter-1', idempotencyKey: 'request-1' },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        routeDistanceKm: 1.8,
        routeDurationMinutes: 6,
        routeGeometry: geometry,
      }),
    );
  });

  it('blocks a new booking while a driver is handling the commuter roadside pickup', async () => {
    const repository = { create: vi.fn() };
    const serviceAreaValidator = vi.fn();
    const service = new BookingService({
      repository,
      roadsidePickupChecker: vi.fn().mockResolvedValue(true),
      serviceAreaValidator,
    });

    await expect(
      service.create(
        {
          rideType: 'shared',
          passengerCount: 1,
          pickupLocation: { type: 'Point', coordinates: [121.2, 13.1], label: 'Pickup' },
          dropoffLocation: { type: 'Point', coordinates: [121.3, 13.2], label: 'Drop-off' },
        },
        { commuterId: 'commuter-1', idempotencyKey: 'request-1' },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACTIVE_ROADSIDE_PICKUP_EXISTS',
    });
    expect(serviceAreaValidator).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('allows exactly one winner when drivers accept simultaneously', async () => {
    const repository = new AtomicMemoryBookingRepository();
    const eventPublisher = vi.fn().mockResolvedValue(undefined);
    const service = new BookingService({ repository, eventPublisher });

    const results = await Promise.allSettled([
      service.accept('booking-1', 'driver-a'),
      service.accept('booking-1', 'driver-b'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('BOOKING_UNAVAILABLE');
    expect(['driver-a', 'driver-b']).toContain(repository.booking.assignedDriverId);
    expect(eventPublisher).toHaveBeenCalledTimes(1);
  });

  it('publishes the authoritative pickup transition after persistence', async () => {
    const calls = [];
    const repository = {
      async transitionByDriver(input) {
        calls.push('persist');
        expect(input).toEqual({
          bookingId: 'booking-1',
          driverUserId: 'assigned-driver',
          targetStatus: BOOKING_STATUS.PICKED_UP,
        });
        return { _id: 'booking-1', status: BOOKING_STATUS.PICKED_UP };
      },
    };
    const eventPublisher = vi.fn(async () => calls.push('publish'));
    const service = new BookingService({ repository, eventPublisher });

    const booking = await service.transition(
      'booking-1',
      'assigned-driver',
      BOOKING_STATUS.PICKED_UP,
    );

    expect(booking.status).toBe(BOOKING_STATUS.PICKED_UP);
    expect(calls).toEqual(['persist', 'publish']);
  });

  it('rejects pickup attempts made by a different driver', async () => {
    const repository = {
      transitionByDriver: vi.fn().mockRejectedValue(
        new AppError('Only the assigned driver may update this booking.', {
          statusCode: 403,
          code: 'BOOKING_NOT_ASSIGNED_TO_DRIVER',
        }),
      ),
    };
    const eventPublisher = vi.fn();
    const service = new BookingService({ repository, eventPublisher });

    await expect(
      service.transition('booking-1', 'different-driver', BOOKING_STATUS.PICKED_UP),
    ).rejects.toMatchObject({ code: 'BOOKING_NOT_ASSIGNED_TO_DRIVER', statusCode: 403 });
    expect(eventPublisher).not.toHaveBeenCalled();
  });
});

