import { isFiniteNumber } from '../../../utils/math.js';
export const entries = [
    ['na', (args, _e, _l, _c) => typeof args[0] !== 'number' || isNaN(args[0]) || !isFinite(args[0])],
    ['nz', (args, _, line, col) => { const v = args[0]; if (typeof v === 'number' && isFiniteNumber(v))
            return v; return typeof args[1] === 'number' ? args[1] : 0; }],
    ['Ok', (args) => ({ __type: 'enum', __name: 'Result', __variant: 'Ok', __data: [args[0] ?? null] })],
    ['Err', (args) => ({ __type: 'enum', __name: 'Result', __variant: 'Err', __data: [args[0] ?? null] })],
];
//# sourceMappingURL=utility.js.map