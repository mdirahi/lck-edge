import "./globals.css";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

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
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
