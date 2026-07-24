import type { Metadata } from "next";
import { Oswald, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Archive — Election Nightclub",
  description: "Daily election market screenshot archive",
};

// Wraps every page — loads the three fonts once here and sets the base
// dark background/text color. Individual pages don't need to repeat any
// of this.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${plexMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-text" suppressHydrationWarning>{children}</body>
    </html>
  );
}
