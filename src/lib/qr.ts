import 'server-only';
import QRCode from 'qrcode';
import { env } from '@/lib/env';
import { cardUrl } from '@/lib/code';

/**
 * SVG QR for a card. Encodes only the opaque lookup URL (/c/<token>) — no
 * personal data. Opening it requires a signed-in staff session.
 */
export async function cardQrSvg(token: string): Promise<string> {
  return QRCode.toString(cardUrl(env.appUrl, token), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    color: { dark: '#120A18', light: '#FFFFFF' },
  });
}
