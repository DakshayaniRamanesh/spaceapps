import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import Navigation from "@/components/ui/Navigation";
export const metadata: Metadata = {
  title: {
    default: "SkyTrace — See the Sky in Motion",
    template: "%s | SkyTrace",
  },
  description:
    "Explore a changing infrared universe with a synthetic astronomical time-series observatory inspired by SPHEREx.",
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
