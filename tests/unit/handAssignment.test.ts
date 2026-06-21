import { describe, it, expect } from 'vitest';
import { assignHandToTrackedPerson } from '../../src/engines/handAssignment';

describe('assignHandToTrackedPerson', () => {
  it('prefers the person whose hull contains the hand over the nearest center', () => {
    const assigned = assignHandToTrackedPerson(
      { x: 173, y: 88 },
      [
        {
          id: 1,
          bbox: { x: 80, y: 40, w: 80, h: 160 },
          hull: [
            { x: 80, y: 40 },
            { x: 160, y: 40 },
            { x: 160, y: 200 },
            { x: 80, y: 200 },
          ],
        },
        {
          id: 2,
          bbox: { x: 170, y: 80, w: 18, h: 18 },
          hull: [
            { x: 170, y: 80 },
            { x: 188, y: 80 },
            { x: 188, y: 98 },
            { x: 170, y: 98 },
          ],
        },
      ],
      220,
    );

    expect(assigned).toBe(2);
  });

  it('falls back to nearest center when no hull contains the hand', () => {
    const assigned = assignHandToTrackedPerson(
      { x: 110, y: 120 },
      [
        {
          id: 1,
          bbox: { x: 80, y: 40, w: 80, h: 160 },
          hull: [],
        },
        {
          id: 2,
          bbox: { x: 250, y: 40, w: 80, h: 160 },
          hull: [],
        },
      ],
      220,
    );

    expect(assigned).toBe(1);
  });
});
