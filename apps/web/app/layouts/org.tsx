import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";
import { useStore } from "~/core/hooks/use-store";

const OrgLayout = observer(() => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useStore();

  useEffect(() => {
    if (orgSlug) org.fetchBySlug(orgSlug);
  }, [orgSlug, org]);

  if (org.isLoading && !org.currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <Outlet />;
});

export default OrgLayout;
