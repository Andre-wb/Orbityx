import { asNum, asBool, toHexStr } from './helpers.js';
let _plotCounter = 0;
export function resetPlotCounter() { _plotCounter = 0; }
export const entries = [
    ['plot', (args, env, line, col) => {
            const value = asNum(args[0], 'plot:value', line, col);
            const title = typeof args[1] === 'string' ? args[1] : '';
            const colorArg = args[2] !== undefined ? toHexStr(args[2], line, col) : '#2196F3';
            const linewidth = typeof args[3] === 'number' ? Math.round(args[3]) : 1;
            const style = (typeof args[4] === 'string' ? args[4] : 'solid');
            env.addPlotPoint(_plotCounter++, title, colorArg, linewidth, style, value);
            return null;
        }],
    ['hline', (args, env, line, col) => {
            const price = asNum(args[0], 'hline:price', line, col);
            const title = typeof args[1] === 'string' ? args[1] : '';
            const colorArg = args[2] !== undefined ? toHexStr(args[2], line, col) : '#9e9e9e';
            const style = (typeof args[3] === 'string' ? args[3] : 'dashed');
            env.addHLine(price, title, colorArg, style);
            return null;
        }],
    ['bgcolor', (args, env, line, col) => {
            const colorArg = toHexStr(args[0], line, col);
            const cond = typeof args[1] === 'boolean' ? args[1] : true;
            const opacity = typeof args[2] === 'number' ? args[2] : 0.1;
            if (cond)
                env.addBgColor(colorArg, opacity);
            return null;
        }],
    ['alertcondition', (args, env, line, col) => {
            const cond = asBool(args[0], 'alertcondition:condition', line, col);
            const title = typeof args[1] === 'string' ? args[1] : 'Alert';
            const message = typeof args[2] === 'string' ? args[2] : title;
            if (cond)
                env.addAlert(title, message);
            return null;
        }],
    ['plotshape', (args, env, line, col) => {
            const cond = asBool(args[0], 'plotshape:condition', line, col);
            const title = typeof args[1] === 'string' ? args[1] : '';
            const shape = (typeof args[2] === 'string' ? args[2] : 'circle');
            const location = (typeof args[3] === 'string' ? args[3] : 'above');
            const clr = args[4] !== undefined ? toHexStr(args[4], line, col) : '#2196F3';
            const size = (typeof args[5] === 'string' ? args[5] : 'small');
            if (cond)
                env.addPlotShape(title, shape, location, clr, size);
            return null;
        }],
    ['plotarrow', (args, env, line, col) => {
            const value = asNum(args[0], 'plotarrow:value', line, col);
            const title = typeof args[1] === 'string' ? args[1] : '';
            const colorUp = args[2] !== undefined ? toHexStr(args[2], line, col) : '#22c55e';
            const colorDn = args[3] !== undefined ? toHexStr(args[3], line, col) : '#ef4444';
            if (value !== 0)
                env.addPlotArrow(title, colorUp, colorDn, value);
            return null;
        }],
    ['plothistogram', (args, env, line, col) => {
            const value = asNum(args[0], 'plothistogram:value', line, col);
            const title = typeof args[1] === 'string' ? args[1] : '';
            const colorArg = args[2] !== undefined ? toHexStr(args[2], line, col) : '#2196F3';
            env.addPlotHistogramBar(title, value, colorArg);
            return null;
        }],
];
//# sourceMappingURL=output-fns.js.map