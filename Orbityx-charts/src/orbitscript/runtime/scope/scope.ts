import type { OSValue } from '../../lang/types.js';
import type { VarEntry } from './var-entry.js';

export class Scope {
    readonly vars = new Map<string, VarEntry>();
    get(name: string): VarEntry | undefined { return this.vars.get(name); }
    set(name: string, entry: VarEntry): void  { this.vars.set(name, entry); }
    has(name: string): boolean               { return this.vars.has(name); }
}
