import type { TokenType } from './token-type.js';

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}
