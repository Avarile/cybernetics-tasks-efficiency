import { observer } from "mobx-react-lite";
import { Outlet } from "react-router";
import { AuthGuard } from "~/core/components/auth/auth-guard";
import { AppSidebar } from "~/core/components/layout/app-sidebar";
import { OrgHeader } from "~/core/components/layout/org-header";

const AuthenticatedLayout = observer(() => {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <OrgHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthGuard>
  );
});

export default AuthenticatedLayout;
