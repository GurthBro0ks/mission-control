import type { Metadata } from "next";
import "./globals.css";
import Shell from "./Shell";

export const metadata: Metadata = {
  title: "🧪 SLIMYAI MISSION CONTROL",
  description: "Ned's Digital Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <Shell>{children}</Shell>;
}
