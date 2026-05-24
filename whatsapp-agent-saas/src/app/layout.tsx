import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI WhatsApp Agent Platform",
  description: "Connect WhatsApp Business, teach your AI agent, and support customers faster."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
