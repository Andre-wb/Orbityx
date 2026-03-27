import { OrbitScriptError } from '../../lang/types.js';
import { ReturnSignal, BreakSignal, ContinueSignal } from '../environment.js';
import { execBlock } from './expr-eval.js';
export { execBlock };
export function execStatement(stmt, interp) {
    switch (stmt.kind) {
        case 'LetStmt': {
            const value = stmt.init ? interp.eval(stmt.init) : null;
            interp.env.define(stmt.name, value, stmt.mutable);
            interp.env.recordBarValue(stmt.name, value);
            break;
        }
        case 'AssignStmt': {
            const value = evalAssignRhs(stmt.op, stmt.target, interp.eval(stmt.value), interp, stmt.line, stmt.col);
            if (stmt.target.kind === 'Identifier') {
                interp.env.set(stmt.target.name, value, stmt.line, stmt.col);
                interp.env.recordBarValue(stmt.target.name, value);
            }
            else if (stmt.target.kind === 'FieldAccessExpr') {
                const obj = interp.eval(stmt.target.object);
                if (obj && typeof obj === 'object' && '__type' in obj) {
                    obj.fields[stmt.target.field] = value;
                }
            }
            else if (stmt.target.kind === 'IndexExpr') {
                const arr = interp.eval(stmt.target.object);
                const idx = interp.eval(stmt.target.index);
                if (Array.isArray(arr) && typeof idx === 'number') {
                    const i = Math.round(idx);
                    arr[i < 0 ? arr.length + i : i] = value;
                }
            }
            break;
        }
        case 'ExprStmt': {
            interp.eval(stmt.expr);
            break;
        }
        case 'ReturnStmt': {
            throw new ReturnSignal(stmt.value ? interp.eval(stmt.value) : null);
        }
        case 'BreakStmt': throw new BreakSignal();
        case 'ContinueStmt': throw new ContinueSignal();
        case 'ForStmt': {
            const iterable = interp.eval(stmt.iterable);
            const items = iterableToArray(iterable, stmt.line, stmt.col);
            for (const item of items) {
                interp.env.pushScope();
                interp.env.define(stmt.varName, item, false);
                try {
                    for (const s of stmt.body)
                        execStatement(s, interp);
                }
                catch (e) {
                    if (e instanceof BreakSignal) {
                        interp.env.popScope();
                        break;
                    }
                    if (e instanceof ContinueSignal) {
                        interp.env.popScope();
                        continue;
                    }
                    interp.env.popScope();
                    throw e;
                }
                interp.env.popScope();
            }
            break;
        }
        case 'WhileStmt': {
            while (isTruthyVal(interp.eval(stmt.condition))) {
                interp.env.pushScope();
                try {
                    for (const s of stmt.body)
                        execStatement(s, interp);
                }
                catch (e) {
                    if (e instanceof BreakSignal) {
                        interp.env.popScope();
                        break;
                    }
                    if (e instanceof ContinueSignal) {
                        interp.env.popScope();
                        continue;
                    }
                    interp.env.popScope();
                    throw e;
                }
                interp.env.popScope();
            }
            break;
        }
        case 'LoopStmt': {
            while (true) {
                interp.env.pushScope();
                try {
                    for (const s of stmt.body)
                        execStatement(s, interp);
                }
                catch (e) {
                    if (e instanceof BreakSignal) {
                        interp.env.popScope();
                        break;
                    }
                    if (e instanceof ContinueSignal) {
                        interp.env.popScope();
                        continue;
                    }
                    interp.env.popScope();
                    throw e;
                }
                interp.env.popScope();
            }
            break;
        }
    }
}
function evalAssignRhs(op, target, rhs, interp, line, col) {
    if (op === '=')
        return rhs;
    const current = interp.eval(target);
    if (typeof current !== 'number' || typeof rhs !== 'number') {
        throw new OrbitScriptError(`Compound assignment '${op}' requires numeric operands`, line, col, 'runtime');
    }
    switch (op) {
        case '+=': return current + rhs;
        case '-=': return current - rhs;
        case '*=': return current * rhs;
        case '/=': return rhs !== 0 ? current / rhs : NaN;
        case '%=': return current % rhs;
    }
    return rhs;
}
function iterableToArray(v, line, col) {
    if (Array.isArray(v))
        return v;
    throw new OrbitScriptError(`Cannot iterate over ${typeof v}`, line, col, 'runtime');
}
function isTruthyVal(v) {
    if (v === null || v === false)
        return false;
    if (typeof v === 'number')
        return !isNaN(v) && v !== 0;
    if (typeof v === 'string')
        return v.length > 0;
    return true;
}
//# sourceMappingURL=stmt-exec.js.map