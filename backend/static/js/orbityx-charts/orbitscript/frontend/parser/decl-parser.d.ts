import type { StructDef, EnumDef, TraitDef, ImplBlock, FnDef, Param, ASTNode, Statement } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
export interface DeclParserDeps {
    parseExpr(ts: TokenStream, minPrec?: number): ASTNode;
    parseBlock(ts: TokenStream): Statement[];
}
export declare function parseFnDef(ts: TokenStream, deps: DeclParserDeps): FnDef;
export declare function parseStructDef(ts: TokenStream): StructDef;
export declare function parseEnumDef(ts: TokenStream): EnumDef;
export declare function parseTraitDef(ts: TokenStream, deps: DeclParserDeps): TraitDef;
export declare function parseImplBlock(ts: TokenStream, deps: DeclParserDeps): ImplBlock;
export declare function parseParamList(ts: TokenStream, allowSelf: boolean, deps: DeclParserDeps): Param[];
//# sourceMappingURL=decl-parser.d.ts.map