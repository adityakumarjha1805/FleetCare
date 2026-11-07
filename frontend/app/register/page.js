import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Create account | FleetCare",
  description: "Create your FleetCare fleet operations account.",
};

export default function RegisterPage() {
  return <AuthPage mode="signup" />;
}
