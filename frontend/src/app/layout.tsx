import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "\u0645\u0633\u0627\u0631 | \u0648\u0643\u064A\u0644 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621",
  description: "\u0627\u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0648\u0641\u064A\u0633\u0628\u0648\u0643 \u0648\u0625\u0646\u0633\u062A\u063A\u0631\u0627\u0645\u060C \u0648\u062E\u0644\u0651\u064A \u0648\u0643\u064A\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u064A\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0645\u0639 \u062A\u062D\u0648\u064A\u0644 \u0628\u0634\u0631\u064A \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
