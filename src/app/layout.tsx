import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoxChord — Sing. Detect. Harmonize.",
  description: "Award-winning 3D immersive experience. Real-time pitch detection and intelligent chord suggestion engine powered by AudioWorklet and YIN algorithm. Cinematic dark-themed interface with advanced micro-interactions.",
  keywords: "pitch detection, chord suggestion, music theory, audio processing, real-time analysis, Three.js, WebAudio",
  authors: [{ name: "VoxChord Team" }],
  openGraph: {
    title: "VoxChord — Sing. Detect. Harmonize.",
    description: "Award-winning 3D immersive experience for real-time pitch detection and harmony suggestions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#050508",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@100;200;300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="noise-overlay">{children}</body>
    </html>
  );
}
