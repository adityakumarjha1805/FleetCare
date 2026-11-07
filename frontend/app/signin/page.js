import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Sign in | FleetCare",
  description: "Sign in to your FleetCare fleet operations workspace.",
};

export default function SigninPage() {
  return <AuthPage mode="login" />;
}
