// useCamera — 调起 getUserMedia 摄像头，绑定到 video element
// Sprint 7

import { useEffect, useRef, useState } from 'react';
import { telemetry } from '../utils/telemetry';

export interface UseCameraOptions {
  /** 自定义视频宽度（默认 640） */
  width?: number;
  /** 自定义视频高度（默认 480） */
  height?: number;
  /** 默认 'user'（前置摄像头） */
  facingMode?: 'user' | 'environment';
  /** 是否请求音频（默认 false） */
  audio?: boolean;
}

export interface UseCameraState {
  stream: MediaStream | null;
  error: string | null;
  isReady: boolean;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraState {
  const {
    width = 640,
    height = 480,
    facingMode = 'user',
    audio = false,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let activeStream: MediaStream | null = null;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('mediaDevices API 不可用（需要 HTTPS 或 localhost）');
        }
        const constraints: MediaStreamConstraints = {
          video: { width, height, facingMode },
          audio,
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = s;
        setStream(s);
        setIsReady(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsReady(false);
        telemetry.error('useCamera', err);
      }
    })();

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      setIsReady(false);
    };
  }, [width, height, facingMode, audio]);

  // 绑定 stream 到 video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.play().catch((err) => {
      telemetry.error('video.play', err);
    });
  }, [stream]);

  return { stream, error, isReady, videoRef };
}
