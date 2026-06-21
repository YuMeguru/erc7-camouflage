// 游戏全局状态（Zustand）
// Sprint 10

import { create } from 'zustand';
import { telemetry } from '../utils/telemetry';

/** 全局模式：INIT 未连摄像头 → READY 等待/运行 → ERROR 错误 */
export type GlobalMode = 'INIT' | 'READY' | 'ERROR';

/** 单人状态机：
 *  IDLE       - 默认
 *  HAND_OPEN  - 检测到手心（连续帧数累加中）
 *  INVISIBLE  - ERC-7 激活中（持续握拳）
 *  VISIBLE    - ERC-7 解除，回到正常
 */
export type PersonState = 'IDLE' | 'HAND_OPEN' | 'INVISIBLE' | 'VISIBLE';

export interface PersonInfo {
  id: number;
  state: PersonState;
  /** 连续检测到手心 OPEN_PALM 的帧数（达到阈值 PALM_FRAMES 才允许触发） */
  openFrames: number;
  /** 连续检测到 FIST 的帧数（达到阈值 FIST_FRAMES 才允许触发） */
  fistFrames: number;
  /** 最近一帧分析出的手状态（调试用） */
  lastHandState?: 'NONE' | 'OPEN_PALM' | 'FIST';
}

export interface GameStoreState {
  mode: GlobalMode;
  errorMessage: string | null;
  persons: Map<number, PersonInfo>;
  /** 当前是否有人 ERC-7 激活中（HUD 状态点用） */
  erc7Active: boolean;
  /** 背景采样是否就绪 */
  backgroundReady: boolean;
  /** 当前已渲染的帧数（自增） */
  frameCount: number;
  /** 最近 1 秒的瞬时 FPS */
  fps: number;
}

export interface GameStoreActions {
  setMode: (mode: GlobalMode, errorMessage?: string | null) => void;
  setPersonState: (id: number, state: PersonState) => void;
  /** 增量更新帧计数（裁剪到 ≥0）；返回最新 PersonInfo（如果存在） */
  updatePersonDebounce: (id: number, delta: { open: number; fist: number }, lastHandState?: PersonInfo['lastHandState']) => PersonInfo | null;
  setErc7Active: (active: boolean) => void;
  setBackgroundReady: (ready: boolean) => void;
  tickFrame: () => void;
  setFps: (fps: number) => void;
  /** 调试用：重置全部 persons */
  resetPersons: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

export const useGameStore = create<GameStore>((set) => ({
  mode: 'INIT',
  errorMessage: null,
  persons: new Map(),
  erc7Active: false,
  backgroundReady: false,
  frameCount: 0,
  fps: 0,

  setMode: (mode, errorMessage = null) => {
    if (mode === 'ERROR') telemetry.error(`mode→${mode}`, errorMessage);
    set({ mode, errorMessage });
  },

  setPersonState: (id, state) => {
    set((s) => {
      const next = new Map(s.persons);
      const p = next.get(id) ?? {
        id,
        state: 'IDLE' as PersonState,
        openFrames: 0,
        fistFrames: 0,
      };
      const prevState = p.state;
      next.set(id, { ...p, state });
      if (prevState !== state) {
        telemetry.stateTransition(id, prevState, state);
      }
      return { persons: next };
    });
  },

  updatePersonDebounce: (id, delta, lastHandState) => {
    let result: PersonInfo | null = null;
    set((s) => {
      const next = new Map(s.persons);
      const p = next.get(id) ?? {
        id,
        state: 'IDLE' as PersonState,
        openFrames: 0,
        fistFrames: 0,
      };
      const updated: PersonInfo = {
        ...p,
        openFrames: Math.max(0, p.openFrames + delta.open),
        fistFrames: Math.max(0, p.fistFrames + delta.fist),
        lastHandState: lastHandState ?? p.lastHandState,
      };
      next.set(id, updated);
      result = updated;
      return { persons: next };
    });
    return result;
  },

  setErc7Active: (erc7Active) => set({ erc7Active }),
  setBackgroundReady: (backgroundReady) => set({ backgroundReady }),
  tickFrame: () => set((s) => ({ frameCount: s.frameCount + 1 })),
  setFps: (fps) => set({ fps }),
  resetPersons: () => set({ persons: new Map() }),
}));

// 暴露给非 React 环境（如测试、worker）使用的 getter
export const getGameState = () => useGameStore.getState();
