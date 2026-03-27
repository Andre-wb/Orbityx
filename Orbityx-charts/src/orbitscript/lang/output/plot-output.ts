export type PlotStyle = 'solid' | 'dashed' | 'dotted' | 'stepline';

export interface PlotOutput {
    type: 'plot';
    seriesIndex: number;   // 0 = first plot(), 1 = second, …
    title: string;
    color: string;
    linewidth: number;
    style: PlotStyle;
    points: Array<{ timestamp: number; value: number }>;
}

export interface HLineOutput {
    type: 'hline';
    price: number;
    title: string;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
}
