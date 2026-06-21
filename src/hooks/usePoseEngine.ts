// usePoseEngine — 加载 MediaPipe PoseLandmarker 并提供 detect 接口
// Sprint 8

import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver, type PoseLandmarkerOptions } from '@mediapipe/tasks-vision';
import type { PoseResult } from '../types/mp';
import { telemetry } from '../utils/telemetry';

export interface UsePoseEngineOptions {
  /** wasm 资源目录（含 vision_wasm_internal.js/.wasm），默认 '/models/' */
  wasmBaseUrl?: string;
  /** 模型路径，默认 '/models/pose_landmarker.task' */
  modelPath?: string;
  /** GPU 失败时降级到 CPU，默认 true */
  fallbackCpu?: boolean;
  /** 最大检测人数，默认 4（v1 需要 2 人入画） */
  numPoses?: number;
  /** 推理委托：'GPU' | 'CPU'，默认 'GPU' */
  delegate?: 'GPU' | 'CPU';
}

export interface UsePoseEngineState {
  isLoaded: boolean;
  error: string | null;
  /** 在指定视频帧上做检测（传入 video 元素和 RAF 时间戳） */
  detect: (video: HTMLVideoElement, timestamp: number) => PoseResult | null;
  /** 释放 landmarker 资源 */
  dispose: () => void;
}

export function usePoseEngine(options: UsePoseEngineOptions = {}): UsePoseEngineState {
  const {
    wasmBaseUrl = '/models/',
    modelPath = '/models/pose_landmarker.task',
    fallbackCpu = true,
    numPoses = 4,
    delegate = 'GPU',
  } = options;

  const ref = useRef<PoseLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(performance.now());

  useEffect(() => {
    let cancelled = false;
    telemetry.modelLoadStart('pose');

    const tryLoad = async (useDelegate: 'GPU' | 'CPU') => {
      const v = await FilesetResolver.forVisionTasks(wasmBaseUrl);
      const opts: PoseLandmarkerOptions = {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: useDelegate,
        },
        runningMode: 'VIDEO',
        numPoses,
        // 修复：降低检测阈值，让部分身体部位也能被检测到
        minPoseDetectionConfidence: 0.25,
        minPosePresenceConfidence: 0.25,
        minTrackingConfidence: 0.25,
      };
      return PoseLandmarker.createFromOptions(v, opts);
    };

    (async () => {
      try {
        const start = startTime.current;
        let landmarker: PoseLandmarker;
        try {
          landmarker = await tryLoad(delegate);
        } catch (e) {
          if (fallbackCpu && delegate === 'GPU') {
            telemetry.error('pose GPU fallback to CPU', e);
            landmarker = await tryLoad('CPU');
          } else {
            throw e;
          }
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        ref.current = landmarker;
        setIsLoaded(true);
        const elapsed = performance.now() - start;
        telemetry.modelLoadEnd('pose');
        telemetry.modelLoadMs('pose', elapsed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        telemetry.error('usePoseEngine', e);
      }
    })();

    return () => {
      cancelled = true;
      ref.current?.close();
      ref.current = null;
      setIsLoaded(false);
    };
  }, [wasmBaseUrl, modelPath, fallbackCpu, numPoses, delegate]);

  const detect = useCallback((video: HTMLVideoElement, timestamp: number): PoseResult | null => {
    const l = ref.current;
    if (!l) return null;
    try {
      const r = l.detectForVideo(video, timestamp);
      return {
        landmarks: r.landmarks as PoseResult['landmarks'],
        worldLandmarks: r.worldLandmarks as PoseResult['worldLandmarks'],
      };
    } catch (e) {
      telemetry.error('poseDetect', e);
      return null;
    }
  }, []);

  const dispose = useCallback(() => {
    ref.current?.close();
    ref.current = null;
    setIsLoaded(false);
  }, []);

  return { isLoaded, error, detect, dispose };
}
