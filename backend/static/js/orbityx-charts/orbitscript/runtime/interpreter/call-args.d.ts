import type { ASTNode } from '../../lang/ast/index.js';
import type { OSValue } from '../../lang/types.js';
import type { Environment } from '../environment.js';
export declare function resolveSeriesArg(node: ASTNode, env: Environment): number[] | null;
export declare function resolveCallArgs(argNodes: ASTNode[], fnName: string, env: Environment, evalFn: (node: ASTNode) => OSValue): OSValue[];
//# sourceMappingURL=call-args.d.ts.map