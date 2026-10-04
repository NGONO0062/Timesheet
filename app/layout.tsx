import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "boosted/dist/css/boosted.css";
import "@/styles/timesheet.css";

export const metadata: Metadata = {
  title: { default: "TimeSheet", template: "%s · TimeSheet" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
