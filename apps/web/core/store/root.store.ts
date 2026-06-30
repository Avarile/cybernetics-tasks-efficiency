import { AuthStore } from "./auth/auth.store";
import { ThemeStore } from "./theme/theme.store";

export class RootStore {
  auth: AuthStore;
  theme: ThemeStore;

  constructor() {
    this.auth = new AuthStore(this);
    this.theme = new ThemeStore(this);
  }

  resetOnSignOut() {
    this.auth.reset();
    this.theme.reset();
  }
}
