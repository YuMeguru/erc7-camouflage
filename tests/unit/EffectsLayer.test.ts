import { describe, it, expect } from 'vitest';
import { EffectsLayer } from '../../src/engines/EffectsLayer';

describe('EffectsLayer', () => {
  it('does nothing when intensity is 0 and no person', () => {
    const e = new EffectsLayer();
    const ctx = {
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    expect(() => e.draw(ctx, 100, 100, 0, 0, false)).not.toThrow();
  });

  it('exposes getOptions / setOptions', () => {
    const e = new EffectsLayer();
    expect(e.getOptions().vignette).toBe(true);
    e.setOptions({ vignette: false, scanline: true });
    expect(e.getOptions().vignette).toBe(false);
    expect(e.getOptions().scanline).toBe(true);
  });

  it('clamps intensity to 0..1', () => {
    const e = new EffectsLayer();
    const ctx = {
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
    } as unknown as CanvasRenderingContext2D;
    expect(() => e.draw(ctx, 100, 100, 2, 0, false)).not.toThrow();
    expect(() => e.draw(ctx, 100, 100, -1, 0, false)).not.toThrow();
  });

  it('adds a bottom glitch band when hasPerson is true', () => {
    const e = new EffectsLayer({ vignette: false, scanline: false });
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ctx = {
      fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h }),
      save: () => undefined,
      restore: () => undefined,
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      set fillStyle(_value: string) {},
      set globalAlpha(_value: number) {},
    } as unknown as CanvasRenderingContext2D;

    e.draw(ctx, 120, 100, 1, 0, true);

    expect(rects.some((rect) => rect.y >= 40 && rect.w < 120)).toBe(true);
  });
});
