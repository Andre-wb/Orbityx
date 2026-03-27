import type { ASTNode } from '../../lang/ast/index.js';
import type { OSValue } from '../../lang/types.js';
import type { Environment } from '../environment.js';
import { SERIES_FUNS } from './series-fns-set.js';

export function resolveSeriesArg(node: ASTNode, env: Environment): number[] | null {
    if (node.kind === 'Identifier') {
        const name = node.name;
        const builtins = ['open','high','low','close','volume'];
        if (builtins.includes(name)) return env.getBuiltinSeriesArray(name);
        const hist = env.seriesHistory.get(name);
        if (hist) return hist;
        for (const [key, arr] of env.seriesCache) {
            if (key === name) return arr;
        }
    }
    return null;
}

export function resolveCallArgs(
    argNodes: ASTNode[],
    fnName: string,
    env: Environment,
    evalFn: (node: ASTNode) => OSValue,
): OSValue[] {
    const isSeriesFn = SERIES_FUNS.has(fnName);
    return argNodes.map(arg => {
        if (isSeriesFn) {
            const arr = resolveSeriesArg(arg, env);
            if (arr) return arr;
        }
        return evalFn(arg);
    });
}
