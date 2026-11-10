import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  transpilePackages: ['@post-tracker/core', '@post-tracker/db', '@post-tracker/ui'],
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  serverExternalPackages: ['@prisma/client'],
  typedRoutes: false,
};

export default nextConfig;
