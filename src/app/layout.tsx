import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import '@fontsource/russo-one/400.css';
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GZX Gaming Loyalty', template: '%s · GZX Loyalty' },
  description: 'Loyalty card management for GZX Gaming lounge staff.',
  applicationName: 'GZX Loyalty',
  appleWebApp: { capable: true, title: 'GZX Loyalty', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#101018',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: { background: '#22162B', border: '1px solid rgba(255,255,255,.1)', color: '#fff' },
          }}
        />
      </body>
    </html>
  );
}
