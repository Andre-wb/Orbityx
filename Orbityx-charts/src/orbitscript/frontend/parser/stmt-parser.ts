import type {
    Statement, LetStmt, AssignStmt, ExprStmt, ReturnStmt,
    ForStmt, WhileStmt, LoopStmt,
    ASTNode, AssignOp,
    TypeExpr,
} from '../../lang/ast/index.js';
import type { TokenType } from '../../lang/token/index.js';
import type { TokenStream } from './token-stream.js';
import { parseTypeExpr } from './type-parser.js';

export interface StmtParserDeps {
    parseExpr(ts: TokenStream, minPrec?: number): ASTNode;
}

export function parseBlock(ts: TokenStream, deps: StmtParserDeps): Statement[] {
    ts.expect('LBRACE');
    const stmts: Statement[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) stmts.push(parseStatement(ts, deps));
    ts.expect('RBRACE');
    return stmts;
}

export function parseStatement(ts: TokenStream, deps: StmtParserDeps): Statement {
    const t = ts.current();
    if (ts.at('LET'))      return parseLetStmt(ts, deps);
    if (ts.at('RETURN'))   return parseReturnStmt(ts, deps);
    if (ts.at('BREAK'))    { ts.advance(); ts.tryConsume('SEMICOLON'); return { kind: 'BreakStmt', line: t.line, col: t.column }; }
    if (ts.at('CONTINUE')) { ts.advance(); ts.tryConsume('SEMICOLON'); return { kind: 'ContinueStmt', line: t.line, col: t.column }; }
    if (ts.at('FOR'))      return parseForStmt(ts, deps);
    if (ts.at('WHILE'))    return parseWhileStmt(ts, deps);
    if (ts.at('LOOP'))     return parseLoopStmt(ts, deps);

    const expr = deps.parseExpr(ts, 0);
    const assignOps: Partial<Record<TokenType, AssignOp>> = {
        EQ: '=', PLUS_EQ: '+=', MINUS_EQ: '-=',
        STAR_EQ: '*=', SLASH_EQ: '/=', PERCENT_EQ: '%=',
    };
    const op = assignOps[ts.current().type];
    if (op) {
        const { line, column: col } = ts.current();
        ts.advance();
        const value = deps.parseExpr(ts, 0);
        ts.tryConsume('SEMICOLON');
        return { kind: 'AssignStmt', target: expr, op, value, line, col } as AssignStmt;
    }
    ts.tryConsume('SEMICOLON');
    return { kind: 'ExprStmt', expr, line: t.line, col: t.column } as ExprStmt;
}

export function parseLetStmt(ts: TokenStream, deps: StmtParserDeps): LetStmt {
    const { line, column: col } = ts.current();
    ts.expect('LET');
    const mutable = ts.tryConsume('MUT');
    const name = ts.expect('IDENT').value;
    let typeAnnotation: TypeExpr | null = null;
    if (ts.tryConsume('COLON')) typeAnnotation = parseTypeExpr(ts);
    let init: ASTNode | null = null;
    if (ts.tryConsume('EQ')) init = deps.parseExpr(ts, 0);
    ts.tryConsume('SEMICOLON');
    return { kind: 'LetStmt', name, mutable, typeAnnotation, init, line, col };
}

export function parseReturnStmt(ts: TokenStream, deps: StmtParserDeps): ReturnStmt {
    const { line, column: col } = ts.current();
    ts.expect('RETURN');
    let value: ASTNode | null = null;
    if (!ts.at('SEMICOLON') && !ts.at('RBRACE') && !ts.at('EOF')) value = deps.parseExpr(ts, 0);
    ts.tryConsume('SEMICOLON');
    return { kind: 'ReturnStmt', value, line, col };
}

export function parseForStmt(ts: TokenStream, deps: StmtParserDeps): ForStmt {
    const { line, column: col } = ts.current();
    ts.expect('FOR');
    const varName = ts.expect('IDENT').value;
    ts.expect('IN');
    const iterable = deps.parseExpr(ts, 0);
    const body = parseBlock(ts, deps);
    return { kind: 'ForStmt', varName, iterable, body, line, col };
}

export function parseWhileStmt(ts: TokenStream, deps: StmtParserDeps): WhileStmt {
    const { line, column: col } = ts.current();
    ts.expect('WHILE');
    const condition = deps.parseExpr(ts, 0);
    const body = parseBlock(ts, deps);
    return { kind: 'WhileStmt', condition, body, line, col };
}

export function parseLoopStmt(ts: TokenStream, deps: StmtParserDeps): LoopStmt {
    const { line, column: col } = ts.current();
    ts.expect('LOOP');
    const body = parseBlock(ts, deps);
    return { kind: 'LoopStmt', body, line, col };
}
