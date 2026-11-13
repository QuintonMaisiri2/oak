import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Attendee-only session photos are read from disk by a gated route, so bundle them with it.
  outputFileTracingIncludes: {
    "/api/programme/photos/[day]/[file]": ["./private/programme-photos/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/oak-event-logo.svg',
      },
    ];
  },
};

export default nextConfig;
