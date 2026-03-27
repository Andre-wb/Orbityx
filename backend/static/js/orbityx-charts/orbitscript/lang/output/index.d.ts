export type { PlotOutput, HLineOutput, PlotStyle } from './plot-output.js';
export type { BgColorOutput, PlotShapeStyle, PlotShapeLocation, PlotShapeOutput, PlotArrowOutput, PlotHistogramOutput, } from './visual-output.js';
export type { AlertOutput } from './alert-output.js';
import type { PlotOutput, HLineOutput } from './plot-output.js';
import type { BgColorOutput, PlotShapeOutput, PlotArrowOutput, PlotHistogramOutput } from './visual-output.js';
import type { AlertOutput } from './alert-output.js';
export type ScriptOutput = PlotOutput | HLineOutput | BgColorOutput | AlertOutput | PlotShapeOutput | PlotArrowOutput | PlotHistogramOutput;
//# sourceMappingURL=index.d.ts.map