import { describe, expect, it } from 'vitest';
import { reconcileDriverSnapshot } from '../src/modules/drivers/driverReconciliation.policy.js';

describe('driver reconnect reconciliation', () => {
  it('removes stale accepted requests and restores active assignments', () => {
    const snapshot = reconcileDriverSnapshot({
      availableBookings: [
        { _id: 'a', status: 'searching', assignedDriverId: null },
        { _id: 'b', status: 'accepted', assignedDriverId: 'driver-2' },
        { _id: 'c', status: 'searching', assignedDriverId: 'driver-3' },
      ],
      activeAssignments: [
        { _id: 'mine-1', status: 'accepted' },
        { _id: 'mine-2', status: 'picked_up' },
        { _id: 'old', status: 'completed' },
      ],
    });

    expect(snapshot.availableBookings.map((booking) => booking._id)).toEqual(['a']);
    expect(snapshot.activeAssignments.map((booking) => booking._id)).toEqual([
      'mine-1',
      'mine-2',
    ]);
  });
});

