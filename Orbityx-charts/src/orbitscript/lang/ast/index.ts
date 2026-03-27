export type { NodeBase, DirectiveArg, Directive, Program } from './program.js';
export type {
    TypeExpr, Param, FnDef,
    StructField, StructDef,
    EnumVariant, EnumDef,
    TraitMethod, TraitDef,
    ImplBlock,
} from './declarations.js';
export type {
    AssignOp,
    LetStmt, AssignStmt, ExprStmt, ReturnStmt,
    BreakStmt, ContinueStmt,
    ForStmt, WhileStmt, LoopStmt,
    Statement,
} from './statements.js';
export type {
    NumberLit, StringLit, BoolLit, ColorLit, NoneLit,
} from './literals.js';
export type {
    Identifier, SelfExpr,
    BinaryOp, BinaryExpr,
    UnaryOp, UnaryExpr,
    IfExpr, MatchArm, MatchPattern, MatchExpr,
    BlockExpr,
    FnCallExpr, MethodCallExpr, FieldAccessExpr, IndexExpr, HistoryRefExpr,
    ClosureParam, ClosureExpr,
    StructFieldInit, StructInitExpr,
    EnumVariantExpr, PathExpr, RangeExpr, TupleExpr, ArrayLitExpr,
    SomeExpr, QuestionExpr, MacroCallExpr,
} from './expressions.js';

import type { NumberLit, StringLit, BoolLit, ColorLit, NoneLit } from './literals.js';
import type {
    Identifier, SelfExpr, BinaryExpr, UnaryExpr, IfExpr, MatchExpr, BlockExpr,
    FnCallExpr, MethodCallExpr, FieldAccessExpr, IndexExpr, HistoryRefExpr,
    ClosureExpr, StructInitExpr, EnumVariantExpr, PathExpr, RangeExpr,
    TupleExpr, ArrayLitExpr, SomeExpr, QuestionExpr, MacroCallExpr,
} from './expressions.js';

export type ASTNode =
    | NumberLit
    | StringLit
    | BoolLit
    | ColorLit
    | NoneLit
    | Identifier
    | SelfExpr
    | BinaryExpr
    | UnaryExpr
    | IfExpr
    | MatchExpr
    | BlockExpr
    | FnCallExpr
    | MethodCallExpr
    | FieldAccessExpr
    | IndexExpr
    | HistoryRefExpr
    | ClosureExpr
    | StructInitExpr
    | EnumVariantExpr
    | PathExpr
    | RangeExpr
    | TupleExpr
    | ArrayLitExpr
    | SomeExpr
    | QuestionExpr
    | MacroCallExpr;
