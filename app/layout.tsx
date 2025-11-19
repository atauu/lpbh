import type { Metadata, Viewport } from "next";
import { Roboto, Rye } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";

const roboto = Roboto({ subsets: ["latin"], weight: ["300", "400", "500", "700"] });
const rye = Rye({ weight: "400", subsets: ["latin"], variable: "--font-rye" });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#31ab43',
};

export const metadata: Metadata = {
  title: "LPBH - Fonksiyonel Organizasyon Paneli",
  description: "Los Perdidos Brotherhood Fonksiyonel Organizasyon Paneli",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LPBH FOP',
  },
  icons: {
    icon: '/lpbhlogo.png',
    apple: '/lpbhlogo.png',
  },
  // Add modern mobile-web-app-capable meta tag
  // Note: Next.js metadata API doesn't support 'other' field,
  // so we'll add this via a script in the body
} as Metadata & {
  other?: Record<string, string>;
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        {/* Modern mobile-web-app-capable meta tag - required by new standard */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* apple-mobile-web-app-capable is still added via metadata API for iOS compatibility */}
      </head>
      <body className={`${roboto.className} ${rye.variable}`} suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

