# ERC-7 Camouflage Simulator

A half-done clone of Vigil's ERC-7 device from Rainbow Six Siege. Vibe coded.

[中文版本 / Chinese](./README.zh-CN.md)

## Status: half-finished

I should warn you before you try this. The README is not going to tell you what's broken.

- Head pose drops constantly. Pose Landmarker hates tilted heads, profile shots, and hats. Keypoints above the shoulders go missing more than I'd like.
- Person tracking falls apart when two people cross paths or swap positions quickly. The IOU drops and IDs need reassignment on the next frame.
- Gesture thresholds were picked by feel. Back-of-hand, weird lighting, partial fist. All of these will trigger it.

The code runs. The local demo is okay for a few minutes. Hand it to someone else and you'll see the cracks.

## How to play

Open the page, allow camera access. Anyone who does the open palm → fist gesture switches that person's cloaking state. The dot in the top right of the HUD goes from green (standby) to red (ERC-7 active).

The 5-second cooldown is hardcoded so a fast double-fist can't lock you in.

## Stack

- React 18, TypeScript in strict mode
- Vite 5 for the build
- Zustand 5 for state
- MediaPipe Tasks Vision, Pose and Hand Landmarkers. Models live in `public/models/` and load locally, so the app works offline.
- Canvas 2D for background sampling and person compositing. WebGL for vignette and grain.
- Vitest (13 files, 59 tests) plus Playwright for end-to-end.

## Layout

```
src/
  components/
    CameraView.tsx     main component, camera + render loop
    HUD.tsx            tactical HUD overlay
    StatusDot.tsx      ERC-7 active state dot
    DebugOverlay.tsx   debug panel, dev only
  engines/
    BackgroundManager.ts  rolling background sampling, median filter
    Compositor.ts         replaces person region with cached background
    EffectsLayer.ts       vignette + grain
    HandStateAnalyzer.ts  gesture state machine: NONE / OPEN_PALM / FIST
    PersonTracker.ts      IOU multi-target tracker
    erc7Tracking.ts       pose to snapshot to cloaking candidate aggregation
    handAssignment.ts     hand to person distance matching
  hooks/
    useCamera.ts          getUserMedia lifecycle
    usePoseEngine.ts      Pose Landmarker load + inference
    useHandEngine.ts      Hand Landmarker load + inference
    useRenderLoop.ts      requestAnimationFrame loop
  store/
    useGameStore.ts       Zustand: mode / persons / fps / erc7Active
  styles/
    tokens.css            OKLCH design tokens
  utils/
    telemetry.ts          debug event bus
  types/
    mp.ts                 MediaPipe types
    index.ts
```

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm test --run    # unit tests
npm run build     # production build
npm run preview
npx playwright install chromium
npx playwright test
```

## Design tokens

Colors, spacing, font sizes, and z-index live in [`src/styles/tokens.css`](src/styles/tokens.css), all in OKLCH. Change one token and the whole site follows. No more hunting through hex values.

## Browser support

Chrome and Edge 119+ run the smoothest. Safari on macOS and iOS 17+ works, but iOS needs HTTPS. Firefox 120+ mostly works, with occasional frame drops.

## Privacy

Camera frames, AI inference, and model loading all happen in the browser. There's no server, no analytics. Refresh the page and the state is gone.

## License

MIT