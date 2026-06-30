import { createContext, useContext } from "react";
import type { RootStore } from "~/core/store/root.store";

export const StoreContext = createContext<RootStore | null>(null);

export const useStore = (): RootStore => {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
};
