import { expect, test } from '@playwright/test';

const ROUTES = ['expediente', 'costo', 'pagos', 'aprobaciones', 'conciliacion', 'aduana', 'preguntar', 'gobernanza'];

/** Public view: no presenter controls and no DEMO label on any screen; screenshots for human review (D-03). */
for (const route of ROUTES) {
  test(`vista pública sin controles de presentador ni etiqueta DEMO en #/${route}`, async ({ page }, info) => {
    await page.goto(`/#/${route}`);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByTestId('demo-band')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('DEMO');
    await page.screenshot({ path: info.outputPath(`${route}.png`), fullPage: true });
  });
}

test('el modo presentador muestra los controles', async ({ page }) => {
  await page.goto('/?presentador');
  await expect(page.getByTestId('demo-mark')).toHaveText('Modo presentador');
  await expect(page.getByTestId('scenario-limpio')).toBeVisible();
});
