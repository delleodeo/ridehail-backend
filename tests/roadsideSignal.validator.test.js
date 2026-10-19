import { describe, expect, it } from 'vitest';
import { publishRoadsideSignalSchema } from '../src/modules/roadsideSignals/roadsideSignal.validator.js';

function request(destinationNote) {
  return {
    body: {
      location: {
        type: 'Point',
        coordinates: [121.2788, 13.1734],
        label: 'Current roadside location',
      },
      destinationNote,
    },
    params: {},
    query: {},
  };
}

describe('roadside signal validation', () => {
  it('trims a valid destination note', () => {
    const result = publishRoadsideSignalSchema.parse(request('  Public market entrance  '));
    expect(result.body.destinationNote).toBe('Public market entrance');
  });

  it('requires a meaningful destination note', () => {
    expect(publishRoadsideSignalSchema.safeParse(request(' ')).success).toBe(false);
  });

  it('rejects notes longer than 180 characters', () => {
    expect(publishRoadsideSignalSchema.safeParse(request('a'.repeat(181))).success).toBe(false);
  });
});
