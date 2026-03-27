import type { Statement } from '../../lang/ast/index.js';
import { execBlock } from './expr-eval.js';
import type { Interpreter } from './interpreter.js';
export { execBlock };
export declare function execStatement(stmt: Statement, interp: Interpreter): void;
//# sourceMappingURL=stmt-exec.d.ts.map