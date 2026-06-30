import { action, makeObservable, observable } from "mobx";
import type { RootStore } from "../root.store";

export type ThemeMode = "light" | "dark";

export class ThemeStore {
  mode: ThemeMode = "light";

  constructor(private root: RootStore) {
    makeObservable(this, {
      mode: observable,
      toggle: action,
      setMode: action,
      reset: action,
    });
    this.mode = (localStorage.getItem("theme") as ThemeMode) ?? "light";
  }

  toggle = () => {
    this.mode = this.mode === "light" ? "dark" : "light";
    localStorage.setItem("theme", this.mode);
    document.documentElement.classList.toggle("dark", this.mode === "dark");
  };

  setMode = (mode: ThemeMode) => {
    this.mode = mode;
    localStorage.setItem("theme", mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
  };

  reset = () => {
    this.mode = "light";
    localStorage.removeItem("theme");
    document.documentElement.classList.remove("dark");
  };
}
