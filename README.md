# VIGIL-07 · ERC-7 Camouflage Simulator

浏览器里把 R6 Siege 干员 Vigil 的 ERC-7 影像干扰器还原出来。摄像头采集画面，本地跑 AI 识别手势，握拳就能"隐身"。

## 当前状态：半成品

写到这里得先交代一句，别被 README 骗了。

- 头部识别经常缺。Pose Landmarker 对低头、侧脸、戴帽场景很挑，肩膀以上的关键点经常漏掉。
- 人物追踪在两个人交叠或快速换位时不稳定，IOU 一掉人就跟丢了，得等下一帧重新分配 ID。
- 手势判定的阈值是拍脑袋定的。手背对着摄像头、灯光偏冷偏暖都会让它误判，握拳半秒也容易触发。

代码跑得起来，本地 demo 凑合能玩。但拿给别人体验大概率会出状况。

## 玩法

打开页面，浏览器要摄像头权限。1-4 个人同时入画，任一人做"摊手 → 握拳"动作就会切换这个人的隐身状态。

HUD 右上角的点会从绿变红，绿是待机，红是 ERC-7 激活中。

5 秒冷却是写死的，防误触双击卡在隐身态出不来。

## 技术栈

- React 18 + TypeScript（strict 模式）
- Vite 5 打包
- Zustand 5 管理状态
- MediaPipe Tasks Vision（Pose + Hand Landmarker，模型放 `public/models/` 本地加载，断网也能跑）
- Canvas 2D 做背景采样和人像合成，WebGL 做 vignette 和白噪
- Vitest（13 个文件 / 59 个测试）+ Playwright e2e

## 项目结构

```
src/
  components/
    CameraView.tsx     主组件：摄像头 + 渲染循环
    HUD.tsx            战术 HUD overlay
    StatusDot.tsx      ERC-7 激活状态点
    DebugOverlay.tsx   调试面板，dev only
  engines/
    BackgroundManager.ts  滚动背景采样，中位数滤波
    Compositor.ts         把人像区域替换成缓存背景
    EffectsLayer.ts       vignette + 白噪
    HandStateAnalyzer.ts  手势状态机：NONE / OPEN_PALM / FIST
    PersonTracker.ts      IOU 多目标追踪
    erc7Tracking.ts       pose → snapshot → 隐身候选聚合
    handAssignment.ts     手到 person 距离匹配
  hooks/
    useCamera.ts          getUserMedia 生命周期
    usePoseEngine.ts      Pose Landmarker 加载 + 推理
    useHandEngine.ts      Hand Landmarker 加载 + 推理
    useRenderLoop.ts      requestAnimationFrame 循环
  store/
    useGameStore.ts       Zustand：mode / persons / fps / erc7Active
  styles/
    tokens.css            OKLCH design tokens
  utils/
    telemetry.ts          调试事件总线
  types/
    mp.ts                 MediaPipe 类型
    index.ts
```

## 开发

```bash
npm install
npm run dev       # 默认 http://localhost:5173
npm test --run    # 单元测试
npm run build     # 生产构建
npm run preview
npx playwright install chromium
npx playwright test
```

## 设计系统

颜色、间距、字号、z-index 集中在 [`src/styles/tokens.css`](src/styles/tokens.css)，全部 OKLCH。改一处 token 整站联动，不用满世界翻 hex 值。

## 浏览器兼容

Chrome / Edge 119+ 跑得最稳。Safari macOS 和 iOS 17+ 能用，但 iOS 必须 HTTPS。Firefox 120+ 基本能跑，偶发掉帧。

## 隐私

摄像头画面、AI 推理、模型加载全在浏览器里。没有后端，没有数据库，没有埋点。刷新页面就清空。

## License

MIT