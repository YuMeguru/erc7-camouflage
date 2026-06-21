import { describe, it, expect, beforeEach } from 'vitest';
import { PersonTracker } from '../../src/engines/PersonTracker';

describe('PersonTracker', () => {
  let t: PersonTracker;
  beforeEach(() => {
    t = new PersonTracker();
  });

  it('associates a center point to nearest tracked person within distance', () => {
    t.update(
      [
        { x: 100, y: 200, w: 20, h: 20 },
        { x: 400, y: 100, w: 30, h: 30 },
      ],
      1,
    );
    const persons = t.snapshot();
    expect(t.assign({ x: 110, y: 210 }, persons, 150)).toBe(1);
    expect(t.assign({ x: 410, y: 110 }, persons, 150)).toBe(2);
  });

  it('returns null when center is too far from any person', () => {
    t.update([{ x: 100, y: 100, w: 20, h: 20 }], 1);
    const persons = t.snapshot();
    expect(t.assign({ x: 0, y: 0 }, persons, 50)).toBeNull();
  });

  it('preserves IDs across frames when bboxes slightly shift', () => {
    const f1 = t.update(
      [
        { x: 0, y: 0, w: 50, h: 100 },
        { x: 200, y: 0, w: 50, h: 100 },
      ],
      1,
    );
    const f2 = t.update(
      [
        { x: 5, y: 0, w: 50, h: 100 },
        { x: 205, y: 0, w: 50, h: 100 },
      ],
      2,
    );
    expect(f2[0].id).toBe(f1[0].id);
    expect(f2[1].id).toBe(f1[1].id);
  });

  it('assigns new ID when a third person enters', () => {
    const f1 = t.update(
      [
        { x: 0, y: 0, w: 50, h: 100 },
        { x: 200, y: 0, w: 50, h: 100 },
      ],
      1,
    );
    const f2 = t.update(
      [
        { x: 0, y: 0, w: 50, h: 100 },
        { x: 200, y: 0, w: 50, h: 100 },
        { x: 400, y: 0, w: 50, h: 100 },
      ],
      2,
    );
    expect(f2.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(f2[2].id).not.toBe(f1[0].id);
  });

  it('drops expired persons after TTL', () => {
    t.update([{ x: 0, y: 0, w: 50, h: 100 }], 1);
    // 200 帧后，TTL=120 (frame - lastSeen = 199 > 120)，原 ID=1 已过期
    const f2 = t.update([{ x: 0, y: 0, w: 50, h: 100 }], 200);
    expect(f2[0].id).toBe(2); // 新 ID
    // 中间消失一段时间（虽然这次没消失）
    const f3 = t.update([], 300);
    expect(f3).toEqual([]);
    const f4 = t.update([{ x: 0, y: 0, w: 50, h: 100 }], 400);
    expect(f4[0].id).toBe(3); // 再次新 ID
  });

  it('reset clears all tracked persons and IDs', () => {
    t.update([{ x: 0, y: 0, w: 50, h: 100 }], 1);
    t.reset();
    expect(t.snapshot()).toEqual([]);
    const f = t.update([{ x: 0, y: 0, w: 50, h: 100 }], 2);
    expect(f[0].id).toBe(1);
  });
});
