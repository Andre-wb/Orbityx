import type { Token } from '../../lang/token/index.js';
import type { Program, Statement, ASTNode, BlockExpr } from '../../lang/ast/index.js';
export declare class Parser {
    private ts;
    constructor(tokens: Token[]);
    private get stmtDeps();
    private get blockDeps();
    private get declDeps();
    parse(): Program;
    parseStatement(): Statement;
    parseExpr(minPrec?: number): ASTNode;
    parseBlockExpr(): BlockExpr;
}
//# sourceMappingURL=parser.d.ts.map