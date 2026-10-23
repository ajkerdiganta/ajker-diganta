import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "দৈনিক আজকের দিগন্ত",
    template: "%s | দৈনিক আজকের দিগন্ত",
  },
  description: "সত্য · সময় · সমাজ — দৈনিক আজকের দিগন্তের বাংলা সংবাদমাধ্যম।",
  applicationName: "দৈনিক আজকের দিগন্ত",
  metadataBase: new URL(process.env.PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="bn-BD" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
