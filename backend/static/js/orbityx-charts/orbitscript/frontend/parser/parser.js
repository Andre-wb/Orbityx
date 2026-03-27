import { TokenStream } from './token-stream.js';
import { parseDirective } from './directive-parser.js';
import { parseFnDef, parseStructDef, parseEnumDef, parseTraitDef, parseImplBlock, } from './decl-parser.js';
import { parseBlock, parseStatement } from './stmt-parser.js';
import { parseExpr, parseBlockExpr } from './expr-parser.js';
export class Parser {
    ts;
    constructor(tokens) {
        this.ts = new TokenStream(tokens);
    }
    // ─── Deps wiring ────────────────────────────────────────────────────────
    get stmtDeps() {
        return { parseExpr: (ts, minPrec = 0) => parseExpr(ts, minPrec, this.blockDeps) };
    }
    get blockDeps() {
        return { parseBlock: (ts) => parseBlock(ts, this.stmtDeps) };
    }
    get declDeps() {
        return {
            parseExpr: (ts, minPrec = 0) => parseExpr(ts, minPrec, this.blockDeps),
            parseBlock: (ts) => parseBlock(ts, this.stmtDeps),
        };
    }
    // ─── Public API ─────────────────────────────────────────────────────────
    parse() {
        const { line, column: col } = this.ts.current();
        const directives = [];
        const structs = [];
        const enums = [];
        const traits = [];
        const impls = [];
        const functions = [];
        const body = [];
        while (!this.ts.at('EOF')) {
            if (this.ts.at('HASH_BRACKET')) {
                directives.push(parseDirective(this.ts, (ts, p) => parseExpr(ts, p, this.blockDeps)));
                continue;
            }
            if (this.ts.at('STRUCT')) {
                structs.push(parseStructDef(this.ts));
                continue;
            }
            if (this.ts.at('ENUM')) {
                enums.push(parseEnumDef(this.ts));
                continue;
            }
            if (this.ts.at('TRAIT')) {
                traits.push(parseTraitDef(this.ts, this.declDeps));
                continue;
            }
            if (this.ts.at('IMPL')) {
                impls.push(parseImplBlock(this.ts, this.declDeps));
                continue;
            }
            if (this.ts.at('FN')) {
                functions.push(parseFnDef(this.ts, this.declDeps));
                continue;
            }
            body.push(parseStatement(this.ts, this.stmtDeps));
        }
        return { kind: 'Program', directives, structs, enums, traits, impls, functions, body, line, col };
    }
    parseStatement() {
        return parseStatement(this.ts, this.stmtDeps);
    }
    parseExpr(minPrec = 0) {
        return parseExpr(this.ts, minPrec, this.blockDeps);
    }
    parseBlockExpr() {
        return parseBlockExpr(this.ts, this.blockDeps);
    }
}
//# sourceMappingURL=parser.js.map