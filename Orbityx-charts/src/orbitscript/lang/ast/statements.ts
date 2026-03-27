import type { NodeBase } from './program.js';
import type { ASTNode } from './index.js';
import type { TypeExpr } from './declarations.js';

export type AssignOp = '=' | '+=' | '-=' | '*=' | '/=' | '%=';

export interface LetStmt extends NodeBase {
    kind:           'LetStmt';
    name:           string;
    mutable:        boolean;
    typeAnnotation: TypeExpr | null;
    init:           ASTNode | null;
}

export interface AssignStmt extends NodeBase {
    kind:   'AssignStmt';
    target: ASTNode;   // Identifier, IndexExpr, FieldAccessExpr
    op:     AssignOp;
    value:  ASTNode;
}

export interface ExprStmt extends NodeBase {
    kind: 'ExprStmt';
    expr: ASTNode;
}

export interface ReturnStmt extends NodeBase {
    kind:  'ReturnStmt';
    value: ASTNode | null;
}

export interface BreakStmt extends NodeBase {
    kind: 'BreakStmt';
}

export interface ContinueStmt extends NodeBase {
    kind: 'ContinueStmt';
}

export interface ForStmt extends NodeBase {
    kind:    'ForStmt';
    varName: string;
    iterable: ASTNode;   // RangeExpr or Identifier (array)
    body:    Statement[];
}

export interface WhileStmt extends NodeBase {
    kind:      'WhileStmt';
    condition: ASTNode;
    body:      Statement[];
}

export interface LoopStmt extends NodeBase {
    kind: 'LoopStmt';
    body: Statement[];
}

export type Statement =
    | LetStmt
    | AssignStmt
    | ExprStmt
    | ReturnStmt
    | BreakStmt
    | ContinueStmt
    | ForStmt
    | WhileStmt
    | LoopStmt;
