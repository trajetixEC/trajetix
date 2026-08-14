import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self)",
        },
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'self'; img-src 'self' data: blob: https: https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.tile.openstreetmap.org; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.google.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: wss: https://*.googleapis.com https://*.google.com; frame-src 'self' https://www.google.com https://maps.google.com https://*.google.com https://*.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        },
      ],
    },
  ],
};
export default config;
