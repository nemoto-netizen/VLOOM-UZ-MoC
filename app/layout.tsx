import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI分析レポート作成・チャット MoC",
  description: "AI分析レポート作成・チャット画面のモック",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
