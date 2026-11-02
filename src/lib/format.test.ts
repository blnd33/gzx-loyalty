import { describe, expect, it } from 'vitest';
import { formatDateTime, relativeDay } from './format';

describe('Asia/Baghdad display', () => {
  it('converts UTC to Baghdad time (UTC+3)', () => {
    expect(formatDateTime('2026-11-02T21:30:00Z')).toBe('3 Nov 2026 · 00:30');
  });
  it('computes calendar days in Baghdad, not UTC', () => {
    const now = new Date('2026-11-02T22:00:00Z'); // 01:00 on 3 Nov in Baghdad
    expect(relativeDay('2026-11-02T20:00:00Z', now)).toBe('Yesterday'); // 23:00 on 2 Nov in Baghdad
    expect(relativeDay('2026-11-02T21:30:00Z', now)).toBe('Today');
    expect(relativeDay(null, now)).toBe('Never');
  });
});
