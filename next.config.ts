import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Solo E2E: directorio de build separado para no chocar con el 'next dev' de desarrollo.
  ...(process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1' ? { distDir: '.next-e2e' } : {}),
  compress: true,
  poweredByHeader: false,
  // Mismas cabeceras de seguridad que dlx-web
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
