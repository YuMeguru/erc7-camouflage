import { describe, it, expect } from 'vitest';
import { type Landmark, POSE } from '../../src/types/mp';
import { landmarkBodyHull } from '../../src/types/mpMask';

function makePose(points: Partial<Record<number, Landmark>>): Landmark[] {
  return new Array(33).fill(null).map((_, index) => points[index] ?? { x: 0.5, y: 0.5, z: 0, visibility: 0.1 });
}

describe('landmarkBodyHull', () => {
  it('extends head coverage along the horizontal body axis for side-lying poses', () => {
    const pose = makePose({
      [POSE.NOSE]: { x: 0.2, y: 0.46, z: 0, visibility: 0.9 },
      [POSE.LEFT_SHOULDER]: { x: 0.35, y: 0.45, z: 0, visibility: 0.9 },
      [POSE.RIGHT_SHOULDER]: { x: 0.42, y: 0.47, z: 0, visibility: 0.9 },
      [POSE.LEFT_HIP]: { x: 0.56, y: 0.5, z: 0, visibility: 0.9 },
      [POSE.RIGHT_HIP]: { x: 0.63, y: 0.52, z: 0, visibility: 0.9 },
      [POSE.LEFT_KNEE]: { x: 0.74, y: 0.54, z: 0, visibility: 0.8 },
      [POSE.RIGHT_KNEE]: { x: 0.8, y: 0.56, z: 0, visibility: 0.8 },
      [POSE.LEFT_ANKLE]: { x: 0.9, y: 0.57, z: 0, visibility: 0.8 },
      [POSE.RIGHT_ANKLE]: { x: 0.96, y: 0.58, z: 0, visibility: 0.8 },
    });

    const hull = landmarkBodyHull(pose, 1000, 600);

    expect(hull).not.toBeNull();
    const leftMost = Math.min(...(hull ?? []).map((point) => point.x));
    expect(leftMost).toBeLessThan(195);
  });

  it('keeps low-visibility lower-body extremities in the occlusion envelope', () => {
    const pose = makePose({
      [POSE.NOSE]: { x: 0.5, y: 0.12, z: 0, visibility: 0.9 },
      [POSE.LEFT_SHOULDER]: { x: 0.44, y: 0.26, z: 0, visibility: 0.9 },
      [POSE.RIGHT_SHOULDER]: { x: 0.56, y: 0.26, z: 0, visibility: 0.9 },
      [POSE.LEFT_HIP]: { x: 0.46, y: 0.48, z: 0, visibility: 0.9 },
      [POSE.RIGHT_HIP]: { x: 0.54, y: 0.48, z: 0, visibility: 0.9 },
      [POSE.LEFT_ANKLE]: { x: 0.44, y: 0.93, z: 0, visibility: 0.15 },
      [POSE.RIGHT_ANKLE]: { x: 0.56, y: 0.94, z: 0, visibility: 0.15 },
    });

    const hull = landmarkBodyHull(pose, 800, 1000);

    expect(hull).not.toBeNull();
    const bottomMost = Math.max(...(hull ?? []).map((point) => point.y));
    expect(bottomMost).toBeGreaterThan(900);
  });
});
