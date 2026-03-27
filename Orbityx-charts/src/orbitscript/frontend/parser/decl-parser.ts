import type {
    StructDef, StructField,
    EnumDef, EnumVariant,
    TraitDef, TraitMethod,
    ImplBlock,
    FnDef, Param,
    TypeExpr,
    ASTNode,
    Statement,
} from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
import { parseTypeExpr } from './type-parser.js';

export interface DeclParserDeps {
    parseExpr(ts: TokenStream, minPrec?: number): ASTNode;
    parseBlock(ts: TokenStream): Statement[];
}

export function parseFnDef(ts: TokenStream, deps: DeclParserDeps): FnDef {
    const { line, column: col } = ts.current();
    ts.expect('FN');
    const name = ts.expect('IDENT').value;
    const params = parseParamList(ts, true, deps);
    let returnType: TypeExpr | null = null;
    if (ts.tryConsume('ARROW')) returnType = parseTypeExpr(ts);
    const body = deps.parseBlock(ts);
    return { kind: 'FnDef', name, params, returnType, body, line, col };
}

export function parseStructDef(ts: TokenStream): StructDef {
    const { line, column: col } = ts.current();
    ts.expect('STRUCT');
    const name = ts.expect('IDENT').value;
    ts.expect('LBRACE');
    const fields: StructField[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const fl = ts.current().line, fc = ts.current().column;
        const fname = ts.expect('IDENT').value;
        ts.expect('COLON');
        const typeAnnotation = parseTypeExpr(ts);
        fields.push({ name: fname, typeAnnotation, line: fl, col: fc });
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('RBRACE');
    return { kind: 'StructDef', name, fields, line, col };
}

export function parseEnumDef(ts: TokenStream): EnumDef {
    const { line, column: col } = ts.current();
    ts.expect('ENUM');
    const name = ts.expect('IDENT').value;
    ts.expect('LBRACE');
    const variants: EnumVariant[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const vl = ts.current().line, vc = ts.current().column;
        const vname = ts.expect('IDENT').value;
        const fieldTypes: TypeExpr[] = [];
        if (ts.tryConsume('LPAREN')) {
            while (!ts.at('RPAREN') && !ts.at('EOF')) {
                fieldTypes.push(parseTypeExpr(ts));
                if (!ts.tryConsume('COMMA')) break;
            }
            ts.expect('RPAREN');
        }
        variants.push({ name: vname, fields: fieldTypes, line: vl, col: vc });
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('RBRACE');
    return { kind: 'EnumDef', name, variants, line, col };
}

export function parseTraitDef(ts: TokenStream, deps: DeclParserDeps): TraitDef {
    const { line, column: col } = ts.current();
    ts.expect('TRAIT');
    const name = ts.expect('IDENT').value;
    ts.expect('LBRACE');
    const methods: TraitMethod[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) {
        const ml = ts.current().line, mc = ts.current().column;
        ts.expect('FN');
        const mname = ts.expect('IDENT').value;
        const params = parseParamList(ts, true, deps);
        let returnType: TypeExpr | null = null;
        if (ts.tryConsume('ARROW')) returnType = parseTypeExpr(ts);
        let defaultBody: Statement[] | null = null;
        if (ts.at('LBRACE')) defaultBody = deps.parseBlock(ts);
        else ts.expect('SEMICOLON');
        methods.push({ name: mname, params, returnType, defaultBody, line: ml, col: mc });
    }
    ts.expect('RBRACE');
    return { kind: 'TraitDef', name, methods, line, col };
}

export function parseImplBlock(ts: TokenStream, deps: DeclParserDeps): ImplBlock {
    const { line, column: col } = ts.current();
    ts.expect('IMPL');
    const first = ts.expect('IDENT').value;
    let typeName: string;
    let traitName: string | null = null;
    if (ts.at('IDENT') && ts.current().value === 'for') {
        ts.advance();
        typeName  = ts.expect('IDENT').value;
        traitName = first;
    } else {
        typeName = first;
    }
    ts.expect('LBRACE');
    const methods: FnDef[] = [];
    while (!ts.at('RBRACE') && !ts.at('EOF')) methods.push(parseFnDef(ts, deps));
    ts.expect('RBRACE');
    return { kind: 'ImplBlock', typeName, traitName, methods, line, col };
}

export function parseParamList(ts: TokenStream, allowSelf: boolean, deps: DeclParserDeps): Param[] {
    ts.expect('LPAREN');
    const params: Param[] = [];
    while (!ts.at('RPAREN') && !ts.at('EOF')) {
        const pl = ts.current().line, pc = ts.current().column;
        if (allowSelf && ts.at('AMP') && ts.peek().type === 'SELF') {
            ts.advance(); ts.advance();
            params.push({ name: 'self', typeAnnotation: { kind: 'NamedType', name: 'Self', line: pl, col: pc }, isSelf: true, line: pl, col: pc });
            if (!ts.tryConsume('COMMA')) break;
            continue;
        }
        if (allowSelf && ts.at('SELF')) {
            ts.advance();
            params.push({ name: 'self', typeAnnotation: { kind: 'NamedType', name: 'Self', line: pl, col: pc }, isSelf: true, line: pl, col: pc });
            if (!ts.tryConsume('COMMA')) break;
            continue;
        }
        const pname = ts.expect('IDENT').value;
        ts.expect('COLON');
        const typeAnnotation = parseTypeExpr(ts);
        let defaultValue: ASTNode | undefined;
        if (ts.tryConsume('EQ')) defaultValue = deps.parseExpr(ts, 0);
        params.push({ name: pname, typeAnnotation, defaultValue, isSelf: false, line: pl, col: pc });
        if (!ts.tryConsume('COMMA')) break;
    }
    ts.expect('RPAREN');
    return params;
}
