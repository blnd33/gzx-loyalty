import { z } from 'zod';

const trimmed = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.').max(100, 'Name is too long.'),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^(\+?[0-9 ()-]{4,24})?$/, 'Use digits, spaces, +, - or brackets only.')
    .optional()
    .transform((v) => (v ? v : undefined)),
  notes: trimmed(1000),
});

export const uuidSchema = z.string().uuid();
export const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{6}$/, 'Codes are exactly 6 letters.');
export const tokenSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{32,64}$/);

export const punchSchema = z.object({
  customerId: uuidSchema,
  idempotencyKey: uuidSchema,
  receiptReference: trimmed(64),
  notes: trimmed(500),
});

export const redeemSchema = z.object({ customerId: uuidSchema, idempotencyKey: uuidSchema });

export const reasonSchema = z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300);

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, 'Use at least 10 characters.').max(72),
  role: z.enum(['super_admin', 'cashier']),
});

export const staffUpdateSchema = z.object({
  staffId: uuidSchema,
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(['super_admin', 'cashier']),
  active: z.boolean(),
});

export const settingsSchema = z.object({
  lounge_name: z.string().trim().min(1).max(80),
  reward_label: z.string().trim().min(1).max(80),
  card_tagline: z.string().trim().min(1).max(80),
  lookup_limit_per_minute: z.coerce.number().int().min(3).max(500),
  lookup_failures_per_10min: z.coerce.number().int().min(3).max(500),
});
