export type ErrorPhase = 'lexer' | 'parser' | 'typecheck' | 'runtime';

export class OrbitScriptError extends Error {
    constructor(
        message: string,
        public readonly line: number,
        public readonly column: number,
        public readonly phase: ErrorPhase,
    ) {
        super(`[OrbitScript:${phase}] ${message} (line ${line}, col ${column})`);
        this.name = 'OrbitScriptError';
    }
}
