import { POSE, type Landmark } from './mp';

/**
 * 生成人物身体凸包轮廓（含头顶扩展）
 * 
 * 头顶计算：用耳朵间距（头宽）估算头高，耳朵间距是比鼻子-耳朵差值
 * 稳定得多的参考量。头部近似椭圆，高度 ≈ 宽度 × 1.0～1.3。
 */
export function landmarkBodyHull(
  landmarks: Landmark[],
  width: number,
  height: number,
): { x: number; y: number }[] | null {
  if (!landmarks || landmarks.length === 0) return null;

  const allPts: { x: number; y: number }[] = [];
  const pts: { x: number; y: number }[] = [];
  for (const lm of landmarks) {
    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) continue;
    const point = { x: lm.x * width, y: lm.y * height };
    allPts.push(point);
    if (typeof lm.visibility === 'number' && lm.visibility < 0.35) continue;
    pts.push(point);
  }
  const workPts = (pts.length >= 6 ? pts : allPts).slice();
  if (workPts.length < 3) return null;

  const rawBox = getBounds(allPts);
  if (!rawBox) return null;

  // ===== 头顶扩展：用耳朵间距估算头高 =====
  const leftEar = landmarks[POSE.LEFT_EAR];
  const rightEar = landmarks[POSE.RIGHT_EAR];

  // 耳朵可见性检查：visibility > 0.5 才算有效（防止用默认值/低置信度位置）
  const earVisThreshold = 0.5;
  const earsValid =
    leftEar && rightEar &&
    Number.isFinite(leftEar.x) && Number.isFinite(rightEar.x) &&
    (typeof leftEar.visibility !== 'number' || leftEar.visibility >= earVisThreshold) &&
    (typeof rightEar.visibility !== 'number' || rightEar.visibility >= earVisThreshold);
  const earMidX = earsValid
    ? ((leftEar!.x + rightEar!.x) / 2) * width
    : rawBox.cx;
  // 耳朵不可见时，用 rawBox 顶部（通常是鼻子/眼睛位置）而不是 rawBox.y0 + 0.15*h
  const earMidY = earsValid
    ? ((leftEar!.y + rightEar!.y) / 2) * height
    : rawBox.y0;

  // 头宽 = 耳朵间距（像素）；耳朵不可见时用 body bbox 宽度 * 0.35
  const headWidth = earsValid
    ? Math.abs(rightEar!.x - leftEar!.x) * width
    : rawBox.w * 0.35;

  // 头高 ≈ 头宽 × 1.3（人头上下比左右略高，含头发余量）
  const headHeight = headWidth * 1.3;

  // 头顶 y = 耳朵中点上移 头高 × 0.7（耳朵在头部中下部，0.7 倍头高到头顶）
  const headTopY = Math.max(0, earMidY - headHeight * 0.7);

  // 在头顶区域生成半圆弧点，宽度 = 1.3 倍头宽（覆盖头发两侧）
  const headArcSteps = 11;
  const arcRadiusX = headWidth * 0.65;
  const arcRadiusY = headHeight * 0.5;
  for (let k = 0; k < headArcSteps; k++) {
    const t = k / (headArcSteps - 1); // 0..1
    const angle = Math.PI * (0.1 + t * 0.8); // 18° 到 162°
    const px = earMidX + Math.cos(angle) * arcRadiusX;
    const py = headTopY + Math.sin(angle) * arcRadiusY;
    workPts.push({
      x: Math.max(0, Math.min(width, px)),
      y: Math.max(0, Math.min(height, py)),
    });
  }

  // 额外加一排更高点（从头顶再往上 0.3 倍头高），宽度 = 1.2 倍头宽
  const extraTopY = Math.max(0, headTopY - headHeight * 0.3);
  for (let k = 0; k < 7; k++) {
    const t = k / 6 - 0.5; // -0.5 到 0.5
    workPts.push({
      x: Math.max(0, Math.min(width, earMidX + t * headWidth * 1.2)),
      y: extraTopY,
    });
  }

  // 加 envelope corner 点，保证凸包足够大
  const envelopePad = Math.max(25, Math.min(rawBox.w, rawBox.h) * 0.15);
  workPts.push({ x: Math.max(0, rawBox.x0 - envelopePad), y: Math.max(0, rawBox.y0 - envelopePad) });
  workPts.push({ x: Math.min(width, rawBox.x1 + envelopePad), y: Math.max(0, rawBox.y0 - envelopePad) });
  workPts.push({ x: Math.min(width, rawBox.x1 + envelopePad), y: Math.min(height, rawBox.y1 + envelopePad) });
  workPts.push({ x: Math.max(0, rawBox.x0 - envelopePad), y: Math.min(height, rawBox.y1 + envelopePad) });

  // Andrew monotone chain 凸包
  workPts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: { x: number; y: number }[] = [];
  for (const p of workPts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = workPts.length - 1; i >= 0; i--) {
    const p = workPts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return hull.length >= 3 ? hull : null;
}

export function expandHull(
  hull: { x: number; y: number }[],
  margin: number,
): { x: number; y: number }[] {
  if (hull.length < 3) return hull;
  const result: { x: number; y: number }[] = [];
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const nx1 = dy1 / len1;
    const ny1 = -dx1 / len1;
    const nx2 = dy2 / len2;
    const ny2 = -dx2 / len2;
    const nx = (nx1 + nx2) / 2;
    const ny = (ny1 + ny2) / 2;
    const nlen = Math.hypot(nx, ny) || 1;
    result.push({ x: curr.x + (nx / nlen) * margin, y: curr.y + (ny / nlen) * margin });
  }
  return result;
}

/**
 * 根据 bbox 大小、深度、画面占比计算自适应 margin
 * 
 * 人离镜头近时（bbox 大、占画面比例高）需要更大的 margin，
 * 因为凸包边缘容易漏出且像素面积大。
 */
export function adaptiveMargin(bbox: { w: number; h: number }, depth: number, width: number, _height: number): number {
  const bboxMax = Math.max(bbox.w, bbox.h);
  // 基础 margin = bbox 较大边的 12%
  const base = bboxMax * 0.12;
  // 画面占比因子：bbox 占画面越大，margin 越大（近距补偿）
  // ratio 0.1(远)→1.0, 0.5(近)→2.5, 0.8(很近)→3.4
  const ratio = (bbox.w * bbox.h) / (width * (_height || width * 0.75));
  const ratioFactor = 1 + Math.max(0, ratio) * 3;
  // depth 因子：depth 小（人近）时 margin 更大
  // depth 0(近)→1.5, depth 0.5(中)→1.0, depth 1(远)→0.5
  const depthFactor = 1.5 - Math.min(1, Math.max(0, depth)) * 1.0;
  return Math.max(30, base * ratioFactor * depthFactor);
}

function cross(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function getBounds(points: { x: number; y: number }[]) {
  if (points.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
