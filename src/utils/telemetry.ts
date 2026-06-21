// telemetry — 集中管理所有埋点（Sprint 20）
// 满足 SPEC §5 可观测性埋点清单

const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event';
const DEBUG_SESSION_ID = 'vigil-stealth-tuning';

export const telemetry = {
  modelLoadStart: (model: string) => {
    // eslint-disable-next-line no-console
    console.time(`[telemetry] model-load:${model}`);
  },
  modelLoadEnd: (model: string) => {
    // eslint-disable-next-line no-console
    console.timeEnd(`[telemetry] model-load:${model}`);
  },
  modelLoadMs: (model: string, ms: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] model-load:${model}:${ms.toFixed(0)}ms`);
  },
  frameLatency: (ms: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] frame-latency:${ms.toFixed(1)}ms`);
  },
  stateTransition: (personId: number, from: string, to: string) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] state-transition:${personId}:${from}->${to}`);
  },
  fpsTick: (fps: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] fps:${fps.toFixed(1)}`);
  },
  fpsSummary: (fps: number, n: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] fps-avg[${n}]:${fps.toFixed(1)}`);
  },
  error: (scope: string, err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`[telemetry] error:${scope}`, err);
  },
  erc7Triggered: (personId: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] erc7-triggered:${personId}`);
  },
  erc7Released: (personId: number) => {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] erc7-released:${personId}`);
  },
  debugEvent: (
    hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E',
    location: string,
    msg: string,
    data: Record<string, unknown>,
    runId = 'pre-fix',
  ) => {
    if (typeof fetch !== 'function') return;
    fetch(DEBUG_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: DEBUG_SESSION_ID,
        runId,
        hypothesisId,
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    }).catch(() => undefined);
  },
};
