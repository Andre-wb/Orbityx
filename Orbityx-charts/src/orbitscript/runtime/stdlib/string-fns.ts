import { osValueToString } from '../environment.js';
import type { StdlibFn } from './helpers.js';
import { asStr } from './helpers.js';

export const entries: Array<[string, StdlibFn]> = [
    ['format', (args, _, line, col) => {
        let template = asStr(args[0], 'format:template', line, col);
        let i = 1;
        template = template.replace(/\{[^}]*\}/g, () => {
            const v = args[i++];
            if (v === null || v === undefined) return 'None';
            if (typeof v === 'number') return isNaN(v) ? 'NaN' : String(v);
            return osValueToString(v);
        });
        return template;
    }],
    ['print', (args, _env, _line, _col) => { const parts = args.map(a => osValueToString(a)); console.log('[OrbitScript]', ...parts); return null; }],
];
