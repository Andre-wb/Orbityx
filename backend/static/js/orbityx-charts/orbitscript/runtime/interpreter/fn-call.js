import { OrbitScriptError } from '../../lang/types.js';
import { ReturnSignal, ErrPropagateSignal } from '../environment.js';
import { STDLIB } from '../stdlib/index.js';
import { resolveCallArgs } from './call-args.js';
export function evalFnCall(node, interp) {
    const name = node.callee;
    const stdFn = STDLIB.get(name);
    if (stdFn) {
        const args = resolveCallArgs(node.args, name, interp.env, n => interp.eval(n));
        return stdFn(args, interp.env, node.line, node.col);
    }
    const fnDef = interp.env.fnRegistry.get(name);
    if (fnDef)
        return callUserFn(fnDef, node.args.map(a => interp.eval(a)), null, node.line, node.col, interp);
    try {
        const maybeClosureVal = interp.env.get(name, node.line, node.col);
        if (maybeClosureVal && typeof maybeClosureVal === 'object' && maybeClosureVal.__type === 'closure') {
            return callClosure(maybeClosureVal, node.args.map(a => interp.eval(a)), node.line, node.col, interp);
        }
    }
    catch { /* not a variable */ }
    throw new OrbitScriptError(`Unknown function '${name}'${suggestFn(name)}`, node.line, node.col, 'runtime');
}
export function callUserFn(fn, args, selfValue, line, col, interp) {
    interp.env.pushScope();
    if (selfValue)
        interp.env.define('self', selfValue, false);
    for (let i = 0; i < fn.params.length; i++) {
        const param = fn.params[i];
        if (param.isSelf)
            continue;
        const argVal = args[i] ?? (param.defaultValue ? interp.eval(param.defaultValue) : null);
        interp.env.define(param.name, argVal, false);
    }
    let result = null;
    try {
        for (let i = 0; i < fn.body.length; i++) {
            const stmt = fn.body[i];
            if (i === fn.body.length - 1 && stmt.kind === 'ExprStmt')
                result = interp.eval(stmt.expr);
            else
                interp.execStatement(stmt);
        }
    }
    catch (e) {
        if (e instanceof ReturnSignal)
            result = e.value;
        else if (e instanceof ErrPropagateSignal)
            result = { __type: 'enum', __name: 'Result', __variant: 'Err', __data: [e.error] };
        else {
            interp.env.popScope();
            throw e;
        }
    }
    interp.env.popScope();
    return result;
}
export function callClosure(closure, args, line, col, interp) {
    interp.env.pushScope();
    for (let i = 0; i < closure.params.length; i++)
        interp.env.define(closure.params[i].name, args[i] ?? null, false);
    let result = null;
    try {
        result = interp.eval(closure.body);
    }
    catch (e) {
        if (e instanceof ReturnSignal)
            result = e.value;
        else if (e instanceof ErrPropagateSignal)
            result = { __type: 'enum', __name: 'Result', __variant: 'Err', __data: [e.error] };
        else {
            interp.env.popScope();
            throw e;
        }
    }
    interp.env.popScope();
    return result;
}
function suggestFn(name) {
    const all = Array.from(STDLIB.keys());
    const close = all.find(k => k.toLowerCase().includes(name.toLowerCase().slice(0, 3)));
    return close ? `. Did you mean '${close}'?` : '';
}
//# sourceMappingURL=fn-call.js.map