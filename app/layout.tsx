import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { fr } from "@/lib/strings.fr";

import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: fr.app.title,
  description: fr.app.description,
};

export const viewport: Viewport = {
  themeColor: "#174a7c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
