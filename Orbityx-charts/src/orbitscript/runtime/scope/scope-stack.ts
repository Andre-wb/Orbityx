import type { OSValue } from '../../lang/types.js';
import { OrbitScriptError } from '../../lang/error.js';
import { Scope } from './scope.js';

export class ScopeStack {
    private scopes: Scope[] = [new Scope()];

    reset(): void { this.scopes = [new Scope()]; }

    push(): void  { this.scopes.push(new Scope()); }
    pop(): void   { if (this.scopes.length > 1) this.scopes.pop(); }

    define(name: string, value: OSValue, mutable: boolean): void {
        const scope = this.scopes[this.scopes.length - 1]!;
        scope.set(name, { value, mutable });
    }

    get(name: string, line = 0, col = 0): OSValue {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const entry = this.scopes[i]!.get(name);
            if (entry) return entry.value;
        }
        throw new OrbitScriptError(`Undefined variable '${name}'`, line, col, 'runtime');
    }

    set(name: string, value: OSValue, line = 0, col = 0): void {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const scope = this.scopes[i]!;
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

    has(name: string): boolean {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i]!.has(name)) return true;
        }
        return false;
    }
}
