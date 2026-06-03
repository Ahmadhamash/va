import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "chatter | وكيل ذكاء اصطناعي لخدمة العملاء",
  description: "اربط واتساب وMessenger وInstagram وخلي وكيل الذكاء الاصطناعي يرد على العملاء مع تحويل بشري عند الحاجة."
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
