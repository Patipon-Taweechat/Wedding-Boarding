import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Each boarding photo goes up with saveBoardingPhoto as two data URLs
      // (colour JPEG + dithered PNG, a few hundred KB together) — above the
      // 1 MB default once base64 and a bright, detailed frame add up.
      bodySizeLimit: "4mb",
    },
  },
  /**
   * The iPad opens this over the venue Wi-Fi as http://<staff-laptop-ip>:3000,
   * not localhost — Next blocks cross-origin requests to its dev assets by
   * default, so without this the page arrives but the JS bundle is refused.
   * These are the LAN ranges a router hands out; development only, ignored by
   * `next build`. Add the actual IP too if it falls outside these ranges.
   */
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.2*.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
