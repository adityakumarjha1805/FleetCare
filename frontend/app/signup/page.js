import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Create account | Telfay",
  description: "Create your Telfay fleet operations account.",
};
export const instant = false;

export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
