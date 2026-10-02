import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinpin Arts CRM",
  description: "Customers, quotations, deals, and invoices in one workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
