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

export type AuditInput = Omit<AuditEntry, 'id' | 'seq' | 'at' | 'contentHash' | 'prevHash'> & { payload: unknown };

const hash = (text: string): string => bytesToHex(sha256(utf8ToBytes(text)));

/**
 * Append-only, hash-chained audit log (principle 7, NFR-06). Entries are frozen;
 * update and delete exist only to fail loudly.
 */
export class AuditLog {
  readonly #entries: AuditEntry[] = [];

  constructor(private readonly clock: () => Date = () => new Date()) {}

  append(input: AuditInput): AuditEntry {
    const seq = this.#entries.length;
    const prevHash = this.#entries[seq - 1]?.contentHash ?? GENESIS_HASH;
    const at = this.clock().toISOString();
    const { payload, ...rest } = input;
    const contentHash = hash(JSON.stringify({ seq, at, ...rest, payload, prevHash }));
    const entry: AuditEntry = Object.freeze({ id: `AUD-${String(seq + 1).padStart(5, '0')}`, seq, at, ...rest, contentHash, prevHash });
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

  /** Verifies the chain links. Returns the first broken sequence number, or null when intact. */
  verifyChain(): number | null {
    for (let i = 0; i < this.#entries.length; i += 1) {
      const expectedPrev = i === 0 ? GENESIS_HASH : this.#entries[i - 1]?.contentHash;
      if (this.#entries[i]?.prevHash !== expectedPrev) return i;
    }
    return null;
  }

  get size(): number {
    return this.#entries.length;
  }
}
