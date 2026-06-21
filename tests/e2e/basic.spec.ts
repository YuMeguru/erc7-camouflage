// E2E smoke 测试 - 验证应用能加载并显示核心 UI
// 注意：浏览器默认会拒绝 getUserMedia（即使有 permissions），所以我们用 fake media stream

import { test, expect } from '@playwright/test';

test.describe('VIGIL-07 ERC-7 Simulator', () => {
  test('app loads and shows HUD', async ({ page }) => {
    await page.goto('/');
    // 等待 HUD 出现（不会等待摄像头授权）
    await expect(page.getByTestId('hud')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('hud-top')).toBeVisible();
  });

  test('shows VIGIL-07 label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('VIGIL-07').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows ERC-7 status dot', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status-dot')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('ERC-7').first()).toBeVisible();
  });

  test('shows signal bar with 10 cells', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('signal-bar')).toBeVisible({ timeout: 10_000 });
    const cells = page.getByTestId(/signal-cell-/);
    await expect(cells).toHaveCount(10);
  });

  test('output canvas is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('output-canvas')).toBeAttached({ timeout: 10_000 });
  });

  test('shows error overlay or renders normally when camera denied', async ({ page }) => {
    await page.goto('/');
    // 等待 error overlay（如被拒绝）或相机视图就绪
    const err = page.getByTestId('error-overlay');
    const canvas = page.getByTestId('output-canvas');
    await Promise.race([
      err.waitFor({ state: 'visible', timeout: 10_000 }),
      canvas.waitFor({ state: 'visible', timeout: 10_000 }),
    ]);
  });
});
