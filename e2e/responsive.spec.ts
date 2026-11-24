import { expect, test } from '@playwright/test';

/** Hallmark discipline 5: no horizontal scroll at phone width. */
for (const route of ['expediente', 'costo', 'pagos', 'gobernanza']) {
  test(`sin scroll horizontal en móvil: #/${route}`, async ({ page }) => {
    await page.goto('/?presentador');
    await page.getByTestId('scenario-limpio').click();
    await page.goto(`/?presentador#/${route}`);
    await expect(page.getByTestId('demo-mark')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
