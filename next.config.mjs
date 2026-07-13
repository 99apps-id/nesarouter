/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  webpack: (config, { webpack }) => {
    // Webpack does not resolve the node: URI scheme by default (Edge/middleware
    // and some client graphs blow up with UnhandledSchemeError on node:crypto etc.).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    return config;
  }
};

export default nextConfig;
