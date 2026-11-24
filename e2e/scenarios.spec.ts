import { expect, test } from '@playwright/test';

test('selector de escenarios, reinicio y reproducción (US-12, US-07, US-08)', async ({ page }) => {
  await page.goto('/?presentador');
  await page.getByTestId('scenario-retraso').click();
  await expect(page.getByTestId('delay-alert')).toBeVisible();

  await page.getByTestId('scenario-limpio').click();
  await expect(page.getByTestId('discrepancies-none')).toBeVisible();
  await expect(page.getByTestId('route-slip')).toContainText('Conciliado');

  await page.getByTestId('nav-aduana').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('padron').check();
  await page.getByTestId('export').click();
  expect((await download).suggestedFilename()).toBe('expediente-SHP-0001.json');

  await page.getByTestId('scenario-discrepancia').click();
  await page.getByTestId('nav-expediente').click();
  await page.getByTestId('open-from-po').click();
  await expect(page.getByTestId('file-folio')).toBeVisible();
  await page.getByTestId('demo-reset').click();
  await expect(page.getByTestId('open-from-po')).toBeVisible();

  await page.getByTestId('demo-replay').click();
  await expect(page.getByTestId('replay-banner')).toContainText('las nuevas se ejecutan en vivo y quedan marcadas');
});
