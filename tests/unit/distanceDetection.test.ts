import { describe, it, expect } from 'vitest';
import { adaptiveMargin } from '../../src/types/mpMask';

describe('adaptiveMargin 距离检测', () => {
  it('人离镜头近（bbox 大）时 margin 应足够大（不低于 bbox 15%）', () => {
    // 模拟人离镜头很近：bbox 占满画面（640x480）
    const nearBbox = { w: 600, h: 450 };
    const margin = adaptiveMargin(nearBbox, 0.1, 640, 480);

    // margin 至少应该是 bbox 较大边的 15%（600 * 0.15 = 90）
    expect(margin).toBeGreaterThanOrEqual(90);
  });

  it('人离镜头远（bbox 小）时 margin 不应过大', () => {
    // 模拟人离镜头远：bbox 很小（100x150）
    const farBbox = { w: 100, h: 150 };
    const margin = adaptiveMargin(farBbox, 0.8, 640, 480);

    // margin 不应超过 bbox 较大边的 50%（150 * 0.5 = 75）
    expect(margin).toBeLessThanOrEqual(75);
  });

  it('bbox 占画面比例 > 50% 时 margin 应显著增大', () => {
    const hugeBbox = { w: 500, h: 400 }; // 占 640x480 的 ~65%
    const smallBbox = { w: 200, h: 160 }; // 占 ~10%
    
    const marginNear = adaptiveMargin(hugeBbox, 0.3, 640, 480);
    const marginFar = adaptiveMargin(smallBbox, 0.3, 640, 480);

    // 近距 margin 应远大于远距 margin
    expect(marginNear).toBeGreaterThan(marginFar * 2);
  });
});
