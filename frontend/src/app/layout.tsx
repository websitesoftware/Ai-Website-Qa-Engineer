import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeProvider } from '../context/ThemeContext';


const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  alternates: { canonical: "http://localhost:3000/" },
  title: "AI Website QA Engineer",
  description: "AI Website QA Dashboard",
  openGraph: {
    title: "AI Website QA Engineer",
    description: "AI Website QA Dashboard",
    url: "http://localhost:3000/",
    siteName: "AI Website QA Engineer",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Website QA Engineer",
  description: "AI Website QA Dashboard",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        {/* Phosphor icon web font — powers every <i className="ph ph-*"> icon across the app */}
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.2/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.2/src/bold/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.2/src/fill/style.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <Providers> <ThemeProvider>
          {children}
        </ThemeProvider></Providers>
      </body>
    </html>
  );
}
