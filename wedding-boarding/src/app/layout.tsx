import type { Metadata, Viewport } from "next";
import { Alex_Brush, Cormorant_Garamond, Jost, Norican } from "next/font/google";
import "./globals.css";

// The invitation's four faces (wedding-invite/src/app/layout.tsx).

// Script — the couple's names, as the cover signs them, and nothing else.
const alexBrush = Alex_Brush({
  variable: "--font-alex-brush",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Display — names, headings, large figures.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// UI & body — buttons, labels, the boarding-pass details.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// The boarding pass's nameplate, and nothing else.
const norican = Norican({
  variable: "--font-norican",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Boarding",
  description: "Wedding boarding gate",
  robots: { index: false, follow: false },
};

// Fixed to portrait-ish kiosk sizing, no pinch-zoom — this runs on one iPad
// at the door for a whole evening, not a page guests browse.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${jost.variable} ${norican.variable} ${alexBrush.variable} h-full antialiased`}
    >
      <body className="min-h-full min-h-svh flex flex-col">{children}</body>
    </html>
  );
}
