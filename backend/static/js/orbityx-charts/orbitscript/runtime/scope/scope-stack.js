import { OrbitScriptError } from '../../lang/error.js';
import { Scope } from './scope.js';
export class ScopeStack {
    scopes = [new Scope()];
    reset() { this.scopes = [new Scope()]; }
    push() { this.scopes.push(new Scope()); }
    pop() { if (this.scopes.length > 1)
        this.scopes.pop(); }
    define(name, value, mutable) {
        const scope = this.scopes[this.scopes.length - 1];
        scope.set(name, { value, mutable });
    }
    get(name, line = 0, col = 0) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const entry = this.scopes[i].get(name);
            if (entry)
                return entry.value;
        }
        throw new OrbitScriptError(`Undefined variable '${name}'`, line, col, 'runtime');
    }
    set(name, value, line = 0, col = 0) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const scope = this.scopes[i];
            const entry = scope.get(name);
            if (entry) {
                if (!entry.mutable) {
                    throw new OrbitScriptError(`Cannot assign to immutable variable '${name}'`, line, col, 'runtime');
                }
                scope.set(name, { value, mutable: true });
                return;
            }
        }
        throw new OrbitScriptError(`Undefined variable '${name}'`, line, col, 'runtime');
    }
    has(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name))
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=scope-stack.js.map