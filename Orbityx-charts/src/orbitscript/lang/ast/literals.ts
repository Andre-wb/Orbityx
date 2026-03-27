import type { NodeBase } from './program.js';

export interface NumberLit extends NodeBase {
    kind:  'NumberLit';
    value: number;
}

export interface StringLit extends NodeBase {
    kind:  'StringLit';
    value: string;
}

export interface BoolLit extends NodeBase {
    kind:  'BoolLit';
    value: boolean;
}

export interface ColorLit extends NodeBase {
    kind: 'ColorLit';
    hex:  string;   // "#RRGGBB" or "#RRGGBBAA"
}

export interface NoneLit extends NodeBase {
    kind: 'NoneLit';
}
