/**
 * @file orbitscript/lang/ast.ts
 * @description Re-exports all AST node types from the modular ast/ directory.
 */
export type {
    NodeBase, DirectiveArg, Directive, Program,
    TypeExpr, Param, FnDef,
    StructField, StructDef,
    EnumVariant, EnumDef,
    TraitMethod, TraitDef,
    ImplBlock,
    AssignOp,
    LetStmt, AssignStmt, ExprStmt, ReturnStmt,
    BreakStmt, ContinueStmt,
    ForStmt, WhileStmt, LoopStmt,
    Statement,
    NumberLit, StringLit, BoolLit, ColorLit, NoneLit,
    Identifier, SelfExpr,
    BinaryOp, BinaryExpr,
    UnaryOp, UnaryExpr,
    IfExpr, MatchArm, MatchPattern, MatchExpr,
    BlockExpr,
    FnCallExpr, MethodCallExpr, FieldAccessExpr, IndexExpr, HistoryRefExpr,
    ClosureParam, ClosureExpr,
    StructFieldInit, StructInitExpr,
    EnumVariantExpr, PathExpr, RangeExpr, TupleExpr, ArrayLitExpr,
    SomeExpr, QuestionExpr,
    ASTNode,
} from './ast/index.js';
