import type { Token } from '../../lang/token/index.js';
export declare class Lexer {
    private pos;
    private line;
    private column;
    private readonly src;
    private readonly tokens;
    constructor(source: string);
    tokenize(): Token[];
    private eof;
    private current;
    private peek;
    private advance;
    private isDigit;
    private isAlpha;
    private isAlphaNum;
    private isHexDigit;
    private push;
    private skipWhitespaceAndComments;
    private readNumber;
    private readString;
    private readColor;
    private readIdent;
    private readOperator;
}
//# sourceMappingURL=lexer.d.ts.map