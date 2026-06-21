import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, getGameState } from '../../src/store/useGameStore';

describe('useGameStore', () => {
  beforeEach(() => {
    getGameState().resetPersons();
    useGameStore.setState({
      mode: 'INIT',
      errorMessage: null,
      erc7Active: false,
      backgroundReady: false,
      frameCount: 0,
      fps: 0,
    });
  });

  it('initial state', () => {
    const s = getGameState();
    expect(s.mode).toBe('INIT');
    expect(s.persons.size).toBe(0);
    expect(s.erc7Active).toBe(false);
  });

  it('setMode transitions', () => {
    getGameState().setMode('READY');
    expect(getGameState().mode).toBe('READY');
    getGameState().setMode('ERROR', 'camera denied');
    expect(getGameState().mode).toBe('ERROR');
    expect(getGameState().errorMessage).toBe('camera denied');
  });

  it('setPersonState adds a new person', () => {
    getGameState().setPersonState(1, 'INVISIBLE');
    const p = getGameState().persons.get(1);
    expect(p?.state).toBe('INVISIBLE');
    expect(p?.openFrames).toBe(0);
  });

  it('updatePersonDebounce accumulates frames and clamps to ≥0', () => {
    const r1 = getGameState().updatePersonDebounce(1, { open: 1, fist: 0 }, 'OPEN_PALM');
    expect(r1?.openFrames).toBe(1);
    const r2 = getGameState().updatePersonDebounce(1, { open: 1, fist: 1 }, 'FIST');
    expect(r2?.openFrames).toBe(2);
    expect(r2?.fistFrames).toBe(1);
    expect(r2?.lastHandState).toBe('FIST');
    // 下界保护：减一不能变负
    const r3 = getGameState().updatePersonDebounce(1, { open: -10, fist: -10 }, 'NONE');
    expect(r3?.openFrames).toBe(0);
    expect(r3?.fistFrames).toBe(0);
  });

  it('setErc7Active toggles HUD state', () => {
    expect(getGameState().erc7Active).toBe(false);
    getGameState().setErc7Active(true);
    expect(getGameState().erc7Active).toBe(true);
  });

  it('tickFrame and setFps update telemetry counters', () => {
    getGameStore_tick();
    getGameStore_tick();
    getGameStore_tick();
    expect(getGameState().frameCount).toBe(3);
    getGameState().setFps(24.5);
    expect(getGameState().fps).toBe(24.5);
  });
});

function getGameStore_tick() {
  getGameState().tickFrame();
}
