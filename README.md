# VIGIL-07 · ERC-7 Camouflage Simulator

> 7 型影像干扰器 · 浏览器实时隐身模拟器

一个基于浏览器摄像头的实时隐身游戏模拟器，复刻 R6 Siege 干员 Vigil 的 **ERC-7 影像干扰器** 技能：玩家展示手心 → 握拳，即可触发电磁伪装，将自己"抹去"在摄像头画面里。底层使用 MediaPipe Tasks Vision 做姿态 + 手势识别，配合 Canvas 实时合成背景替换。

## 项目特性

- 🎥 **本地运行**：摄像头画面与 AI 推理全程在浏览器内完成，无任何远程服务
- 👁 **多人识别**：支持 1-4 人同时入画，基于 IOU 的 PersonTracker 做稳定追踪
- ✋ **手势驱动**：手心 → 握拳切换隐身 / 显形，带 5 秒冷却防误触
- 🎨 **军用 HUD**：绿色战术夜视风 + 等宽字体 + REC 闪烁 + 信号格 + 雷达准星
- ⚡ **硬件加速**：Canvas 2D + WebGL，所有渲染 60fps 稳定
- 🛡 **完全离线**：MediaPipe 模型本地加载，断网可用

## 动手指令

| 动作 | 触发效果 |
|---|---|
| 摄像头前展示 **手心**（连续 5+ 帧） | 累加 open-palm 帧数，进入待触发态 |
| 接着 **握拳**（连续 5+ 帧） | 切换 ERC-7 状态：可见 ↔ 隐身 |
| 松开手 | 计数器衰减（每帧 -2） |
| 5 秒冷却 | 防止误触双击 |

## 玩法

1. 打开 [https://your-deployment-url](https://your-deployment-url) （或本地 `npm run dev`）
2. 允许浏览器使用摄像头
3. 1-4 人同时入画
4. 任一人做"手心 → 握拳"手势即可触发 ERC-7 隐身
5. HUD 右上角状态点会变红，表示 ERC-7 激活中

## 技术栈

- **构建**：Vite 5 + TypeScript 5.6（strict）
- **框架**：React 18.3（hooks + function components）
- **状态**：Zustand 5（轻量 store）
- **AI**：MediaPipe Tasks Vision（Pose Landmarker + Hand Landmarker）
- **渲染**：Canvas 2D API（合成 + 背景采样）+ WebGL（vignette 效果）
- **样式**：原生 CSS + OKLCH design tokens（`src/styles/tokens.css`）
- **测试**：Vitest（unit / 13 文件 / 59 测试）+ Playwright（e2e）

## 项目结构

```
src/
  components/
    CameraView.tsx     # 主组件：摄像头 + 渲染循环
    HUD.tsx            # 战术 HUD overlay
    StatusDot.tsx      # ERC-7 激活状态点
    DebugOverlay.tsx   # 调试面板（dev only）
  engines/
    BackgroundManager.ts  # 滚动背景采样（中位数滤波）
    Compositor.ts         # 人形区域 = 缓存背景
    EffectsLayer.ts       # vignette + 白噪
    HandStateAnalyzer.ts  # 手势状态机：NONE / OPEN_PALM / FIST
    PersonTracker.ts      # IOU 多目标追踪
    erc7Tracking.ts       # pose → snapshot → 隐身候选聚合
    handAssignment.ts      # 手到 person 距离匹配
  hooks/
    useCamera.ts          # getUserMedia 生命周期
    usePoseEngine.ts      # Pose Landmarker 加载 + 推理
    useHandEngine.ts      # Hand Landmarker 加载 + 推理
    useRenderLoop.ts      # requestAnimationFrame 循环
  store/
    useGameStore.ts       # Zustand：mode / persons / fps / erc7Active
  styles/
    tokens.css            # OKLCH design tokens（颜色 / 间距 / z-index）
  utils/
    telemetry.ts          # 调试事件总线
  types/
    mp.ts                 # MediaPipe 类型
    index.ts
```

## 开发

```bash
# 安装依赖
npm install

# 启动 dev server（默认 5173）
npm run dev

# 单元测试
npm test --run

# 生产构建
npm run build

# 预览生产构建
npm run preview

# E2E 测试
npx playwright install chromium
npx playwright test
```

## 设计系统

所有视觉令牌集中在 [`src/styles/tokens.css`](src/styles/tokens.css)，使用 OKLCH 色彩空间：

| 类别 | Token | 用途 |
|---|---|---|
| 背景层级 | `--bg-void` `--bg-deep` `--bg-elevated` | 页面 / HUD / 浮层底色 |
| 信号灯 | `--signal-standby` `--signal-armed` `--signal-error` | 绿 / 红 / 黄 三态 |
| 文字 | `--ink-primary` `--ink-secondary` `--ink-dim` | 主 / 次 / 弱 |
| 警示 | `--ink-critical` `--ink-warn` | 红 / 琥珀 |
| 发光 | `--glow-tactical` `--glow-alert` `--glow-warn` | 节制的单层外发光 |
| 间距 | `--space-{1..10}` | 4px 网格 |
| z-index | `--z-{camera,effects,hud,modal,toast,debug}` | 语义化层级 |
| 视口 | `--viewport-min-h: 100dvh` | iOS Safari 兼容 |

修改一处 token，整站联动。

## 浏览器兼容

| 浏览器 | 最低版本 | 备注 |
|---|---|---|
| Chrome / Edge | 119+ | 推荐，getUserMedia + WebGL 完整支持 |
| Safari (macOS) | 17+ | 需启用摄像头权限 |
| Safari (iOS) | 17+ | 需 HTTPS + 主动授权 |
| Firefox | 120+ | 基本可用 |

## 安全与隐私

- **完全本地处理**：摄像头画面、姿态推理、手势识别全程在浏览器内完成，无任何网络上传
- **MediaPipe 模型**：从 `/public/models/` 本地加载，断网可用
- **零后端**：项目无服务器、无数据库、无追踪
- **零数据持久化**：刷新页面即清除所有运行时状态

## License

MIT