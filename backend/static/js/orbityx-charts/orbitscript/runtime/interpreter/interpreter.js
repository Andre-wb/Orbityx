import { OrbitScriptError, } from '../../lang/types.js';
import { Environment, ReturnSignal, BreakSignal, ContinueSignal, hexToColor, } from '../environment.js';
import { resetPlotCounter } from '../stdlib/index.js';
import { registerDeclarations } from './decl-register.js';
import { evalExpr } from './expr-eval.js';
import { execStatement as _execStatement } from './stmt-exec.js';
import { evalFnCall as _evalFnCall, callUserFn as _callUserFn, callClosure as _callClosure } from './fn-call.js';
import { STDLIB } from '../stdlib/index.js';
// ─── Interpreter ──────────────────────────────────────────────────────────────
export class Interpreter {
    env;
    constructor() { this.env = new Environment(); }
    interpret(program, candles, inputs = new Map()) {
        const meta = this.extractMeta(program);
        const mergedInputs = new Map();
        for (const def of meta.inputs)
            mergedInputs.set(def.name, def.defaultValue);
        for (const [k, v] of inputs)
            mergedInputs.set(k, v);
        registerDeclarations(program, this.env);
        this.env.initRun(candles, mergedInputs);
        for (let i = 0; i < candles.length; i++) {
            this.env.setBar(i);
            resetPlotCounter();
            try {
                for (const stmt of program.body)
                    this.execStatement(stmt);
            }
            catch (e) {
                if (e instanceof ReturnSignal) { /* top-level return */ }
                else if (e instanceof BreakSignal || e instanceof ContinueSignal) { /* ignore */ }
                else
                    throw e;
            }
        }
        return { meta, outputs: this.env.getOutputs() };
    }
    extractMeta(program) {
        let name = 'Custom Script';
        let overlay = false;
        let kind = 'indicator';
        const inputs = [];
        let version;
        let timezone;
        for (const dir of program.directives) {
            if (dir.name === 'indicator' || dir.name === 'strategy' || dir.name === 'library') {
                kind = dir.name;
                for (const arg of dir.args) {
                    if (arg.key === '0' || arg.key === 'name')
                        name = this.evalLiteral(arg.value) ?? name;
                    else if (arg.key === 'overlay')
                        overlay = this.evalLiteral(arg.value) === true;
                }
            }
            if (dir.name === 'version') {
                const arg = dir.args[0];
                if (arg)
                    version = String(this.evalLiteral(arg.value) ?? '');
            }
            if (dir.name === 'timezone') {
                const arg = dir.args[0];
                if (arg)
                    timezone = String(this.evalLiteral(arg.value) ?? '');
            }
            if (dir.name === 'input') {
                const inputDef = this.parseInputDirective(dir);
                if (inputDef)
                    inputs.push(inputDef);
            }
        }
        return { kind, name, overlay, inputs, ...(version !== undefined ? { version } : {}), ...(timezone !== undefined ? { timezone } : {}) };
    }
    parseInputDirective(dir) {
        let inputName = '';
        let inputType = 'f64';
        let defaultValue = 0;
        let min;
        let max;
        let step;
        for (const arg of dir.args) {
            if (arg.key === 'min') {
                min = this.evalLiteral(arg.value);
                continue;
            }
            if (arg.key === 'max') {
                max = this.evalLiteral(arg.value);
                continue;
            }
            if (arg.key === 'step') {
                step = this.evalLiteral(arg.value);
                continue;
            }
            if (arg.key === '0') {
                if (arg.value.kind === 'Identifier')
                    inputName = arg.value.name;
                else
                    defaultValue = this.evalLiteral(arg.value) ?? 0;
                continue;
            }
            if (arg.key === 'name') {
                inputName = this.evalLiteral(arg.value);
                continue;
            }
            if (arg.key === 'type') {
                inputType = this.evalLiteral(arg.value);
                continue;
            }
            if (arg.key === 'default') {
                defaultValue = this.evalLiteral(arg.value) ?? 0;
                continue;
            }
            if (arg.key === '1') {
                const v = this.evalLiteral(arg.value);
                if (typeof v === 'string')
                    inputType = v;
                continue;
            }
            if (arg.key === '2') {
                defaultValue = this.evalLiteral(arg.value) ?? 0;
                continue;
            }
        }
        if (!inputName)
            return null;
        return { name: inputName, type: inputType, defaultValue, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(step !== undefined ? { step } : {}) };
    }
    evalLiteral(node) {
        switch (node.kind) {
            case 'NumberLit': return node.value;
            case 'StringLit': return node.value;
            case 'BoolLit': return node.value;
            case 'ColorLit': return hexToColor(node.hex);
            case 'NoneLit': return null;
            case 'Identifier': return node.name;
            default: return null;
        }
    }
    eval(node) { return evalExpr(node, this); }
    execStatement(stmt) { _execStatement(stmt, this); }
    callUserFn(fn, args, selfValue, line, col) {
        return _callUserFn(fn, args, selfValue, line, col, this);
    }
    evalFnCall(node) {
        return _evalFnCall(node, this);
    }
    callClosure(closure, args, line, col) {
        return _callClosure(closure, args, line, col, this);
    }
    callStaticMethod(typeName, methodName, args, line, col) {
        const resolvedArgs = args.map(a => this.eval(a));
        const fnDef = this.env.resolveMethod(typeName, methodName);
        if (fnDef)
            return this.callUserFn(fnDef, resolvedArgs, null, line, col);
        if (typeName === 'color') {
            const stdFn = STDLIB.get(`color::${methodName}`);
            if (stdFn)
                return stdFn(resolvedArgs, this.env, line, col);
        }
        throw new OrbitScriptError(`No static method '${typeName}::${methodName}'`, line, col, 'runtime');
    }
}
//# sourceMappingURL=interpreter.js.map