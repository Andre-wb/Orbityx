import type { Directive, DirectiveArg } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
import { isTypeKw } from './type-parser.js';
import type { parseExpr as ParseExprFn } from './expr-parser.js';

export function parseDirective(
    ts: TokenStream,
    parseExpr: typeof ParseExprFn,
): Directive {
    const { line, column: col } = ts.current();
    ts.expect('HASH_BRACKET');
    const name = ts.expect('IDENT').value;
    const args: DirectiveArg[] = [];
    if (ts.tryConsume('LPAREN')) {
        while (!ts.at('RPAREN') && !ts.at('EOF')) {
            if ((ts.at('IDENT') || isTypeKw(ts)) && ts.peek().type === 'EQ') {
                const key = ts.advance().value;
                ts.advance();
                const value = parseExpr(ts, 0);
                args.push({ key, value });
            } else {
                const value = parseExpr(ts, 0);
                args.push({ key: String(args.length), value });
            }
            if (!ts.tryConsume('COMMA')) break;
        }
        ts.expect('RPAREN');
    }
    ts.expect('RBRACKET');
    return { kind: 'Directive', name, args, line, col };
}
