import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "@/styles/globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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

/** Inline script to apply theme before first paint — prevents flash. */
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
