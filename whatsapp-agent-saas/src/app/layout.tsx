import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مسار | وكيل ذكاء اصطناعي لخدمة العملاء",
  description: "اربط واتساب وفيسبوك وإنستغرام، وخلّي وكيل الذكاء الاصطناعي يرد على العملاء مع تحويل بشري عند الحاجة."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
