import { describe, it, expect } from 'vitest';
import { analyzeHandState, PALM_Z_DIFF, FIST_Z_DIFF } from '../../src/engines/HandStateAnalyzer';
import { HAND } from '../../src/types/mp';

/** 构造一组手 landmarks，tip 和 pip 分别给定 z 值 */
function makeHand(tipZ: number, pipZ: number) {
  const l: { x: number; y: number; z: number }[] = new Array(21).fill(null).map(() => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  [HAND.INDEX_TIP, HAND.MIDDLE_TIP, HAND.RING_TIP, HAND.PINKY_TIP].forEach((i) => {
    l[i] = { x: 0, y: 0, z: tipZ };
  });
  [HAND.INDEX_PIP, HAND.MIDDLE_PIP, HAND.RING_PIP, HAND.PINKY_PIP].forEach((i) => {
    l[i] = { x: 0, y: 0, z: pipZ };
  });
  // 给其它点任意有限 z，避免判错
  l[HAND.WRIST] = { x: 0, y: 0, z: 0 };
  return l;
}

function makeTinyOpenPalm() {
  const l: { x: number; y: number; z: number }[] = new Array(21).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  l[HAND.WRIST] = { x: 0.5, y: 0.5, z: 0 };
  l[HAND.MIDDLE_MCP] = { x: 0.505, y: 0.49, z: 0 };
  l[HAND.INDEX_MCP] = { x: 0.502, y: 0.492, z: 0 };
  l[HAND.RING_MCP] = { x: 0.508, y: 0.492, z: 0 };
  l[HAND.PINKY_MCP] = { x: 0.511, y: 0.494, z: 0 };
  l[HAND.INDEX_PIP] = { x: 0.503, y: 0.478, z: -0.01 };
  l[HAND.MIDDLE_PIP] = { x: 0.506, y: 0.475, z: -0.01 };
  l[HAND.RING_PIP] = { x: 0.509, y: 0.478, z: -0.01 };
  l[HAND.PINKY_PIP] = { x: 0.512, y: 0.482, z: -0.01 };
  l[HAND.INDEX_TIP] = { x: 0.503, y: 0.455, z: -0.038 };
  l[HAND.MIDDLE_TIP] = { x: 0.506, y: 0.45, z: -0.038 };
  l[HAND.RING_TIP] = { x: 0.509, y: 0.455, z: -0.038 };
  l[HAND.PINKY_TIP] = { x: 0.512, y: 0.46, z: -0.038 };
  return l;
}

describe('analyzeHandState', () => {
  it('returns NONE for empty landmarks', () => {
    expect(analyzeHandState([])).toBe('NONE');
  });

  it('returns NONE for too-short landmarks', () => {
    expect(analyzeHandState(new Array(10).fill({ x: 0, y: 0, z: 0 }))).toBe('NONE');
  });

  it('detects FIST when fingers curled (tip ~ pip)', () => {
    // tip.z 略小于 pip.z 但 |diff| < FIST_Z_DIFF
    expect(analyzeHandState(makeHand(-0.04, -0.05))).toBe('FIST');
  });

  it('detects OPEN_PALM when fingers extended (tip much farther)', () => {
    // diff = -0.15 - (-0.05) = -0.10 < -PALM_Z_DIFF(0.05)
    expect(analyzeHandState(makeHand(-0.15, -0.05))).toBe('OPEN_PALM');
  });

  it('returns NONE for partial pose (3 of 4 fingers extended)', () => {
    const l = makeHand(-0.15, -0.05);
    // 强行让 pinky 的 tip 接近 pip：把 diff 改为 0
    l[HAND.PINKY_TIP] = { x: 0, y: 0, z: l[HAND.PINKY_PIP].z };
    expect(analyzeHandState(l)).toBe('NONE');
  });

  it('keeps detecting OPEN_PALM for tiny far-away hands with compressed depth', () => {
    expect(analyzeHandState(makeTinyOpenPalm())).toBe('OPEN_PALM');
  });

  it('exposes threshold constants for runtime tuning', () => {
    expect(typeof PALM_Z_DIFF).toBe('number');
    expect(typeof FIST_Z_DIFF).toBe('number');
    expect(PALM_Z_DIFF).toBeGreaterThan(0);
    expect(FIST_Z_DIFF).toBeGreaterThan(0);
  });
});
