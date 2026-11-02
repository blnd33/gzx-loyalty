// Database functions raise stable codes; translate them for staff.
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to do that.',
  CUSTOMER_NOT_FOUND: 'No customer found with that code. Check the letters and try again.',
  CARD_REPLACED: 'This card was replaced. Ask the customer for their new card or search by name.',
  CARD_INACTIVE: 'This card is deactivated. An admin must reactivate or reissue it first.',
  CUSTOMER_INACTIVE: 'This customer account is deactivated.',
  INVALID_CODE: 'Customer codes are exactly 6 letters (A–Z).',
  INVALID_QR: 'This QR code is not a GZX loyalty card.',
  RATE_LIMITED: 'Too many lookups in a short time. Wait a minute and try again.',
  REWARD_PENDING: 'This customer has an unredeemed reward. Redeem it before adding more paid hours.',
  NO_REWARD_AVAILABLE: 'There is no reward available to redeem (it may have just been redeemed).',
  IDEMPOTENCY_KEY_REQUIRED: 'Request could not be verified. Please try again.',
  IDEMPOTENCY_KEY_REUSED: 'Request could not be verified. Please try again.',
  INTEGRITY_ERROR: 'The loyalty record looks inconsistent. Please contact an admin.',
  INVALID_NAME: 'Enter a name between 1 and 100 characters.',
  INVALID_PHONE: 'Phone numbers may contain digits, spaces, +, - and brackets only.',
  INVALID_NOTES: 'Notes are too long.',
  INVALID_RECEIPT: 'Receipt reference is too long (max 64 characters).',
  REASON_REQUIRED: 'Please give a reason (at least 3 characters).',
  NOTHING_TO_VOID: 'There are no paid hours in the current cycle to correct.',
  CODE_GENERATION_FAILED: 'Could not generate a unique code. Please try again.',
  INVALID_ROLE: 'Invalid role.',
  STAFF_NOT_FOUND: 'Staff member not found.',
  CANNOT_DEMOTE_SELF: 'You cannot remove your own admin access.',
  LAST_ADMIN: 'At least one active administrator is required.',
  INVALID_SETTING: 'That value is not allowed for this setting.',
};

export function errorCode(err: unknown): string {
  const msg =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  const match = msg.match(/^[A-Z_]{3,40}$/);
  return match ? match[0] : 'UNKNOWN';
}

export function friendlyError(codeOrErr: unknown): string {
  const code = typeof codeOrErr === 'string' ? codeOrErr : errorCode(codeOrErr);
  return MESSAGES[code] ?? 'Something went wrong. Please try again.';
}
