import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TJSL Impact Control Tower",
  description: "NORTAGO TJSL Impact Control Tower",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
