import { describe, it, expect } from 'vitest';
import { euclidean, bboxIoU, pointInBbox, expandBbox } from '../../src/utils/geometry';

describe('geometry', () => {
  it('euclidean distance (3,4,5 triangle)', () => {
    expect(euclidean({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('euclidean same point = 0', () => {
    expect(euclidean({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('bboxIoU disjoint = 0', () => {
    expect(bboxIoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(0);
  });

  it('bboxIoU identical = 1', () => {
    const b = { x: 0, y: 0, w: 10, h: 10 };
    expect(bboxIoU(b, b)).toBe(1);
  });

  it('bboxIoU half overlap (10x10 vs 10x10 shifted by 5)', () => {
    // 10x10 重叠 5x10 = 50，union = 100+100-50 = 150 → 1/3
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 0, w: 10, h: 10 };
    expect(bboxIoU(a, b)).toBeCloseTo(50 / 150, 5);
  });

  it('pointInBbox inclusive boundary', () => {
    const b = { x: 0, y: 0, w: 10, h: 10 };
    expect(pointInBbox({ x: 5, y: 5 }, b)).toBe(true);
    expect(pointInBbox({ x: 0, y: 0 }, b)).toBe(true);
    expect(pointInBbox({ x: 10, y: 10 }, b)).toBe(true);
    expect(pointInBbox({ x: 15, y: 5 }, b)).toBe(false);
  });

  it('expandBbox symmetrically', () => {
    expect(expandBbox({ x: 10, y: 10, w: 20, h: 20 }, 5)).toEqual({
      x: 5,
      y: 5,
      w: 30,
      h: 30,
    });
  });
});
