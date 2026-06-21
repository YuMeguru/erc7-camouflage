// CameraView — 主组件：摄像头 + MediaPipe + 合成 + HUD
// Sprint 17

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { usePoseEngine } from '../hooks/usePoseEngine';
import { useHandEngine } from '../hooks/useHandEngine';
import { useRenderLoop } from '../hooks/useRenderLoop';
import { useGameStore } from '../store/useGameStore';
import { PersonTracker } from '../engines/PersonTracker';
import { analyzeHandState, type HandState } from '../engines/HandStateAnalyzer';
import { assignHandToTrackedPerson } from '../engines/handAssignment';
import { BackgroundManager } from '../engines/BackgroundManager';
import { Compositor } from '../engines/Compositor';
import { buildHandAssignmentCandidates, collectInvisibleSubjects, matchPoseSnapshots } from '../engines/erc7Tracking';
import { EffectsLayer } from '../engines/EffectsLayer';
import { HUD } from './HUD';
import { landmarkBbox, landmarkCenter } from '../types/mp';
import { telemetry } from '../utils/telemetry';
import './CameraView.css';

const FIST_FRAMES = 5;
/** 非目标手势时的衰减系数（每帧减少的帧数） */
const DECAY_PER_FRAME = 2;
/** ASSIGN 手到人最大距离（像素） */
const ASSIGN_MAX_DIST = 220;

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const outputRef = useRef<HTMLCanvasElement | null>(null);

  const { isReady: camOk, error: camError, videoRef: camVideoRef } = useCamera();
  const { isLoaded: poseOk, error: poseError, detect: detectPose } = usePoseEngine({ numPoses: 4 });
  const { isLoaded: handOk, error: handError, detect: detectHand } = useHandEngine({ numHands: 4 });

  // 让 useCamera 的 ref 指向本地 videoRef（因为 hook 内部用了独立 ref）
  useEffect(() => {
    if (videoRef.current && camVideoRef.current !== videoRef.current) {
      (camVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = videoRef.current;
    }
  }, [camVideoRef, camOk]);

  const tracker = useMemo(() => new PersonTracker({ ttl: 90 }), []);
  const compositor = useMemo(() => new Compositor(), []);
  const effects = useMemo(() => new EffectsLayer({ vignette: true, vignetteIntensity: 0.35 }), []);
  const bgRef = useRef<BackgroundManager | null>(null);
  const frameRef = useRef(0);
  const fpsBuffer = useRef<number[]>([]);
  const lastTs = useRef(0);
  /** 每个人当前的 glitch 剩余帧数（进/出隐身时特效过渡用） */
  const glitchFramesRef = useRef<Map<number, number>>(new Map());
  /** 握拳触发冷却帧数（5 秒防双击） */
  const cooldownRef = useRef<Map<number, number>>(new Map());

  // 绑定到 store
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const setBgReady = useGameStore((s) => s.setBackgroundReady);
  const setErc7 = useGameStore((s) => s.setErc7Active);
  const updDeb = useGameStore((s) => s.updatePersonDebounce);
  const setPerson = useGameStore((s) => s.setPersonState);
  const tickFrame = useGameStore((s) => s.tickFrame);
  const setFps = useGameStore((s) => s.setFps);

  // 视频 ready 后初始化 BackgroundManager
  useEffect(() => {
    if (!camOk) return;
    const v = videoRef.current;
    if (!v) return;
    function init() {
      const w = v?.videoWidth || 640;
      const h = v?.videoHeight || 480;
      if (w > 0 && h > 0) {
        bgRef.current = new BackgroundManager(w, h);
      }
    }
    if (v.videoWidth > 0) {
      init();
    } else {
      v.addEventListener('loadedmetadata', init, { once: true });
    }
  }, [camOk]);

  // 错误状态
  useEffect(() => {
    if (camError) setMode('ERROR', `摄像头：${camError}`);
    else if (poseError) setMode('ERROR', `Pose 模型：${poseError}`);
    else if (handError) setMode('ERROR', `Hand 模型：${handError}`);
  }, [camError, poseError, handError, setMode]);

  // 摄像头+模型就绪后立即进入 READY 模式，不再倒计时
  useEffect(() => {
    if (camOk && poseOk && handOk && mode === 'INIT') {
      setBgReady(true);
      setMode('READY');
    }
  }, [camOk, poseOk, handOk, mode, setMode, setBgReady]);

  const onFrame = useCallback(
    (ts: number) => {
      const v = videoRef.current;
      const src = sourceRef.current;
      const out = outputRef.current;
      const bg = bgRef.current;

      // 未就绪直接返回（显示黑屏，无花屏）
      if (!v || !src || !out || !bg) return;
      if (v.readyState < 2 || v.videoWidth === 0) return;
      if (!poseOk || !handOk) return;
      if (useGameStore.getState().mode === 'ERROR') return;

      const w = v.videoWidth;
      const h = v.videoHeight;
      src.width = w;
      src.height = h;
      const sctx = src.getContext('2d');
      if (!sctx) return;
      sctx.drawImage(v, 0, 0, w, h);
      const img = sctx.getImageData(0, 0, w, h);

      // Pose 检测 → bbox + hull
      const pose = detectPose(v, ts);
      const poseBboxes: { x: number; y: number; w: number; h: number }[] = [];
      if (pose) {
        for (const lms of pose.landmarks) {
          const bb = landmarkBbox(lms, w, h);
          if (bb) poseBboxes.push(bb);
        }
      }

      // 更新 tracker
      const frame = frameRef.current++;
      const tracked = tracker.update(poseBboxes, frame);
      const snapshots = matchPoseSnapshots(pose, tracked, w, h);
      const handAssignmentCandidates = buildHandAssignmentCandidates(tracked, snapshots);
      // #region debug-point A:pose-snapshots
      if (frame % 15 === 0) {
        telemetry.debugEvent('A', 'CameraView:onFrame:pose', 'pose snapshots sampled', {
          frame,
          poseCount: pose?.landmarks.length ?? 0,
          trackedCount: tracked.length,
          snapshotCount: snapshots.length,
          snapshotDepths: snapshots.map((snapshot) => Number(snapshot.depth.toFixed(3))),
          hullSizes: snapshots.map((snapshot) => snapshot.hull.length),
        });
      }
      // #endregion
      tickFrame();

      // Hand 检测 → 指派给 person
      const hand = detectHand(v, ts);
      if (hand) {
        for (const lms of hand.landmarks) {
          const st: HandState = analyzeHandState(lms);
          const c = landmarkCenter(lms, w, h);
          if (!c) continue;
          const pid = assignHandToTrackedPerson(c, handAssignmentCandidates, ASSIGN_MAX_DIST);
          // #region debug-point C:hand-assignment
          telemetry.debugEvent('C', 'CameraView:onFrame:hand', 'hand assignment evaluated', {
            frame,
            state: st,
            handCenter: { x: Number(c.x.toFixed(1)), y: Number(c.y.toFixed(1)) },
            assignedPersonId: pid,
            candidates: handAssignmentCandidates.map((candidate) => ({
              id: candidate.id,
              bbox: { x: Number(candidate.bbox.x.toFixed(1)), y: Number(candidate.bbox.y.toFixed(1)), w: Number(candidate.bbox.w.toFixed(1)), h: Number(candidate.bbox.h.toFixed(1)) },
              hullSize: candidate.hull.length,
            })),
          });
          // #endregion
          if (pid === null) continue;

          // Sprint 22：进出对称（手心→握拳），带衰减
          // NONE 时双方都衰减 DECAY_PER_FRAME
          const decay = st === 'NONE' ? DECAY_PER_FRAME : 0;
          const updated = updDeb(
            pid,
            st === 'OPEN_PALM'
              ? { open: 1, fist: -decay }
              : st === 'FIST'
                ? { open: -decay, fist: 1 }
                : { open: -decay, fist: -decay },
            st,
          );
          if (!updated) continue;

          // Sprint 23：握拳触发 + 5 秒冷却，防双击
          const fistReached = updated.fistFrames >= FIST_FRAMES;
          const cd = cooldownRef.current.get(pid) ?? 0;

          if (fistReached && cd <= 0) {
            const newState = updated.state === 'INVISIBLE' ? 'VISIBLE' : 'INVISIBLE';
            setPerson(pid, newState);

            // 按当前 FPS 算 5 秒冷却
            const avgFps =
              fpsBuffer.current.length > 0
                ? fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length
                : 30;
            cooldownRef.current.set(pid, Math.round(5 * avgFps));
            glitchFramesRef.current.set(pid, 30);

            // 重置帧计数器，避免下一帧重复触发
            updDeb(pid, { open: -updated.openFrames, fist: -updated.fistFrames });

            telemetry.debugEvent('E', 'gesture:toggle', 'fist toggle with cooldown', {
              pid,
              newState,
              cooldownFrames: cooldownRef.current.get(pid),
            });
          } else if (cd > 0) {
            // 冷却中，每帧递减
            cooldownRef.current.set(pid, cd - 1);
          }
        }
      }

      const persons = useGameStore.getState().persons;
      const { anyInvisible, erc7Intensity, invisibleBboxes, invisibleHulls } = collectInvisibleSubjects(persons, tracked, snapshots, w, h);
      // #region debug-point B:occlusion-envelope
      if (frame % 15 === 0) {
        telemetry.debugEvent('B', 'CameraView:onFrame:occlusion', 'occlusion envelope sampled', {
          frame,
          anyInvisible,
          invisibleCount: invisibleBboxes.length,
          invisibleBoxes: invisibleBboxes.map((bbox) => ({
            x: Number(bbox.x.toFixed(1)),
            y: Number(bbox.y.toFixed(1)),
            w: Number(bbox.w.toFixed(1)),
            h: Number(bbox.h.toFixed(1)),
          })),
          hullSizes: invisibleHulls.map((hull) => hull.length),
        });
      }
      // #endregion
      setErc7(anyInvisible);

      // 更新背景（person 区域不参与）— 用 tracked 的原始 bbox（不含 margin，避免背景空洞过大）
      const personBboxesForBg = tracked.map((t) => t.bbox);
      bg.addFrame(img.data, personBboxesForBg);

      // 合成到 output（传 hull 列表给 Compositor + 传入 glitch intensity）
      const maxGlitchRemaining = Math.max(0, ...Array.from(glitchFramesRef.current.values()));
      const glitchIntensity = maxGlitchRemaining > 0 ? Math.min(1, maxGlitchRemaining / 30) : 0;
      compositor.composite({
        sourceCanvas: src,
        outputCanvas: out,
        background: bg.getBackground(),
        personBboxes: invisibleBboxes,
        personHulls: invisibleHulls,
        intensity: erc7Intensity,
        glitchIntensity,
        frame,
      });

      // 衰减 glitch 计数器
      for (const [pid, remaining] of glitchFramesRef.current) {
        if (remaining <= 1) glitchFramesRef.current.delete(pid);
        else glitchFramesRef.current.set(pid, remaining - 1);
      }

      // 叠加 vignette 效果
      const octx = out.getContext('2d');
      if (octx) {
        let maxRatio = 0;
        for (const p of tracked) {
          const r = (p.bbox.w * p.bbox.h) / (w * h);
          if (r > maxRatio) maxRatio = r;
        }
        // intensity 映射：开方抬高中近距离，远时短、中近时饱满
        // maxRatio 0.05(远)→0.38, 0.15(中)→0.77, 0.35(近)→1.0
        const rawIntensity = Math.min(1, Math.sqrt(maxRatio * 4));
        const intensity = rawIntensity;
        // #region debug-point D:effect-intensity
        if (frame % 15 === 0) {
          telemetry.debugEvent('D', 'CameraView:onFrame:effects', 'effects intensity sampled', {
            frame,
            erc7Intensity: Number(erc7Intensity.toFixed(3)),
            overlayIntensity: Number(intensity.toFixed(3)),
            maxRatio: Number(maxRatio.toFixed(3)),
            invisibleCount: invisibleBboxes.length,
          });
        }
        // #endregion
        // 白噪条：只有有人开技能（INVISIBLE）才显示
        effects.draw(octx, w, h, intensity, frame, anyInvisible);
      }

      // FPS 计算（30 帧滑动平均 + 每 30 帧 summary log）
      if (lastTs.current > 0) {
        const dt = ts - lastTs.current;
        if (dt > 0) {
          fpsBuffer.current.push(1000 / dt);
          if (fpsBuffer.current.length > 30) fpsBuffer.current.shift();
          if (frame % 30 === 0) {
            const avg = fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length;
            setFps(avg);
            telemetry.fpsSummary(avg, fpsBuffer.current.length);
          }
        }
      }
      lastTs.current = ts;
    },
    [poseOk, handOk, detectPose, detectHand, updDeb, setPerson, setErc7, tickFrame, setFps, tracker, compositor, effects],
  );

  useRenderLoop(onFrame);

  return (
    <div className="camera-view" data-testid="camera-view">
      <video
        ref={videoRef}
        className="camera-view__video"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />
      <canvas
        ref={sourceRef}
        className="camera-view__canvas camera-view__canvas--source"
        aria-hidden="true"
      />
      <canvas
        ref={outputRef}
        className="camera-view__canvas camera-view__canvas--output"
        data-testid="output-canvas"
        aria-hidden="true"
      />
      <HUD />
    </div>
  );
}