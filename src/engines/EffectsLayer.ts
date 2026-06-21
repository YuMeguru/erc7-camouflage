// EffectsLayer — 在 output 上叠加特效（vignette + scanline + U形白噪条）
// Sprint 22 v3：删除所有花屏，白噪条位置固定只上下运动

export interface EffectsOptions {
  /** 是否启用 vignette */
  vignette?: boolean;
  /** 是否启用扫描线（夜视感） */
  scanline?: boolean;
  /** vignette 强度 0..1 */
  vignetteIntensity?: number;
}

function noise(seed: number): number {
  return ((seed * 374761393 + seed * 668265263) & 0x7fffffff) / 0x7fffffff;
}

interface BarState {
  /** 固定的 x 位置（不随帧变化） */
  x: number;
  /** 固定的宽度（不随帧变化） */
  w: number;
  /** 上一帧高度（用于平滑插值） */
  prevHeight: number;
}

export class EffectsLayer {
  private opts: Required<EffectsOptions>;
  /** 白噪条状态数组（位置固定，只有高度变化） */
  private bars: BarState[] = [];
  /** bars 对应的画布宽度（尺寸变化时重新初始化） */
  private barsW = 0;
  /** 平滑系数（越大越平滑，从底部慢慢涨上来） */
  private readonly barSmoothAlpha = 0.96;
  /** 当前有效 intensity（人消失后缓慢衰减到 0，让白噪条向下缩短消失） */
  private fadeIntensity = 0;
  /** 是否正在淡出（人消失后持续到条高度接近 0） */
  private fadingOut = false;

  constructor(opts: EffectsOptions = {}) {
    this.opts = {
      scanline: opts.scanline ?? true,
      vignette: opts.vignette ?? true,
      vignetteIntensity: opts.vignetteIntensity ?? 0.4,
    };
  }

  /**
   * 绘制特效。
   * @param intensity 0..1，有人时 >0（人物 bbox 占比），越近越大
   * @param hasPerson 是否检测到人（有人就画白噪条，不管多远）
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, frame: number, hasPerson: boolean): void {
    // 维护 fadeIntensity：有人时跟随 intensity，人消失后缓慢衰减
    if (hasPerson) {
      this.fadeIntensity = intensity;
      this.fadingOut = intensity > 0;
    } else if (this.fadingOut) {
      // 人消失后每帧衰减 0.04（约 25 帧从满到 0），让条向下缩短
      this.fadeIntensity = Math.max(0, this.fadeIntensity - 0.04);
      if (this.fadeIntensity <= 0) {
        this.fadingOut = false;
        // 衰减结束时把所有条高度归零，避免下次有人时残留
        for (const bar of this.bars) bar.prevHeight = 0;
      }
    }

    const showBars = hasPerson || this.fadingOut;
    if (intensity <= 0 && !showBars) return;
    const i = Math.min(1, Math.max(0, intensity)) * this.opts.vignetteIntensity;

    if (this.opts.vignette) {
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      g.addColorStop(0, 'rgba(0, 0, 0, 0)');
      g.addColorStop(1, `rgba(0, 0, 0, ${0.5 * i})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.opts.scanline) {
      ctx.save();
      ctx.globalAlpha = 0.12 * i;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();
    }

    // 有人时或淡出中继续画白噪条（用 fadeIntensity 驱动高度衰减）
    if (showBars) {
      this.drawBottomGlitchBand(ctx, w, h, Math.min(1, Math.max(0, this.fadeIntensity)), frame);
    }
  }

  setOptions(opts: Partial<EffectsOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  getOptions(): Readonly<Required<EffectsOptions>> {
    return this.opts;
  }

  /**
   * 初始化白噪条（位置固定，只调用一次或画布尺寸变化时）。
   * 每根条的 x 位置和宽度在此固定，之后只有高度变化（上下运动）。
   */
  private initBars(w: number): void {
    this.bars = [];
    this.barsW = w;
    // 奇数条数，确保中间有一条在 t=0.5，左右对称
    const colCount = 27;
    const cellW = w / colCount;
    // 从中心向两边生成，保证左右对称
    const half = Math.floor(colCount / 2);
    const leftBars: BarState[] = [];
    const rightBars: BarState[] = [];
    let cursorL = 0; // 从中心向左累加
    let cursorR = 0; // 从中心向右累加
    const centerX = w / 2;

    // 中间条（t=0.5）
    const midWidthNoise = noise(13 * 7919 + 7);
    const midBarW = Math.max(8, Math.floor(8 + midWidthNoise * 16));
    const midBar: BarState = { x: centerX - midBarW / 2, w: midBarW, prevHeight: 0 };

    for (let i = 0; i < half; i++) {
      // 左右用相同的 noise（镜像），保证对称
      const gapNoise = noise(i * 6271 + 13);
      const widthNoise = noise(i * 7919 + 7);
      const gap = cellW * (0.9 + gapNoise * 0.4);
      const barW = Math.max(8, Math.floor(8 + widthNoise * 16));
      // 右边：从中心向右
      cursorR += gap;
      rightBars.push({ x: centerX + cursorR, w: barW, prevHeight: 0 });
      // 左边：从中心向左（镜像）
      cursorL += gap;
      leftBars.push({ x: centerX - cursorL - barW, w: barW, prevHeight: 0 });
    }
    // 组合：左（从外到内）+ 中 + 右（从内到外）
    this.bars = leftBars.reverse().concat([midBar]).concat(rightBars);
  }

  /**
   * 底部 U 形白噪条（位置固定，只上下运动）。
   * 规则：
   *   - 固定在屏幕底部，U 形（两边高中间低）
   *   - 中间最高 = 屏幕高度 1/3，两边最高 = 屏幕高度 1/2
   *   - 只要有人就显示，不管多远；距离只影响轻微高度变化
   *   - 每根条 x 位置和宽度固定不变，只有高度上下变化
   *   - 高度平滑插值（从底部涨上来，不快不慢）
   */
  private drawBottomGlitchBand(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    intensity: number,
    frame: number,
  ): void {
    // 画布尺寸变化时重新初始化条位置
    if (this.bars.length === 0 || Math.abs(this.barsW - w) > 2) {
      this.initBars(w);
    }

    // 有人时高度系数 0.15..0.9：人远条短（0.15），中近距离饱满（0.9）
    const heightFactor = 0.15 + 0.75 * intensity;
    const midMax = (h / 6) * heightFactor;   // 中间最高 1/6 屏（更低，U 形更明显）
    const sideMax = (h / 2) * heightFactor;   // 两边最高 1/2 屏
    const baseY = h - 1;
    const colCount = this.bars.length;

    ctx.save();
    for (let col = 0; col < colCount; col++) {
      const bar = this.bars[col];
      const t = colCount > 1 ? col / (colCount - 1) : 0.5; // 0..1
      // U 形系数
      const uShape = (2 * t - 1) * (2 * t - 1);
      const baseHeight = midMax + (sideMax - midMax) * uShape;

      // 目标高度：baseHeight + 上下抖动（只影响高度，不影响位置）
      // 多频率 noise 叠加 + 每根条独立相位，打破规律性
      const phase = col * 104729; // 每根条独立相位
      const slow = noise(phase + frame * 2);        // 慢速波动
      const mid = noise(phase * 2 + frame * 3);     // 中速波动
      const fast = noise(phase * 3 + frame * 5);    // 快速细微波纹
      // 三层叠加，权重不同，形成不规律的复合抖动
      const jitterRaw = (slow * 0.5 + mid * 0.3 + fast * 0.2 - 0.4);
      // 幅度随 intensity 变化：远时 0.2（平稳），近时 1.0（剧烈跳动）
      const amplitude = 0.2 + 0.8 * intensity;
      const jitterTarget = jitterRaw * baseHeight * amplitude;
      const targetHeight = Math.max(3, baseHeight + jitterTarget);

      // 平滑插值：从底部慢慢涨上来
      bar.prevHeight = bar.prevHeight * this.barSmoothAlpha + targetHeight * (1 - this.barSmoothAlpha);
      const finalHeight = Math.max(2, Math.floor(bar.prevHeight));

      // x 位置固定（bar.x），宽度固定（bar.w），只有 y 变化
      const y = baseY - finalHeight;

      // 不规则亮度/颜色（透明度固定，不随距离变化）
      const bright = noise(phase + frame + 3);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = bright > 0.5 ? '#e8ecf5' : '#ffffff';
      ctx.fillRect(bar.x, y, bar.w, Math.ceil(finalHeight));

      // 偶尔的顶部高亮（只垂直，不水平偏移）
      if (noise(phase + frame * 2 + 11) > 0.6) {
        ctx.globalAlpha = 0.5;
        ctx.fillRect(bar.x, y - 2, bar.w, 2);
      }
    }
    ctx.restore();
  }
}
