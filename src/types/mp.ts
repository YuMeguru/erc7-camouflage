// MediaPipe Tasks Vision 类型契约
// 定义我们用到的核心 landmark / result 接口 + Pose / Hand 关键点索引常量

export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** 仅 Pose 模型有这个字段 */
  visibility?: number;
  /** 仅 Pose 模型有这个字段 */
  presence?: number;
}

export interface PoseResult {
  landmarks: Landmark[][];
  worldLandmarks?: Landmark[][];
}

export interface HandResult {
  landmarks: Landmark[][];
  /** 每只手的左右标记 */
  handedness: ('Left' | 'Right')[];
  handWorldLandmarks?: Landmark[][];
}

/** Pose 模型的关键点索引（参考 mediapipe pose_landmarker 文档） */
export const POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/** Hand 模型的关键点索引（21 个关键点） */
export const HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/** 计算 landmarks 的像素坐标 bbox（landmarks 是归一化 0..1 坐标） */
export function landmarkBbox(
  landmarks: Landmark[],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } | null {
  if (landmarks.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const lm of landmarks) {
    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) continue;
    if (x0 > lm.x) x0 = lm.x;
    if (y0 > lm.y) y0 = lm.y;
    if (x1 < lm.x) x1 = lm.x;
    if (y1 < lm.y) y1 = lm.y;
  }
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  return { x: x0 * width, y: y0 * height, w: (x1 - x0) * width, h: (y1 - y0) * height };
}

/** 计算 landmarks 的中心点（像素坐标） */
export function landmarkCenter(
  landmarks: Landmark[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (landmarks.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const lm of landmarks) {
    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) continue;
    sx += lm.x;
    sy += lm.y;
    n++;
  }
  if (n === 0) return null;
  return { x: (sx / n) * width, y: (sy / n) * height };
}
