import type { Token } from '../../lang/token/index.js';
import { Lexer } from './lexer.js';

/**
 * Tokenise an OrbitScript source string.
 *
 * @throws {OrbitScriptError} on unexpected characters or unterminated literals.
 */
export function tokenize(source: string): Token[] {
    return new Lexer(source).tokenize();
}
