import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Claim Assistant",
  description: "Зафиксируйте страховое событие и получите предварительную оценку ущерба",
  manifest: "/manifest.json",
  // Favicon и apple-touch-icon подхватываются автоматически
  // через /app/icon.svg и /app/apple-icon.tsx (Next.js App Router convention).
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
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
