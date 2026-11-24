/** Date helpers on ISO calendar dates (UTC) so the demo is deterministic in tests. */
export const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
};

export const formatDateEs = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
};
