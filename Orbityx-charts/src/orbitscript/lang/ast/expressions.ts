import type { NodeBase } from './program.js';
import type { ASTNode } from './index.js';
import type { TypeExpr } from './declarations.js';
import type { Statement } from './statements.js';

export interface Identifier extends NodeBase {
    kind: 'Identifier';
    name: string;
}

export interface SelfExpr extends NodeBase {
    kind: 'SelfExpr';
}

export type BinaryOp =
    | '+' | '-' | '*' | '/' | '%' | '**'
    | '==' | '!=' | '<' | '>' | '<=' | '>='
    | '&&' | '||';

export interface BinaryExpr extends NodeBase {
    kind:  'BinaryExpr';
    op:    BinaryOp;
    left:  ASTNode;
    right: ASTNode;
}

export type UnaryOp = '-' | '!';

export interface UnaryExpr extends NodeBase {
    kind:    'UnaryExpr';
    op:      UnaryOp;
    operand: ASTNode;
}

export interface IfExpr extends NodeBase {
    kind:       'IfExpr';
    condition:  ASTNode;
    thenBranch: Statement[];
    elseBranch: Statement[] | IfExpr | null;
}

export interface MatchArm extends NodeBase {
    kind:    'MatchArm';
    pattern: MatchPattern;
    body:    ASTNode;
}

export type MatchPattern =
    | { kind: 'LiteralPattern';   value: ASTNode }
    | { kind: 'IdentPattern';     name: string }
    | { kind: 'EnumPattern';      typeName: string; variant: string; bindings: string[] }
    | { kind: 'TuplePattern';     patterns: MatchPattern[] }
    | { kind: 'WildcardPattern' }
    | { kind: 'SomePattern';      inner: MatchPattern }
    | { kind: 'NonePattern' }
    | { kind: 'GuardPattern';     pattern: MatchPattern; guard: ASTNode };

export interface MatchExpr extends NodeBase {
    kind:  'MatchExpr';
    value: ASTNode;
    arms:  MatchArm[];
}

export interface BlockExpr extends NodeBase {
    kind:  'BlockExpr';
    body:  Statement[];
    tail:  ASTNode | null;   // optional trailing expression (the return value)
}

export interface FnCallExpr extends NodeBase {
    kind:     'FnCallExpr';
    callee:   string;         // function or stdlib name
    args:     ASTNode[];
}

export interface MethodCallExpr extends NodeBase {
    kind:     'MethodCallExpr';
    receiver: ASTNode;
    method:   string;
    args:     ASTNode[];
}

export interface FieldAccessExpr extends NodeBase {
    kind:   'FieldAccessExpr';
    object: ASTNode;
    field:  string;
}

export interface IndexExpr extends NodeBase {
    kind:   'IndexExpr';
    object: ASTNode;
    index:  ASTNode;
}

export interface HistoryRefExpr extends NodeBase {
    kind:   'HistoryRefExpr';
    series: ASTNode;   // the series expression (usually an Identifier)
    offset: ASTNode;   // the lookback offset (usually a NumberLit)
}

export interface ClosureParam {
    name:           string;
    typeAnnotation: TypeExpr | null;
}

export interface ClosureExpr extends NodeBase {
    kind:       'ClosureExpr';
    params:     ClosureParam[];
    returnType: TypeExpr | null;
    body:       ASTNode;   // BlockExpr or single expression
}

export interface StructFieldInit {
    name:  string;
    value: ASTNode;
    line:  number;
    col:   number;
}

export interface StructInitExpr extends NodeBase {
    kind:      'StructInitExpr';
    typeName:  string;
    fields:    StructFieldInit[];
}

export interface EnumVariantExpr extends NodeBase {
    kind:      'EnumVariantExpr';
    enumName:  string;    // e.g. "Trend"
    variant:   string;    // e.g. "Up"
    args:      ASTNode[]; // associated data
}

export interface PathExpr extends NodeBase {
    kind:     'PathExpr';
    segments: string[];   // ["Color", "red"]
}

export interface RangeExpr extends NodeBase {
    kind:      'RangeExpr';
    start:     ASTNode;
    end:       ASTNode;
    inclusive: boolean;   // false = 0..10, true = 0..=10
}

export interface TupleExpr extends NodeBase {
    kind:     'TupleExpr';
    elements: ASTNode[];
}

export interface ArrayLitExpr extends NodeBase {
    kind:     'ArrayLitExpr';
    elements: ASTNode[];
}

export interface SomeExpr extends NodeBase {
    kind:  'SomeExpr';
    value: ASTNode;
}

export interface QuestionExpr extends NodeBase {
    kind: 'QuestionExpr';
    expr: ASTNode;
}

/** macro_name!(arg1, arg2, …) — Rust-style macro invocation */
export interface MacroCallExpr extends NodeBase {
    kind: 'MacroCallExpr';
    name: string;
    args: ASTNode[];
}
