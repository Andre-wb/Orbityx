/**
 * @file orbitscript/runtime/stdlib/time-fns.ts
 * @description Time-based stdlib functions. All functions read the current bar's
 *              timestamp (unix ms, UTC) from env.candles[env.barIndex].timestamp.
 */
function barTs(env) {
    const candle = env.candles[env.barIndex];
    return candle ? candle.timestamp : NaN;
}
export const entries = [
    ['time', (_args, env) => barTs(env)],
    ['dayofweek', (_args, env) => {
            const ts = barTs(env);
            if (!isFinite(ts))
                return NaN;
            return new Date(ts).getUTCDay();
        }],
    ['hour', (_args, env) => {
            const ts = barTs(env);
            if (!isFinite(ts))
                return NaN;
            return new Date(ts).getUTCHours();
        }],
    ['minute', (_args, env) => {
            const ts = barTs(env);
            if (!isFinite(ts))
                return NaN;
            return new Date(ts).getUTCMinutes();
        }],
    ['month', (_args, env) => {
            const ts = barTs(env);
            if (!isFinite(ts))
                return NaN;
            return new Date(ts).getUTCMonth() + 1;
        }],
    ['year', (_args, env) => {
            const ts = barTs(env);
            if (!isFinite(ts))
                return NaN;
            return new Date(ts).getUTCFullYear();
        }],
];
//# sourceMappingURL=time-fns.js.map