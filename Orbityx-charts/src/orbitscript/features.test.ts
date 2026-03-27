/**
 * @file orbitscript/features.test.ts
 * @description Tests for string indexing and macro commands.
 */

import { describe, it, expect } from 'vitest';
import { interpret } from './runtime/interpreter.js';
import { tokenize }  from './frontend/lexer.js';
import { parse }     from './frontend/parser.js';
import { OrbitScriptError } from './lang/types.js';
import type { Candle } from '../types/index.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCandles(n = 3): Candle[] {
    return Array.from({ length: n }, (_, i) => ({
        timestamp: i * 1000,
        open: 100 + i,
        high: 110 + i,
        low:  90  + i,
        close: 105 + i,
        volume: 1000 * (i + 1),
    }));
}

function run(source: string, n = 3) {
    const tokens = tokenize(source);
    const ast    = parse(tokens);
    return interpret(ast, makeCandles(n));
}

function lastPlot(source: string, n = 3): number {
    const result = run(source, n);
    const plot = result.outputs.find(o => o.type === 'plot') as { points: { value: number }[] } | undefined;
    const pts  = plot?.points ?? [];
    return pts[pts.length - 1]?.value ?? NaN;
}

// ─── String indexing ─────────────────────────────────────────────────────────

describe('String indexing — single character', () => {
    it('s[0] returns first character', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[0] == "h") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[4] returns last character of 5-char string', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[4] == "o") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[-1] returns last character (negative index)', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[-1] == "o") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[-2] returns second-to-last character', () => {
        const { outputs } = run(`
            let s = "world";
            plot(if (s[-2] == "l") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('out-of-bounds returns null (None)', () => {
        const { outputs } = run(`
            let s = "hi";
            plot(if (s[10] == None) { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('string literal indexing: "abc"[1]', () => {
        const { outputs } = run(`
            plot(if ("abc"[1] == "b") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });
});

describe('String indexing — range slice', () => {
    it('s[1..4] returns exclusive substring', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[1..4] == "ell") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[0..=2] returns inclusive substring', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[0..=2] == "hel") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[0..0] returns empty string', () => {
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[0..0] == "") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('s[-3..] simulated with len', () => {
        // s[2..5] on "hello" = "llo"
        const { outputs } = run(`
            let s = "hello";
            plot(if (s[2..5] == "llo") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('array[1..3] slices an array', () => {
        const { outputs } = run(`
            let arr = [10.0, 20.0, 30.0, 40.0];
            let sl  = arr[1..3];
            plot(sl[0], "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(20);
    });

    it('array[0..=1] inclusive slice', () => {
        const { outputs } = run(`
            let arr = [1.0, 2.0, 3.0];
            let sl  = arr[0..=1];
            plot(sl[1], "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(2);
    });
});

// ─── Macros ───────────────────────────────────────────────────────────────────

describe('Macro: println!', () => {
    it('println! returns None', () => {
        const { outputs } = run(`
            let r = println!("hello");
            plot(if (r == None) { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('println! with multiple args does not throw', () => {
        expect(() => run(`println!("a", "b", "c");`)).not.toThrow();
    });
});

describe('Macro: format!', () => {
    it('format! replaces {} placeholders', () => {
        const { outputs } = run(`
            let s = format!("Hello, {}!", "World");
            plot(if (s == "Hello, World!") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('format! with multiple placeholders', () => {
        const { outputs } = run(`
            let s = format!("{} + {} = {}", 1.0, 2.0, 3.0);
            plot(if (s == "1 + 2 = 3") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('format! with no placeholders returns template', () => {
        const { outputs } = run(`
            let s = format!("no placeholders");
            plot(if (s == "no placeholders") { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });

    it('format! throws when first arg is not a string', () => {
        expect(() => run(`format!(42.0, "x");`)).toThrow(OrbitScriptError);
    });
});

describe('Macro: assert!', () => {
    it('assert! passes when condition is true', () => {
        expect(() => run(`assert!(1.0 > 0.0);`)).not.toThrow();
    });

    it('assert! throws when condition is false', () => {
        expect(() => run(`assert!(1.0 > 2.0);`)).toThrow(OrbitScriptError);
    });

    it('assert! uses custom message', () => {
        let msg = '';
        try { run(`assert!(false, "my custom error");`); }
        catch (e) { msg = (e as OrbitScriptError).message; }
        expect(msg).toContain('my custom error');
    });
});

describe('Macro: panic!', () => {
    it('panic! always throws', () => {
        expect(() => run(`panic!("something went wrong");`)).toThrow(OrbitScriptError);
    });

    it('panic! message is preserved', () => {
        let msg = '';
        try { run(`panic!("boom");`); }
        catch (e) { msg = (e as OrbitScriptError).message; }
        expect(msg).toContain('boom');
    });

    it('panic! with no args throws with default message', () => {
        let msg = '';
        try { run(`panic!();`); }
        catch (e) { msg = (e as OrbitScriptError).message; }
        expect(msg).toContain('explicit panic');
    });
});

describe('Macro: todo! and unreachable!', () => {
    it('todo! throws a runtime error', () => {
        expect(() => run(`todo!("implement me");`)).toThrow(OrbitScriptError);
    });

    it('unreachable! throws a runtime error', () => {
        expect(() => run(`unreachable!("this path");`)).toThrow(OrbitScriptError);
    });
});

describe('Macro: dbg!', () => {
    it('dbg! returns the value unchanged', () => {
        const { outputs } = run(`
            let x = 42.0;
            let r = dbg!(x);
            plot(r, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(42);
    });

    it('dbg! with expression', () => {
        const { outputs } = run(`
            let r = dbg!(2.0 + 3.0);
            plot(r, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(5);
    });
});

describe('Macro: vec!', () => {
    it('vec![...] constructs an array', () => {
        const { outputs } = run(`
            let arr = vec![1.0, 2.0, 3.0];
            plot(arr[1], "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(2);
    });

    it('vec![] creates an empty array', () => {
        const { outputs } = run(`
            let arr = vec![];
            plot(if (arr[0] == None) { 1.0 } else { 0.0 }, "t", #ffffff, 1);
        `);
        const pts = (outputs[0] as any).points;
        expect(pts[0].value).toBe(1);
    });
});

describe('Unknown macro', () => {
    it('calling an unknown macro throws OrbitScriptError', () => {
        expect(() => run(`foobar!(42.0);`)).toThrow(OrbitScriptError);
    });
});
