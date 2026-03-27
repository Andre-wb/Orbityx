import type { Program } from '../../lang/ast/index.js';
import type { Environment } from '../environment.js';

export function registerDeclarations(program: Program, env: Environment): void {
    for (const s of program.structs)  env.structDefs.set(s.name, s);
    for (const e of program.enums)    env.enumDefs.set(e.name, e);
    for (const t of program.traits)   env.traitDefs.set(t.name, t);
    for (const fn of program.functions) env.fnRegistry.set(fn.name, fn);
    for (const impl of program.impls) {
        const existing = env.implBlocks.get(impl.typeName) ?? [];
        existing.push(impl);
        env.implBlocks.set(impl.typeName, existing);
    }
}
