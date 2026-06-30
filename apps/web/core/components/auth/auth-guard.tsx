import React from "react";
import { observer } from "mobx-react-lite";
import { Navigate } from "react-router";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";
import { useStore } from "~/core/hooks/use-store";

export const AuthGuard = observer(({ children }: { children: React.ReactNode }) => {
  const { auth } = useStore();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  return <>{children}</>;
});
