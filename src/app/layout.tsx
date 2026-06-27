import type { Metadata } from "next";
import "./globals.css";
import { getAppUrl } from "@/lib/app-url";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Phantom Reach - AI-Powered Business Intelligence",
  description: "Run deep, automated audits on any local business. Discover prospects, analyze competitors, and generate actionable intelligence reports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
