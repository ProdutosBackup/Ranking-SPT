import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // O Excel lê a logo do disco e usa o sharp (binários nativos em @img): garante que entrem no pacote das duas rotas.
  // Chaves = rotas; valores = padrões a partir da raiz do projeto.
  outputFileTracingIncludes: {
    "/api/relatorio": ["./public/logo-spt.png", "./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
    "/api/exportacao": ["./public/logo-spt.png", "./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default nextConfig;
