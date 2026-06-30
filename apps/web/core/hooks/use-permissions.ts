import { useStore } from "./use-store";

const ROLE_RANK: Record<string, number> = {
  admin: 4,
  manager: 3,
  executive: 2,
  member: 1,
};

export const usePermissions = () => {
  const { auth } = useStore();
  const role = auth.currentUser?.role ?? "member";

  return {
    isAdmin: role === "admin",
    isManager: ROLE_RANK[role] >= ROLE_RANK["manager"],
    isExec: ROLE_RANK[role] >= ROLE_RANK["executive"],
    can: (minRole: string) => ROLE_RANK[role] >= (ROLE_RANK[minRole] ?? 0),
  };
};
