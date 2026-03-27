import type { Candle } from '../../../types/index.js';
import type { Program, ASTNode, Statement, FnDef } from '../../lang/ast/index.js';
import { type OSValue, type OSStruct, type OSClosure, type ScriptOutput, type ScriptMeta } from '../../lang/types.js';
import { Environment } from '../environment.js';
export declare class Interpreter {
    readonly env: Environment;
    constructor();
    interpret(program: Program, candles: Candle[], inputs?: Map<string, OSValue>): {
        meta: ScriptMeta;
        outputs: ScriptOutput[];
    };
    private extractMeta;
    private parseInputDirective;
    private evalLiteral;
    eval(node: ASTNode): OSValue;
    execStatement(stmt: Statement): void;
    callUserFn(fn: FnDef, args: OSValue[], selfValue: OSStruct | null, line: number, col: number): OSValue;
    evalFnCall(node: import('../../lang/ast/expressions.js').FnCallExpr): OSValue;
    callClosure(closure: OSClosure, args: OSValue[], line: number, col: number): OSValue;
    callStaticMethod(typeName: string, methodName: string, args: ASTNode[], line: number, col: number): OSValue;
}
//# sourceMappingURL=interpreter.d.ts.map