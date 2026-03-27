import type { NodeBase } from './program.js';
import type { ASTNode } from './index.js';
import type { Statement } from './statements.js';
export type TypeExpr = {
    kind: 'NamedType';
    name: string;
    line: number;
    col: number;
} | {
    kind: 'ArrayType';
    elem: TypeExpr;
    line: number;
    col: number;
} | {
    kind: 'TupleType';
    elems: TypeExpr[];
    line: number;
    col: number;
} | {
    kind: 'OptionType';
    inner: TypeExpr;
    line: number;
    col: number;
} | {
    kind: 'ResultType';
    ok: TypeExpr;
    err: TypeExpr;
    line: number;
    col: number;
} | {
    kind: 'FnType';
    params: TypeExpr[];
    ret: TypeExpr;
    line: number;
    col: number;
};
export interface Param {
    name: string;
    typeAnnotation: TypeExpr;
    defaultValue?: ASTNode | undefined;
    isSelf: boolean;
    line: number;
    col: number;
}
export interface FnDef extends NodeBase {
    kind: 'FnDef';
    name: string;
    params: Param[];
    returnType: TypeExpr | null;
    body: Statement[];
}
export interface StructField {
    name: string;
    typeAnnotation: TypeExpr;
    line: number;
    col: number;
}
export interface StructDef extends NodeBase {
    kind: 'StructDef';
    name: string;
    fields: StructField[];
}
export interface EnumVariant {
    name: string;
    fields: TypeExpr[];
    line: number;
    col: number;
}
export interface EnumDef extends NodeBase {
    kind: 'EnumDef';
    name: string;
    variants: EnumVariant[];
}
export interface TraitMethod {
    name: string;
    params: Param[];
    returnType: TypeExpr | null;
    defaultBody: Statement[] | null;
    line: number;
    col: number;
}
export interface TraitDef extends NodeBase {
    kind: 'TraitDef';
    name: string;
    methods: TraitMethod[];
}
export interface ImplBlock extends NodeBase {
    kind: 'ImplBlock';
    typeName: string;
    traitName: string | null;
    methods: FnDef[];
}
//# sourceMappingURL=declarations.d.ts.map