import { OrbitScriptError } from '../../lang/error.js';
export class TokenStream {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    current() { return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0 }; }
    peek(offset = 1) { return this.tokens[this.pos + offset] ?? { type: 'EOF', value: '', line: 0, column: 0 }; }
    at(type) { return this.current().type === type; }
    advance() {
        const t = this.current();
        if (t.type !== 'EOF')
            this.pos++;
        return t;
    }
    expect(type) {
        const t = this.current();
        if (t.type !== type)
            this.error(`Expected '${type}' but got '${t.value || t.type}'`);
        return this.advance();
    }
    tryConsume(type) {
        if (this.at(type)) {
            this.advance();
            return true;
        }
        return false;
    }
    error(msg, t = this.current()) {
        throw new OrbitScriptError(msg, t.line, t.column, 'parser');
    }
}
//# sourceMappingURL=token-stream.js.map