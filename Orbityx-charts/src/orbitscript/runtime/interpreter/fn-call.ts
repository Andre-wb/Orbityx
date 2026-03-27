import type { ASTNode } from '../../lang/ast/index.js';
import type { FnDef } from '../../lang/ast/index.js';
import { type OSValue, type OSClosure, OrbitScriptError } from '../../lang/types.js';
import { ReturnSignal, ErrPropagateSignal } from '../environment.js';
import { STDLIB } from '../stdlib/index.js';
import { resolveCallArgs } from './call-args.js';
import type { Interpreter } from './interpreter.js';

export function evalFnCall(node: import('../../lang/ast/expressions.js').FnCallExpr, interp: Interpreter): OSValue {
    const name = node.callee;
    const stdFn = STDLIB.get(name);
    if (stdFn) {
        const args = resolveCallArgs(node.args, name, interp.env, n => interp.eval(n)) as (OSValue | undefined)[];
        return stdFn(args, interp.env, node.line, node.col);
    }
    const fnDef = interp.env.fnRegistry.get(name);
    if (fnDef) return callUserFn(fnDef, node.args.map(a => interp.eval(a)), null, node.line, node.col, interp);
    try {
        const maybeClosureVal = interp.env.get(name, node.line, node.col);
        if (maybeClosureVal && typeof maybeClosureVal === 'object' && (maybeClosureVal as OSClosure).__type === 'closure') {
            return callClosure(maybeClosureVal as OSClosure, node.args.map(a => interp.eval(a)), node.line, node.col, interp);
        }
    } catch { /* not a variable */ }
    throw new OrbitScriptError(`Unknown function '${name}'${suggestFn(name)}`, node.line, node.col, 'runtime');
}

export function callUserFn(fn: FnDef, args: OSValue[], selfValue: import('../../lang/types.js').OSStruct | null, line: number, col: number, interp: Interpreter): OSValue {
    interp.env.pushScope();
    if (selfValue) interp.env.define('self', selfValue, false);
    for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i]!;
        if (param.isSelf) continue;
        const argVal = args[i] ?? (param.defaultValue ? interp.eval(param.defaultValue) : null);
        interp.env.define(param.name, argVal, false);
    }
    let result: OSValue = null;
    try {
        for (let i = 0; i < fn.body.length; i++) {
            const stmt = fn.body[i]!;
            if (i === fn.body.length - 1 && stmt.kind === 'ExprStmt') result = interp.eval(stmt.expr);
            else interp.execStatement(stmt);
        }
    } catch (e) {
        if (e instanceof ReturnSignal) result = e.value;
        else if (e instanceof ErrPropagateSignal) result = { __type: 'enum', __name: 'Result', __variant: 'Err', __data: [e.error] } as import('../../lang/types.js').OSEnum;
        else { interp.env.popScope(); throw e; }
    }
    interp.env.popScope();
    return result;
}

export function callClosure(closure: OSClosure, args: OSValue[], line: number, col: number, interp: Interpreter): OSValue {
    interp.env.pushScope();
    for (let i = 0; i < closure.params.length; i++) interp.env.define(closure.params[i]!.name, args[i] ?? null, false);
    let result: OSValue = null;
    try { result = interp.eval(closure.body as ASTNode); }
    catch (e) {
        if (e instanceof ReturnSignal) result = e.value;
        else if (e instanceof ErrPropagateSignal) result = { __type: 'enum', __name: 'Result', __variant: 'Err', __data: [e.error] } as import('../../lang/types.js').OSEnum;
        else { interp.env.popScope(); throw e; }
    }
    interp.env.popScope();
    return result;
}

function suggestFn(name: string): string {
    const all = Array.from(STDLIB.keys());
    const close = all.find(k => k.toLowerCase().includes(name.toLowerCase().slice(0, 3)));
    return close ? `. Did you mean '${close}'?` : '';
}
