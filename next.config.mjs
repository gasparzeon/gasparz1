/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // O PGlite (Postgres em WebAssembly, usado sem DATABASE_URL) carrega seus
  // arquivos .wasm/.data do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
