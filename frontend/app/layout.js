import { Geist, Geist_Mono } from "next/font/google";
import AuthGuard from "../components/auth-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fleet Dashboard | FleetCare",
  description: "Manage fleet maintenance and vehicle diagnostics with FleetCare.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
