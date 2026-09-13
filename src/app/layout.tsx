import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "toto予想 AI | 根拠が見えるJリーグtoto予想",
  description:
    "AIがJリーグtoto全13試合を根拠・自信度つきで予想。買い目生成と過去成績の検証まで行うアプリ。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              toto<span>予想AI</span>
            </Link>
            <nav className="nav">
              <Link href="/">予想</Link>
              <Link href="/betting">買い目</Link>
              <Link href="/results">成績検証</Link>
              <Link href="/about">仕組み</Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="container">{children}</div>
        </main>
      </body>
    </html>
  );
}
