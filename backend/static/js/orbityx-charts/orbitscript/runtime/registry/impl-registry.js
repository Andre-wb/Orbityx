export class ImplRegistry {
    blocks = new Map();
    register(impl) {
        const existing = this.blocks.get(impl.typeName) ?? [];
        existing.push(impl);
        this.blocks.set(impl.typeName, existing);
    }
    resolveMethod(typeName, methodName) {
        const implBlocks = this.blocks.get(typeName) ?? [];
        for (const block of implBlocks) {
            const fn = block.methods.find(m => m.name === methodName);
            if (fn)
                return fn;
        }
        return null;
    }
    getAll() {
        return this.blocks;
    }
}
//# sourceMappingURL=impl-registry.js.map