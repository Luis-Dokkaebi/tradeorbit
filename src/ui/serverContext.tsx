import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEMO_ORG, type KiilonovaServer } from '../server/server';
import type { Ctx } from '../server/state';

interface ServerValue {
  server: KiilonovaServer;
  ctx: Ctx;
  setActor: (actor: string) => void;
}

const ServerContext = createContext<ServerValue | null>(null);

export const DEFAULT_ACTOR = 'Dirección general (aprobador de referencia, DEMO)';

export function ServerProvider({ server, children }: { server: KiilonovaServer; children: ReactNode }) {
  const [actor, setActor] = useState(DEFAULT_ACTOR);
  return <ServerContext.Provider value={{ server, ctx: { orgId: DEMO_ORG, actor }, setActor }}>{children}</ServerContext.Provider>;
}

/** Subscribes the component to server changes so every view re-renders after a server function runs. */
export const useServer = (): ServerValue => {
  const value = useContext(ServerContext);
  if (!value) throw new Error('useServer fuera de ServerProvider');
  useSyncExternalStore(value.server.subscribe, value.server.getVersion);
  return value;
};

export const errorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    const issues = (e as { issues?: { message: string }[] }).issues;
    return issues && issues.length > 0 ? issues.map((i) => i.message).join(' · ') : e.message;
  }
  return 'Error inesperado';
};

/** Wraps a server call: returns [run, error] so views show failures inline instead of swallowing them. */
export const useAction = (): [(fn: () => void) => boolean, string | null, () => void] => {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback((fn: () => void): boolean => {
    try {
      fn();
      setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }, []);
  return [run, error, () => setError(null)];
};
