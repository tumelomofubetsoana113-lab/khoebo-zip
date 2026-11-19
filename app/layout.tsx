import type { Metadata, Viewport } from "next";
import { strings } from "@/lib/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${strings.brand.name} · ${strings.chat.subtitle}`,
    template: `%s · ${strings.brand.name}`,
  },
  description: strings.brand.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#232733",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
