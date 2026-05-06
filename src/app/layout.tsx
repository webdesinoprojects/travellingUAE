import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { FloatingSocial } from "@/components/layout/FloatingSocial";
import { Header } from "@/components/layout/Header";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fly Time | Flights, Holidays and Visa Support",
  description:
    "Fly Time helps travelers book flights, holiday packages, visas, hotels and support services through a clean modern travel experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${sora.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Header />
        {children}
        <WhatsAppButton />
        <FloatingSocial />
      </body>
    </html>
  );
}
