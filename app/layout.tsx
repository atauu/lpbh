import type { Metadata, Viewport } from "next";
import { Inter, Rye } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${inter.className} ${rye.variable}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

