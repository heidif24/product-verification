import type { NextConfig } from "next";

if (process.env.VERCEL_ENV === "production" && !process.env.NEXT_PUBLIC_PAN_API_URL) {
  throw new Error("NEXT_PUBLIC_PAN_API_URL must be configured before the PAN manufacturer production deployment.");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
      ]
    }];
  }
};

export default nextConfig;
