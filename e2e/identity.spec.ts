import { expect, test } from '@playwright/test';

const ROUTES = ['expediente', 'costo', 'pagos', 'aprobaciones', 'conciliacion', 'aduana', 'preguntar', 'gobernanza'];

/** US-12.c and D-03: the DEMO label is on every screen; screenshots for human identity review. */
for (const route of ROUTES) {
  test(`etiqueta DEMO visible en #/${route}`, async ({ page }, info) => {
    await page.goto('/');
    await page.getByTestId('scenario-limpio').click();
    await page.goto(`/#/${route}`);
    await expect(page.getByTestId('demo-mark')).toBeVisible();
    await expect(page.getByTestId('demo-mark')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`${route}.png`), fullPage: true });
  });
}
