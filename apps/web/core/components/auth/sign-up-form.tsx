import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { observer } from "mobx-react-lite";
import { useStore } from "~/core/hooks/use-store";
import { AuthService } from "~/core/services/auth.service";

const authService = new AuthService();

interface SignUpFields {
  name: string;
  email: string;
  password: string;
}

export const SignUpForm = observer(() => {
  const { auth } = useStore();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFields>();

  const onSubmit = async ({ name, email, password }: SignUpFields) => {
    setErrorMessage(null);
    auth.setLoading(true);
    try {
      const { data } = await authService.register(name, email, password);
      auth.setToken(data.accessToken);
      auth.setCurrentUser(data.user);
      navigate("/");
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErrorMessage(axiosMsg ?? "Registration failed. Please try again.");
    } finally {
      auth.setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Jane Smith"
          {...register("name", { required: "Name is required." })}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="you@example.com"
          {...register("email", {
            required: "Email is required.",
            pattern: {
              value: /^\S+@\S+\.\S+$/,
              message: "Enter a valid email address.",
            },
          })}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="••••••••"
          {...register("password", {
            required: "Password is required.",
            minLength: {
              value: 8,
              message: "Password must be at least 8 characters.",
            },
          })}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={auth.isLoading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {auth.isLoading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/auth/sign-in" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
});
