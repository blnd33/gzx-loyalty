/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is needed by the QR scanner on our own origin only.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },

];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders },
      {source:'/card/:path*',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'private, no-store, max-age=0'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}];
  },
};

export default nextConfig;
