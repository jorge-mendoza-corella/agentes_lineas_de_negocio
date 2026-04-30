import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@agentes/shared'],
  // ssh2 usa módulos nativos (cpu-features) — excluir del bundle de webpack
  serverExternalPackages: ['ssh2', 'cpu-features'],
};

export default nextConfig;
