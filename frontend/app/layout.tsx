import type { Metadata } from "next";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import Navigation from "@/components/ui/Navigation";
export const metadata: Metadata = {
  title: {
    default: "SkyTrace — See the Sky in Motion",
    template: "%s | SkyTrace",
  },
  description:
    "Explore a changing infrared universe with an astronomical time-series observatory inspired by SPHEREx.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
