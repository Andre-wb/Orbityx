import type { Token, TokenType } from '../../lang/token/index.js';
import { OrbitScriptError } from '../../lang/error.js';
import { KEYWORDS } from './keywords.js';

export class Lexer {
    private pos    = 0;
    private line   = 1;
    private column = 1;
    private readonly src: string;
    private readonly tokens: Token[] = [];

    constructor(source: string) {
        this.src = source;
    }

    tokenize(): Token[] {
        while (!this.eof()) {
            this.skipWhitespaceAndComments();
            if (this.eof()) break;

            const line = this.line;
            const col  = this.column;
            const ch   = this.current();

            if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek(1)))) {
                this.readNumber(line, col);
                continue;
            }
            if (ch === '"') { this.readString(line, col); continue; }
            if (ch === '#' && this.isHexDigit(this.peek(1))) { this.readColor(line, col); continue; }
            if (ch === '#' && this.peek(1) === '[') {
                this.advance(); this.advance();
                this.push('HASH_BRACKET', '#[', line, col);
                continue;
            }
            if (this.isAlpha(ch)) { this.readIdent(line, col); continue; }
            if (this.readOperator(line, col)) continue;

            throw new OrbitScriptError(`Unexpected character '${ch}'`, line, col, 'lexer');
        }

        this.push('EOF', '', this.line, this.column);
        return this.tokens;
    }

    private eof(): boolean { return this.pos >= this.src.length; }
    private current(): string { return this.src[this.pos] ?? ''; }
    private peek(offset = 1): string { return this.src[this.pos + offset] ?? ''; }

    private advance(): string {
        const ch = this.current();
        this.pos++;
        if (ch === '\n') { this.line++; this.column = 1; }
        else              { this.column++; }
        return ch;
    }

    private isDigit(ch: string): boolean  { return ch >= '0' && ch <= '9'; }
    private isAlpha(ch: string): boolean  { return /[a-zA-Z_]/.test(ch); }
    private isAlphaNum(ch: string): boolean { return /[a-zA-Z0-9_]/.test(ch); }
    private isHexDigit(ch: string): boolean { return /[0-9a-fA-F]/.test(ch); }

    private push(type: TokenType, value: string, line: number, col: number): void {
        this.tokens.push({ type, value, line, column: col });
    }

    private skipWhitespaceAndComments(): void {
        while (!this.eof()) {
            const ch = this.current();
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { this.advance(); continue; }
            if (ch === '/' && this.peek() === '/') {
                while (!this.eof() && this.current() !== '\n') this.advance();
                continue;
            }
            if (ch === '/' && this.peek() === '*') {
                this.advance(); this.advance();
                while (!this.eof()) {
                    if (this.current() === '*' && this.peek() === '/') { this.advance(); this.advance(); break; }
                    this.advance();
                }
                continue;
            }
            break;
        }
    }

    private readNumber(line: number, col: number): void {
        let raw = '';
        while (!this.eof() && this.isDigit(this.current())) raw += this.advance();
        if (!this.eof() && this.current() === '.' && this.isDigit(this.peek())) {
            raw += this.advance();
            while (!this.eof() && this.isDigit(this.current())) raw += this.advance();
        }
        if (!this.eof() && (this.current() === 'e' || this.current() === 'E')) {
            raw += this.advance();
            if (!this.eof() && (this.current() === '+' || this.current() === '-')) raw += this.advance();
            while (!this.eof() && this.isDigit(this.current())) raw += this.advance();
        }
        this.push('NUMBER', raw, line, col);
    }

    private readString(line: number, col: number): void {
        this.advance();
        let value = '';
        while (!this.eof() && this.current() !== '"') {
            if (this.current() === '\\') {
                this.advance();
                const esc = this.advance();
                switch (esc) {
                    case 'n':  value += '\n'; break;
                    case 't':  value += '\t'; break;
                    case 'r':  value += '\r'; break;
                    case '"':  value += '"';  break;
                    case '\\': value += '\\'; break;
                    default:   value += esc;
                }
            } else {
                value += this.advance();
            }
        }
        if (this.eof()) throw new OrbitScriptError('Unterminated string literal', line, col, 'lexer');
        this.advance();
        this.push('STRING', value, line, col);
    }

    private readColor(line: number, col: number): void {
        this.advance();
        let hex = '#';
        let digits = 0;
        while (!this.eof() && this.isHexDigit(this.current()) && digits < 8) {
            hex += this.advance();
            digits++;
        }
        if (digits !== 6 && digits !== 8) {
            throw new OrbitScriptError(
                `Invalid color literal '${hex}' — expected 6 or 8 hex digits`, line, col, 'lexer',
            );
        }
        this.push('COLOR', hex, line, col);
    }

    private readIdent(line: number, col: number): void {
        let name = '';
        while (!this.eof() && this.isAlphaNum(this.current())) name += this.advance();
        const kwType = KEYWORDS[name];
        this.push(kwType ?? 'IDENT', name, line, col);
    }

    private readOperator(line: number, col: number): boolean {
        const ch  = this.current();
        const ch2 = ch + this.peek();
        const ch3 = ch2 + this.peek(2);

        if (ch3 === '..=') { this.advance(); this.advance(); this.advance(); this.push('DOT_DOT', '..=', line, col); return true; }

        switch (ch2) {
            case '->': this.advance(); this.advance(); this.push('ARROW',       '->', line, col); return true;
            case '=>': this.advance(); this.advance(); this.push('FAT_ARROW',   '=>', line, col); return true;
            case '::': this.advance(); this.advance(); this.push('DOUBLE_COLON','::',line, col); return true;
            case '..': this.advance(); this.advance(); this.push('DOT_DOT',     '..', line, col); return true;
            case '==': this.advance(); this.advance(); this.push('EQ_EQ',       '==', line, col); return true;
            case '!=': this.advance(); this.advance(); this.push('BANG_EQ',     '!=', line, col); return true;
            case '<=': this.advance(); this.advance(); this.push('LT_EQ',       '<=', line, col); return true;
            case '>=': this.advance(); this.advance(); this.push('GT_EQ',       '>=', line, col); return true;
            case '&&': this.advance(); this.advance(); this.push('AMP_AMP',     '&&', line, col); return true;
            case '||': this.advance(); this.advance(); this.push('PIPE_PIPE',   '||', line, col); return true;
            case '+=': this.advance(); this.advance(); this.push('PLUS_EQ',     '+=', line, col); return true;
            case '-=': this.advance(); this.advance(); this.push('MINUS_EQ',    '-=', line, col); return true;
            case '*=': this.advance(); this.advance(); this.push('STAR_EQ',     '*=', line, col); return true;
            case '/=': this.advance(); this.advance(); this.push('SLASH_EQ',    '/=', line, col); return true;
            case '%=': this.advance(); this.advance(); this.push('PERCENT_EQ',  '%=', line, col); return true;
            case '**': this.advance(); this.advance(); this.push('STAR_STAR',   '**', line, col); return true;
        }

        switch (ch) {
            case '+': this.advance(); this.push('PLUS',      '+', line, col); return true;
            case '-': this.advance(); this.push('MINUS',     '-', line, col); return true;
            case '*': this.advance(); this.push('STAR',      '*', line, col); return true;
            case '/': this.advance(); this.push('SLASH',     '/', line, col); return true;
            case '%': this.advance(); this.push('PERCENT',   '%', line, col); return true;
            case '!': this.advance(); this.push('BANG',      '!', line, col); return true;
            case '<': this.advance(); this.push('LT',        '<', line, col); return true;
            case '>': this.advance(); this.push('GT',        '>', line, col); return true;
            case '=': this.advance(); this.push('EQ',        '=', line, col); return true;
            case '(': this.advance(); this.push('LPAREN',    '(', line, col); return true;
            case ')': this.advance(); this.push('RPAREN',    ')', line, col); return true;
            case '{': this.advance(); this.push('LBRACE',    '{', line, col); return true;
            case '}': this.advance(); this.push('RBRACE',    '}', line, col); return true;
            case '[': this.advance(); this.push('LBRACKET',  '[', line, col); return true;
            case ']': this.advance(); this.push('RBRACKET',  ']', line, col); return true;
            case ',': this.advance(); this.push('COMMA',     ',', line, col); return true;
            case ':': this.advance(); this.push('COLON',     ':', line, col); return true;
            case ';': this.advance(); this.push('SEMICOLON', ';', line, col); return true;
            case '.': this.advance(); this.push('DOT',       '.', line, col); return true;
            case '?': this.advance(); this.push('QUESTION',  '?', line, col); return true;
            case '|': this.advance(); this.push('PIPE',      '|', line, col); return true;
            case '&': this.advance(); this.push('AMP',       '&', line, col); return true;
            case '_': this.advance(); this.push('UNDERSCORE','_', line, col); return true;
        }

        return false;
    }
}
