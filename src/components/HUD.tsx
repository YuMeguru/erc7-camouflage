// HUD — 绿色军用夜视风 HUD 覆盖层
// Sprint 16+ 设计重制：
// - BEM 类名统一：.hud / .hud-corner--{tl,tr,bl,br} / .hud-status__dot--{armed,error}
// - 时间戳改用 rAF 节流（每秒 setState 一次），避免每秒 re-render
// - a11y：HUD overlay 区域标 aria-hidden，状态点 + 错误用 role="status"/"alert"

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { StatusDot } from './StatusDot';
import './HUD.css';

function fmtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function HUD() {
  const mode = useGameStore((s) => s.mode);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const fps = useGameStore((s) => s.fps);
  const [seconds, setSeconds] = useState(0);

  // rAF 节流：每秒只在 second 变化时 setState，避免每秒强制 re-render
  useEffect(() => {
    const start = Date.now();
    let rafId = 0;
    let lastSecond = -1;
    function tick() {
      const sec = Math.floor((Date.now() - start) / 1000);
      if (sec !== lastSecond) {
        lastSecond = sec;
        setSeconds(sec);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="hud" data-testid="hud" aria-hidden="true">
      <div className="hud-corner hud-corner--tl" data-testid="hud-top">
        <div className="hud-line">
          <span className="hud-line__label">[VIGIL-07]</span>
          <span className="hud-line__value">ERC-7 / STANDBY</span>
        </div>
        <div className="hud-signal" data-testid="signal-bar">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`hud-signal__bar${i >= 7 ? ' hud-signal__bar--dim' : ''}`}
              data-testid={`signal-cell-${i}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="hud-corner hud-corner--tr">
        <StatusDot />
      </div>

      <div className="hud-crosshair" aria-hidden="true">
        <span className="cross-h" />
        <span className="cross-v" />
      </div>

      <div className="hud-corner hud-corner--bl" aria-hidden="true">
        <span className="hud-rec">
          <span className="hud-rec__dot" />
          <span className="hud-line__value hud-line__value--critical">REC</span>
        </span>
      </div>

      <div className="hud-corner hud-corner--br" aria-hidden="true">
        <span className="hud-fps">{fps > 0 ? `${fps.toFixed(0)} FPS` : '— FPS'}</span>
        <span className="hud-timestamp">{fmtTimestamp(seconds)}</span>
      </div>

      {mode === 'ERROR' && (
        <div
          className="hud-error"
          data-testid="error-overlay"
          role="alert"
          aria-live="assertive"
        >
          <div className="hud-line__value hud-line__value--critical">系统错误</div>
          <div style={{ marginTop: 'var(--space-2)' }}>{errorMessage ?? '未知错误'}</div>
          <div style={{ marginTop: 'var(--space-3)', color: 'var(--ink-dim)', fontSize: 'var(--text-xs)' }}>
            请刷新页面或检查摄像头权限
          </div>
        </div>
      )}
    </div>
  );
}