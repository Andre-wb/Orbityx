/**
 * @file orbitscript/orbitscript.test.ts
 * @description Comprehensive tests for the OrbitScript pipeline:
 *   Lexer → Parser → Interpreter → Stdlib → Compiler
 */

import { describe, it, expect } from 'vitest';
import { tokenize }    from './frontend/lexer.js';
import { parse }       from './frontend/parser.js';
import { interpret }   from './runtime/interpreter.js';
import { compile }     from './compiler.js';
import { OrbitScriptError } from './lang/types.js';
import type { Token }  from './lang/types.js';
import type { Candle } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCandles(closes: number[], opens?: number[]): Candle[] {
    return closes.map((c, i) => ({
        timestamp: 1_000_000 + i * 60_000,
        open:   opens ? opens[i]! : c,
        high:   c + 1,
        low:    c - 1,
        close:  c,
        volume: 1000,
    }));
}

function run(source: string, candles: Candle[], inputs?: Record<string, import('./types.js').OSValue>) {
    const tokens  = tokenize(source);
    const program = parse(tokens);
    const inputMap = inputs ? new Map(Object.entries(inputs)) : undefined;
    return interpret(program, candles, inputMap);
}

function tokenTypes(source: string) {
    return tokenize(source).map(t => t.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEXER
// ─────────────────────────────────────────────────────────────────────────────

describe('Lexer', () => {
    it('tokenizes integer and float literals', () => {
        const toks = tokenize('42 3.14 0.5');
        const nums = toks.filter(t => t.type === 'NUMBER');
        expect(nums).toHaveLength(3);
        expect(nums[0]!.value).toBe('42');
        expect(nums[1]!.value).toBe('3.14');
        expect(nums[2]!.value).toBe('0.5');
    });

    it('tokenizes string literals with escape sequences', () => {
        const toks = tokenize('"hello\\nworld"');
        const str = toks.find(t => t.type === 'STRING');
        expect(str).toBeDefined();
        expect(str!.value).toBe('hello\nworld');
    });

    it('tokenizes color literals (6-digit)', () => {
        const toks = tokenize('#FF0000');
        const col = toks.find(t => t.type === 'COLOR');
        expect(col).toBeDefined();
        expect(col!.value).toBe('#FF0000');
    });

    it('tokenizes color literals (8-digit with alpha)', () => {
        const toks = tokenize('#FF000080');
        const col = toks.find(t => t.type === 'COLOR');
        expect(col).toBeDefined();
        expect(col!.value).toBe('#FF000080');
    });

    it('tokenizes Rust keywords', () => {
        const types = tokenTypes('let mut fn struct enum impl trait for while loop return break continue if else match');
        expect(types).toContain('LET');
        expect(types).toContain('MUT');
        expect(types).toContain('FN');
        expect(types).toContain('STRUCT');
        expect(types).toContain('ENUM');
        expect(types).toContain('IMPL');
        expect(types).toContain('TRAIT');
        expect(types).toContain('FOR');
        expect(types).toContain('WHILE');
        expect(types).toContain('LOOP');
        expect(types).toContain('RETURN');
        expect(types).toContain('BREAK');
        expect(types).toContain('CONTINUE');
        expect(types).toContain('IF');
        expect(types).toContain('ELSE');
        expect(types).toContain('MATCH');
    });

    it('tokenizes Rust operators: -> => :: ..', () => {
        const types = tokenTypes('-> => :: ..');
        expect(types).toContain('ARROW');
        expect(types).toContain('FAT_ARROW');
        expect(types).toContain('DOUBLE_COLON');
        expect(types).toContain('DOT_DOT');
    });

    it('tokenizes power operator **', () => {
        const types = tokenTypes('2 ** 10');
        expect(types).toContain('STAR_STAR');
    });

    it('tokenizes #[ attribute opener', () => {
        const types = tokenTypes('#[indicator]');
        expect(types).toContain('HASH_BRACKET');
    });

    it('ignores // line comments', () => {
        const toks = tokenize('42 // this is a comment\n99');
        const nums = toks.filter(t => t.type === 'NUMBER');
        expect(nums).toHaveLength(2);
        expect(parseFloat(nums[0]!.value)).toBe(42);
        expect(parseFloat(nums[1]!.value)).toBe(99);
    });

    it('ignores /* block comments */', () => {
        const toks = tokenize('1 /* block */ 2');
        const nums = toks.filter(t => t.type === 'NUMBER');
        expect(nums).toHaveLength(2);
    });

    it('tracks line and col numbers', () => {
        const toks = tokenize('a\nb');
        const idents = toks.filter(t => t.type === 'IDENT');
        expect(idents[0]!.line).toBe(1);
        expect(idents[0]!.column).toBe(1);
        expect(idents[1]!.line).toBe(2);
        expect(idents[1]!.column).toBe(1);
    });

    it('throws OrbitScriptError on unterminated string', () => {
        expect(() => tokenize('"unterminated')).toThrow(OrbitScriptError);
    });

    it('throws OrbitScriptError on invalid color literal', () => {
        expect(() => tokenize('#XYZ')).toThrow(OrbitScriptError);
    });

    it('tokenizes boolean literals', () => {
        const toks = tokenize('true false');
        const bools = toks.filter(t => t.type === 'TRUE' || t.type === 'FALSE');
        expect(bools).toHaveLength(2);
        expect(bools[0]!.value).toBe('true');
        expect(bools[1]!.value).toBe('false');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARSER
// ─────────────────────────────────────────────────────────────────────────────

describe('Parser', () => {
    it('parses #[indicator] directive', () => {
        const prog = parse(tokenize('#[indicator(name = "RSI", overlay = false)]'));
        expect(prog.directives).toHaveLength(1);
        expect(prog.directives[0]!.name).toBe('indicator');
    });

    it('parses #[input] directive', () => {
        // Positional form: name, type-string, default
        const prog = parse(tokenize('#[input(length, "i64", 14)]'));
        expect(prog.directives.some(d => d.name === 'input')).toBe(true);
    });

    it('parses let binding', () => {
        const prog = parse(tokenize('let x = 42;'));
        expect(prog.body).toHaveLength(1);
        expect(prog.body[0]!.kind).toBe('LetStmt');
    });

    it('parses let mut binding', () => {
        const prog = parse(tokenize('let mut counter = 0;'));
        const stmt = prog.body[0]!;
        expect(stmt.kind).toBe('LetStmt');
        if (stmt.kind === 'LetStmt') expect(stmt.mutable).toBe(true);
    });

    it('parses assignment operators +=, -=, *=', () => {
        const prog = parse(tokenize('x += 1; y -= 2; z *= 3;'));
        const kinds = prog.body.map(s => {
            if (s.kind === 'AssignStmt') return s.op;
            return null;
        });
        expect(kinds).toContain('+=');
        expect(kinds).toContain('-=');
        expect(kinds).toContain('*=');
    });

    it('parses binary expressions with correct precedence', () => {
        // 2 + 3 * 4 should be 2 + (3*4) = 14
        const prog = parse(tokenize('let x = 2 + 3 * 4;'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error('not let');
        const init = stmt.init!;
        expect(init.kind).toBe('BinaryExpr');
        if (init.kind === 'BinaryExpr') {
            expect(init.op).toBe('+');
            expect(init.right.kind).toBe('BinaryExpr');
        }
    });

    it('parses power operator ** with higher precedence than *', () => {
        const prog = parse(tokenize('let x = 2 * 3 ** 2;'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error('not let');
        const init = stmt.init!;
        expect(init.kind).toBe('BinaryExpr');
        if (init.kind === 'BinaryExpr') {
            expect(init.op).toBe('*');
            expect(init.right.kind).toBe('BinaryExpr');
            if (init.right.kind === 'BinaryExpr') expect(init.right.op).toBe('**');
        }
    });

    it('parses history reference close[1]', () => {
        const prog = parse(tokenize('let prev = close[1];'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error('not let');
        expect(stmt.init!.kind).toBe('HistoryRefExpr');
    });

    it('parses if/else expression', () => {
        // Condition must not end with a bare identifier before {
        // because "ident {" is ambiguous with struct init.
        // Use literal values to avoid the ambiguity.
        const src = 'let x = if 3.0 > 2.0 { 1.0 } else { 2.0 };';
        const prog = parse(tokenize(src));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error('not let');
        expect(stmt.init!.kind).toBe('IfExpr');
    });

    it('parses match expression', () => {
        // Wrap the subject in parens to prevent "trend {" from being
        // parsed as a struct-init expression.
        const src = `
            match (trend) {
                Trend::Up => 1.0,
                Trend::Down => -1.0,
                _ => 0.0,
            }
        `;
        const prog = parse(tokenize(src));
        const stmt = prog.body[0]!;
        expect(stmt.kind).toBe('ExprStmt');
        if (stmt.kind === 'ExprStmt') {
            expect(stmt.expr.kind).toBe('MatchExpr');
        }
    });

    it('parses fn definition', () => {
        const src = 'fn add(a: f64, b: f64) -> f64 { a + b }';
        const prog = parse(tokenize(src));
        expect(prog.functions).toHaveLength(1);
        expect(prog.functions[0]!.name).toBe('add');
        expect(prog.functions[0]!.params).toHaveLength(2);
    });

    it('parses struct definition', () => {
        const src = 'struct Point { x: f64, y: f64 }';
        const prog = parse(tokenize(src));
        expect(prog.structs).toHaveLength(1);
        expect(prog.structs[0]!.name).toBe('Point');
        expect(prog.structs[0]!.fields).toHaveLength(2);
    });

    it('parses enum definition', () => {
        const src = 'enum Trend { Up, Down, Sideways }';
        const prog = parse(tokenize(src));
        expect(prog.enums).toHaveLength(1);
        expect(prog.enums[0]!.name).toBe('Trend');
        expect(prog.enums[0]!.variants).toHaveLength(3);
    });

    it('parses closure |x| x * 2', () => {
        const prog = parse(tokenize('let f = |x| x * 2.0;'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error('not let');
        expect(stmt.init!.kind).toBe('ClosureExpr');
    });

    it('parses range 0..10', () => {
        const src = 'for i in 0..10 { }';
        const prog = parse(tokenize(src));
        expect(prog.body[0]!.kind).toBe('ForStmt');
    });

    it('parses array literal', () => {
        const prog = parse(tokenize('let arr = [1.0, 2.0, 3.0];'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error();
        expect(stmt.init!.kind).toBe('ArrayLitExpr');
    });

    it('parses struct init expr', () => {
        const src = 'let p = Point { x: 1.0, y: 2.0 };';
        const prog = parse(tokenize(src));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error();
        expect(stmt.init!.kind).toBe('StructInitExpr');
    });

    it('parses path expr Color::red', () => {
        const prog = parse(tokenize('let c = Color::red;'));
        const stmt = prog.body[0]!;
        if (stmt.kind !== 'LetStmt') throw new Error();
        expect(stmt.init!.kind).toBe('PathExpr');
    });

    it('semicolon after let is optional (no throw)', () => {
        // OrbitScript follows Rust-lite style: semicolons are optional in let bindings
        expect(() => parse(tokenize('let x = 5'))).not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. INTERPRETER — arithmetic & variables
// ─────────────────────────────────────────────────────────────────────────────

describe('Interpreter — arithmetic & variables', () => {
    const candles = makeCandles([10, 20, 30]);

    it('evaluates arithmetic expressions', () => {
        const { outputs } = run('plot(2.0 + 3.0 * 4.0, "x", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            expect(plot.points.every(p => p.value === 14)).toBe(true);
        }
    });

    it('evaluates power operator', () => {
        const { outputs } = run('plot(2.0 ** 8.0, "x", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(256);
        }
    });

    it('evaluates let binding and variable reference', () => {
        const { outputs } = run('let val = 42.0; plot(val, "v", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(42);
        }
    });

    it('evaluates boolean logic && ||', () => {
        const src = 'let x = true && false; plot(if (x) { 1.0 } else { 0.0 }, "b", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(0);
        }
    });

    it('evaluates unary negation', () => {
        const { outputs } = run('plot(-5.0, "v", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(-5);
        }
    });

    it('evaluates if/else expression', () => {
        const src = 'let x = if 3.0 > 2.0 { 100.0 } else { 0.0 }; plot(x, "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(100);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. INTERPRETER — series & history
// ─────────────────────────────────────────────────────────────────────────────

describe('Interpreter — series & history', () => {
    it('reads close series (one point per bar)', () => {
        const candles = makeCandles([10, 20, 30]);
        const { outputs } = run('plot(close, "c", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot?.type).toBe('plot');
        if (plot?.type === 'plot') {
            expect(plot.points.map(p => p.value)).toEqual([10, 20, 30]);
        }
    });

    it('reads open, high, low series', () => {
        const candles = makeCandles([50, 60], [45, 55]);
        const src = 'plot(open, "o", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points.map(p => p.value)).toEqual([45, 55]);
        }
    });

    it('reads volume series', () => {
        const candles = makeCandles([10, 20]);
        const { outputs } = run('plot(volume, "v", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(1000);
        }
    });

    it('history reference close[1] gives previous bar value', () => {
        const candles = makeCandles([10, 20, 30]);
        const src = 'let prev = close[1]; plot(prev, "p", #2196F3, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            // bar 0: close[1] = NaN (no prior bar), bar 1: 10, bar 2: 20
            expect(plot.points[1]!.value).toBe(10);
            expect(plot.points[2]!.value).toBe(20);
        }
    });

    it('bar_index increments correctly', () => {
        const candles = makeCandles([1, 2, 3]);
        const { outputs } = run('plot(bar_index, "bi", #2196F3, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points.map(p => p.value)).toEqual([0, 1, 2]);
        }
    });

    it('close[1..4] returns array of 3 values (indices 1,2,3) on bar 4', () => {
        // candles: closes = [10, 20, 30, 40, 50]
        // On bar index 4 (close=50): close[1]=40, close[2]=30, close[3]=20
        const candles = makeCandles([10, 20, 30, 40, 50]);
        const src = 'let arr = close[1..4];';
        // We need to capture the value at bar 4, use a helper variable via plot
        const src2 = `
            let arr = close[1..4];
            let s = arr[0] + arr[1] + arr[2];
            plot(s, "s", #2196F3, 1);
        `;
        const { outputs } = run(src2, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            // bar 4: arr = [close[1]=40, close[2]=30, close[3]=20], sum = 90
            expect(plot.points[4]!.value).toBe(90);
            // bar 0: all history is NaN — sum = NaN
            expect(isNaN(plot.points[0]!.value)).toBe(true);
        }
    });

    it('close[0..=3] returns array of 4 values (indices 0,1,2,3) on bar 4', () => {
        // candles: closes = [10, 20, 30, 40, 50]
        // On bar index 4 (close=50): close[0]=50, close[1]=40, close[2]=30, close[3]=20
        const candles = makeCandles([10, 20, 30, 40, 50]);
        const src2 = `
            let arr = close[0..=3];
            let s = arr[0] + arr[1] + arr[2] + arr[3];
            plot(s, "s", #2196F3, 1);
        `;
        const { outputs } = run(src2, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            // bar 4: arr = [50, 40, 30, 20], sum = 140
            expect(plot.points[4]!.value).toBe(140);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTERPRETER — control flow
// ─────────────────────────────────────────────────────────────────────────────

describe('Interpreter — control flow', () => {
    const candles = makeCandles([10, 20, 30]);

    it('for loop accumulates sum', () => {
        const src = `
            let mut total = 0.0;
            for i in 0..3 {
                total += 1.0;
            }
            plot(total, "t", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(3);
        }
    });

    it('while loop exits on condition', () => {
        const src = `
            let mut n = 0.0;
            while n < 5.0 {
                n += 1.0;
            }
            plot(n, "n", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(5);
        }
    });

    it('break exits loop early', () => {
        const src = `
            let mut i = 0.0;
            loop {
                i += 1.0;
                if i >= 3.0 { break; }
            }
            plot(i, "i", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(3);
        }
    });

    it('return inside fn stops execution', () => {
        const src = `
            fn first_positive(a: f64, b: f64) -> f64 {
                if a > 0.0 { return a; }
                b
            }
            plot(first_positive(5.0, 10.0), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(5);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. INTERPRETER — functions, structs, enums
// ─────────────────────────────────────────────────────────────────────────────

describe('Interpreter — user-defined functions', () => {
    const candles = makeCandles([10, 20, 30]);

    it('calls user fn with positional args', () => {
        const src = `
            fn square(x: f64) -> f64 { x * x }
            plot(square(7.0), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(49);
        }
    });

    it('calls recursive fn (factorial)', () => {
        const src = `
            fn factorial(n: f64) -> f64 {
                if n <= 1.0 { 1.0 } else { n * factorial(n - 1.0) }
            }
            plot(factorial(5.0), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(120);
        }
    });

    it('invokes closure', () => {
        const src = `
            let double = |x| x * 2.0;
            plot(double(6.0), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(12);
        }
    });
});

describe('Interpreter — structs', () => {
    const candles = makeCandles([10, 20]);

    it('creates struct and reads field', () => {
        const src = `
            struct Point { x: f64, y: f64 }
            let p = Point { x: 3.0, y: 4.0 };
            plot(p.x, "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(3);
        }
    });

    it('impl method on struct', () => {
        const src = `
            struct Circle { r: f64 }
            impl Circle {
                fn area(&self) -> f64 {
                    3.14159 * self.r * self.r
                }
            }
            let c = Circle { r: 2.0 };
            plot(c.area(), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBeCloseTo(12.566, 2);
        }
    });
});

describe('Interpreter — enums & match', () => {
    const candles = makeCandles([10, 20]);

    it('matches enum variant', () => {
        const src = `
            enum Signal { Buy, Sell, Hold }
            let sig = Signal::Buy;
            let val = match (sig) {
                Signal::Buy  => 1.0,
                Signal::Sell => -1.0,
                _            => 0.0,
            };
            plot(val, "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(1);
        }
    });

    it('wildcard pattern matches anything', () => {
        const src = `
            let x = match 42.0 {
                1.0 => "one",
                _   => "other",
            };
            plot(if (x == "other") { 1.0 } else { 0.0 }, "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(1);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. STDLIB — math functions
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — math', () => {
    const candles = makeCandles([10, 20, 30]);

    it('abs() returns absolute value', () => {
        const { outputs } = run('plot(abs(-7.0), "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(7);
    });

    it('sqrt() returns square root', () => {
        const { outputs } = run('plot(sqrt(9.0), "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(3);
    });

    it('max() and min() compare two values', () => {
        const src = 'plot(max(3.0, 7.0), "a", #ffffff, 1); plot(min(3.0, 7.0), "b", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plots = outputs.filter(o => o.type === 'plot');
        expect(plots[0]?.type === 'plot' && plots[0].points[0]!.value).toBe(7);
        expect(plots[1]?.type === 'plot' && plots[1].points[0]!.value).toBe(3);
    });

    it('round() rounds to nearest integer', () => {
        const { outputs } = run('plot(round(3.7), "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(4);
    });

    it('pow() raises to power', () => {
        const { outputs } = run('plot(pow(2.0, 10.0), "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(1024);
    });

    it('na() returns true for NaN, false for finite', () => {
        const src = 'plot(if na(close[100]) { 1.0 } else { 0.0 }, "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(1);
    });

    it('nz() replaces NaN with default', () => {
        const src = 'plot(nz(close[100], 99.0), "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(99);
    });

    it('clamp() constrains value', () => {
        const { outputs } = run('plot(clamp(150.0, 0.0, 100.0), "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(100);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. STDLIB — series / moving averages
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — moving averages', () => {
    // Generate a linearly increasing series: 1,2,3,...,20
    const closes = Array.from({ length: 20 }, (_, i) => i + 1);
    const candles = makeCandles(closes);

    it('sma(close, 3) on last bar = avg of last 3 closes', () => {
        const { outputs } = run('plot(sma(close, 3), "s", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            // last 3 closes: 18, 19, 20 → avg = 19
            const lastPt = plot.points.at(-1)!;
            expect(lastPt.value).toBeCloseTo(19, 5);
        }
    });

    it('ema(close, 5) returns a number (not NaN) on bar >= 4', () => {
        const { outputs } = run('plot(ema(close, 5), "e", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const p = plot.points[4]!;  // bar index 4 (5th bar)
            expect(isNaN(p.value)).toBe(false);
            expect(p.value).toBeGreaterThan(0);
        }
    });

    it('sma early bars (index < length-1) produce NaN', () => {
        const { outputs } = run('plot(sma(close, 5), "s", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            // Bars 0-3 (before warmup complete) should be NaN
            expect(isNaN(plot.points[0]!.value)).toBe(true);
            expect(isNaN(plot.points[3]!.value)).toBe(true);
        }
    });

    it('highest(close, 5) equals max of last 5 bars', () => {
        const { outputs } = run('plot(highest(close, 5), "h", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const lastPt = plot.points.at(-1)!;
            expect(lastPt.value).toBe(20);
        }
    });

    it('lowest(close, 5) equals min of last 5 bars', () => {
        const candles5 = makeCandles([5, 3, 8, 2, 9]);
        const { outputs } = run('plot(lowest(close, 5), "l", #ffffff, 1);', candles5);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const lastPt = plot.points.at(-1)!;
            expect(lastPt.value).toBe(2);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. STDLIB — crossover / crossunder
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — crossover & crossunder', () => {
    it('crossover detects upward cross', () => {
        // fast line crosses above slow line between bar 1 and bar 2
        const fast  = [5, 5, 15];
        const slow  = [10, 10, 10];
        const candles = makeCandles(fast);

        // Use custom arrays via let
        const src = `
            let f = sma(close, 1);
            let s = sma(close, 1);
            plot(if crossover(f, 10.0) { 1.0 } else { 0.0 }, "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[2]!.value).toBe(1);  // crossed on bar 2
            expect(plot.points[0]!.value).toBe(0);  // no cross on bar 0
        }
    });

    it('crossunder detects downward cross', () => {
        // fast line crosses below 10 between bar 1 and bar 2
        const candles = makeCandles([15, 15, 5]);
        const src = 'plot(if crossunder(close, 10.0) { 1.0 } else { 0.0 }, "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[2]!.value).toBe(1);
            expect(plot.points[0]!.value).toBe(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. STDLIB — output functions
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — output functions', () => {
    const candles = makeCandles([10, 20, 30]);

    it('plot() generates PlotOutput with correct type', () => {
        const { outputs } = run('plot(close, "Close", #2196F3, 2);', candles);
        const p = outputs.find(o => o.type === 'plot');
        expect(p).toBeDefined();
        expect(p!.type).toBe('plot');
    });

    it('plot() produces one point per candle', () => {
        const { outputs } = run('plot(close, "C", #ffffff, 1);', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') {
            expect(p.points).toHaveLength(3);
        }
    });

    it('hline() generates HLineOutput', () => {
        const { outputs } = run('hline(70.0, "OB", #ef4444, "dashed");', candles);
        const h = outputs.find(o => o.type === 'hline');
        expect(h).toBeDefined();
        expect(h!.type).toBe('hline');
        if (h?.type === 'hline') {
            expect(h.price).toBe(70);
        }
    });

    it('bgcolor() generates BgColorOutput', () => {
        const { outputs } = run('bgcolor(#FF000020, close > 15.0);', candles);
        const bg = outputs.find(o => o.type === 'bgcolor');
        expect(bg).toBeDefined();
    });

    it('alertcondition() generates AlertOutput', () => {
        const { outputs } = run('alertcondition(close > 10.0, "Alert", "Price above 10");', candles);
        const al = outputs.find(o => o.type === 'alert');
        expect(al).toBeDefined();
    });

    it('multiple plot() calls produce multiple plot outputs', () => {
        const src = 'plot(close, "A", #ffffff, 1); plot(close, "B", #ff0000, 1);';
        const { outputs } = run(src, candles);
        const plots = outputs.filter(o => o.type === 'plot');
        expect(plots).toHaveLength(2);
    });

    it('plot() defaults style to "solid" when not provided', () => {
        const { outputs } = run('plot(close, "C", #2196F3, 1);', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.style).toBe('solid');
    });

    it('plot() accepts style="dashed"', () => {
        const { outputs } = run('plot(close, "C", #2196F3, 1, "dashed");', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.style).toBe('dashed');
    });

    it('plot() accepts style="dotted"', () => {
        const { outputs } = run('plot(close, "C", #2196F3, 1, "dotted");', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.style).toBe('dotted');
    });

    it('plot() accepts style="stepline"', () => {
        const { outputs } = run('plot(close, "C", #2196F3, 1, "stepline");', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.style).toBe('stepline');
    });

    it('plot() linewidth is stored correctly', () => {
        const { outputs } = run('plot(close, "C", #2196F3, 3);', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.linewidth).toBe(3);
    });

    it('plot() linewidth defaults to 1 when not provided', () => {
        const { outputs } = run('plot(close, "C", #2196F3);', candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') expect(p.linewidth).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. STDLIB — array methods
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — array methods', () => {
    const candles = makeCandles([10, 20, 30]);

    it('arr.len() returns length', () => {
        const src = 'let arr = [1.0, 2.0, 3.0]; plot(arr.len(), "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(3);
    });

    it('arr.push() and arr.len() after push', () => {
        const src = `
            let mut arr = [1.0, 2.0];
            arr.push(3.0);
            plot(arr.len(), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(3);
    });

    it('arr.sum() sums elements', () => {
        const src = 'let arr = [1.0, 2.0, 3.0, 4.0]; plot(arr.sum(), "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(10);
    });

    it('arr.avg() averages elements', () => {
        const src = 'let arr = [2.0, 4.0, 6.0]; plot(arr.avg(), "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(4);
    });

    it('arr.max() returns max element', () => {
        const src = 'let arr = [3.0, 1.0, 4.0, 1.0, 5.0]; plot(arr.max(), "v", #ffffff, 1);';
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(5);
    });

    it('arr.map() transforms elements', () => {
        const src = `
            let arr = [1.0, 2.0, 3.0];
            let doubled = arr.map(|x| x * 2.0);
            plot(doubled.sum(), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(12);
    });

    it('arr.filter() keeps matching elements', () => {
        const src = `
            let arr = [1.0, 2.0, 3.0, 4.0, 5.0];
            let evens = arr.filter(|x| x % 2.0 == 0.0);
            plot(evens.len(), "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') expect(plot.points[0]!.value).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. INTERPRETER — inputs / directives
// ─────────────────────────────────────────────────────────────────────────────

describe('Interpreter — inputs & meta', () => {
    const candles = makeCandles([10, 20, 30]);

    it('extracts indicator name and overlay from directive', () => {
        const src = `
            #[indicator(name = "My Indicator", overlay = true)]
            plot(close, "v", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.name).toBe('My Indicator');
        expect(meta.overlay).toBe(true);
    });

    it('extracts strategy kind from directive', () => {
        const src = '#[strategy(name = "My Strat")] plot(close, "v", #ffffff, 1);';
        const { meta } = run(src, candles);
        expect(meta.kind).toBe('strategy');
    });

    it('input directive defines a variable accessible in script', () => {
        const src = `
            #[input(length, "i64", 5)]
            plot(sma(close, length), "s", #ffffff, 1);
        `;
        const { outputs } = run(src, candles);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
    });

    it('input overrides take precedence over defaults', () => {
        const src = `
            #[input(mult, "f64", 1.0)]
            plot(close * mult, "v", #ffffff, 1);
        `;
        const { outputs } = run(src, candles, { mult: 3 });
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points[0]!.value).toBe(30);  // 10 * 3
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. COMPILER — compile() + register() integration
// ─────────────────────────────────────────────────────────────────────────────

describe('Compiler — compile()', () => {
    it('compile() returns CompiledScript with meta and computeFn', () => {
        const src = `
            #[indicator(name = "Test Ind", overlay = false)]
            plot(close, "C", #2196F3, 1);
        `;
        const compiled = compile(src);
        expect(compiled.meta.name).toBe('Test Ind');
        expect(compiled.meta.overlay).toBe(false);
        expect(typeof compiled.computeFn).toBe('function');
        expect(compiled.program).toBeDefined();
    });

    it('compile() computeFn returns IndicatorSeries', () => {
        const src = '#[indicator(name = "SMA20")] plot(sma(close, 3), "S", #ffffff, 1);';
        const compiled = compile(src);
        const candles = makeCandles(Array.from({ length: 10 }, (_, i) => i + 1));
        const series = compiled.computeFn(candles);
        expect(series).not.toBeNull();
        if (series) {
            expect((series.points ?? []).length).toBe(10);
            expect(typeof series.color).toBe('string');
        }
    });

    it('compile() returns null for empty candles', () => {
        const compiled = compile('plot(close, "v", #ffffff, 1);');
        const series = compiled.computeFn([]);
        expect(series).toBeNull();
    });

    it('compile() throws OrbitScriptError on syntax error', () => {
        expect(() => compile('let x = ;')).toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. INTEGRATION — full indicator scripts
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration — full indicator scripts', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
    const candles = makeCandles(closes);

    it('RSI indicator compiles and produces values in [0, 100]', () => {
        const src = `
            #[indicator(name = "RSI", overlay = false)]
            #[input(length, "i64", 14)]
            let rsi_val = rsi(close, length);
            plot(rsi_val, "RSI", #2196F3, 2);
            hline(70.0, "OB", #ef4444, "dashed");
            hline(30.0, "OS", #22c55e, "dashed");
        `;
        const compiled = compile(src);
        const series = compiled.computeFn(candles);
        expect(series).not.toBeNull();
        if (series) {
            const finitePoints = (series.points ?? []).filter(p => isFinite(p.value));
            expect(finitePoints.length).toBeGreaterThan(0);
            finitePoints.forEach(p => {
                expect(p.value).toBeGreaterThanOrEqual(0);
                expect(p.value).toBeLessThanOrEqual(100);
            });
        }
    });

    it('SMA Golden Cross produces two plot series', () => {
        const src = `
            #[indicator(name = "Golden Cross", overlay = true)]
            #[input(fast, "i64", 5)]
            #[input(slow, "i64", 10)]
            let fast_ma = sma(close, fast);
            let slow_ma = sma(close, slow);
            plot(fast_ma, "Fast", #2196F3, 2);
            plot(slow_ma, "Slow", #F44336, 2);
        `;
        const toks = tokenize(src);
        const prog = parse(toks);
        const { outputs } = interpret(prog, candles);
        const plots = outputs.filter(o => o.type === 'plot');
        expect(plots).toHaveLength(2);
    });

    it('Bollinger Bands indicator computes without errors', () => {
        const src = `
            #[indicator(name = "BB", overlay = true)]
            let bb = bollinger(close, 20, 2.0);
            plot(bb.middle, "Mid", #ffffff, 1);
            plot(bb.upper,  "Up",  #2196F3, 1);
            plot(bb.lower,  "Low", #F44336, 1);
        `;
        const compiled = compile(src);
        const series = compiled.computeFn(candles);
        expect(series).not.toBeNull();
    });

    it('Script with no plot() returns null from computeFn', () => {
        const src = '#[indicator(name = "Noop")] let x = 1.0;';
        const compiled = compile(src);
        const series = compiled.computeFn(candles);
        expect(series).toBeNull();
    });

    it('MACD indicator produces struct output with macd/signal/histogram fields', () => {
        const src = `
            #[indicator(name = "MACD", overlay = false)]
            let m = macd(close, 12, 26, 9);
            plot(m.macd_line,   "MACD",   #2196F3, 1);
            plot(m.signal_line, "Signal", #F44336, 1);
            plot(m.histogram,   "Hist",   #4CAF50, 1);
        `;
        const toks = tokenize(src);
        const prog = parse(toks);
        const { outputs } = interpret(prog, candles);
        const plots = outputs.filter(o => o.type === 'plot');
        expect(plots).toHaveLength(3);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe('Error handling', () => {
    const candles = makeCandles([10, 20, 30]);

    it('OrbitScriptError has line and col properties', () => {
        try {
            parse(tokenize('let x = ;'));
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(OrbitScriptError);
            if (e instanceof OrbitScriptError) {
                expect(typeof e.line).toBe('number');
                expect(typeof e.column).toBe('number');
            }
        }
    });

    it('accessing undefined variable throws OrbitScriptError', () => {
        expect(() => run('plot(undefined_var, "v", #ffffff, 1);', candles)).toThrow();
    });

    it('division by zero produces Infinity (not a crash)', () => {
        const { outputs } = run('plot(1.0 / 0.0, "v", #ffffff, 1);', candles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(isFinite(plot.points[0]!.value)).toBe(false);
        }
    });

    it('compile() with OrbitScriptError phase is "parse" or "lex"', () => {
        try {
            compile('fn (');
            expect.fail('should throw');
        } catch (e) {
            if (e instanceof OrbitScriptError) {
                expect(['parser', 'lexer', 'runtime']).toContain(e.phase);
            }
        }
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// Time stdlib functions
// ─────────────────────────────────────────────────────────────────────────────

describe('Stdlib — time functions', () => {
    // makeCandles uses timestamp = 1_000_000 + i * 60_000
    // bar 0 → 1000000 ms  → 1970-01-01T00:16:40Z  → day=4(Thu), hour=0, min=16, month=1, year=1970
    // bar 1 → 1060000 ms  → 1970-01-01T00:17:40Z  → day=4(Thu), hour=0, min=17, month=1, year=1970
    const candles = makeCandles([10, 20, 30]);

    it('time() returns unix timestamp in ms for each bar', () => {
        const { outputs } = run('plot(time(), "t", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1_000_000);
        expect(pts[1].value).toBe(1_060_000);
        expect(pts[2].value).toBe(1_120_000);
    });

    it('dayofweek() returns correct UTC day of week', () => {
        const { outputs } = run('plot(dayofweek(), "d", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(4); // Thursday
        expect(pts[1].value).toBe(4);
    });

    it('hour() returns correct UTC hour', () => {
        const { outputs } = run('plot(hour(), "h", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(0);
    });

    it('minute() returns correct UTC minute', () => {
        const { outputs } = run('plot(minute(), "m", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(16); // 1000000 ms = 16 min 40 sec
        expect(pts[1].value).toBe(17); // +60000 ms = +1 min
    });

    it('month() returns correct UTC month (1-based)', () => {
        const { outputs } = run('plot(month(), "mo", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1); // January
    });

    it('year() returns correct UTC year', () => {
        const { outputs } = run('plot(year(), "y", #2196F3, 1);', candles);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1970);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// @version, @timezone, @library directives
// ─────────────────────────────────────────────────────────────────────────────

describe('Directives — @version, @timezone, @library', () => {
    const candles = makeCandles([10, 20]);

    it('@version directive is stored in meta.version', () => {
        const src = `
            #[version("1.2.3")]
            #[indicator(name = "Test", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.version).toBe('1.2.3');
    });

    it('@version directive without @indicator still populates meta.version', () => {
        const src = `
            #[version("2.0.0")]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.version).toBe('2.0.0');
    });

    it('@timezone directive is stored in meta.timezone', () => {
        const src = `
            #[timezone("America/New_York")]
            #[indicator(name = "TZ Test", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.timezone).toBe('America/New_York');
    });

    it('@version and @timezone can coexist', () => {
        const src = `
            #[version("3.0.0")]
            #[timezone("UTC")]
            #[indicator(name = "Both", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.version).toBe('3.0.0');
        expect(meta.timezone).toBe('UTC');
    });

    it('missing @version leaves meta.version undefined', () => {
        const src = `
            #[indicator(name = "No Version", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.version).toBeUndefined();
    });

    it('missing @timezone leaves meta.timezone undefined', () => {
        const src = `
            #[indicator(name = "No TZ", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const { meta } = run(src, candles);
        expect(meta.timezone).toBeUndefined();
    });

    it('@library directive sets meta.kind to "library"', () => {
        const src = `
            #[library(name = "MyLib")]
            fn add(a: f64, b: f64) -> f64 { a + b }
        `;
        const { meta } = run(src, candles);
        expect(meta.kind).toBe('library');
        expect(meta.name).toBe('MyLib');
    });

    it('compile() preserves @version in meta', () => {
        const src = `
            #[version("0.9.1")]
            #[indicator(name = "CV", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const compiled = compile(src);
        expect(compiled.meta.version).toBe('0.9.1');
    });

    it('compile() preserves @timezone in meta', () => {
        const src = `
            #[timezone("Europe/London")]
            #[indicator(name = "CTZ", overlay = false)]
            plot(close, "c", #ffffff, 1);
        `;
        const compiled = compile(src);
        expect(compiled.meta.timezone).toBe('Europe/London');
    });

    it('compile() with @library sets meta.kind to "library"', () => {
        const src = `
            #[library(name = "UtilLib")]
            fn double(x: f64) -> f64 { x * 2.0 }
        `;
        const compiled = compile(src);
        expect(compiled.meta.kind).toBe('library');
        expect(compiled.meta.name).toBe('UtilLib');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Result<T,E> and ? error propagation
// ─────────────────────────────────────────────────────────────────────────────

describe('Result<T,E> and ? error propagation', () => {
    const candles = makeCandles([1]);

    function plotVal(src: string): number {
        const { outputs } = run(src, candles);
        const p = outputs.find(o => o.type === 'plot');
        if (p?.type === 'plot') return p.points[0]!.value;
        return NaN;
    }

    it('Ok(v)? unwraps to v', () => {
        const src = `
            fn divide(a: f64, b: f64) -> f64 {
                if b == 0 { return Err("div by zero") }
                Ok(a / b)
            }
            let r = divide(10, 2)?
            plot(r, "r", #ffffff, 1)
        `;
        expect(plotVal(src)).toBe(5);
    });

    it('Err(e)? propagates as Err — is_err() returns true', () => {
        const src = `
            fn divide(a: f64, b: f64) -> f64 {
                if b == 0 { return Err("div by zero") }
                Ok(a / b)
            }
            fn safe_calc() -> f64 {
                let v = divide(10, 0)?
                Ok(v + 1)
            }
            let r = safe_calc()
            plot(if r.is_err() { 1 } else { 0 }, "r", #ffffff, 1)
        `;
        expect(plotVal(src)).toBe(1);
    });

    it('Ok().is_ok() returns true', () => {
        const src = `plot(if Ok(42).is_ok() { 1 } else { 0 }, "r", #ffffff, 1)`;
        expect(plotVal(src)).toBe(1);
    });

    it('Err().is_err() returns true', () => {
        const src = `plot(if Err("oops").is_err() { 1 } else { 0 }, "r", #ffffff, 1)`;
        expect(plotVal(src)).toBe(1);
    });

    it('Ok(v).unwrap() returns v', () => {
        const src = `plot(Ok(99).unwrap(), "r", #ffffff, 1)`;
        expect(plotVal(src)).toBe(99);
    });

    it('Err(e).unwrap_or(default) returns default', () => {
        const src = `plot(Err("bad").unwrap_or(0), "r", #ffffff, 1)`;
        expect(plotVal(src)).toBe(0);
    });

    it('Ok(v).unwrap_or(default) returns v', () => {
        const src = `plot(Ok(7).unwrap_or(0), "r", #ffffff, 1)`;
        expect(plotVal(src)).toBe(7);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// New Technical Indicator Functions
// ─────────────────────────────────────────────────────────────────────────────

describe('New Technical Indicators', () => {
    const candles30 = Array.from({ length: 30 }, (_, i) => ({
        timestamp: 1_000_000 + i * 60_000,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100 + i,
        volume: 1000 + i * 10,
    }));

    // SMMA
    it('smma returns a finite number for sufficient data', () => {
        const { outputs } = run('plot(smma(close, 5), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
            expect(lastVal).toBeGreaterThan(100);
        }
    });

    it('smma returns NaN for insufficient data', () => {
        const { outputs } = run('plot(smma(close, 5), "v", #2196F3, 1);', makeCandles([10, 20, 30]));
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(plot.points.every(p => isNaN(p.value))).toBe(true);
        }
    });

    // KAMA
    it('kama returns a finite number for sufficient data', () => {
        const { outputs } = run('plot(kama(close, 10), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    it('kama uses default period 10', () => {
        const { outputs } = run('plot(kama(close), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    // T3
    it('t3 returns a finite number for sufficient data', () => {
        const { outputs } = run('plot(t3(close, 3, 0.7), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    // SMI
    it('smi returns values within -100 to 100 range', () => {
        const { outputs } = run('plot(smi(close, 5, 3), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const finite = plot.points.filter(p => Number.isFinite(p.value));
            expect(finite.length).toBeGreaterThan(0);
            finite.forEach(p => {
                expect(p.value).toBeGreaterThanOrEqual(-100);
                expect(p.value).toBeLessThanOrEqual(100);
            });
        }
    });

    // Elder Force Index
    it('elder_force returns a finite number', () => {
        const { outputs } = run('plot(elder_force(close, volume, 5), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    it('elder_force uses default period 13', () => {
        const { outputs } = run('plot(elder_force(close, volume), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    // VROC
    it('vroc returns a finite number for sufficient data', () => {
        const { outputs } = run('plot(vroc(volume, 5), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        expect(plot).toBeDefined();
        if (plot?.type === 'plot') {
            const lastVal = plot.points[plot.points.length - 1]!.value;
            expect(Number.isFinite(lastVal)).toBe(true);
        }
    });

    it('vroc returns NaN for early bars', () => {
        const { outputs } = run('plot(vroc(volume, 5), "v", #2196F3, 1);', candles30);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            expect(isNaN(plot.points[0]!.value)).toBe(true);
            expect(isNaN(plot.points[4]!.value)).toBe(true);
        }
    });

    it('vroc of constant volume is 0', () => {
        const constCandles = Array.from({ length: 20 }, (_, i) => ({
            timestamp: 1_000_000 + i * 60_000,
            open: 100, high: 101, low: 99, close: 100,
            volume: 500,
        }));
        const { outputs } = run('plot(vroc(volume, 3), "v", #2196F3, 1);', constCandles);
        const plot = outputs.find(o => o.type === 'plot');
        if (plot?.type === 'plot') {
            const finitePoints = plot.points.filter(p => Number.isFinite(p.value));
            finitePoints.forEach(p => expect(p.value).toBeCloseTo(0));
        }
    });
});
