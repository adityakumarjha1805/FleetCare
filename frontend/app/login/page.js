import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Sign in | Telfay",
  description: "Sign in to your Telfay fleet operations workspace.",
};
export const instant = false;

export default function LoginPage() {
  return <AuthPage mode="login" />;
}
