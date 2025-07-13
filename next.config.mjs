/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add headers for better proxy functionality and CORS handling
  async headers() {
    return [
      {
        source: '/api/:path*', // Apply to all API routes
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Allow all origins for API routes
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

export default nextConfig
