// DebugOverlay — 按 D 键切换 Debug 模式
// 显示：Pose 骨架关键点、Hand 手部关键点、手势状态标签、距离信息

import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { HAND, POSE } from '../types/mp';
import type { Landmark } from '../types/mp';
import './DebugOverlay.css';

interface DebugData {
  poseLandmarks: Landmark[][];
  handLandmarks: Landmark[][];
  handStates: string[];
  persons: { id: number; state: string; depth?: number }[];
  fps: number;
}

// Pose 关键点连接（骨架线）
const POSE_CONNECTIONS: [number, number][] = [
  [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER],
  [POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW],
  [POSE.LEFT_ELBOW, POSE.LEFT_WRIST],
  [POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW],
  [POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST],
  [POSE.LEFT_SHOULDER, POSE.LEFT_HIP],
  [POSE.RIGHT_SHOULDER, POSE.RIGHT_HIP],
  [POSE.LEFT_HIP, POSE.RIGHT_HIP],
  [POSE.LEFT_HIP, POSE.LEFT_KNEE],
  [POSE.LEFT_KNEE, POSE.LEFT_ANKLE],
  [POSE.RIGHT_HIP, POSE.RIGHT_KNEE],
  [POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE],
  [POSE.NOSE, POSE.LEFT_SHOULDER],
  [POSE.NOSE, POSE.RIGHT_SHOULDER],
];

// Hand 关键点连接
const HAND_CONNECTIONS: [number, number][] = [
  [HAND.WRIST, HAND.THUMB_CMC],
  [HAND.THUMB_CMC, HAND.THUMB_MCP],
  [HAND.THUMB_MCP, HAND.THUMB_IP],
  [HAND.THUMB_IP, HAND.THUMB_TIP],
  [HAND.WRIST, HAND.INDEX_MCP],
  [HAND.INDEX_MCP, HAND.INDEX_PIP],
  [HAND.INDEX_PIP, HAND.INDEX_DIP],
  [HAND.INDEX_DIP, HAND.INDEX_TIP],
  [HAND.WRIST, HAND.PINKY_MCP],
  [HAND.PINKY_MCP, HAND.PINKY_PIP],
  [HAND.PINKY_PIP, HAND.PINKY_DIP],
  [HAND.PINKY_DIP, HAND.PINKY_TIP],
];

export interface DebugOverlayProps {
  debugData: DebugData | null;
}

export function DebugOverlay({ debugData }: DebugOverlayProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback((e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') {
      setVisible((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, [toggle]);

  if (!visible || !debugData) return null;

  const { poseLandmarks, handLandmarks, handStates, persons } = debugData;
  const state = useGameStore.getState();

  return (
    <div className="debug-overlay">
      <div className="debug-header">
        <span className="debug-badge">DEBUG</span>
        <span>FPS: {state.fps.toFixed(1)}</span>
        <span>ERC7: {state.erc7Active ? 'ACTIVE' : 'INACTIVE'}</span>
        <span className="debug-hint">[D] 切换</span>
      </div>

      <div className="debug-panels">
        {/* Persons */}
        <div className="debug-panel">
          <div className="debug-panel-title">PERSONS ({persons.length})</div>
          {persons.map((p) => (
            <div key={p.id} className="debug-row">
              ID:{p.id} [{p.state}]
              {p.depth !== undefined && (
                <span style={{ color: p.depth < 0.3 ? '#00ff41' : p.depth > 0.7 ? '#ff0033' : '#ff9900' }}>
                  {' '}
                  depth:{p.depth.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Pose */}
        <div className="debug-panel">
          <div className="debug-panel-title">POSE ({poseLandmarks.length})</div>
          {poseLandmarks.map((_, i) => (
            <div key={i} className="debug-row">
              Person #{i + 1}: {_.length} pts
            </div>
          ))}
        </div>

        {/* Hands */}
        <div className="debug-panel">
          <div className="debug-panel-title">HANDS ({handLandmarks.length})</div>
          {handStates.map((s, i) => (
            <div key={i} className="debug-row" style={{ color: s === 'FIST' ? '#ff0033' : s === 'OPEN_PALM' ? '#00ff41' : '#666' }}>
              Hand #{i + 1}: {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 在 canvas 上绘制骨架 overlay */
export function drawDebugSkeleton(
  ctx: CanvasRenderingContext2D,
  poseLandmarks: Landmark[][],
  handLandmarks: Landmark[][],
  handStates: string[],
  w: number,
  h: number,
) {
  // Pose 骨架
  ctx.save();
  for (const lms of poseLandmarks) {
    // 关键点
    ctx.fillStyle = '#00ff41';
    for (const lm of lms) {
      if (!lm || !Number.isFinite(lm.x)) continue;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 连线
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.5)';
    ctx.lineWidth = 1.5;
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = lms[a];
      const pb = lms[b];
      if (!pa || !pb || !Number.isFinite(pa.x)) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Hand 骨架
  ctx.save();
  for (const lms of handLandmarks) {
    ctx.fillStyle = '#ffcc00';
    for (const lm of lms) {
      if (!lm || !Number.isFinite(lm.x)) continue;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.6)';
    ctx.lineWidth = 1;
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = lms[a];
      const pb = lms[b];
      if (!pa || !pb || !Number.isFinite(pa.x)) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 手势状态标签
  ctx.save();
  ctx.font = '12px monospace';
  for (let i = 0; i < handLandmarks.length; i++) {
    const lms = handLandmarks[i];
    const st = handStates[i] || 'NONE';
    // 取 wrist 位置
    const wrist = lms[HAND.WRIST];
    if (!wrist || !Number.isFinite(wrist.x)) continue;
    const tx = wrist.x * w;
    const ty = wrist.y * h - 10;
    ctx.fillStyle = st === 'FIST' ? '#ff0033' : st === 'OPEN_PALM' ? '#00ff41' : '#888';
    ctx.fillText(st, tx, ty);
  }
  ctx.restore();
}