import type { MetadataRoute } from 'next';

// Installable PWA for staff. Data always comes from the server (no offline mode).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GZX Gaming Loyalty',
    short_name: 'GZX Loyalty',
    start_url: '/',
    display: 'standalone',
    background_color: '#101018',
    theme_color: '#101018',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
