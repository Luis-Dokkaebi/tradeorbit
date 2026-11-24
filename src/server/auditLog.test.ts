import { AuditLog, AuditLogImmutableError, canonicalJson, GENESIS_HASH } from './auditLog';

const clock = () => new Date('2026-11-24T15:00:00.000Z');
const add = (log: AuditLog, orgId: string, action: string) =>
  log.append({ orgId, actorType: 'persona', actor: 'Dirección (DEMO)', action, entity: 'shipments', entityId: 'SHP-0001', payload: { b: 1, a: [2, { d: 3, c: 4 }] } });

describe('AuditLog (principle 7, NFR-06)', () => {
  it('chains per organization starting from genesis', () => {
    const log = new AuditLog(clock);
    const a1 = add(log, 'org-a', 'x');
    const b1 = add(log, 'org-b', 'x');
    const a2 = add(log, 'org-a', 'y');
    expect(a1.prevHash).toBe(GENESIS_HASH);
    expect(b1.prevHash).toBe(GENESIS_HASH);
    expect(a2.prevHash).toBe(a1.contentHash);
    expect(log.verifyChain('org-a')).toBeNull();
    expect(log.list('org-b')).toHaveLength(1);
  });

  it('update and delete always fail; entries are frozen', () => {
    const log = new AuditLog(clock);
    const e = add(log, 'org-a', 'x');
    expect(() => log.update(e.id, { action: 'z' })).toThrow(AuditLogImmutableError);
    expect(() => log.delete(e.id)).toThrow(AuditLogImmutableError);
    expect(Object.isFrozen(e)).toBe(true);
  });

  it('canonical JSON does not depend on key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});
