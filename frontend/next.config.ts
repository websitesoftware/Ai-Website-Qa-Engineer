import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turns off the dev-only build-activity badge/panel in the corner —
  // never shown in production anyway, just distracting locally.
  devIndicators: false,
};

export default nextConfig;
