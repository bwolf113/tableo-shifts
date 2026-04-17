import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tableo Shifts - Restaurant Staff Planner",
  description: "Smart shift scheduling powered by your reservation data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50">{children}</body>
    </html>
  );
}
