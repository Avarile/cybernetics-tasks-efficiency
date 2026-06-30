import { AuthLayout } from "~/core/components/auth/auth-layout";
import { SignUpForm } from "~/core/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthLayout title="Create your account">
      <SignUpForm />
    </AuthLayout>
  );
}
