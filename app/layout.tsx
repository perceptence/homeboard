import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

/**
 * Type system — Poppins, one geometric family for everything.
 * Poppins is a static font: every weight we use has to be listed here or the
 * browser fakes it. Nothing goes above 500 — <Em> is the heaviest thing here.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Homeboard",
  description: "The calm operating system for running a home.",
};

export const viewport: Viewport = { themeColor: "#0E0E10" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
