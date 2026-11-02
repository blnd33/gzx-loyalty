// Six-letter customer codes and QR payload parsing (shared by client & server).

export const CODE_LENGTH = 6;
const CODE_RE = /^[A-Z]{6}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

/** Uppercases and strips anything that is not A–Z, keeping at most 6 letters. */
export function sanitizeCodeInput(raw: string): { value: string; rejected: boolean } {
  const upper = raw.toUpperCase();
  const value = upper.replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);
  const rejected = /[^A-Z]/.test(upper);
  return { value, rejected };
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function normalizeCode(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  return CODE_RE.test(v) ? v : null;
}

export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

export type QrPayload = { kind: 'token'; token: string } | { kind: 'code'; code: string } | { kind: 'invalid' };

/**
 * Accepts what a scanner reads from a GZX card:
 *  - a lookup URL  https://<app>/c/<token>
 *  - a bare token
 *  - a six-letter code (e.g. a hand-written test QR)
 */
export function parseQrPayload(text: string): QrPayload {
  const raw = text.trim();
  if (!raw) return { kind: 'invalid' };
  try {
    const url = new URL(raw);
    const m = url.pathname.match(/\/c\/([A-Za-z0-9_-]{32,64})\/?$/);
    if (m) return { kind: 'token', token: m[1] };
    return { kind: 'invalid' };
  } catch {
    /* not a URL */
  }
  if (TOKEN_RE.test(raw)) return { kind: 'token', token: raw };
  const code = normalizeCode(raw);
  if (code) return { kind: 'code', code };
  return { kind: 'invalid' };
}

export function cardUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/c/${token}`;
}
