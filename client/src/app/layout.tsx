import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "react-hot-toast";
import arMessages from "../messages/ar.json";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "AI Marketing App",
  description: "Advanced AI Social Media Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${inter.variable} ${cairo.variable} font-sans antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider messages={arMessages} locale="ar">
          {children}
          <Toaster position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
