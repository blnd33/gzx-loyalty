import { describe, expect, it } from 'vitest';
import { describeHistory } from './history';

const row = (action: string, metadata: Record<string, unknown>) =>
  ({ id: 1, action, created_at: '2026-11-02T10:00:00Z', staff_name: 'Cashier', metadata, reason: null });

describe('history lines (matches the spec example)', () => {
  it('maps every loyalty event to activity + progress', () => {
    expect(describeHistory(row('punch.added', { punch_number: 1, cycle_number: 1 }))).toMatchObject({ label: 'Paid hour', progress: '1/3', cycle: 1 });
    expect(describeHistory(row('punch.added', { punch_number: 3, cycle_number: 1 })).progress).toBe('3/3');
    expect(describeHistory(row('reward.unlocked', { cycle_number: 1 }))).toMatchObject({ label: 'Reward unlocked', progress: 'Available' });
    expect(describeHistory(row('reward.redeemed', { cycle_number: 1, new_cycle_number: 2 }))).toMatchObject({ label: 'Reward redeemed', progress: 'Completed' });
    expect(describeHistory(row('punch.added', { punch_number: 1, cycle_number: 2 }))).toMatchObject({ progress: '1/3', cycle: 2 });
  });
  it('includes receipt references', () => {
    expect(describeHistory(row('punch.added', { punch_number: 2, receipt_reference: 'PS5-3' })).detail).toBe('Receipt PS5-3');
  });
});
