// Compositor — 把当前摄像头画面 + 背景帧合成到 output canvas
// Sprint 21 重构版 — 基于 convex hull mask 的 ERC-7 隐身合成
//
// 核心改进（针对用户反馈）：
//   1. 用凸包多边形 mask 替代矩形抹除 → 解决"头顶没覆盖 + 四肢漏出"
//   2. 恢复边缘羽化（blur filter）→ 解决"隐身边缘生硬/不完全"
//   3. ERC-7 glitch 效果优化：扫描线撕裂 + 白噪点 + 边缘辉光（贴近原作）
//   4. 时序抖动：每帧偏移不同，模拟电子干扰的闪烁感
//   5. 兼容旧 bbox 接口（personBboxes 仍传 bbox，内部用 hull 算法重建轮廓）

import type { Bbox } from '../utils/geometry';
import { expandHullToViewport, featherHullEdge } from './compositorMask';

export interface CompositorInput {
  sourceCanvas: HTMLCanvasElement;
  outputCanvas: HTMLCanvasElement;
  background: Uint8ClampedArray;
  /** 要抹除的人的 bbox 列表（INVISIBLE 状态） */
  personBboxes: Bbox[];
  /** ERC-7 效果强度 0..1，由距离决定（越近越大） */
  intensity?: number;
  /** 可选：凸包轮廓列表（与 personBboxes 一一对应，若提供则用 hull 抹除） */
  personHulls?: { x: number; y: number }[][];
  /** glitch 过渡强度 0..1：>0 时显示进出隐身特效，=0 时纯抹除 */
  glitchIntensity?: number;
  /** 帧序号，用于驱动时序抖动 */
  frame?: number;
}

export class Compositor {
  private bgImage: ImageData | null = null;
  private seed = 42;
  private tmpCanvas: HTMLCanvasElement | null = null;
  private tmpW = 0;
  private tmpH = 0;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskW = 0;
  private maskH = 0;

  composite(input: CompositorInput): void {
    const { sourceCanvas, outputCanvas, background, personBboxes, intensity = 0.5, personHulls, glitchIntensity = 0, frame = 0 } = input;

    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;

    // 1) 全画面 draw source
    ctx.drawImage(sourceCanvas, 0, 0);

    if (personBboxes.length === 0) return;

    const W = outputCanvas.width;
    const H = outputCanvas.height;

    // 2) 准备背景 ImageData → tmp canvas
    if (!this.bgImage || this.bgImage.width !== W || this.bgImage.height !== H) {
      this.bgImage = new ImageData(new Uint8ClampedArray(W * H * 4), W, H);
    }
    if (background.length === W * H * 4) {
      this.bgImage.data.set(background);
    } else {
      this.bgImage.data.fill(0);
    }

    const tmp = this.getTmpCanvas(W, H);
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.putImageData(this.bgImage, 0, 0);

    // 3) 对每个 INVISIBLE person
    for (let i = 0; i < personBboxes.length; i++) {
      const bbox = personBboxes[i];
      const hull = personHulls?.[i];
      this.eraseVigilStyle(ctx, tmp, bbox, hull, W, H, intensity, glitchIntensity, frame + i);
    }
  }

  private eraseVigilStyle(
    ctx: CanvasRenderingContext2D,
    bgCanvas: HTMLCanvasElement,
    bbox: Bbox,
    hull: { x: number; y: number }[] | undefined,
    vw: number,
    vh: number,
    intensity: number,
    glitchIntensity: number,
    frameSeed: number,
  ): void {
    // 动态 margin：基于 bbox 大小 + intensity（近距更大，无硬上限）
    const dynamicMargin = Math.max(30, Math.round(Math.max(bbox.w, bbox.h) * 0.18 + intensity * 20));

    // 如果有凸包轮廓，用轮廓抹除；否则退化为带 margin 的 bbox
    let clipPath: { x: number; y: number }[];
    if (hull && hull.length >= 3) {
      // 凸包外膨胀
      clipPath = expandHullToViewport(hull, dynamicMargin, vw, vh);
    } else {
      // 退化为 bbox + margin（兼容老接口）
      const x0 = Math.max(0, bbox.x - dynamicMargin);
      const y0 = Math.max(0, bbox.y - dynamicMargin);
      const x1 = Math.min(vw, bbox.x + bbox.w + dynamicMargin);
      const y1 = Math.min(vh, bbox.y + bbox.h + dynamicMargin);
      clipPath = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
    }

    // 计算 clip 区域的 bbox（用于限制绘制范围）
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of clipPath) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const rx = Math.max(0, Math.floor(minX));
    const ry = Math.max(0, Math.floor(minY));
    const rw = Math.min(vw - rx, Math.ceil(maxX - minX));
    const rh = Math.min(vh - ry, Math.ceil(maxY - minY));
    if (rw <= 0 || rh <= 0) return;

    ctx.save();

    // 用凸包路径 clip
    ctx.beginPath();
    ctx.moveTo(clipPath[0].x, clipPath[0].y);
    for (let i = 1; i < clipPath.length; i++) {
      ctx.lineTo(clipPath[i].x, clipPath[i].y);
    }
    ctx.closePath();
    ctx.clip();

    // ===== 基底：整体填背景 =====
    ctx.drawImage(bgCanvas, rx, ry, rw, rh, rx, ry, rw, rh);

    // glitchIntensity > 0 时才叠加进出隐身特效
    if (glitchIntensity > 0.01) {
      // ===== ERC-7 扫描线撕裂（screen tear）=====
      // 水平切片，部分切片水平偏移，模拟信号撕裂
      const sliceCount = 14 + Math.floor(this.pseudoRandom() * 10);
      const sliceH = rh / sliceCount;
      const maxOffset = Math.round(18 * intensity);
      for (let i = 0; i < sliceCount; i++) {
        const sy = ry + Math.round(i * sliceH);
        const sh = Math.max(1, Math.round(sliceH));
        // 帧序号驱动撕裂位置变化（每帧不同切片撕裂）
        const tearRoll = this.pseudoRandom() + frameSeed * 0.013;
        const gap = tearRoll < 0.18 * intensity;
        if (gap) {
          // 留缝：露出原始画面（模拟信号丢失的"残影闪烁"）
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(ctx.canvas, rx, sy, rw, sh, rx, sy, rw, sh);
          ctx.restore();
          continue;
        }
        const offsetX = Math.round((this.pseudoRandom() - 0.5) * 2 * maxOffset);
        const alpha = 0.7 + 0.3 * this.pseudoRandom();
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(bgCanvas, rx + offsetX, sy, rw, sh, rx, sy, rw, sh);
        ctx.restore();
      }

      // ===== 水平扫描线条纹（ERC-7 标志性视觉）=====
      ctx.save();
      ctx.globalAlpha = 0.18 * intensity;
      ctx.fillStyle = '#ffffff';
      const scanlineCount = Math.round(rh / 4);
      for (let i = 0; i < scanlineCount; i++) {
        // 用帧序号让扫描线滚动
        const offset = (frameSeed % 4);
        if (this.pseudoRandom() < 0.35) {
          const sy = ry + i * 4 + offset;
          if (sy < ry + rh) ctx.fillRect(rx, sy, rw, 1);
        }
      }
      ctx.restore();

      // ===== 白噪颗粒散布 =====
      const grainCount = Math.round(intensity * 900);
      ctx.save();
      for (let i = 0; i < grainCount; i++) {
        const gx = rx + Math.round(this.pseudoRandom() * rw);
        const gy = ry + Math.round(this.pseudoRandom() * rh);
        const alpha = 0.1 + 0.35 * intensity * this.pseudoRandom();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.pseudoRandom() < 0.5 ? '#ffffff' : '#0a0a0a';
        ctx.fillRect(gx, gy, 2 + Math.round(this.pseudoRandom() * 3), 1);
      }
      ctx.restore();

      // ===== 边缘辉光（沿凸包轮廓）=====
      ctx.save();
      ctx.globalAlpha = 0.3 * intensity;
      ctx.strokeStyle = '#aeeaff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#7fdfff';
      ctx.shadowBlur = 12 * intensity;
      ctx.beginPath();
      ctx.moveTo(clipPath[0].x, clipPath[0].y);
      for (let i = 1; i < clipPath.length; i++) {
        ctx.lineTo(clipPath[i].x, clipPath[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // ===== 边缘羽化：在 clip 区域边界做 blur 过渡 =====
    // 用 destination-in + blur 实现 mask 边缘软化
    featherHullEdge(ctx, this.getMaskCanvas(rw, rh), clipPath, rx, ry, rw, rh, intensity);

    // 推进 seed
    this.seed = (this.seed * 16807 + frameSeed) % 2147483647;
  }

  private pseudoRandom(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private getTmpCanvas(w: number, h: number): HTMLCanvasElement {
    if (!this.tmpCanvas || this.tmpW !== w || this.tmpH !== h) {
      this.tmpCanvas = document.createElement('canvas');
      this.tmpCanvas.width = w;
      this.tmpCanvas.height = h;
      this.tmpW = w;
      this.tmpH = h;
    }
    return this.tmpCanvas;
  }

  private getMaskCanvas(w: number, h: number): HTMLCanvasElement {
    if (!this.maskCanvas || this.maskW !== w || this.maskH !== h) {
      this.maskCanvas = document.createElement('canvas');
      this.maskCanvas.width = Math.max(1, w);
      this.maskCanvas.height = Math.max(1, h);
      this.maskW = w;
      this.maskH = h;
    }
    return this.maskCanvas;
  }

  dispose(): void {
    this.bgImage = null;
    this.tmpCanvas = null;
    this.maskCanvas = null;
  }
}
