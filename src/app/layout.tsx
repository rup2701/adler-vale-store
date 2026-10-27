import type { Metadata, Viewport } from "next";
import "./globals.css";
import { settings } from "@/config/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${settings.store.name} | Designer boutique, Los Gatos`, template: `%s | ${settings.store.name}` },
  description: settings.store.tagline,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
