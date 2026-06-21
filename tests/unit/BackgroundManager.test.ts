import { describe, it, expect } from 'vitest';
import { BackgroundManager, BLEND_ALPHA } from '../../src/engines/BackgroundManager';

function makePixels(w: number, h: number, fill: number): Uint8ClampedArray {
  const p = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < p.length; i += 4) {
    p[i] = fill;
    p[i + 1] = fill;
    p[i + 2] = fill;
    p[i + 3] = 255;
  }
  return p;
}

describe('BackgroundManager', () => {
  it('initializes with first frame', () => {
    const m = new BackgroundManager(10, 10);
    const p = makePixels(10, 10, 128);
    m.addFrame(p, []);
    expect(m.isReady()).toBe(true);
    expect(m.getBackground()[0]).toBe(128);
    expect(m.getBackground()[1]).toBe(128);
    expect(m.getBackground()[3]).toBe(255);
  });

  it('blends new frames over time toward new value', () => {
    const m = new BackgroundManager(10, 10);
    const f1 = makePixels(10, 10, 0);
    const f2 = makePixels(10, 10, 200);
    m.addFrame(f1, []);
    // 20 帧 f2 之后，背景应趋近 200（但仍是加权和，不会完全等于）
    for (let i = 0; i < 20; i++) m.addFrame(f2, []);
    expect(m.getBackground()[0]).toBeGreaterThan(150);
    expect(m.getBackground()[0]).toBeLessThanOrEqual(200);
  });

  it('fills in previously-occupied region from current frame (v4: no ghosting)', () => {
    // v4 注意：buildPersonMask 会外扩 MASK_DILATE=6px，所以测试用的人移位距离要 > 12px
    // 避免上一帧的 dilate 区域和当前帧的 dilate 区域重叠
    const m = new BackgroundManager(30, 30);
    const f1 = makePixels(30, 30, 0);
    // 人占左上角 (2,2)~(8,8)，dilate 后约 (0,0)~(14,14)
    m.addFrame(f1, [{ x: 2, y: 2, w: 6, h: 6 }]);
    // 第一帧后 pixel(2,2) 是人区域，buffer 未初始化（默认 0）
    // pixel(29,29) 非人区域 = 0 (f1=0)
    const idx22 = (2 * 30 + 2) * 4;
    const idx2929 = (29 * 30 + 29) * 4;
    expect(m.getBackground()[idx2929]).toBe(0);

    // 第二帧：人移位到右下角 (20,20)~(26,26)，dilate 后约 (14,14)~(30,30)
    // (2,2) 不在人区域（含 dilate），不再是人了
    const f2 = makePixels(30, 30, 200);
    m.addFrame(f2, [{ x: 20, y: 20, w: 6, h: 6 }]);
    // v4 算法：(2,2) 人刚离开 → 直接取当前帧 f2=200（假设人走了，当前帧就是真实背景）
    // 关键验证：不应该残留旧的"人像素"或"旧背景"，应该反映当前帧
    const px22After = m.getBackground()[idx22];
    expect(px22After).toBe(200); // v4：人离开后直接取当前帧，消除旧背景穿帮
    // (0,15) 第一帧非人（dilate 到 y=14），第二帧也非人（dilate 从 y=14 起，y=15 刚好在外）
    // 验证非人区域的动态混合：f1=0 → f2=200，帧差大用 FAST_BLEND，值应 > 100
    const idx015 = (15 * 30 + 0) * 4;
    const px015After = m.getBackground()[idx015];
    expect(px015After).toBeGreaterThanOrEqual(100);
  });

  it('rejects mismatched pixel size', () => {
    const m = new BackgroundManager(10, 10);
    const p = new Uint8ClampedArray(100); // 错误大小
    expect(() => m.addFrame(p, [])).toThrow();
  });

  it('reset clears initialization', () => {
    const m = new BackgroundManager(10, 10);
    m.addFrame(makePixels(10, 10, 100), []);
    expect(m.isReady()).toBe(true);
    m.reset();
    expect(m.isReady()).toBe(false);
    expect(m.getBackground()[0]).toBe(0);
  });

  it('exposes BLEND_ALPHA constant for runtime tuning', () => {
    expect(typeof BLEND_ALPHA).toBe('number');
    expect(BLEND_ALPHA).toBeGreaterThan(0);
    expect(BLEND_ALPHA).toBeLessThan(1);
  });
});