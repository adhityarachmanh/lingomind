import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  title: "LingoMind",
  description: "Belajar bahasa asing dengan AI",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "LingoMind",
    description: "Belajar bahasa asing dengan AI — latihan, quiz, chat AI, dan banyak lagi.",
    type: "website",
    siteName: "LingoMind",
    locale: "id_ID",
  },
  twitter: {
    card: "summary",
    title: "LingoMind",
    description: "Belajar bahasa asing dengan AI — latihan, quiz, chat AI, dan banyak lagi.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('lingomind_theme')==='dark'||(!('lingomind_theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
