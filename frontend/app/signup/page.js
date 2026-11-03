import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Create account | FleetCare",
  description: "Create your FleetCare fleet operations account.",
};
export const instant = false;

export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
