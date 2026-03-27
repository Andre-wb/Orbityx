import { SERIES_FUNS } from './series-fns-set.js';
export function resolveSeriesArg(node, env) {
    if (node.kind === 'Identifier') {
        const name = node.name;
        const builtins = ['open', 'high', 'low', 'close', 'volume'];
        if (builtins.includes(name))
            return env.getBuiltinSeriesArray(name);
        const hist = env.seriesHistory.get(name);
        if (hist)
            return hist;
        for (const [key, arr] of env.seriesCache) {
            if (key === name)
                return arr;
        }
    }
    return null;
}
export function resolveCallArgs(argNodes, fnName, env, evalFn) {
    const isSeriesFn = SERIES_FUNS.has(fnName);
    return argNodes.map(arg => {
        if (isSeriesFn) {
            const arr = resolveSeriesArg(arg, env);
            if (arr)
                return arr;
        }
        return evalFn(arg);
    });
}
//# sourceMappingURL=call-args.js.map