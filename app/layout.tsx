import type { Metadata } from "next";
import localFont from "next/font/local";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  variable: "--font-body",
  weight: "300 500",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rautaki Plan Architect",
  description:
    "A lightweight AI project planner with editable briefs and data model visualization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
