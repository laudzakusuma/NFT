import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SUI Pet Game",
  description: "Tamagotchi x Pokemon GO on SUI",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen overflow-hidden`}>
        <Providers>
          <div className="max-w-md mx-auto h-[100dvh] relative bg-black shadow-2xl overflow-hidden flex flex-col">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}