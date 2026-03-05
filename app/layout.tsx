import type { Metadata } from "next";
import "./globals.css";
import "@/styles/moc-report.css";

const CDN_BASE = "https://prd-001-mng.vloom.jp/css";

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
      <head>
        <link href={`${CDN_BASE}/select2.min.css`} rel="stylesheet" />
        <link href={`${CDN_BASE}/common.css`} rel="stylesheet" />
        <link href={`${CDN_BASE}/jquery.toast.min.css`} rel="stylesheet" />
        <link href={`${CDN_BASE}/home.css`} rel="stylesheet" />
      </head>
      <body className="moc-page">{children}</body>
    </html>
  );
}
