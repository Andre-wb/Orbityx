import type { OSValue } from '../../lang/types.js';

export class ReturnSignal {
    constructor(public readonly value: OSValue) {}
}
export class BreakSignal {}
export class ContinueSignal {}
export class ErrPropagateSignal {
    constructor(public readonly error: OSValue) {}
}
