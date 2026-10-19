import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server and production builds use separate folders, so `npm run build`
  // can't corrupt a running `npm run dev` ("__webpack_modules__[moduleId] is not a function").
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
