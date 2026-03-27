export type { MacroFn }    from './macro-def.js';
export { MacroRegistry }   from './macro-registry.js';

import { MacroRegistry }    from './macro-registry.js';
import { printlnMacro }     from './builtins/println-macro.js';
import { dbgMacro }         from './builtins/dbg-macro.js';
import { assertMacro }      from './builtins/assert-macro.js';
import { panicMacro }       from './builtins/panic-macro.js';
import { formatMacro }      from './builtins/format-macro.js';
import { todoMacro }        from './builtins/todo-macro.js';
import { unreachableMacro } from './builtins/unreachable-macro.js';
import { vecMacro }         from './builtins/vec-macro.js';

/** Singleton macro registry with all built-in macros pre-registered. */
export const MACRO_REGISTRY = new MacroRegistry();

MACRO_REGISTRY.register('println',     printlnMacro);
MACRO_REGISTRY.register('print',       printlnMacro);
MACRO_REGISTRY.register('eprintln',    printlnMacro);
MACRO_REGISTRY.register('dbg',         dbgMacro);
MACRO_REGISTRY.register('assert',      assertMacro);
MACRO_REGISTRY.register('assert_eq',   assertMacro);  // assert_eq!(a, b) uses same logic
MACRO_REGISTRY.register('panic',       panicMacro);
MACRO_REGISTRY.register('format',      formatMacro);
MACRO_REGISTRY.register('todo',        todoMacro);
MACRO_REGISTRY.register('unreachable', unreachableMacro);
MACRO_REGISTRY.register('vec',         vecMacro);
