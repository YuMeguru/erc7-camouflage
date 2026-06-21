// useRenderLoop — 用 requestAnimationFrame 每帧调用回调
// Sprint 17

import { useEffect, useRef } from 'react';

export type FrameCallback = (timestamp: number) => void;

export function useRenderLoop(callback: FrameCallback): void {
  const rafRef = useRef<number | null>(null);
  // 用 ref 持引用，避免 callback 变化时重启循环
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let alive = true;
    function loop(ts: number) {
      if (!alive) return;
      cbRef.current(ts);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);
}