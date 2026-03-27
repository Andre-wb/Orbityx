import type { FnDef, ImplBlock } from '../../lang/ast/index.js';

export class ImplRegistry {
    private readonly blocks = new Map<string, ImplBlock[]>();

    register(impl: ImplBlock): void {
        const existing = this.blocks.get(impl.typeName) ?? [];
        existing.push(impl);
        this.blocks.set(impl.typeName, existing);
    }

    resolveMethod(typeName: string, methodName: string): FnDef | null {
        const implBlocks = this.blocks.get(typeName) ?? [];
        for (const block of implBlocks) {
            const fn = block.methods.find(m => m.name === methodName);
            if (fn) return fn;
        }
        return null;
    }

    getAll(): Map<string, ImplBlock[]> {
        return this.blocks;
    }
}
