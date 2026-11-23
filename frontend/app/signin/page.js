import AuthPage from "../../components/auth-page";

export const metadata = {
  title: "Sign in | Telfay",
  description: "Sign in to your Telfay fleet operations workspace.",
};

export default function SigninPage() {
  return <AuthPage mode="login" />;
}
