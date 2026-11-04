import { Geist } from "next/font/google";
import AuthGuard from "../components/auth-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fleet Dashboard | FleetCare",
  description: "Manage fleet maintenance and vehicle diagnostics with FleetCare.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
