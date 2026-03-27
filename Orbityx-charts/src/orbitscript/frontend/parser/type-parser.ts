import type { TokenType } from '../../lang/token/index.js';
import type { TypeExpr } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';

export function parseTypeExpr(ts: TokenStream): TypeExpr {
    const { line, column: col } = ts.current();
    if (ts.at('LBRACKET')) {
        ts.advance();
        const elem = parseTypeExpr(ts);
        ts.expect('RBRACKET');
        return { kind: 'ArrayType', elem, line, col };
    }
    if (ts.at('LPAREN')) {
        ts.advance();
        const elems: TypeExpr[] = [];
        while (!ts.at('RPAREN') && !ts.at('EOF')) {
            elems.push(parseTypeExpr(ts));
            if (!ts.tryConsume('COMMA')) break;
        }
        ts.expect('RPAREN');
        return { kind: 'TupleType', elems, line, col };
    }
    if (ts.at('OPTION_TY')) {
        ts.advance(); ts.expect('LT');
        const inner = parseTypeExpr(ts);
        ts.expect('GT');
        return { kind: 'OptionType', inner, line, col };
    }
    if (ts.at('RESULT_TY')) {
        ts.advance(); ts.expect('LT');
        const ok = parseTypeExpr(ts);
        ts.expect('COMMA');
        const err = parseTypeExpr(ts);
        ts.expect('GT');
        return { kind: 'ResultType', ok, err, line, col };
    }
    const typeMap: Partial<Record<TokenType, string>> = {
        F64: 'f64', I64: 'i64', BOOL_TY: 'bool', STR_TY: 'str',
        COLOR_TY: 'color', SERIES_TY: 'series', VOID_TY: 'void',
    };
    if (typeMap[ts.current().type]) {
        const name = typeMap[ts.advance().type as TokenType]!;
        return { kind: 'NamedType', name, line, col };
    }
    if (ts.at('IDENT')) {
        const name = ts.advance().value;
        return { kind: 'NamedType', name, line, col };
    }
    ts.error('Expected type expression');
}

export function isTypeKw(ts: TokenStream): boolean {
    const type = ts.current().type;
    return type === 'F64' || type === 'I64' || type === 'BOOL_TY' || type === 'STR_TY'
        || type === 'COLOR_TY' || type === 'SERIES_TY' || type === 'VOID_TY'
        || type === 'OPTION_TY' || type === 'RESULT_TY' || type === 'IDENT';
}
