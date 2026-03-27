import type { VarEntry } from './var-entry.js';
export declare class Scope {
    readonly vars: Map<string, VarEntry>;
    get(name: string): VarEntry | undefined;
    set(name: string, entry: VarEntry): void;
    has(name: string): boolean;
}
//# sourceMappingURL=scope.d.ts.map