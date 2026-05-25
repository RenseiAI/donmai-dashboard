import type { NextConfig } from 'next'

/**
 * Security headers for production
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 */
const securityHeaders = [
  {
    // Enforce HTTPS for 1 year with subdomains
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Prevent clickjacking - allow same origin only
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    // Control referrer information
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Basic Content Security Policy
    // Allow self, inline scripts (for Next.js), and Linear for links
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
      "style-src 'self' 'unsafe-inline'", // For styled components
      "img-src 'self' data: https:", // Allow images from HTTPS sources
      "font-src 'self'",
      "connect-src 'self'", // For API calls
      "frame-ancestors 'self'", // Complement to X-Frame-Options
    ].join('; '),
  },
  {
    // Disable FLoC tracking
    key: 'Permissions-Policy',
    value: 'interest-cohort=()',
  },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@donmai/dashboard'],
  // Exclude server-side packages that use Node.js-only APIs (child_process spawn etc.)
  // from Turbopack bundling. @donmai/core and @renseiai/agentfactory both contain
  // stdio-server.js which uses spawn() — Turbopack can't resolve the dynamic entrypoint.
  // NOTE: @renseiai/agentfactory-nextjs must NOT be external — it imports 'next/server'
  // without .js extension which fails under Node.js native ESM resolution.
  serverExternalPackages: [
    '@donmai/core',
    '@donmai/server',
    '@renseiai/agentfactory',
    '@renseiai/agentfactory-server',
  ],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // reactCompiler requires babel-plugin-react-compiler; enable when needed
  // reactCompiler: true,

  // Add security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
