import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Shell from "./Shell";

export const metadata: Metadata = {
  title: "🧪 SLIMYAI MISSION CONTROL",
  description: "Ned's Digital Command Center",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-mission-control-pathname") === "/login") {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return <Shell>{children}</Shell>;
}
