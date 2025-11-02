const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Development'ta PWA'yı kapat (hot reload için)
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse ve pdfjs-dist'i external olarak işaretle (server-side only)
      // Bu sayede webpack bunları bundle etmez ve Node.js direkt kullanır
      config.externals = config.externals || [];
      
      // Array veya function olabilir, her ikisini de destekle
      if (Array.isArray(config.externals)) {
        config.externals.push('pdf-parse', 'pdfjs-dist');
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          (context, request, callback) => {
            if (request === 'pdf-parse' || request === 'pdfjs-dist') {
              return callback(null, 'commonjs ' + request);
            }
            callback();
          },
        ];
      } else {
        // Object ise merge et
        config.externals = {
          ...config.externals,
          'pdf-parse': 'commonjs pdf-parse',
          'pdfjs-dist': 'commonjs pdfjs-dist',
        };
      }
    }
    return config;
  },
}

module.exports = withPWA(nextConfig)

