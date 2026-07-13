import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Bake version into the server/client bundle so standalone/Docker do not show v0.0.0.
  env: {
    NESA_APP_VERSION: packageJson.version
  },
  webpack: (config, { webpack }) => {
    // Webpack does not resolve the node: URI scheme by default (Edge/middleware
    // and some client graphs blow up with UnhandledSchemeError on node:crypto etc.).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
      new webpack.DefinePlugin({
        "process.env.NESA_APP_VERSION": JSON.stringify(packageJson.version)
      })
    );
    return config;
  }
};

export default nextConfig;
