import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Kora — Vision Architect",
  description:
    "Turn your raw idea into a focused one-page vision. Answer hard questions. Walk away with clarity.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kora — Vision Architect",
  url: "https://kora.altitudedp.com",
  creator: {
    "@type": "Organization",
    name: "Altitude",
    url: "https://altitudedp.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="border-t border-zinc-800/50 px-4 py-5 flex justify-center items-center gap-2.5">
          <span className="text-[11px] font-mono text-zinc-700">Built by</span>
          <a
            href="https://altitudedp.com"
            target="_blank"
            rel="noopener"
            className="opacity-30 hover:opacity-60 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://altitudedp.com/api/brand/altitude-logo-original.png"
              alt="Altitude"
              height={16}
              className="h-4 w-auto invert"
            />
          </a>
        </footer>
      </body>
    </html>
  );
}
