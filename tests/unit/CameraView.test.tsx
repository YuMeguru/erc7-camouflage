// CameraView 在 jsdom 下不能跑真实摄像头，但可以验证组件能挂载
// 并验证它在未授权摄像头时不会崩溃（应显示 ERROR overlay）

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CameraView } from '../../src/components/CameraView';
import { useGameStore } from '../../src/store/useGameStore';

// Mock 摄像头 API（jsdom 默认没有 mediaDevices）
beforeEach(() => {
  // 重置 store 到 INIT 状态
  useGameStore.setState({
    mode: 'INIT',
    errorMessage: null,
    erc7Active: false,
    backgroundReady: false,
    persons: new Map(),
  });

  // Mock mediaDevices 让 useCamera 进入"未授权"路径 → setMode('ERROR')
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied (mock)')),
    },
    writable: true,
    configurable: true,
  });
});

describe('CameraView', () => {
  it('renders without crashing', () => {
    render(<CameraView />);
    expect(screen.getByTestId('hud')).toBeInTheDocument();
    expect(screen.getByTestId('hud-top')).toBeInTheDocument();
    expect(screen.getByTestId('status-dot')).toBeInTheDocument();
    expect(screen.getByTestId('output-canvas')).toBeInTheDocument();
  });

  it('shows VIGIL-07 label', () => {
    render(<CameraView />);
    expect(screen.getByText(/VIGIL-07/)).toBeInTheDocument();
  });

  it('shows ERC-7 label inside StatusDot', () => {
    render(<CameraView />);
    // StatusDot 内部 "ERC-7" 文本用 testid 精准定位，避免与 header 撞车
    expect(screen.getByTestId('status-dot').textContent).toMatch(/ERC-7/);
  });

  it('shows signal bar with 10 cells', () => {
    render(<CameraView />);
    const cells = screen.getAllByTestId(/signal-cell-/);
    expect(cells).toHaveLength(10);
  });

  it('shows error overlay when camera permission denied', async () => {
    render(<CameraView />);
    await waitFor(
      () => {
        expect(screen.getByTestId('error-overlay')).toBeInTheDocument();
      },
      { timeout: 500 },
    );
    expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
  });

  it('renders without init overlay when no error (countdown removed)', () => {
    // Mock 让摄像头成功
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
      writable: true,
      configurable: true,
    });
    render(<CameraView />);
    expect(screen.queryByTestId('init-overlay')).not.toBeInTheDocument();
  });
});