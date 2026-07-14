import type { Metadata } from "next";
import I18nProvider from "@/components/I18nProvider";
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
