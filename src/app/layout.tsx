import type { Metadata } from "next";
import I18nProvider from "@/components/I18nProvider";
import "./globals.css";

const APP_DESCRIPTION =
  "NesaRouter - Next Smart Adaptive Router. A local-first, OpenAI-compatible AI gateway that routes across providers, controls budgets, and tracks usage.";

// metadataBase is resolved at request time when NESA_PUBLIC_URL is set (e.g.
// behind a reverse proxy); falls back to undefined so OpenGraph omits absolute URLs.
const publicOriginEnv = process.env.NESA_PUBLIC_URL;
const metadataBase = publicOriginEnv ? new URL(publicOriginEnv) : undefined;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "NesaRouter",
    template: "%s · NesaRouter"
  },
  description: APP_DESCRIPTION,
  applicationName: "NesaRouter",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }]
  },
  openGraph: {
    type: "website",
    title: "NesaRouter",
    description: APP_DESCRIPTION,
    siteName: "NesaRouter"
  },
  twitter: {
    card: "summary",
    title: "NesaRouter",
    description: APP_DESCRIPTION
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('nesa-theme') || 'dark';
                document.documentElement.dataset.theme = theme;
                var locale = localStorage.getItem('nesa-locale') || 'en';
                document.documentElement.lang = locale;
                if (locale === 'ar') document.documentElement.dir = 'rtl';
              } catch (_) {
                document.documentElement.dataset.theme = 'dark';
              }
            `
          }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
