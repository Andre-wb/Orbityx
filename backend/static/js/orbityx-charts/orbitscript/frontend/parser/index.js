import { Parser } from './parser.js';
/**
 * Parse a flat Token[] into a Program AST.
 *
 * @throws {OrbitScriptError} on syntax errors with line/column information.
 */
export function parse(tokens) {
    return new Parser(tokens).parse();
}
//# sourceMappingURL=index.js.map