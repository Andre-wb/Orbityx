import type { Statement, LetStmt, ReturnStmt, ForStmt, WhileStmt, LoopStmt, ASTNode } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
export interface StmtParserDeps {
    parseExpr(ts: TokenStream, minPrec?: number): ASTNode;
}
export declare function parseBlock(ts: TokenStream, deps: StmtParserDeps): Statement[];
export declare function parseStatement(ts: TokenStream, deps: StmtParserDeps): Statement;
export declare function parseLetStmt(ts: TokenStream, deps: StmtParserDeps): LetStmt;
export declare function parseReturnStmt(ts: TokenStream, deps: StmtParserDeps): ReturnStmt;
export declare function parseForStmt(ts: TokenStream, deps: StmtParserDeps): ForStmt;
export declare function parseWhileStmt(ts: TokenStream, deps: StmtParserDeps): WhileStmt;
export declare function parseLoopStmt(ts: TokenStream, deps: StmtParserDeps): LoopStmt;
//# sourceMappingURL=stmt-parser.d.ts.map