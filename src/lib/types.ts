export type Role = 'super_admin' | 'cashier';

export interface StaffProfile {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface LoyaltyState {
  customer_id: string;
  cycle_id: string;
  cycle_number: number;
  cycle_status: 'active' | 'completed' | 'redeemed';
  punch_count: number;
  reward_id: string | null;
  reward_status: 'available' | null;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  last_visit_at: string | null;
  card: {
    id: string;
    code: string;
    qr_token: string;
    status: 'active' | 'deactivated';
    status_reason: string | null;
    created_at: string;
  } | null;
  state: LoyaltyState;
  reward_unlocked_at: string | null;
  total_paid_hours: number;
  total_rewards_redeemed: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  code: string | null;
  card_status: string | null;
  punch_count: number | null;
  cycle_status: string | null;
  last_visit_at: string | null;
  created_at: string;
  active: boolean;
  total_count: number;
}

export interface HistoryRow {
  id: number;
  action: string;
  created_at: string;
  staff_name: string | null;
  metadata: Record<string, unknown>;
  reason: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string };
