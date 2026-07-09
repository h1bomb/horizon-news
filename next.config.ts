import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true, // static export: no Next image optimizer at runtime
  },
  trailingSlash: true, // Nginx serves /foo/index.html cleanly
};

export default nextConfig;
