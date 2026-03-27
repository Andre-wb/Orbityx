import type { Token } from '../../lang/token/index.js';
import type {
    Program, Directive,
    StructDef, EnumDef, TraitDef, ImplBlock, FnDef,
    Statement, ASTNode, BlockExpr,
} from '../../lang/ast/index.js';
import { TokenStream } from './token-stream.js';
import { parseTypeExpr, isTypeKw } from './type-parser.js';
import { parseDirective } from './directive-parser.js';
import {
    parseFnDef, parseStructDef, parseEnumDef, parseTraitDef,
    parseImplBlock, parseParamList,
} from './decl-parser.js';
import { parseBlock, parseStatement } from './stmt-parser.js';
import { parseExpr, parseBlockExpr } from './expr-parser.js';

export class Parser {
    private ts: TokenStream;

    constructor(tokens: Token[]) {
        this.ts = new TokenStream(tokens);
    }

    // ─── Deps wiring ────────────────────────────────────────────────────────

    private get stmtDeps() {
        return { parseExpr: (ts: TokenStream, minPrec = 0) => parseExpr(ts, minPrec, this.blockDeps) };
    }

    private get blockDeps() {
        return { parseBlock: (ts: TokenStream) => parseBlock(ts, this.stmtDeps) };
    }

    private get declDeps() {
        return {
            parseExpr:  (ts: TokenStream, minPrec = 0) => parseExpr(ts, minPrec, this.blockDeps),
            parseBlock: (ts: TokenStream) => parseBlock(ts, this.stmtDeps),
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    parse(): Program {
        const { line, column: col } = this.ts.current();
        const directives: Directive[] = [];
        const structs:    StructDef[] = [];
        const enums:      EnumDef[]   = [];
        const traits:     TraitDef[]  = [];
        const impls:      ImplBlock[] = [];
        const functions:  FnDef[]     = [];
        const body:       Statement[] = [];

        while (!this.ts.at('EOF')) {
            if (this.ts.at('HASH_BRACKET')) { directives.push(parseDirective(this.ts, (ts, p) => parseExpr(ts, p, this.blockDeps))); continue; }
            if (this.ts.at('STRUCT')) { structs.push(parseStructDef(this.ts)); continue; }
            if (this.ts.at('ENUM'))   { enums.push(parseEnumDef(this.ts));     continue; }
            if (this.ts.at('TRAIT'))  { traits.push(parseTraitDef(this.ts, this.declDeps));   continue; }
            if (this.ts.at('IMPL'))   { impls.push(parseImplBlock(this.ts, this.declDeps));   continue; }
            if (this.ts.at('FN'))     { functions.push(parseFnDef(this.ts, this.declDeps));   continue; }
            body.push(parseStatement(this.ts, this.stmtDeps));
        }

        return { kind: 'Program', directives, structs, enums, traits, impls, functions, body, line, col };
    }

    parseStatement(): Statement {
        return parseStatement(this.ts, this.stmtDeps);
    }

    parseExpr(minPrec = 0): ASTNode {
        return parseExpr(this.ts, minPrec, this.blockDeps);
    }

    parseBlockExpr(): BlockExpr {
        return parseBlockExpr(this.ts, this.blockDeps);
    }
}
