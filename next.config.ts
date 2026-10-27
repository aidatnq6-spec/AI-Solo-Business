import type { NextConfig } from "next";
const config: NextConfig = { serverExternalPackages: ["firebase-admin", "sharp", "@google-cloud/tasks"], poweredByHeader: false };
export default config;
