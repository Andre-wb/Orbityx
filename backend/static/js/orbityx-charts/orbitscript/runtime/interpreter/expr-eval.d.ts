import type { ASTNode, Statement, IfExpr } from '../../lang/ast/index.js';
import { type OSValue } from '../../lang/types.js';
import type { Interpreter } from './interpreter.js';
export declare function evalExpr(node: ASTNode, interp: Interpreter): OSValue;
export declare function evalIf(node: IfExpr, interp: Interpreter): OSValue;
export declare function execBlock(stmts: Statement[], interp: Interpreter): OSValue;
export declare function isTruthy(v: OSValue): boolean;
//# sourceMappingURL=expr-eval.d.ts.map