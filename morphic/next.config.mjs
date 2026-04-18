/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization
  reactStrictMode: true,
  // Disable browser caching
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          }
        ]
      }
    ]
  }
};

export default nextConfig;
