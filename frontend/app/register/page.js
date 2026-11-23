import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Create account | Telfay",
  description: "Create your Telfay fleet operations account.",
};

export default function RegisterPage() {
  return <AuthPage mode="signup" />;
}
