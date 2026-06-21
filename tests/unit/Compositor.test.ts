import { describe, it, expect } from 'vitest';
import { Compositor } from '../../src/engines/Compositor';

describe('Compositor', () => {
  it('exports a class with composite() and dispose()', () => {
    const c = new Compositor();
    expect(typeof c.composite).toBe('function');
    expect(typeof c.dispose).toBe('function');
  });

  it('dispose clears internal cache', () => {
    const c = new Compositor();
    c.dispose();
    expect(() => c.dispose()).not.toThrow();
  });

  it('composite with no persons is a no-op for bboxes', () => {
    const src = document.createElement('canvas');
    src.width = 320;
    src.height = 240;
    const out = document.createElement('canvas');
    const bg = new Uint8ClampedArray(320 * 240 * 4);
    const c = new Compositor();
    expect(() =>
      c.composite({
        sourceCanvas: src,
        outputCanvas: out,
        background: bg,
        personBboxes: [],
        intensity: 0.5,
      }),
    ).not.toThrow();
  });

  it('composite with a single INVISIBLE person bbox does not crash', () => {
    const src = document.createElement('canvas');
    src.width = 320;
    src.height = 240;
    const out = document.createElement('canvas');
    const bg = new Uint8ClampedArray(320 * 240 * 4).fill(100);
    const c = new Compositor();
    expect(() =>
      c.composite({
        sourceCanvas: src,
        outputCanvas: out,
        background: bg,
        personBboxes: [{ x: 100, y: 50, w: 80, h: 150 }],
        intensity: 0.8,
      }),
    ).not.toThrow();
  });

  it('handles intensity clamp (0..1)', () => {
    const src = document.createElement('canvas');
    src.width = 100;
    src.height = 100;
    const out = document.createElement('canvas');
    const bg = new Uint8ClampedArray(100 * 100 * 4).fill(50);
    const c = new Compositor();
    // intensity > 1 也不该崩
    expect(() =>
      c.composite({
        sourceCanvas: src,
        outputCanvas: out,
        background: bg,
        personBboxes: [{ x: 0, y: 0, w: 50, h: 50 }],
        intensity: 5,
      }),
    ).not.toThrow();
  });
});
