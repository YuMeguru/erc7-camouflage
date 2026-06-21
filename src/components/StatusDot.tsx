// StatusDot — HUD 右上角状态点，反映 ERC-7 激活状态
// 绿色 = 系统就绪；红色 = ERC-7 激活中（armed）
// Sprint 16

import { useGameStore } from '../store/useGameStore';

export function StatusDot() {
  const armed = useGameStore((s) => s.erc7Active);
  return (
    <div className="hud-status" data-testid="status-dot">
      <span
        className={`hud-status__dot${armed ? ' hud-status__dot--armed' : ''}`}
        aria-hidden="true"
      />
      <span className="hud-line__value">ERC-7</span>
    </div>
  );
}