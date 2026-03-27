export type ErrorPhase = 'lexer' | 'parser' | 'typecheck' | 'runtime';
export declare class OrbitScriptError extends Error {
    readonly line: number;
    readonly column: number;
    readonly phase: ErrorPhase;
    constructor(message: string, line: number, column: number, phase: ErrorPhase);
}
//# sourceMappingURL=error.d.ts.map