import type {
    ASTNode, BinaryOp, UnaryOp,
    MatchArm, MatchPattern,
    ClosureExpr, ClosureParam,
    StructFieldInit,
    HistoryRefExpr,
    BlockExpr,
    Statement,
} from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
import { PREC } from './precedence.js';
import { parseTypeExpr } from './type-parser.js';
import { parseStatement } from './stmt-parser.js';

// ─── Deps interface (to avoid circular import) ─────────────────────────────

export interface ExprParserDeps {
    parseBlock(ts: TokenStream): Statement[];
}

// ─── Expr ──────────────────────────────────────────────────────────────────

export function parseExpr(ts: TokenStream, minPrec = 0, deps?: ExprParserDeps): ASTNode {
    let left = parseUnary(ts, deps);
    while (true) {
        const op = currentBinaryOp(ts);
        if (!op) break;
        const prec = PREC[op] ?? 0;
        if (prec <= minPrec) break;
        const { line, column: col } = ts.current();
        // Capture whether this is an inclusive range BEFORE advancing
        const isInclusiveRange = ts.current().value === '..=';
        ts.advance();
        const rightPrec = (op === '..' || op === '..=') ? prec : (op === '**' ? prec - 1 : prec);
        const right = parseExpr(ts, rightPrec, deps);
        if (op === '..' || op === '..=') {
            left = { kind: 'RangeExpr', start: left, end: right, inclusive: isInclusiveRange, line, col };
        } else {
            left = { kind: 'BinaryExpr', op: op as BinaryOp, left, right, line, col };
        }
    }
    return left;
}

function currentBinaryOp(ts: TokenStream): string | null {
    const t = ts.current();
    switch (t.type) {
        case 'PIPE_PIPE': return '||';
        case 'AMP_AMP':   return '&&';
        case 'EQ_EQ':     return '==';
        case 'BANG_EQ':   return '!=';
        case 'LT':        return '<';
        case 'GT':        return '>';
        case 'LT_EQ':     return '<=';
        case 'GT_EQ':     return '>=';
        case 'DOT_DOT':   return t.value === '..=' ? '..=' : '..';
        case 'PLUS':      return '+';
        case 'MINUS':     return '-';
        case 'STAR':      return '*';
        case 'SLASH':     return '/';
        case 'PERCENT':   return '%';
        case 'STAR_STAR': return '**';
        default: return null;
    }
}

function parseUnary(ts: TokenStream, deps?: ExprParserDeps): ASTNode {
    const { line, column: col } = ts.current();
    if (ts.at('MINUS')) {
        ts.advance();
        const operand = parseUnary(ts, deps);
        return { kind: 'UnaryExpr', op: '-' as UnaryOp, operand, line, col };
    }
    if (ts.at('BANG')) {
        ts.advance();
        const operand = parseUnary(ts, deps);
        return { kind: 'UnaryExpr', op: '!' as UnaryOp, operand, line, col };
    }
    return parsePostfix(ts, deps);
}

function parsePostfix(ts: TokenStream, deps?: ExprParserDeps): ASTNode {
    let node = parsePrimary(ts, deps);
    while (true) {
        const { line, column: col } = ts.current();
        if (ts.at('DOT')) {
            ts.advance();
            const name = ts.expect('IDENT').value;
            if (ts.at('LPAREN')) {
                const args = parseArgList(ts, deps);
                node = { kind: 'MethodCallExpr', receiver: node, method: name, args, line, col };
            } else {
                node = { kind: 'FieldAccessExpr', object: node, field: name, line, col };
            }
            continue;
        }
        if (ts.at('LBRACKET')) {
            ts.advance();
            const index = parseExpr(ts, 0, deps);
            ts.expect('RBRACKET');
            if (node.kind === 'Identifier' && (index.kind === 'NumberLit' || index.kind === 'Identifier')) {
                node = { kind: 'HistoryRefExpr', series: node, offset: index, line, col } as HistoryRefExpr;
            } else {
                node = { kind: 'IndexExpr', object: node, index, line, col };
            }
            continue;
        }
        if (ts.at('QUESTION')) {
            ts.advance();
            node = { kind: 'QuestionExpr', expr: node, line, col };
            continue;
        }
        break;
    }
    return node;
}

function parsePrimary(ts: TokenStream, deps?: ExprParserDeps): ASTNode {
    const t = ts.current();
    const { line, column: col } = t;

    if (ts.at('NUMBER'))  { ts.advance(); return { kind: 'NumberLit', value: parseFloat(t.value), line, col }; }
    if (ts.at('STRING'))  { ts.advance(); return { kind: 'StringLit', value: t.value, line, col }; }
    if (ts.at('TRUE'))    { ts.advance(); return { kind: 'BoolLit', value: true,  line, col }; }
    if (ts.at('FALSE'))   { ts.advance(); return { kind: 'BoolLit', value: false, line, col }; }
    if (ts.at('COLOR'))   { ts.advance(); return { kind: 'ColorLit', hex: t.value, line, col }; }
    if (ts.at('NONE'))    { ts.advance(); return { kind: 'NoneLit', line, col }; }
    if (ts.at('SOME'))    {
        ts.advance(); ts.expect('LPAREN');
        const value = parseExpr(ts, 0, deps);
        ts.expect('RPAREN');
        return { kind: 'SomeExpr', value, line, col };
    }
    if (ts.at('SELF'))    { ts.advance(); return { kind: 'SelfExpr', line, col }; }
    if (ts.at('PIPE'))    { return parseClosure(ts, line, col, deps); }
    if (ts.at('IF'))      { return parseIfExpr(ts, deps); }
    if (ts.at('MATCH'))   { return parseMatchExpr(ts, deps); }
    if (ts.at('LBRACE'))  { return parseBlockExpr(ts, deps); }
    if (ts.at('LBRACKET')) {
        ts.advance();
        const elements: ASTNode[] = [];
        while (!ts.at('RBRACKET') && !ts.at('EOF')) {
            elements.push(parseExpr(ts, 0, deps));
            if (!ts.tryConsume('COMMA')) break;
        }
        ts.expect('RBRACKET');
        return { kind: 'ArrayLitExpr', elements, line, col };
    }
    if (ts.at('LPAREN')) {
        ts.advance();
        if (ts.at('RPAREN')) { ts.advance(); return { kind: 'TupleExpr', elements: [], line, col }; }
        const first = parseExpr(ts, 0, deps);
        if (ts.tryConsume('COMMA')) {
            const elements: ASTNode[] = [first];
            while (!ts.at('RPAREN') && !ts.at('EOF')) {
                elements.push(parseExpr(ts, 0, deps));
                if (!ts.tryConsume('COMMA')) break;
            }
            ts.expect('RPAREN');
            return { kind: 'TupleExpr', elements, line, col };
        }
        ts.expect('RPAREN');
        return first;
    }
    if (ts.at('IDENT') || ts.at('OK') || ts.at('ERR')) {
        return parseIdentOrCall(ts, line, col, deps);
    }
    ts.error(`Unexpected token '${t.value || t.type}'`);
}

function parseIdentOrCall(ts: TokenStream, line: number, col: number, deps?: ExprParserDeps): ASTNode {
    const name = ts.advance().value;
    // Macro call:  name!(args...)  or  name![elems...]
    if (ts.at('BANG') && (ts.peek().type === 'LPAREN' || ts.peek().type === 'LBRACKET')) {
        ts.advance(); // consume !
        let args: ASTNode[];
        if (ts.at('LPAREN')) {
            args = parseArgList(ts, deps);
        } else {
            ts.advance(); // consume [
            args = [];
            while (!ts.at('RBRACKET') && !ts.at('EOF')) {
                args.push(parseExpr(ts, 0, deps));
                if (!ts.tryConsume('COMMA')) break;
            }
            ts.expect('RBRACKET');
        }
        return { kind: 'MacroCallExpr', name, args, line, col };
    }
    if (ts.at('DOUBLE_COLON')) {
        ts.advance();
        const segments: string[] = [name];
        while (true) {
            const seg = ts.expect('IDENT').value;
            segments.push(seg);
            if (!ts.at('DOUBLE_COLON')) break;
            ts.advance();
        }
        if (ts.at('LPAREN')) {
            const args = parseArgList(ts, deps);
            const enumName = segments.slice(0, -1).join('::');
            const variant  = segments[segments.length - 1]!;
            return { kind: 'EnumVariantExpr', enumName, variant, args, line, col };
        }
        if (segments.length === 2 && ts.at('LBRACE')) {
            const typeName = segments[0]!;
            return parseStructInit(ts, typeName, line, col, deps);
        }
        return { kind: 'PathExpr', segments, line, col };
    }
    if (ts.at('LPAREN')) {
        const args = parseArgList(ts, deps);
        return { kind: 'FnCallExpr', callee: name, args, line, col };
    }
    if (ts.at('LBRACE')) return parseStructInit(ts, name, line, col, deps);
    return { kind: 'Identifier', name, line, col };
}

function parseStructInit(ts: TokenStream, typeName: string, line: number, col: number, deps?: ExprParserDeps): ASTNode {
    ts.expect('LBRACE');
    const fields: StructFieldInit[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const fl = ts.current().line, fc = ts.current().column;
        const fname = ts.expect('IDENT').value;
        ts.expect('COLON');
        const value = parseExpr(ts, 0, deps);
        fields.push({ name: fname, value, line: fl, col: fc });
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('RBRACE');
    return { kind: 'StructInitExpr', typeName, fields, line, col };
}

function parseArgList(ts: TokenStream, deps?: ExprParserDeps): ASTNode[] {
    ts.expect('LPAREN');
    const args: ASTNode[] = [];
    while (!ts.at('RPAREN') && !ts.at('EOF')) {
        args.push(parseExpr(ts, 0, deps));
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('RPAREN');
    return args;
}

function parseIfExpr(ts: TokenStream, deps?: ExprParserDeps): ASTNode {
    const { line, column: col } = ts.current();
    ts.expect('IF');
    const condition = parseExpr(ts, 0, deps);
    const thenBranch = deps ? deps.parseBlock(ts) : parseInlineBlock(ts, deps);
    if (ts.tryConsume('ELSE')) {
        if (ts.at('IF')) {
            const nested = parseIfExpr(ts, deps);
            return { kind: 'IfExpr', condition, thenBranch, elseBranch: nested as import('../../lang/ast/expressions.js').IfExpr, line, col };
        }
        const elseBlock = deps ? deps.parseBlock(ts) : parseInlineBlock(ts, deps);
        return { kind: 'IfExpr', condition, thenBranch, elseBranch: elseBlock, line, col };
    }
    return { kind: 'IfExpr', condition, thenBranch, elseBranch: null, line, col };
}

function parseInlineBlock(ts: TokenStream, deps?: ExprParserDeps): Statement[] {
    ts.expect('LBRACE');
    const stmts: Statement[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) stmts.push(parseStatement(ts, { parseExpr: (t, p) => parseExpr(t, p, deps) }));
    ts.expect('RBRACE');
    return stmts;
}

function parseMatchExpr(ts: TokenStream, deps?: ExprParserDeps): ASTNode {
    const { line, column: col } = ts.current();
    ts.expect('MATCH');
    const value = parseExpr(ts, 0, deps);
    ts.expect('LBRACE');
    const arms: MatchArm[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const al = ts.current().line, ac = ts.current().column;
        const pattern = parseMatchPattern(ts);
        let finalPattern = pattern;
        if (ts.at('IDENT') && ts.current().value === 'if') {
            ts.advance();
            const guard = parseExpr(ts, 0, deps);
            finalPattern = { kind: 'GuardPattern', pattern, guard };
        }
        ts.expect('FAT_ARROW');
        const body = ts.at('LBRACE') ? parseBlockExpr(ts, deps) : parseExpr(ts, 0, deps);
        arms.push({ kind: 'MatchArm', pattern: finalPattern, body, line: al, col: ac });
        ts.tryConsume('COMMA');
    }
    ts.expect('RBRACE');
    return { kind: 'MatchExpr', value, arms, line, col };
}

function parseMatchPattern(ts: TokenStream): MatchPattern {
    const t = ts.current();
    if (ts.at('UNDERSCORE'))  { ts.advance(); return { kind: 'WildcardPattern' }; }
    if (ts.at('NONE'))        { ts.advance(); return { kind: 'NonePattern' }; }
    if (ts.at('SOME')) {
        ts.advance(); ts.expect('LPAREN');
        const inner = parseMatchPattern(ts);
        ts.expect('RPAREN');
        return { kind: 'SomePattern', inner };
    }
    if (ts.at('IDENT') && ts.peek().type === 'DOUBLE_COLON') {
        const typeName = ts.advance().value;
        ts.advance();
        const variant = ts.expect('IDENT').value;
        const bindings: string[] = [];
        if (ts.tryConsume('LPAREN')) {
            while (!ts.at('RPAREN') && !ts.at('EOF')) {
                bindings.push(ts.expect('IDENT').value);
                if (!ts.tryConsume('COMMA')) break;
            }
            ts.expect('RPAREN');
        }
        return { kind: 'EnumPattern', typeName, variant, bindings };
    }
    if (ts.at('NUMBER'))  { const v = { kind: 'NumberLit' as const, value: parseFloat(t.value), line: t.line, col: t.column }; ts.advance(); return { kind: 'LiteralPattern', value: v }; }
    if (ts.at('STRING'))  { const v = { kind: 'StringLit' as const, value: t.value, line: t.line, col: t.column }; ts.advance(); return { kind: 'LiteralPattern', value: v }; }
    if (ts.at('TRUE'))    { ts.advance(); return { kind: 'LiteralPattern', value: { kind: 'BoolLit', value: true,  line: t.line, col: t.column } }; }
    if (ts.at('FALSE'))   { ts.advance(); return { kind: 'LiteralPattern', value: { kind: 'BoolLit', value: false, line: t.line, col: t.column } }; }
    if (ts.at('COLOR'))   { const v = { kind: 'ColorLit' as const, hex: t.value, line: t.line, col: t.column }; ts.advance(); return { kind: 'LiteralPattern', value: v }; }
    if (ts.at('IDENT'))   { const name = ts.advance().value; return { kind: 'IdentPattern', name }; }
    ts.error(`Expected match pattern`);
}

export function parseBlockExpr(ts: TokenStream, deps?: ExprParserDeps): BlockExpr {
    const { line, column: col } = ts.current();
    ts.expect('LBRACE');
    const body: Statement[] = [];
    let tail: ASTNode | null = null;
    const stmtDeps = { parseExpr: (t: TokenStream, p?: number) => parseExpr(t, p, deps) };
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const stmt = parseStatement(ts, stmtDeps);
        if (!ts.at('RBRACE')) {
            body.push(stmt);
        } else {
            if (stmt.kind === 'ExprStmt') { tail = stmt.expr; }
            else { body.push(stmt); }
        }
    }
    ts.expect('RBRACE');
    return { kind: 'BlockExpr', body, tail, line, col };
}

function parseClosure(ts: TokenStream, line: number, col: number, deps?: ExprParserDeps): ClosureExpr {
    ts.expect('PIPE');
    const params: ClosureParam[] = [];
    while (!ts.at('PIPE') && !ts.at('EOF')) {
        const pname = ts.expect('IDENT').value;
        let typeAnnotation = null;
        if (ts.tryConsume('COLON')) typeAnnotation = parseTypeExpr(ts);
        params.push({ name: pname, typeAnnotation });
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('PIPE');
    let returnType = null;
    if (ts.tryConsume('ARROW')) returnType = parseTypeExpr(ts);
    const body = ts.at('LBRACE') ? parseBlockExpr(ts, deps) : parseExpr(ts, 0, deps);
    return { kind: 'ClosureExpr', params, returnType, body, line, col };
}
