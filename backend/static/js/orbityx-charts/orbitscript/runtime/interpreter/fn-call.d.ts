import type { FnDef } from '../../lang/ast/index.js';
import { type OSValue, type OSClosure } from '../../lang/types.js';
import type { Interpreter } from './interpreter.js';
export declare function evalFnCall(node: import('../../lang/ast/expressions.js').FnCallExpr, interp: Interpreter): OSValue;
export declare function callUserFn(fn: FnDef, args: OSValue[], selfValue: import('../../lang/types.js').OSStruct | null, line: number, col: number, interp: Interpreter): OSValue;
export declare function callClosure(closure: OSClosure, args: OSValue[], line: number, col: number, interp: Interpreter): OSValue;
//# sourceMappingURL=fn-call.d.ts.map