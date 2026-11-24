import { expect, test } from '@playwright/test';

/** The 8-minute demo script end to end (SDD § Harness de demostración), P1 stories plus US-10/11. */
test('guion de demo completo: expediente, discrepancias, costo, propuesta, aprobación, pregunta, gobernanza', async ({ page }) => {
  await page.goto('/?presentador');
  await expect(page.getByTestId('demo-mark')).toBeVisible();

  // US-01 — open the file from the purchase order
  await page.getByTestId('open-from-po').click();
  await expect(page.getByTestId('file-folio')).toHaveText('SHP-0001');
  await expect(page.getByTestId('eta-field')).toContainText('Requiere revisión');

  // US-02 / US-03 — upload documents; 3 planted discrepancies with tasks
  for (const id of ['DIS-FAC', 'DIS-LE', 'DIS-CP', 'DIS-BL']) await page.getByTestId(`upload-${id}`).click();
  for (const type of ['importe', 'cantidad', 'proveedor']) await expect(page.getByTestId(`disc-${type}`)).toContainText('Tarea de corrección');
  await expect(page.getByTestId('doc-DIS-FAC')).toContainText('p.1');
  await page.getByTestId('upload-DIS-ILEG').click();
  await expect(page.getByTestId('doc-DIS-ILEG')).toContainText('Revisión manual');

  // US-04 — landed cost with fraction, rate, source, validity and NOM
  await page.getByTestId('nav-costo').click();
  await page.getByTestId('calc-cost').click();
  await expect(page.getByTestId('cost-total')).toContainText('174,118.27');
  await expect(page.getByText('NOM-004-SE-2021')).toBeVisible();
  await expect(page.getByText('35%', { exact: true })).toBeVisible();
  await expect(page.getByText(/Decreto DOF 19\/12\/2024/).first()).toBeVisible();
  await expect(page.getByText('Por verificar contra el DOF')).toBeVisible();
  await page.getByTestId('hs-input').fill('8517.13.01');
  await page.getByTestId('calc-cost').click();
  await expect(page.getByTestId('cost-sin-dato')).toContainText('Sin dato');

  // US-05 — two DEMO routes, never a "Pagar" button
  await page.getByTestId('nav-pagos').click();
  await page.getByTestId('pay-generate').click();
  await expect(page.getByTestId('proposal-banco')).toContainText('5,479.45');
  await expect(page.getByRole('button', { name: /^Pagar/ })).toHaveCount(0);
  await page.getByTestId('submit-banco').click();
  await page.getByTestId('submit-riel_stablecoin').click();

  // US-06 — rejection needs a reason; approval is simulated and moves no money
  await page.getByTestId('nav-aprobaciones').click();
  await page.getByTestId('reject-riel_stablecoin').click();
  await expect(page.getByRole('alert')).toContainText('motivo');
  await page.getByTestId('reason-riel_stablecoin').fill('Falta validación legal del riel en Hong Kong');
  await page.getByTestId('reject-riel_stablecoin').click();
  // 3 high-severity discrepancies are open: authorizing requires a reason for accepting the risk
  await expect(page.getByTestId('risk-banco')).toBeVisible();
  await page.getByTestId('approve-banco').click();
  await expect(page.getByRole('alert')).toContainText('severidad alta');
  await page.getByTestId('reason-banco').fill('Anticipo pactado; la factura corregida llega antes del saldo');
  await page.getByTestId('approve-banco').click();
  await expect(page.getByTestId('approvals-history')).toContainText('Autorizada (simulada)');
  await expect(page.getByTestId('approvals-history')).toContainText('v1');
  await expect(page.getByTestId('no-money')).toHaveText('No se movió dinero.');

  // US-09 / US-10 — reconciliation and question with citation
  await page.getByTestId('nav-conciliacion').click();
  await expect(page.getByTestId('balance')).toContainText('4,196.00');
  await page.getByTestId('nav-preguntar').click();
  await page.getByTestId('ask-input').fill('¿Cuánto falta por pagar?');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('answers')).toContainText('4,196.00 USD');
  await expect(page.getByTestId('answers')).toContainText('reconciliations/REC-0001');

  // US-11 — governance: sandbox policy, audit log
  await page.getByTestId('nav-gobernanza').click();
  await expect(page.getByTestId('policies')).toContainText('Sandbox, sin despliegue');
  await expect(page.getByTestId('policies')).toContainText('Ilustrativo, no medido');
  await expect(page.getByTestId('policies')).toContainText('medido ahora');
  await expect(page.getByTestId('audit-log')).toContainText('propuesta.autorizada_simulada');
  await expect(page.getByRole('button', { name: /desplegar|deploy|promover/i })).toHaveCount(0);
});
