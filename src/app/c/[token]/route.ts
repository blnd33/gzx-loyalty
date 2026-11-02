import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidToken } from '@/lib/code';

/**
 * Target of the URL printed in each card's QR code. Only signed-in staff are
 * resolved to a profile; anyone else is sent to the login page and learns
 * nothing about the customer. Opening the link never adds a punch.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(request.url).origin;
  if (!isValidToken(token)) return NextResponse.redirect(new URL('/scan?error=INVALID_QR', origin));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=/c/${token}`, origin));

  const { data, error } = await supabase.rpc('find_customer_by_qr', { p_token: token });
  if (error) return NextResponse.redirect(new URL('/scan?error=FORBIDDEN', origin));
  if (data?.error || !data?.customer_id) {
    return NextResponse.redirect(new URL(`/scan?error=${encodeURIComponent(data?.error ?? 'CUSTOMER_NOT_FOUND')}`, origin));
  }
  return NextResponse.redirect(new URL(`/customers/${data.customer_id}`, origin));
}
