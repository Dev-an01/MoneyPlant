/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so their TS sources are bundled directly.
  transpilePackages: ["@moneyplant/shared", "@moneyplant/core", "@moneyplant/db"],
  experimental: {
    // Keep native/node-only deps external to the server bundle.
    serverComponentsExternalPackages: ["pg", "bcryptjs", "@electric-sql/pglite"],
  },
  // @electric-sql/pglite is pulled in transitively via the transpiled @moneyplant/db
  // package, which makes webpack bundle it despite serverComponentsExternalPackages.
  // Bundling breaks it: its polyfilled `URL` fails Node's fs `instanceof URL` check.
  // Force it (and pg) to a real runtime require() on the server.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "@electric-sql/pglite", "pg"];
    }
    return config;
  },
};

export default nextConfig;
