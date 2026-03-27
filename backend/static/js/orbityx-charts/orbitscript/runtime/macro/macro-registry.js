/** Registry of all available macros. Supports runtime extension. */
export class MacroRegistry {
    macros = new Map();
    register(name, fn) {
        this.macros.set(name, fn);
    }
    get(name) {
        return this.macros.get(name);
    }
    has(name) {
        return this.macros.has(name);
    }
    names() {
        return Array.from(this.macros.keys());
    }
}
//# sourceMappingURL=macro-registry.js.map