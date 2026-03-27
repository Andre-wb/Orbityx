import type { OSValue } from '../../lang/types.js';
export declare class ScopeStack {
    private scopes;
    reset(): void;
    push(): void;
    pop(): void;
    define(name: string, value: OSValue, mutable: boolean): void;
    get(name: string, line?: number, col?: number): OSValue;
    set(name: string, value: OSValue, line?: number, col?: number): void;
    has(name: string): boolean;
}
//# sourceMappingURL=scope-stack.d.ts.map