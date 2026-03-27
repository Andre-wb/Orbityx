export class OrbitScriptError extends Error {
    line;
    column;
    phase;
    constructor(message, line, column, phase) {
        super(`[OrbitScript:${phase}] ${message} (line ${line}, col ${column})`);
        this.line = line;
        this.column = column;
        this.phase = phase;
        this.name = 'OrbitScriptError';
    }
}
//# sourceMappingURL=error.js.map