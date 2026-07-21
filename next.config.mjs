import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline' https://static.cloudflareinsights.com";
const connectSrc = "'self' https: http: ws: wss: https://cloudflareinsights.com";

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: https:; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; connect-src ${connectSrc}` },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ]
    }];
  },
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
