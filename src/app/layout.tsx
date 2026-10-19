import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Malam Pilihan Raya",
  description: "Build your power base, hold your seats and win Malaysia's election night.",
  applicationName: "Malam Pilihan Raya",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  appleWebApp: { capable: true, title: "Pilihan Raya", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141417",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
