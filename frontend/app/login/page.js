import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Sign in | FleetCare",
  description: "Sign in to your FleetCare fleet operations workspace.",
};
export const instant = false;

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
