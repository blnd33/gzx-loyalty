import { describe, expect, it } from 'vitest';
import { errorCode, friendlyError } from './errors';

describe('database error codes', () => {
  it('extracts codes raised by Postgres functions', () => {
    expect(errorCode({ message: 'REWARD_PENDING' })).toBe('REWARD_PENDING');
    expect(errorCode({ message: 'duplicate key value violates unique constraint' })).toBe('UNKNOWN');
  });
  it('never leaks raw database messages', () => {
    expect(friendlyError({ message: 'relation "x" does not exist' })).toBe('Something went wrong. Please try again.');
    expect(friendlyError('NO_REWARD_AVAILABLE')).toMatch(/no reward/i);
  });
});
