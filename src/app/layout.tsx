import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LCK Edge \u2014 Research & Analysis",
  description: "Research and analysis tool for LCK esports. Analytical support, not guaranteed betting advice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
