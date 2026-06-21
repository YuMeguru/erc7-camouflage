// BackgroundManager — 维护一张 "无前景人" 背景帧（用于抹人时填回）
// Sprint 21 重构版 — 更快的动态背景适应 + 消除拖影
//
// 算法演进：
//   v1: 滑动平均（BLEND_ALPHA=0.85），人在区域内不更新 → 拖影严重
//   v2: 双缓冲 + 上一帧填回 → 画面残留
//   v3: 纯净背景帧 + 快速混合 + 动态区域检测
//   v4（当前）: 进一步降低 BLEND_ALPHA 到 0.35 + 人离开区域直接取当前帧
//     - 旧版人离开从 pureBackground 取，但 pureBackground 可能是几秒前的旧背景
//     - 新版人离开区域直接用当前帧（假设人走了，当前帧就是真实背景）
//     - 非人区域用更快的混合速度适应动态背景（窗帘、光影变化）
//     - 增加 mask 膨胀：人区域 bbox 外扩几像素，避免边缘残留

import type { Bbox } from '../utils/geometry';

/** 帧间背景混合系数（旧帧权重）；值越小背景更新越快 */
export const BLEND_ALPHA = 0.35;
/** 动态区域（帧差大）的快速混合系数 */
export const FAST_BLEND_ALPHA = 0.15;
/** 帧差阈值，超过则认为是动态区域 */
const DYNAMIC_DIFF_THRESHOLD = 25;
/** 人区域 mask 外扩像素数（避免边缘残留） */
const MASK_DILATE = 6;

export class BackgroundManager {
  private buffer: Uint8ClampedArray;
  /** 纯净背景帧：只在无人区域更新，用于填回人离开的区域 */
  private pureBackground: Uint8ClampedArray;
  private width: number;
  private height: number;
  private initialized = false;
  /** 上一帧的完整像素（用于帧差检测） */
  private previousFrame: Uint8ClampedArray | null = null;
  /** 上一帧的人 mask */
  private lastMask: Uint8Array | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = new Uint8ClampedArray(width * height * 4);
    this.pureBackground = new Uint8ClampedArray(width * height * 4);
  }

  /**
   * 把当前帧融合进背景。personBboxes 区域不参与融合。
   * v4 改进：
   *   1. 人离开区域直接取当前帧（而非旧 pureBackground），消除"旧背景"穿帮
   *   2. 非人区域混合更快（BLEND_ALPHA 0.35），动态背景适应更灵敏
   *   3. mask 外扩 MASK_DILATE 像素，避免人边缘 1-2 像素残留导致拖影
   */
  addFrame(pixels: Uint8ClampedArray, personBboxes: Bbox[]): void {
    if (pixels.length !== this.buffer.length) {
      throw new Error(`size mismatch: pixels=${pixels.length} buffer=${this.buffer.length}`);
    }
    const mask = this.buildPersonMask(personBboxes);

    if (!this.initialized) {
      this.initFromFrame(pixels, mask);
      this.previousFrame = new Uint8ClampedArray(pixels);
      this.lastMask = mask;
      return;
    }

    // Step 1: 填补 "上一帧有人但这一帧没人" 的区域
    // v4：直接取当前帧像素（假设人已离开，当前帧就是真实背景）
    if (this.lastMask) {
      for (let i = 0; i < this.buffer.length; i += 4) {
        const px = i / 4;
        if (this.lastMask[px] === 1 && mask[px] === 0) {
          // 人刚离开：直接用当前帧（不是几秒前的 pureBackground）
          this.buffer[i] = pixels[i];
          this.buffer[i + 1] = pixels[i + 1];
          this.buffer[i + 2] = pixels[i + 2];
          this.buffer[i + 3] = 255;
          this.pureBackground[i] = pixels[i];
          this.pureBackground[i + 1] = pixels[i + 1];
          this.pureBackground[i + 2] = pixels[i + 2];
          this.pureBackground[i + 3] = 255;
        }
      }
    }

    // Step 2: 混合更新（非人区域）
    if (this.previousFrame) {
      for (let i = 0; i < this.buffer.length; i += 4) {
        const px = i / 4;
        if (mask[px] !== 0) continue;

        // 帧差检测：判断是否是动态区域
        const diff = Math.abs(pixels[i] - this.previousFrame[i]) +
                     Math.abs(pixels[i + 1] - this.previousFrame[i + 1]) +
                     Math.abs(pixels[i + 2] - this.previousFrame[i + 2]);
        const alpha = diff > DYNAMIC_DIFF_THRESHOLD ? FAST_BLEND_ALPHA : BLEND_ALPHA;

        this.buffer[i] = Math.round(this.buffer[i] * alpha + pixels[i] * (1 - alpha));
        this.buffer[i + 1] = Math.round(this.buffer[i + 1] * alpha + pixels[i + 1] * (1 - alpha));
        this.buffer[i + 2] = Math.round(this.buffer[i + 2] * alpha + pixels[i + 2] * (1 - alpha));
        this.buffer[i + 3] = 255;

        // 同步更新纯净背景帧
        this.pureBackground[i] = this.buffer[i];
        this.pureBackground[i + 1] = this.buffer[i + 1];
        this.pureBackground[i + 2] = this.buffer[i + 2];
        this.pureBackground[i + 3] = 255;
      }
    }

    // 缓存当前帧 + mask 给下一帧用
    this.previousFrame = new Uint8ClampedArray(pixels);
    this.lastMask = mask;
  }

  private initFromFrame(pixels: Uint8ClampedArray, mask: Uint8Array): void {
    for (let i = 0; i < this.buffer.length; i += 4) {
      if (mask[i / 4] === 0) {
        this.buffer[i] = pixels[i];
        this.buffer[i + 1] = pixels[i + 1];
        this.buffer[i + 2] = pixels[i + 2];
        this.buffer[i + 3] = pixels[i + 3];
        this.pureBackground[i] = pixels[i];
        this.pureBackground[i + 1] = pixels[i + 1];
        this.pureBackground[i + 2] = pixels[i + 2];
        this.pureBackground[i + 3] = pixels[i + 3];
      }
    }
    this.initialized = true;
  }

  private buildPersonMask(bboxes: Bbox[]): Uint8Array {
    const w = this.width;
    const h = this.height;
    const mask = new Uint8Array(w * h);
    for (const b of bboxes) {
      // v4：外扩 MASK_DILATE 像素，避免人边缘残留
      const x0 = Math.max(0, Math.floor(b.x - MASK_DILATE));
      const y0 = Math.max(0, Math.floor(b.y - MASK_DILATE));
      const x1 = Math.min(w, Math.ceil(b.x + b.w + MASK_DILATE));
      const y1 = Math.min(h, Math.ceil(b.y + b.h + MASK_DILATE));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          mask[y * w + x] = 1;
        }
      }
    }
    return mask;
  }

  getBackground(): Uint8ClampedArray {
    return this.buffer;
  }

  isReady(): boolean {
    return this.initialized;
  }

  reset(): void {
    this.initialized = false;
    this.buffer.fill(0);
    this.pureBackground.fill(0);
    this.previousFrame = null;
    this.lastMask = null;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}
