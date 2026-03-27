import type { OSValue } from './value/index.js';

export type InputType = 'f64' | 'i64' | 'bool' | 'str' | 'color' | 'series';
export type ScriptKind = 'indicator' | 'strategy' | 'library';

export interface InputDef {
    name: string;
    type: InputType;
    defaultValue: OSValue;
    min?: number;
    max?: number;
    step?: number;
    options?: OSValue[];
    title?: string;
}

export interface ScriptMeta {
    kind: ScriptKind;
    name: string;
    overlay: boolean;   // true = draw on main chart, false = sub-panel
    inputs: InputDef[];
    version?: string;
    timezone?: string;
}
