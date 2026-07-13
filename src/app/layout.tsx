import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NesaRouter",
  description: "Next Smart Adaptive Router",
  icons: {
    icon: "/favicon.svg"
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
              } catch (_) {
                document.documentElement.dataset.theme = 'dark';
              }
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
