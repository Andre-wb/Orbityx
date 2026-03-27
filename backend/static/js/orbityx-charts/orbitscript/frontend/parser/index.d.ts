import type { Token } from '../../lang/token/index.js';
import type { Program } from '../../lang/ast/index.js';
/**
 * Parse a flat Token[] into a Program AST.
 *
 * @throws {OrbitScriptError} on syntax errors with line/column information.
 */
export declare function parse(tokens: Token[]): Program;
//# sourceMappingURL=index.d.ts.map