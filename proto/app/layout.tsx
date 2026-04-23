import type { Metadata, Viewport } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";

// Golos Text — основной шрифт проекта. Подключается через next/font/google
// с подмножествами latin + cyrillic.
const golosText = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
});

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
      <body className={golosText.variable}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
