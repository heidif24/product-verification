import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAN — Manufacturer workspace",
  description: "Product identity and verification, made clear.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
