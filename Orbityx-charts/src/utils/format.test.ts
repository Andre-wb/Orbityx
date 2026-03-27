import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPrice,
  formatNumber,
  formatPercent,
  formatPct,
  formatVolume,
  formatCompact,
} from './format.js';

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats USD values', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats with different currency', () => {
    const result = formatCurrency(1234.56, 'EUR');
    expect(result).toContain('1,234.56');
  });

  it('returns empty string for invalid input', () => {
    expect(formatCurrency(null)).toBe('');
    expect(formatCurrency(undefined)).toBe('');
    expect(formatCurrency('abc')).toBe('');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative values', () => {
    const result = formatCurrency(-50);
    expect(result).toContain('50.00');
  });
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------
describe('formatPrice', () => {
  it('auto-precision for sub-cent values (< 0.01)', () => {
    const result = formatPrice(0.005);
    // Should use 6-8 decimals
    expect(result).toContain('0.005');
  });

  it('auto-precision for sub-dollar values (< 1)', () => {
    const result = formatPrice(0.5);
    // Should use 4-6 decimals
    expect(result).toContain('0.5');
  });

  it('auto-precision for normal values (>= 100)', () => {
    const result = formatPrice(1234.56);
    expect(result).toContain('1,234.56');
  });

  it('explicit precision overrides auto', () => {
    const result = formatPrice(1.23456, 'USD', 5);
    expect(result).toContain('1.23456');
  });

  it('returns empty string for invalid input', () => {
    expect(formatPrice(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------
describe('formatNumber', () => {
  it('formats a normal number', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects min/max fraction digits', () => {
    const result = formatNumber(3.14159, 2, 4);
    expect(result).toBe('3.1416');
  });

  it('returns empty string for invalid', () => {
    expect(formatNumber(null)).toBe('');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------
describe('formatPercent', () => {
  it('formats 0.5 as 50%', () => {
    const result = formatPercent(0.5);
    expect(result).toBe('50.00%');
  });

  it('formats 0 as 0%', () => {
    const result = formatPercent(0);
    expect(result).toBe('0.00%');
  });

  it('formats 1 as 100%', () => {
    const result = formatPercent(1);
    expect(result).toBe('100.00%');
  });

  it('returns empty string for invalid', () => {
    expect(formatPercent(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatPct
// ---------------------------------------------------------------------------
describe('formatPct', () => {
  it('shows + sign for positive', () => {
    expect(formatPct(5.5)).toBe('+5.50%');
  });

  it('shows - sign for negative', () => {
    expect(formatPct(-3.2)).toBe('-3.20%');
  });

  it('shows + for zero', () => {
    expect(formatPct(0)).toBe('+0.00%');
  });

  it('returns empty string for invalid', () => {
    expect(formatPct(null)).toBe('');
  });

  it('respects decimals parameter', () => {
    expect(formatPct(1.234, 1)).toBe('+1.2%');
  });
});

// ---------------------------------------------------------------------------
// formatVolume
// ---------------------------------------------------------------------------
describe('formatVolume', () => {
  it('formats billions', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.5B');
  });

  it('formats millions', () => {
    expect(formatVolume(2_500_000)).toBe('2.5M');
  });

  it('formats thousands', () => {
    expect(formatVolume(1_500)).toBe('1.5K');
  });

  it('formats small numbers', () => {
    expect(formatVolume(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(formatVolume(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatVolume(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatCompact
// ---------------------------------------------------------------------------
describe('formatCompact', () => {
  it('formats large numbers compactly', () => {
    const result = formatCompact(1_000_000);
    expect(result).toBe('1M');
  });

  it('formats billions', () => {
    const result = formatCompact(2_500_000_000);
    expect(result).toBe('2.5B');
  });

  it('returns empty string for invalid', () => {
    expect(formatCompact(null)).toBe('');
  });
});
