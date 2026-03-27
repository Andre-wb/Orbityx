import type { MacroFn } from './macro-def.js';

/** Registry of all available macros. Supports runtime extension. */
export class MacroRegistry {
    private readonly macros = new Map<string, MacroFn>();

    register(name: string, fn: MacroFn): void {
        this.macros.set(name, fn);
    }

    get(name: string): MacroFn | undefined {
        return this.macros.get(name);
    }

    has(name: string): boolean {
        return this.macros.has(name);
    }

    names(): string[] {
        return Array.from(this.macros.keys());
    }
}
