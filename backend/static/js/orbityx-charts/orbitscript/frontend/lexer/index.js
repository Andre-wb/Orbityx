import { Lexer } from './lexer.js';
/**
 * Tokenise an OrbitScript source string.
 *
 * @throws {OrbitScriptError} on unexpected characters or unterminated literals.
 */
export function tokenize(source) {
    return new Lexer(source).tokenize();
}
//# sourceMappingURL=index.js.map