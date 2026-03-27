import type { MacroFn } from './macro-def.js';
/** Registry of all available macros. Supports runtime extension. */
export declare class MacroRegistry {
    private readonly macros;
    register(name: string, fn: MacroFn): void;
    get(name: string): MacroFn | undefined;
    has(name: string): boolean;
    names(): string[];
}
//# sourceMappingURL=macro-registry.d.ts.map