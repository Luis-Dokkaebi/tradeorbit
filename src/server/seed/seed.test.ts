import { allSeedDocuments, seedLibrary } from './scenarios';
import { TARIFF_RULES } from './tariffs';

describe('synthetic seed set (NFR-08, T-041)', () => {
  const text = allSeedDocuments('2026-11-24').flatMap((d) => d.pages.flat()).join('\n');

  it('marks the importer and carrier as fictitious and uses no emails, phones or tax IDs', () => {
    expect(text).toMatch(/ficticia/);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(text).not.toMatch(/\+?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{4}\b/);
    expect(text).not.toMatch(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/); // RFC
  });

  it('every tariff row has source, date and validity (principle 6)', () => {
    for (const r of TARIFF_RULES) {
      expect(r.source.length).toBeGreaterThan(10);
      expect(r.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['verificada', 'por_verificar']).toContain(r.verification);
    }
  });

  it('only the live scenario offers documents to upload, including one illegible scan', () => {
    expect(seedLibrary('limpio', '2026-11-24')).toEqual([]);
    expect(seedLibrary('discrepancia', '2026-11-24').some((d) => d.id.endsWith('-ILEG'))).toBe(true);
  });
});
