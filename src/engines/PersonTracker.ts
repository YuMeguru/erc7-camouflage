// PersonTracker — 用 bbox IoU 维持稳定的 person ID（多帧不会跳号）
// Sprint 12

import type { Bbox, Point } from '../utils/geometry';
import { bboxIoU, euclidean } from '../utils/geometry';

export interface TrackedPerson {
  id: number;
  bbox: Bbox;
  lastSeenFrame: number;
  /** 平滑后的 bbox（指数移动平均），用于匹配，避免人部分出画时 bbox 突变导致丢号 */
  smoothBbox: Bbox;
}

export class PersonTracker {
  private nextId = 1;
  private tracked: TrackedPerson[] = [];
  /** IoU 阈值：超过该值认为是同一个人 */
  private readonly iouThreshold: number;
  /** 多长时间没看到就丢弃（帧数） */
  private readonly ttl: number;
  /** bbox 平滑系数（越大越平滑，0=不平滑） */
  private readonly smoothAlpha: number;

  constructor(opts: { iouThreshold?: number; ttl?: number; smoothAlpha?: number } = {}) {
    // 修复：降低 IoU 阈值（从 0.3 到 0.15），让 bbox 变化较大时也能匹配
    this.iouThreshold = opts.iouThreshold ?? 0.15;
    // 修复：增大 TTL（从 90 到 150），人短暂出画/遮挡时更不容易丢号
    this.ttl = opts.ttl ?? 150;
    // Sprint 23：bbox 平滑系数，0.7 表示历史权重 70%（更平滑，减少 jittery 追踪）
    this.smoothAlpha = opts.smoothAlpha ?? 0.7;
  }

  /**
   * 输入当前帧的所有 bbox，输出更新后的 tracked persons（保持 ID）。
   * 返回数组按 ID 升序。
   * Sprint 22 改进：
   *   1. 维护 smoothBbox（指数平滑），用 smoothBbox 做匹配，避免人部分出画 bbox 突变丢号
   *   2. 距离阈值放宽（max(w,h) * 1.2 → * 2.0）
   *   3. IoU 阈值降低（0.2 → 0.15）
   */
  update(bboxes: Bbox[], frame: number): TrackedPerson[] {
    // 先淘汰过期 tracked
    this.tracked = this.tracked.filter((p) => frame - p.lastSeenFrame < this.ttl);

    const result: TrackedPerson[] = [];
    const used = new Set<number>();

    for (const bbox of bboxes) {
      let bestScore = 0;
      let best: TrackedPerson | null = null;

      const bboxCenter = {
        x: bbox.x + bbox.w / 2,
        y: bbox.y + bbox.h / 2,
      };

      for (const p of this.tracked) {
        if (used.has(p.id)) continue;
        // 用 smoothBbox 做匹配（更稳定）
        const ref = p.smoothBbox;
        const iou = bboxIoU(ref, bbox);

        const pCenter = {
          x: ref.x + ref.w / 2,
          y: ref.y + ref.h / 2,
        };
        const dist = Math.hypot(bboxCenter.x - pCenter.x, bboxCenter.y - pCenter.y);
        // Sprint 22：放宽距离阈值 * 2.0（原 * 1.2），人部分出画 bbox 突变也能匹配
        const distThreshold = Math.max(bbox.w, bbox.h, ref.w, ref.h) * 2.0;

        // 优先用 IoU 匹配
        if (iou > bestScore && iou > this.iouThreshold) {
          bestScore = iou;
          best = p;
        }
        // 站→躺等大幅形变时 IoU 可能极低，用中心距离作为补充
        const distScore = Math.max(0, 1 - dist / distThreshold);
        if (distScore > bestScore) {
          bestScore = distScore;
          best = p;
        }
      }
      if (best) {
        best.bbox = bbox;
        // Sprint 22：更新 smoothBbox（指数移动平均）
        best.smoothBbox = smoothBbox(best.smoothBbox, bbox, this.smoothAlpha);
        best.lastSeenFrame = frame;
        used.add(best.id);
        result.push(best);
      } else {
        const np: TrackedPerson = { id: this.nextId++, bbox, lastSeenFrame: frame, smoothBbox: bbox };
        this.tracked.push(np);
        used.add(np.id);
        result.push(np);
      }
    }

    // 兜底淘汰过期
    this.tracked = this.tracked.filter((p) => frame - p.lastSeenFrame < this.ttl);

    return result.slice().sort((a, b) => a.id - b.id);
  }

  /**
   * 给定一个手部中心点，把它指派给最近的 tracked person。
   * 距离超过 maxDist（像素）返回 null。
   */
  assign(center: Point, persons: TrackedPerson[], maxDist: number): number | null {
    let bestDist = Infinity;
    let bestId: number | null = null;
    for (const p of persons) {
      const c = { x: p.bbox.x + p.bbox.w / 2, y: p.bbox.y + p.bbox.h / 2 };
      const d = euclidean(center, c);
      if (d < bestDist) {
        bestDist = d;
        bestId = p.id;
      }
    }
    return bestDist <= maxDist ? bestId : null;
  }

  reset(): void {
    this.nextId = 1;
    this.tracked = [];
  }

  /** 调试：当前 tracked 列表（含 TTL） */
  snapshot(): TrackedPerson[] {
    return this.tracked.map((p) => ({ ...p, bbox: { ...p.bbox }, smoothBbox: { ...p.smoothBbox } }));
  }
}

/** 指数移动平均平滑 bbox */
function smoothBbox(prev: Bbox, curr: Bbox, alpha: number): Bbox {
  return {
    x: prev.x * alpha + curr.x * (1 - alpha),
    y: prev.y * alpha + curr.y * (1 - alpha),
    w: prev.w * alpha + curr.w * (1 - alpha),
    h: prev.h * alpha + curr.h * (1 - alpha),
  };
}
