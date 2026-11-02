import { describe, expect, it } from 'vitest';
import { cardUrl, isValidCode, normalizeCode, parseQrPayload, sanitizeCodeInput } from './code';

describe('six-letter codes', () => {
  it('accepts exactly six letters, case-insensitively', () => {
    expect(normalizeCode('axkjtr')).toBe('AXKJTR');
    expect(normalizeCode(' AXKJTR ')).toBe('AXKJTR');
    expect(isValidCode('AXKJTR')).toBe(true);
  });
  it('rejects numbers, spaces, symbols and wrong lengths', () => {
    for (const bad of ['AXKJT', 'AXKJTRR', 'AXK1TR', 'AXK TR', 'AXK-TR', '', 'ÄXKJTR']) {
      expect(normalizeCode(bad)).toBeNull();
    }
  });
  it('sanitizes typing and pasting and reports rejected characters', () => {
    expect(sanitizeCodeInput('ax kj-tr')).toEqual({ value: 'AXKJTR', rejected: true });
    expect(sanitizeCodeInput('axk')).toEqual({ value: 'AXK', rejected: false });
    expect(sanitizeCodeInput('ABCDEFGH').value).toBe('ABCDEF');
    expect(sanitizeCodeInput('12345').value).toBe('');
  });
});

describe('QR payloads', () => {
  const token = 'Xk2_9fQpLm3VbN8sRt4YwZ1aCd6EgH0j';
  it('reads the lookup URL printed on cards', () => {
    expect(parseQrPayload(cardUrl('https://gzx.example/', token))).toEqual({ kind: 'token', token });
    expect(parseQrPayload(`https://gzx.example/c/${token}/`)).toEqual({ kind: 'token', token });
  });
  it('reads a bare token or a six-letter code', () => {
    expect(parseQrPayload(token)).toEqual({ kind: 'token', token });
    expect(parseQrPayload('axkjtr')).toEqual({ kind: 'code', code: 'AXKJTR' });
  });
  it('rejects anything else', () => {
    expect(parseQrPayload('https://evil.example/login')).toEqual({ kind: 'invalid' });
    expect(parseQrPayload('hello world')).toEqual({ kind: 'invalid' });
    expect(parseQrPayload('')).toEqual({ kind: 'invalid' });
  });
  it('never puts personal data in the QR URL', () => {
    expect(cardUrl('https://gzx.example', token)).toBe(`https://gzx.example/c/${token}`);
  });
});
