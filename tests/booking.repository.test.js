import { describe, expect, it, vi } from 'vitest';
import { createAcceptanceNotifications } from '../src/modules/bookings/booking.repository.js';

describe('booking repository acceptance notifications', () => {
  it('uses an ordered insert when creating multiple documents in a transaction', async () => {
    const session = { id: 'transaction-session' };
    const create = vi.fn().mockResolvedValue([]);

    await createAcceptanceNotifications({
      booking: { _id: 'booking-1', commuterId: 'commuter-1' },
      driver: { userId: 'driver-user-1' },
      session,
      notificationModel: { create },
    });

    expect(create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: 'commuter-1',
          type: 'booking_accepted',
          data: { bookingId: 'booking-1' },
        }),
        expect.objectContaining({
          userId: 'driver-user-1',
          type: 'booking_assigned',
          data: { bookingId: 'booking-1' },
        }),
      ],
      { session, ordered: true },
    );
  });
});
