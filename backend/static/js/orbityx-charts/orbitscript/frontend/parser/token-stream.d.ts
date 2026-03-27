import type { Token, TokenType } from '../../lang/token/index.js';
export declare class TokenStream {
    readonly tokens: Token[];
    pos: number;
    constructor(tokens: Token[]);
    current(): Token;
    peek(offset?: number): Token;
    at(type: TokenType): boolean;
    advance(): Token;
    expect(type: TokenType): Token;
    tryConsume(type: TokenType): boolean;
    error(msg: string, t?: Token): never;
}
//# sourceMappingURL=token-stream.d.ts.map