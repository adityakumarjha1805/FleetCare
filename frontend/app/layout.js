import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import AuthGuard from "../components/auth-guard";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fleet Dashboard | FleetCare",
  description: "Manage fleet maintenance and vehicle diagnostics with FleetCare.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetBrainsMono.variable}`}>
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
