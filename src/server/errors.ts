export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} no existe en esta organización`);
    this.name = 'NotFoundError';
  }
}

export class ConstitutionViolationError extends Error {
  constructor(article: number, detail: string) {
    super(`Violación al principio ${article}: ${detail}`);
    this.name = 'ConstitutionViolationError';
  }
}

export class AgentPausedError extends Error {
  constructor() {
    super('Los agentes están en pausa (interruptor global). Reanuda desde Gobernanza.');
    this.name = 'AgentPausedError';
  }
}

export class StaleVersionError extends Error {
  constructor(expected: number, got: number) {
    super(`La propuesta cambió: versión actual ${expected}, se intentó decidir sobre la versión ${got}`);
    this.name = 'StaleVersionError';
  }
}
