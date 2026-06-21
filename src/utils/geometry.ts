// 几何工具：欧氏距离、IoU、bbox、凸包工具
// Sprint 5 TDD 实现

export interface Point {
  x: number;
  y: number;
}

export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 两点欧氏距离 */
export function euclidean(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 两个 bbox 的交并比 (IoU) */
export function bboxIoU(a: Bbox, b: Bbox): number {
  const ix = Math.max(a.x, b.x);
  const iy = Math.max(a.y, b.y);
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const iw = Math.max(0, Math.min(ax2, bx2) - ix);
  const ih = Math.max(0, Math.min(ay2, by2) - iy);
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  return union === 0 ? 0 : inter / union;
}

/** 点是否在 bbox 内 */
export function pointInBbox(p: Point, b: Bbox): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

/** 给 bbox 外扩 margin */
export function expandBbox(b: Bbox, margin: number): Bbox {
  return { x: b.x - margin, y: b.y - margin, w: b.w + margin * 2, h: b.h + margin * 2 };
}

/** 点到线段的最短距离 */
export function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}
