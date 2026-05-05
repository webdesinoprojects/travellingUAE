import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Travel | Holiday Packages, Flights and Visas",
  description:
    "Smart Travel homepage for curated holidays, flights, visas, cruises, hotels, and travel services.",
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
      className="h-full scroll-smooth antialiased"
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
