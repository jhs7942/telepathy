import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(projectDirectory, '../..'),
  turbopack: {
    root: join(projectDirectory, '../..'),
    resolveAlias: {
      '@': join(projectDirectory, 'src'),
    },
  },
};

export default nextConfig;
