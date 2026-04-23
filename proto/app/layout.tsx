import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is loaded as fallback for Sber's SB Sans (visually close).
// Exposed as a CSS variable so globals.css can keep SB Sans first in the chain.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Claim Assistant",
  description: "Зафиксируйте страховое событие и получите предварительную оценку ущерба",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#21A038",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.variable}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
