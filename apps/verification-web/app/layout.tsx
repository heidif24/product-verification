import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "PAN Verify — Product Authentication Network", description: "Understand the identity of the product in your hands." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
