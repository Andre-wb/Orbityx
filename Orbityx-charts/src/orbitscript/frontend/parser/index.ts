import type { Token } from '../../lang/token/index.js';
import type { Program } from '../../lang/ast/index.js';
import { Parser } from './parser.js';

/**
 * Parse a flat Token[] into a Program AST.
 *
 * @throws {OrbitScriptError} on syntax errors with line/column information.
 */
export function parse(tokens: Token[]): Program {
    return new Parser(tokens).parse();
}
