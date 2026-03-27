import { OrbitScriptError, } from '../../lang/types.js';
import { ReturnSignal, ErrPropagateSignal, hexToColor, isOSColor } from '../environment.js';
import { MACRO_REGISTRY } from '../macro/index.js';
import { indexString, sliceString, sliceArray } from './string-index.js';
import { BUILTIN_SERIES } from '../series/builtin-series.js';
export function evalExpr(node, interp) {
    switch (node.kind) {
        case 'NumberLit': return node.value;
        case 'StringLit': return node.value;
        case 'BoolLit': return node.value;
        case 'NoneLit': return null;
        case 'ColorLit': return hexToColor(node.hex);
        case 'SelfExpr': return interp.env.get('self', node.line, node.col);
        case 'Identifier': return interp.env.get(node.name, node.line, node.col);
        case 'BinaryExpr': return evalBinary(node, interp);
        case 'UnaryExpr': return evalUnary(node, interp);
        case 'IfExpr': return evalIf(node, interp);
        case 'MatchExpr': return evalMatch(node, interp);
        case 'BlockExpr': {
            interp.env.pushScope();
            let result = null;
            try {
                for (const s of node.body)
                    interp.execStatement(s);
                if (node.tail)
                    result = interp.eval(node.tail);
            }
            catch (e) {
                interp.env.popScope();
                throw e;
            }
            interp.env.popScope();
            return result;
        }
        case 'FnCallExpr': return interp.evalFnCall(node);
        case 'MethodCallExpr': return evalMethodCall(node, interp);
        case 'FieldAccessExpr': {
            const obj = interp.eval(node.object);
            return getField(obj, node.field, node.line, node.col);
        }
        case 'IndexExpr': {
            // Range history lookback:  seriesName[start..end]  or  seriesName[start..=end]
            if (node.index.kind === 'RangeExpr' && node.object.kind === 'Identifier') {
                const seriesName = node.object.name;
                const isBuiltin = BUILTIN_SERIES.has(seriesName);
                const isUserSeries = !isBuiltin && interp.env.seriesHistory.has(seriesName);
                if (isBuiltin || isUserSeries) {
                    const range = node.index;
                    const start = interp.eval(range.start);
                    const end = interp.eval(range.end);
                    if (typeof start !== 'number' || typeof end !== 'number') {
                        throw new OrbitScriptError('Range indices must be numbers', node.line, node.col, 'runtime');
                    }
                    const s = Math.round(start);
                    const e = Math.round(end);
                    const limit = range.inclusive ? e : e - 1;
                    const result = [];
                    for (let i = s; i <= limit; i++) {
                        result.push(interp.env.getHistory(seriesName, i, node.line, node.col));
                    }
                    return result;
                }
            }
            const obj = interp.eval(node.object);
            // Range slice:  obj[start..end]  or  obj[start..=end]
            if (node.index.kind === 'RangeExpr') {
                const range = node.index;
                const start = interp.eval(range.start);
                const end = interp.eval(range.end);
                if (typeof start !== 'number' || typeof end !== 'number') {
                    throw new OrbitScriptError('Range indices must be numbers', node.line, node.col, 'runtime');
                }
                if (typeof obj === 'string')
                    return sliceString(obj, Math.round(start), Math.round(end), range.inclusive);
                if (Array.isArray(obj))
                    return sliceArray(obj, Math.round(start), Math.round(end), range.inclusive);
                throw new OrbitScriptError(`Cannot slice ${typeof obj}`, node.line, node.col, 'runtime');
            }
            const idx = interp.eval(node.index);
            if (typeof idx !== 'number')
                throw new OrbitScriptError('Index must be a number', node.line, node.col, 'runtime');
            const i = Math.round(idx);
            if (typeof obj === 'string')
                return indexString(obj, i);
            if (Array.isArray(obj))
                return obj[i < 0 ? obj.length + i : i] ?? null;
            throw new OrbitScriptError(`Cannot index into ${typeof obj}`, node.line, node.col, 'runtime');
        }
        case 'HistoryRefExpr': {
            const offset = interp.eval(node.offset);
            if (typeof offset !== 'number')
                throw new OrbitScriptError('Index must be a number', node.line, node.col, 'runtime');
            if (node.series.kind === 'Identifier') {
                const name = node.series.name;
                // Runtime disambiguation: if the variable holds a string/array, do indexing — not history lookup
                if (!BUILTIN_SERIES.has(name) && interp.env.has(name)) {
                    const val = interp.env.get(name, node.line, node.col);
                    if (typeof val === 'string')
                        return indexString(val, Math.round(offset));
                    if (Array.isArray(val))
                        return val[Math.round(offset)] ?? null;
                }
                return interp.env.getHistory(name, Math.round(offset), node.line, node.col);
            }
            throw new OrbitScriptError('History reference requires a series identifier', node.line, node.col, 'runtime');
        }
        case 'MacroCallExpr': {
            const macro = MACRO_REGISTRY.get(node.name);
            if (!macro) {
                throw new OrbitScriptError(`Unknown macro '${node.name}!'`, node.line, node.col, 'runtime');
            }
            const evaledArgs = node.args.map(a => interp.eval(a));
            return macro(evaledArgs, node.args, interp.env, node.line, node.col);
        }
        case 'ClosureExpr': {
            const closure = {
                __type: 'closure',
                params: node.params.map(p => {
                    const ta = p.typeAnnotation?.kind === 'NamedType' ? p.typeAnnotation.name : undefined;
                    return ta ? { name: p.name, typeAnnotation: ta } : { name: p.name };
                }),
                body: node.body,
                capturedEnv: new Map(),
            };
            return closure;
        }
        case 'StructInitExpr': {
            const fields = {};
            for (const f of node.fields)
                fields[f.name] = interp.eval(f.value);
            return { __type: 'struct', __name: node.typeName, fields };
        }
        case 'EnumVariantExpr': {
            const data = node.args.map(a => interp.eval(a));
            return { __type: 'enum', __name: node.enumName, __variant: node.variant, __data: data };
        }
        case 'PathExpr': {
            if (node.segments[0] === 'color' && node.segments.length === 2) {
                const colorName = node.segments[1];
                const c = interp.env.resolveColorConst(colorName);
                if (c)
                    return c;
                throw new OrbitScriptError(`Unknown color constant 'color::${colorName}'`, node.line, node.col, 'runtime');
            }
            if (node.segments.length === 2) {
                const [typeName, variant] = node.segments;
                const enumDef = interp.env.enumDefs.get(typeName);
                if (enumDef) {
                    const v = enumDef.variants.find(v => v.name === variant);
                    if (v)
                        return { __type: 'enum', __name: typeName, __variant: variant, __data: [] };
                }
                throw new OrbitScriptError(`Unknown path '${node.segments.join('::')}' `, node.line, node.col, 'runtime');
            }
            throw new OrbitScriptError(`Cannot evaluate path '${node.segments.join('::')}' as expression`, node.line, node.col, 'runtime');
        }
        case 'RangeExpr': {
            const start = Math.round(interp.eval(node.start));
            const end = Math.round(interp.eval(node.end));
            const arr = [];
            const limit = node.inclusive ? end : end - 1;
            for (let i = start; i <= limit; i++)
                arr.push(i);
            return arr;
        }
        case 'TupleExpr': return node.elements.map(e => interp.eval(e));
        case 'ArrayLitExpr': return node.elements.map(e => interp.eval(e));
        case 'SomeExpr': return interp.eval(node.value);
        case 'QuestionExpr': {
            const v = interp.eval(node.expr);
            // Result enum support: Ok(v) propagates value, Err(e) propagates error
            if (v && typeof v === 'object' && !Array.isArray(v) && v.__type === 'enum') {
                const enumVal = v;
                if (enumVal.__name === 'Result' || enumVal.__variant === 'Ok' || enumVal.__variant === 'Err') {
                    if (enumVal.__variant === 'Err')
                        throw new ErrPropagateSignal(enumVal.__data[0] ?? null);
                    if (enumVal.__variant === 'Ok')
                        return enumVal.__data[0] ?? null;
                }
            }
            if (v === null || (typeof v === 'number' && isNaN(v)))
                throw new ReturnSignal(null);
            return v;
        }
    }
}
function evalBinary(node, interp) {
    const L = interp.eval(node.left);
    if (node.op === '&&')
        return isTruthy(L) ? interp.eval(node.right) : false;
    if (node.op === '||')
        return isTruthy(L) ? true : interp.eval(node.right);
    const R = interp.eval(node.right);
    switch (node.op) {
        case '+':
            if (typeof L === 'string' || typeof R === 'string')
                return String(L) + String(R);
            return L + R;
        case '-': return L - R;
        case '*': return L * R;
        case '/': return R !== 0 ? L / R : NaN;
        case '%': return L % R;
        case '**': return Math.pow(L, R);
        case '==': return osEqual(L, R);
        case '!=': return !osEqual(L, R);
        case '<': return L < R;
        case '>': return L > R;
        case '<=': return L <= R;
        case '>=': return L >= R;
    }
    return null;
}
function osEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a === 'number' && typeof b === 'number')
        return a === b;
    if (typeof a === 'string' && typeof b === 'string')
        return a === b;
    if (a === null && b === null)
        return true;
    return false;
}
function evalUnary(node, interp) {
    const v = interp.eval(node.operand);
    switch (node.op) {
        case '-': return -v;
        case '!': return !isTruthy(v);
    }
}
export function evalIf(node, interp) {
    const cond = isTruthy(interp.eval(node.condition));
    if (cond)
        return execBlock(node.thenBranch, interp);
    if (node.elseBranch === null)
        return null;
    if (Array.isArray(node.elseBranch))
        return execBlock(node.elseBranch, interp);
    return evalIf(node.elseBranch, interp);
}
export function execBlock(stmts, interp) {
    interp.env.pushScope();
    let result = null;
    try {
        for (let i = 0; i < stmts.length; i++) {
            const s = stmts[i];
            if (i === stmts.length - 1 && s.kind === 'ExprStmt')
                result = interp.eval(s.expr);
            else
                interp.execStatement(s);
        }
    }
    catch (e) {
        interp.env.popScope();
        throw e;
    }
    interp.env.popScope();
    return result;
}
function evalMatch(node, interp) {
    const value = interp.eval(node.value);
    for (const arm of node.arms) {
        const bindings = new Map();
        if (matchPattern(arm.pattern, value, bindings, interp)) {
            interp.env.pushScope();
            for (const [name, val] of bindings)
                interp.env.define(name, val, false);
            let result;
            try {
                result = interp.eval(arm.body);
            }
            catch (e) {
                interp.env.popScope();
                throw e;
            }
            interp.env.popScope();
            return result;
        }
    }
    return null;
}
function matchPattern(pattern, value, bindings, interp) {
    switch (pattern.kind) {
        case 'WildcardPattern': return true;
        case 'NonePattern': return value === null;
        case 'SomePattern': return value !== null && matchPattern(pattern.inner, value, bindings, interp);
        case 'IdentPattern':
            bindings.set(pattern.name, value);
            return true;
        case 'LiteralPattern': return osEqual(interp.eval(pattern.value), value);
        case 'EnumPattern': {
            if (typeof value !== 'object' || value === null)
                return false;
            const e = value;
            if (e.__type !== 'enum')
                return false;
            if (e.__name !== pattern.typeName || e.__variant !== pattern.variant)
                return false;
            for (let i = 0; i < pattern.bindings.length; i++)
                bindings.set(pattern.bindings[i], e.__data[i] ?? null);
            return true;
        }
        case 'TuplePattern': {
            if (!Array.isArray(value))
                return false;
            const arr = value;
            if (arr.length !== pattern.patterns.length)
                return false;
            return pattern.patterns.every((p, i) => matchPattern(p, arr[i], bindings, interp));
        }
        case 'GuardPattern': {
            if (!matchPattern(pattern.pattern, value, bindings, interp))
                return false;
            interp.env.pushScope();
            for (const [name, val] of bindings)
                interp.env.define(name, val, false);
            const guardResult = isTruthy(interp.eval(pattern.guard));
            interp.env.popScope();
            return guardResult;
        }
    }
}
function evalMethodCall(node, interp) {
    const receiver = interp.eval(node.receiver);
    const method = node.method;
    const args = node.args.map(a => interp.eval(a));
    if (Array.isArray(receiver))
        return callArrayMethod(receiver, method, args, node.line, node.col, interp);
    if (typeof receiver === 'string')
        return callStringMethod(receiver, method, args, node.line, node.col);
    if (receiver && typeof receiver === 'object' && '__type' in receiver) {
        const obj = receiver;
        if (obj.__type === 'enum') {
            const enumVal = obj;
            if (enumVal.__variant === 'Ok' || enumVal.__variant === 'Err') {
                switch (method) {
                    case 'is_ok': return enumVal.__variant === 'Ok';
                    case 'is_err': return enumVal.__variant === 'Err';
                    case 'unwrap':
                        if (enumVal.__variant === 'Err')
                            throw new OrbitScriptError(`Called unwrap() on Err: ${enumVal.__data[0]}`, node.line, node.col, 'runtime');
                        return enumVal.__data[0] ?? null;
                    case 'unwrap_or':
                        return enumVal.__variant === 'Ok' ? (enumVal.__data[0] ?? null) : (args[0] ?? null);
                }
            }
        }
        if (obj.__type === 'struct') {
            const fnDef = interp.env.resolveMethod(obj.__name, method);
            if (fnDef)
                return interp.callUserFn(fnDef, args, obj, node.line, node.col);
        }
    }
    if (isOSColor(receiver)) {
        if (method === 'with_alpha') {
            const alpha = typeof args[0] === 'number' ? args[0] : 1;
            return { ...receiver, a: alpha };
        }
    }
    throw new OrbitScriptError(`No method '${method}' on ${typeof receiver}`, node.line, node.col, 'runtime');
}
function callArrayMethod(arr, method, args, line, col, interp) {
    switch (method) {
        case 'len': return arr.length;
        case 'is_empty': return arr.length === 0;
        case 'push':
            arr.push(args[0] ?? null);
            return null;
        case 'pop': return arr.length > 0 ? arr.pop() ?? null : null;
        case 'get': return arr[Math.round(args[0])] ?? null;
        case 'contains': return arr.some(v => osEqual(v, args[0] ?? null));
        case 'first': return arr[0] ?? null;
        case 'last': return arr[arr.length - 1] ?? null;
        case 'reverse': return [...arr].reverse();
        case 'sort': return [...arr].sort((a, b) => a - b);
        case 'slice': return arr.slice(Math.round(args[0]), Math.round(args[1]));
        case 'max': {
            const nums = arr.filter(v => typeof v === 'number');
            return nums.length ? Math.max(...nums) : null;
        }
        case 'min': {
            const nums = arr.filter(v => typeof v === 'number');
            return nums.length ? Math.min(...nums) : null;
        }
        case 'sum': return arr.reduce((s, v) => s + v, 0);
        case 'avg': {
            const nums = arr.filter(v => typeof v === 'number');
            return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : NaN;
        }
        case 'map': {
            const fn = args[0];
            if (!fn || typeof fn !== 'object' || fn.__type !== 'closure')
                throw new OrbitScriptError('map() requires a closure argument', line, col, 'runtime');
            return arr.map(item => interp.callClosure(fn, [item], line, col));
        }
        case 'filter': {
            const fn = args[0];
            if (!fn || typeof fn !== 'object' || fn.__type !== 'closure')
                throw new OrbitScriptError('filter() requires a closure argument', line, col, 'runtime');
            return arr.filter(item => isTruthy(interp.callClosure(fn, [item], line, col)));
        }
        case 'reduce': {
            const init = args[0];
            const fn = args[1];
            if (!fn || typeof fn !== 'object' || fn.__type !== 'closure')
                throw new OrbitScriptError('reduce() requires a closure argument', line, col, 'runtime');
            return arr.reduce((acc, item) => interp.callClosure(fn, [acc, item], line, col), init ?? null);
        }
        default: throw new OrbitScriptError(`No method '${method}' on array`, line, col, 'runtime');
    }
}
function callStringMethod(s, method, args, line, col) {
    switch (method) {
        case 'len': return s.length;
        case 'is_empty': return s.length === 0;
        case 'contains': return s.includes(args[0]);
        case 'starts_with': return s.startsWith(args[0]);
        case 'ends_with': return s.endsWith(args[0]);
        case 'to_upper': return s.toUpperCase();
        case 'to_lower': return s.toLowerCase();
        case 'trim': return s.trim();
        case 'split': return s.split(args[0] ?? '');
        case 'replace': return s.replace(args[0], args[1] ?? '');
        default: throw new OrbitScriptError(`No method '${method}' on str`, line, col, 'runtime');
    }
}
function getField(obj, field, line, col) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        if ('__type' in obj) {
            const s = obj;
            if (s.__type === 'struct' && field in s.fields)
                return s.fields[field] ?? null;
            const e = obj;
            if (e.__type === 'enum') {
                if (field === '__variant')
                    return e.__variant;
                if (field === '__name')
                    return e.__name;
            }
        }
        if (field === 'r' || field === 'g' || field === 'b' || field === 'a' || field === 'hex') {
            return obj[field] ?? null;
        }
    }
    throw new OrbitScriptError(`No field '${field}' on ${typeof obj}`, line, col, 'runtime');
}
export function isTruthy(v) {
    if (v === null || v === false)
        return false;
    if (typeof v === 'number')
        return !isNaN(v) && v !== 0;
    if (typeof v === 'string')
        return v.length > 0;
    return true;
}
//# sourceMappingURL=expr-eval.js.map