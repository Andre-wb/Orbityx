import { isTypeKw } from './type-parser.js';
export function parseDirective(ts, parseExpr) {
    const { line, column: col } = ts.current();
    ts.expect('HASH_BRACKET');
    const name = ts.expect('IDENT').value;
    const args = [];
    if (ts.tryConsume('LPAREN')) {
        while (!ts.at('RPAREN') && !ts.at('EOF')) {
            if ((ts.at('IDENT') || isTypeKw(ts)) && ts.peek().type === 'EQ') {
                const key = ts.advance().value;
                ts.advance();
                const value = parseExpr(ts, 0);
                args.push({ key, value });
            }
            else {
                const value = parseExpr(ts, 0);
                args.push({ key: String(args.length), value });
            }
            if (!ts.tryConsume('COMMA'))
                break;
        }
        ts.expect('RPAREN');
    }
    ts.expect('RBRACKET');
    return { kind: 'Directive', name, args, line, col };
}
//# sourceMappingURL=directive-parser.js.map