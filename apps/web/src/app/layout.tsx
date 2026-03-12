import type { Metadata } from "next";
import "@/styles/globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata: Metadata = {
  title: {
    default: "LexBuild — U.S. Code in Markdown",
    template: "%s | LexBuild",
  },
  description:
    "Browse the complete U.S. Code as structured Markdown. Built by LexBuild for AI/RAG ingestion.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    siteName: "LexBuild",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400;500;600;700&family=Google+Sans+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
      <GoogleAnalytics gaId="G-2S71DGYMWR" />
    </html>
  );
}
