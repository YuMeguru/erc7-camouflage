// handAssignment — 将手部关键点指派给 tracked person
// Sprint 21 改进版

import type { Bbox, Point } from '../utils/geometry';
import { euclidean, pointInBbox } from '../utils/geometry';

export interface HandAssignmentCandidate {
  id: number;
  bbox: Bbox;
  hull: Point[];
  /** 手腕关键点的像素坐标（如果有 pose snapshot 与之关联） */
  wristPoint?: Point;
  /** 手肘关键点的像素坐标 */
  elbowPoint?: Point;
}

export function assignHandToTrackedPerson(
  center: Point,
  persons: HandAssignmentCandidate[],
  maxDist: number,
): number | null {
  // 第一阶段：凸包/bbox 内含测试（手在谁的身体区域里就派给谁）
  const containing = persons
    .filter((person) => pointInPolygon(center, person.hull) || pointInBbox(center, person.bbox))
    .sort((a, b) => bboxArea(a.bbox) - bboxArea(b.bbox));

  if (containing.length > 0) {
    return containing[0].id;
  }

  // 第二阶段：找最近的手腕/手肘关键点
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (const person of persons) {
    // 优先用手腕-手肘连线到手的距离
    let dist = Infinity;
    if (person.wristPoint) {
      dist = euclidean(center, person.wristPoint);
    }
    if (person.elbowPoint) {
      const elbowDist = euclidean(center, person.elbowPoint);
      if (elbowDist < dist) dist = elbowDist;
    }
    if (!Number.isFinite(dist)) {
      // 退化为 bbox 中心距
      const personCenter = {
        x: person.bbox.x + person.bbox.w / 2,
        y: person.bbox.y + person.bbox.h / 2,
      };
      dist = euclidean(center, personCenter);
    }
    const allowance = Math.max(maxDist, Math.max(person.bbox.w, person.bbox.h) * 1.1);
    if (dist <= allowance && dist < bestDist) {
      bestDist = dist;
      bestId = person.id;
    }
  }

  return bestId;
}

function bboxArea(bbox: Bbox): number {
  return Math.max(1, bbox.w * bbox.h);
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersect =
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-6) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
