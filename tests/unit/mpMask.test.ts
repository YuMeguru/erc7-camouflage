import { describe, it, expect } from 'vitest';
import { expandHull, landmarkBodyHull } from '../../src/types/mpMask';
import { type Landmark, POSE } from '../../src/types/mp';

function makePose(points: Partial<Record<number, Landmark>>): Landmark[] {
  return new Array(33).fill(null).map((_, index) => points[index] ?? { x: 0.5, y: 0.5, z: 0, visibility: 0.1 });
}

describe('expandHull', () => {
  it('应该向外扩展凸包（顶部点 y 应减小，底部点 y 应增大）', () => {
    // 顺时针正方形（与 Andrew monotone chain 在屏幕坐标系中的输出一致）
    const hull = [
      { x: 100, y: 100 }, // 左上
      { x: 200, y: 100 }, // 右上
      { x: 200, y: 200 }, // 右下
      { x: 100, y: 200 }, // 左下
    ];

    const expanded = expandHull(hull, 20);

    // 扩展后，顶部点的 y 应该更小（向上扩展）
    const topPoints = expanded.filter((p) => p.y < 150);
    for (const p of topPoints) {
      expect(p.y).toBeLessThan(100);
    }

    // 扩展后，底部点的 y 应该更大（向下扩展）
    const bottomPoints = expanded.filter((p) => p.y > 150);
    for (const p of bottomPoints) {
      expect(p.y).toBeGreaterThan(200);
    }
  });
});

describe('landmarkBodyHull 头顶覆盖', () => {
  it('凸包最高点应高于耳朵位置至少 0.8 倍头宽（覆盖头顶+头发）', () => {
    // 模拟一个站立人物，耳朵间距 80 像素（归一化 0.1）
    const earDist = 0.1; // 归一化耳朵间距
    const earMidY = 0.3; // 耳朵中点 y
    const pose = makePose({
      [POSE.NOSE]: { x: 0.5, y: 0.28, z: 0, visibility: 0.9 },
      [POSE.LEFT_EAR]: { x: 0.5 - earDist / 2, y: earMidY, z: 0, visibility: 0.9 },
      [POSE.RIGHT_EAR]: { x: 0.5 + earDist / 2, y: earMidY, z: 0, visibility: 0.9 },
      [POSE.LEFT_SHOULDER]: { x: 0.4, y: 0.4, z: 0, visibility: 0.9 },
      [POSE.RIGHT_SHOULDER]: { x: 0.6, y: 0.4, z: 0, visibility: 0.9 },
      [POSE.LEFT_HIP]: { x: 0.42, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.RIGHT_HIP]: { x: 0.58, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.LEFT_KNEE]: { x: 0.43, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.RIGHT_KNEE]: { x: 0.57, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.LEFT_ANKLE]: { x: 0.44, y: 0.95, z: 0, visibility: 0.8 },
      [POSE.RIGHT_ANKLE]: { x: 0.56, y: 0.95, z: 0, visibility: 0.8 },
    });

    const W = 640, H = 480;
    const hull = landmarkBodyHull(pose, W, H);
    expect(hull).not.toBeNull();

    const earMidYPx = earMidY * H; // 144
    const headWidthPx = earDist * W; // 64
    const requiredTopY = earMidYPx - headWidthPx * 0.8; // 耳朵上方至少 0.8 倍头宽

    const hullTopY = Math.min(...(hull ?? []).map((p) => p.y));
    expect(hullTopY).toBeLessThanOrEqual(requiredTopY);
  });

  it('凸包最高点应在头顶两侧（x方向）也有覆盖，不只是中间', () => {
    const earDist = 0.1;
    const earMidY = 0.3;
    const earMidX = 0.5;
    const pose = makePose({
      [POSE.NOSE]: { x: earMidX, y: 0.28, z: 0, visibility: 0.9 },
      [POSE.LEFT_EAR]: { x: earMidX - earDist / 2, y: earMidY, z: 0, visibility: 0.9 },
      [POSE.RIGHT_EAR]: { x: earMidX + earDist / 2, y: earMidY, z: 0, visibility: 0.9 },
      [POSE.LEFT_SHOULDER]: { x: 0.4, y: 0.4, z: 0, visibility: 0.9 },
      [POSE.RIGHT_SHOULDER]: { x: 0.6, y: 0.4, z: 0, visibility: 0.9 },
      [POSE.LEFT_HIP]: { x: 0.42, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.RIGHT_HIP]: { x: 0.58, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.LEFT_KNEE]: { x: 0.43, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.RIGHT_KNEE]: { x: 0.57, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.LEFT_ANKLE]: { x: 0.44, y: 0.95, z: 0, visibility: 0.8 },
      [POSE.RIGHT_ANKLE]: { x: 0.56, y: 0.95, z: 0, visibility: 0.8 },
    });

    const W = 640, H = 480;
    const hull = landmarkBodyHull(pose, W, H);
    expect(hull).not.toBeNull();

    const earMidYPx = earMidY * H; // 144
    const headWidthPx = earDist * W; // 64
    // 检查耳朵上方 0.5 倍头宽的位置，凸包在左右两侧（耳朵 x ± 0.5 倍头宽）是否都有点
    const checkY = earMidYPx - headWidthPx * 0.5;
    const earMidXPx = earMidX * W; // 320
    const leftX = earMidXPx - headWidthPx * 0.5;
    const rightX = earMidXPx + headWidthPx * 0.5;

    // 凸包中 y <= checkY 的点应该在 x 方向覆盖到 leftX 和 rightX
    const topPoints = (hull ?? []).filter((p) => p.y <= checkY);
    const minX = Math.min(...topPoints.map((p) => p.x));
    const maxX = Math.max(...topPoints.map((p) => p.x));

    expect(minX).toBeLessThanOrEqual(leftX);
    expect(maxX).toBeGreaterThanOrEqual(rightX);
  });

  it('耳朵不可见时（fallback），凸包最高点仍应高于 rawBox.y0 足够多', () => {
    // 不提供耳朵 landmark，测试 fallback 逻辑
    const pose = makePose({
      [POSE.NOSE]: { x: 0.5, y: 0.2, z: 0, visibility: 0.9 },
      [POSE.LEFT_SHOULDER]: { x: 0.4, y: 0.35, z: 0, visibility: 0.9 },
      [POSE.RIGHT_SHOULDER]: { x: 0.6, y: 0.35, z: 0, visibility: 0.9 },
      [POSE.LEFT_HIP]: { x: 0.42, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.RIGHT_HIP]: { x: 0.58, y: 0.6, z: 0, visibility: 0.9 },
      [POSE.LEFT_KNEE]: { x: 0.43, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.RIGHT_KNEE]: { x: 0.57, y: 0.8, z: 0, visibility: 0.8 },
      [POSE.LEFT_ANKLE]: { x: 0.44, y: 0.95, z: 0, visibility: 0.8 },
      [POSE.RIGHT_ANKLE]: { x: 0.56, y: 0.95, z: 0, visibility: 0.8 },
    });

    const W = 640, H = 480;
    const hull = landmarkBodyHull(pose, W, H);
    expect(hull).not.toBeNull();

    // rawBox.y0 大约在鼻子位置 y=0.2*480=96
    const rawBoxY0 = 0.2 * H; // 96
    // 凸包最高点应该比 rawBox.y0 至少高 30 像素（而不是以前的 3% body height ≈ 14px）
    const hullTopY = Math.min(...(hull ?? []).map((p) => p.y));
    expect(hullTopY).toBeLessThan(rawBoxY0 - 30);
  });
});
