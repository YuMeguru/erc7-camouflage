// useHandEngine — 加载 MediaPipe HandLandmarker 并提供 detect 接口
// Sprint 9

import { useCallback, useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver, type HandLandmarkerOptions } from '@mediapipe/tasks-vision';
import type { HandResult } from '../types/mp';
import { telemetry } from '../utils/telemetry';

export interface UseHandEngineOptions {
  wasmBaseUrl?: string;
  modelPath?: string;
  fallbackCpu?: boolean;
  /** 最多检测几只手，默认 4（2 人 × 2 手） */
  numHands?: number;
  delegate?: 'GPU' | 'CPU';
}

export interface UseHandEngineState {
  isLoaded: boolean;
  error: string | null;
  detect: (video: HTMLVideoElement, timestamp: number) => HandResult | null;
  dispose: () => void;
}

export function useHandEngine(options: UseHandEngineOptions = {}): UseHandEngineState {
  const {
    wasmBaseUrl = '/models/',
    modelPath = '/models/hand_landmarker.task',
    fallbackCpu = true,
    numHands = 4,
    delegate = 'GPU',
  } = options;

  const ref = useRef<HandLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(performance.now());

  useEffect(() => {
    let cancelled = false;
    telemetry.modelLoadStart('hand');

    const tryLoad = async (useDelegate: 'GPU' | 'CPU') => {
      const v = await FilesetResolver.forVisionTasks(wasmBaseUrl);
      const opts: HandLandmarkerOptions = {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: useDelegate,
        },
        runningMode: 'VIDEO',
        numHands,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      };
      return HandLandmarker.createFromOptions(v, opts);
    };

    (async () => {
      try {
        const start = startTime.current;
        let landmarker: HandLandmarker;
        try {
          landmarker = await tryLoad(delegate);
        } catch (e) {
          if (fallbackCpu && delegate === 'GPU') {
            telemetry.error('hand GPU fallback to CPU', e);
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
        telemetry.modelLoadEnd('hand');
        telemetry.modelLoadMs('hand', elapsed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        telemetry.error('useHandEngine', e);
      }
    })();

    return () => {
      cancelled = true;
      ref.current?.close();
      ref.current = null;
      setIsLoaded(false);
    };
  }, [wasmBaseUrl, modelPath, fallbackCpu, numHands, delegate]);

  const detect = useCallback((video: HTMLVideoElement, timestamp: number): HandResult | null => {
    const l = ref.current;
    if (!l) return null;
    try {
      const r = l.detectForVideo(video, timestamp);
      // MediaPipe 0.10.18: handedness 是 Category[][]，每只手一个 Category[]（通常只含 1 个）
      const handedness: ('Left' | 'Right')[] = (r.handedness ?? []).map(
        (categories) => (categories[0]?.categoryName as 'Left' | 'Right') ?? 'Right',
      );
      return {
        landmarks: r.landmarks as HandResult['landmarks'],
        handedness,
        handWorldLandmarks: r.worldLandmarks as HandResult['handWorldLandmarks'],
      };
    } catch (e) {
      telemetry.error('handDetect', e);
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
