import type { Token, TokenType } from '../../lang/token/index.js';
import { OrbitScriptError } from '../../lang/error.js';

export class TokenStream {
    pos = 0;

    constructor(readonly tokens: Token[]) {}

    current(): Token { return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0 }; }
    peek(offset = 1): Token { return this.tokens[this.pos + offset] ?? { type: 'EOF', value: '', line: 0, column: 0 }; }
    at(type: TokenType): boolean { return this.current().type === type; }

    advance(): Token {
        const t = this.current();
        if (t.type !== 'EOF') this.pos++;
        return t;
    }

    expect(type: TokenType): Token {
        const t = this.current();
        if (t.type !== type) this.error(`Expected '${type}' but got '${t.value || t.type}'`);
        return this.advance();
    }

    tryConsume(type: TokenType): boolean {
        if (this.at(type)) { this.advance(); return true; }
        return false;
    }

    error(msg: string, t = this.current()): never {
        throw new OrbitScriptError(msg, t.line, t.column, 'parser');
    }
}
