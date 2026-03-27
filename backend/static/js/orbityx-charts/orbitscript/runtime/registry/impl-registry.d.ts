import type { FnDef, ImplBlock } from '../../lang/ast/index.js';
export declare class ImplRegistry {
    private readonly blocks;
    register(impl: ImplBlock): void;
    resolveMethod(typeName: string, methodName: string): FnDef | null;
    getAll(): Map<string, ImplBlock[]>;
}
//# sourceMappingURL=impl-registry.d.ts.map