import type { ASTNode } from '../../lang/ast/index.js';
import type { OSValue } from '../../lang/value/index.js';
import type { Environment } from '../environment.js';

/**
 * A macro function receives both the evaluated argument values and the
 * original AST nodes (needed by dbg! to show the expression text).
 */
export type MacroFn = (
    args:    OSValue[],
    rawArgs: ASTNode[],
    env:     Environment,
    line:    number,
    col:     number,
) => OSValue;
