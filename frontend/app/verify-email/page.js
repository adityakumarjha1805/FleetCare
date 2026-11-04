import EmailOtpPage from "../../components/email-otp-page";

export const metadata = {
  title: "Verify your email | FleetCare",
  description: "Verify your email address to access FleetCare.",
};
export const instant = false;

export default function VerifyEmailPage() {
  return <EmailOtpPage />;
}
