import type { OSValue } from '../../lang/types.js';
export declare class ReturnSignal {
    readonly value: OSValue;
    constructor(value: OSValue);
}
export declare class BreakSignal {
}
export declare class ContinueSignal {
}
export declare class ErrPropagateSignal {
    readonly error: OSValue;
    constructor(error: OSValue);
}
//# sourceMappingURL=control-signals.d.ts.map