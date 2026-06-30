import { useMemo, type ReactNode } from "react";
import { RootStore } from "~/core/store/root.store";
import { StoreContext } from "~/core/hooks/use-store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => {
    const s = new RootStore();
    s.auth.hydrateToken();
    return s;
  }, []);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
