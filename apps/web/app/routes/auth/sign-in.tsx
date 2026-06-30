import { AuthLayout } from "~/core/components/auth/auth-layout";
import { SignInForm } from "~/core/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthLayout title="Sign in to Cybernetic">
      <SignInForm />
    </AuthLayout>
  );
}
