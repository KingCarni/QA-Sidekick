import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Sidekick",
  description: "AI QA copilot for test cases, ticket risks, and bug reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
