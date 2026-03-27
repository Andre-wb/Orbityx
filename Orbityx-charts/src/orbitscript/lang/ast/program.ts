import type { ASTNode } from './index.js';
import type { StructDef, EnumDef, TraitDef, ImplBlock, FnDef } from './declarations.js';
import type { Statement } from './statements.js';

export interface NodeBase {
    line: number;
    col:  number;
}

export interface DirectiveArg {
    key:   string;
    value: ASTNode;
}

export interface Directive extends NodeBase {
    kind: 'Directive';
    name: string;                 // "indicator", "strategy", "input"
    args: DirectiveArg[];
}

export interface Program extends NodeBase {
    kind:        'Program';
    directives:  Directive[];     // #[indicator(...)] / #[strategy(...)] / #[input(...)]
    structs:     StructDef[];
    enums:       EnumDef[];
    traits:      TraitDef[];
    impls:       ImplBlock[];
    functions:   FnDef[];
    body:        Statement[];     // top-level executable statements
}
