import type { ASTNode, BlockExpr, Statement } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
export interface ExprParserDeps {
    parseBlock(ts: TokenStream): Statement[];
}
export declare function parseExpr(ts: TokenStream, minPrec?: number, deps?: ExprParserDeps): ASTNode;
export declare function parseBlockExpr(ts: TokenStream, deps?: ExprParserDeps): BlockExpr;
//# sourceMappingURL=expr-parser.d.ts.map