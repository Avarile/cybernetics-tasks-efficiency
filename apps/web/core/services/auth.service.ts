import type { IAuthSession } from "@cybernetic/types";
import { APIService } from "./api.service";

export interface LoginResponse {
  accessToken: string;
  user: IAuthSession;
}

export class AuthService extends APIService {
  login(email: string, password: string) {
    return this.post<LoginResponse>("/auth/login", { email, password });
  }

  logout() {
    return this.post<void>("/auth/logout");
  }

  me() {
    return this.get<IAuthSession>("/auth/me");
  }

  refresh() {
    return this.post<{ accessToken: string }>("/auth/refresh");
  }
}
