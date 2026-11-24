import { expect, test } from '@playwright/test';

/** NFR-04: initial screen under 3 s and a working plan B with no network after load. */
test('pantalla inicial en menos de 3 s', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/?presentador');
  await expect(page.getByTestId('demo-mark')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(3000);
});

test('la demo completa funciona sin red una vez cargada (sin llamadas externas)', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173')) external.push(r.url());
  });
  await page.goto('/?presentador');
  await context.setOffline(true);
  await page.getByTestId('open-from-po').click();
  for (const id of ['DIS-FAC', 'DIS-LE', 'DIS-CP', 'DIS-BL']) await page.getByTestId(`upload-${id}`).click();
  await page.getByTestId('nav-costo').click();
  await page.getByTestId('calc-cost').click();
  await expect(page.getByTestId('cost-total')).toContainText('174,118.27');
  expect(external).toEqual([]);
});
