import type { Metadata } from "next";
import "./globals.css";
import "./qat-companion-rail.css";
import "./qat-companion-toolbelt-fix.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "QAtalyst",
  description: "AI QA copilot for test cases, ticket risks, bug reports, and QA planning.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/favicon-256.png", sizes: "256x256", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
