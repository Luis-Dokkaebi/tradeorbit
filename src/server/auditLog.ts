import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { AuditEntry } from '../shared/schemas';

export class AuditLogImmutableError extends Error {
  constructor(operation: 'update' | 'delete') {
    super(`audit_log es solo de agregar: la operación "${operation}" no está permitida`);
    this.name = 'AuditLogImmutableError';
  }
}

export const GENESIS_HASH = '0'.repeat(64);

export type AuditInput = Omit<AuditEntry, 'id' | 'seq' | 'at' | 'contentHash' | 'prevHash' | 'payloadHash'> & { payload: unknown };

const hash = (text: string): string => bytesToHex(sha256(utf8ToBytes(text)));

/** Deterministic JSON: object keys sorted at every level, so the same content always hashes the same. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
};

const entryHash = (e: Omit<AuditEntry, 'id' | 'contentHash'>): string => hash(canonicalJson(e));

/**
 * Append-only, hash-chained audit log (principle 7, NFR-06). One chain per organization.
 * Entries are frozen; update and delete exist only to fail loudly; verifyChain recomputes every hash.
 */
export class AuditLog {
  readonly #entries: AuditEntry[] = [];

  constructor(private readonly clock: () => Date = () => new Date()) {}

  append(input: AuditInput): AuditEntry {
    const { payload, ...rest } = input;
    const orgEntries = this.#entries.filter((e) => e.orgId === rest.orgId);
    const seq = orgEntries.length;
    const prevHash = orgEntries.at(-1)?.contentHash ?? GENESIS_HASH;
    const base = { seq, at: this.clock().toISOString(), ...rest, payloadHash: hash(canonicalJson(payload)), prevHash };
    const entry: AuditEntry = Object.freeze({ ...base, id: `AUD-${rest.orgId.slice(-4)}-${String(seq + 1).padStart(5, '0')}`, contentHash: entryHash(base) });
    this.#entries.push(entry);
    return entry;
  }

  list(orgId: string): readonly AuditEntry[] {
    return Object.freeze(this.#entries.filter((e) => e.orgId === orgId));
  }

  update(_id: string, _patch: Partial<AuditEntry>): never {
    throw new AuditLogImmutableError('update');
  }

  delete(_id: string): never {
    throw new AuditLogImmutableError('delete');
  }

  /** Recomputes each hash and link of one organization's chain. Returns the first broken seq, or null when intact. */
  verifyChain(orgId: string): number | null {
    const chain = this.#entries.filter((e) => e.orgId === orgId);
    for (let i = 0; i < chain.length; i += 1) {
      const e = chain[i];
      if (!e) return i;
      const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1]?.contentHash;
      const { contentHash, ...withId } = e;
      const base: Omit<AuditEntry, 'id' | 'contentHash'> = { ...withId };
      delete (base as Partial<AuditEntry>).id;
      if (e.prevHash !== expectedPrev || entryHash(base) !== contentHash) return i;
    }
    return null;
  }
}
