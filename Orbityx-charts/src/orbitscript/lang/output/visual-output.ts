export interface BgColorOutput {
    type: 'bgcolor';
    color: string;
    opacity: number;
    barIndices: number[];
}

export type PlotShapeStyle =
    | 'circle' | 'cross' | 'triangle_up' | 'triangle_down'
    | 'diamond' | 'arrow_up' | 'arrow_down';

export type PlotShapeLocation = 'above' | 'below' | 'absolute';

export interface PlotShapeOutput {
    type: 'plotshape';
    title: string;
    shape: PlotShapeStyle;
    location: PlotShapeLocation;
    color: string;
    size: 'tiny' | 'small' | 'normal' | 'large';
    barIndices: number[];
}

export interface PlotArrowOutput {
    type: 'plotarrow';
    title: string;
    colorUp: string;
    colorDown: string;
    points: Array<{ timestamp: number; value: number }>;  // > 0 up, < 0 down
}

export interface PlotHistogramOutput {
    type: 'plothistogram';
    title: string;
    points: Array<{ timestamp: number; value: number; color: string }>;
}
