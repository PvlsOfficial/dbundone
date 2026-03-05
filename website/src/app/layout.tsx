import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dbundone.com"),
  title: {
    default: "DBundone — Music Production Management for FL Studio & Ableton",
    template: "%s | DBundone",
  },
  description:
    "Auto-discover and organize your FL Studio and Ableton projects. Audio version control with LUFS analysis, kanban task management, statistics dashboard, and VST3 plugin bridge.",
  keywords: [
    "music production management",
    "FL Studio project organizer",
    "Ableton project manager",
    "DAW project management",
    "music production workflow",
    "FLP file parser",
    "audio version control",
    "music production dashboard",
    "beat organization software",
    "producer tools",
    "music project tracker",
    "FL Studio plugin analyzer",
    "LUFS metering",
    "music production statistics",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dbundone.com",
    siteName: "DBundone",
    title: "DBundone — Music Production Management for FL Studio & Ableton",
    description:
      "Auto-discover and organize your FL Studio and Ableton projects. Audio version control, task management, and a VST3 plugin that bridges your DAW to your dashboard.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "DBundone — Music Production Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DBundone — Music Production Management",
    description:
      "Auto-discover and organize your FL Studio and Ableton projects.",
    creator: "@dbundone",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://dbundone.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased noise-bg`}
      >
        {children}
      </body>
    </html>
  );
}
