import type { NodeBase } from './program.js';
import type { ASTNode } from './index.js';
import type { Statement } from './statements.js';

export type TypeExpr =
    | { kind: 'NamedType';  name: string; line: number; col: number }
    | { kind: 'ArrayType';  elem: TypeExpr; line: number; col: number }
    | { kind: 'TupleType';  elems: TypeExpr[]; line: number; col: number }
    | { kind: 'OptionType'; inner: TypeExpr; line: number; col: number }
    | { kind: 'ResultType'; ok: TypeExpr; err: TypeExpr; line: number; col: number }
    | { kind: 'FnType';     params: TypeExpr[]; ret: TypeExpr; line: number; col: number };

export interface Param {
    name:           string;
    typeAnnotation: TypeExpr;
    defaultValue?:  ASTNode | undefined;
    isSelf:         boolean;  // &self
    line:           number;
    col:            number;
}

export interface FnDef extends NodeBase {
    kind:       'FnDef';
    name:       string;
    params:     Param[];
    returnType: TypeExpr | null;
    body:       Statement[];
}

export interface StructField {
    name:   string;
    typeAnnotation: TypeExpr;
    line:   number;
    col:    number;
}

export interface StructDef extends NodeBase {
    kind:   'StructDef';
    name:   string;
    fields: StructField[];
}

export interface EnumVariant {
    name:   string;
    fields: TypeExpr[];   // empty for unit variants, e.g. Up; tuple for Up(f64)
    line:   number;
    col:    number;
}

export interface EnumDef extends NodeBase {
    kind:     'EnumDef';
    name:     string;
    variants: EnumVariant[];
}

export interface TraitMethod {
    name:       string;
    params:     Param[];
    returnType: TypeExpr | null;
    defaultBody: Statement[] | null;
    line:       number;
    col:        number;
}

export interface TraitDef extends NodeBase {
    kind:    'TraitDef';
    name:    string;
    methods: TraitMethod[];
}

export interface ImplBlock extends NodeBase {
    kind:      'ImplBlock';
    typeName:  string;            // the type being implemented
    traitName: string | null;     // null → inherent impl
    methods:   FnDef[];
}
