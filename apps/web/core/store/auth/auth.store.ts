import { action, computed, makeObservable, observable } from "mobx";
import type { IAuthSession } from "@cybernetic/types";
import type { RootStore } from "../root.store";

export class AuthStore {
  currentUser: IAuthSession | null = null;
  isLoading = false;
  token: string | null = null;

  constructor(private root: RootStore) {
    makeObservable(this, {
      currentUser: observable,
      isLoading: observable,
      token: observable,
      isAuthenticated: computed,
      setCurrentUser: action,
      setToken: action,
      setLoading: action,
      reset: action,
    });
  }

  get isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  setCurrentUser = (user: IAuthSession | null) => {
    this.currentUser = user;
  };

  setToken = (token: string | null) => {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  };

  setLoading = (loading: boolean) => {
    this.isLoading = loading;
  };

  reset = () => {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem("auth_token");
  };

  hydrateToken = () => {
    const stored = localStorage.getItem("auth_token");
    if (stored) this.token = stored;
  };
}
