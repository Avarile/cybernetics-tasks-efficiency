import type { IPerson } from "@cybernetic/types";
import { APIService } from "./api.service";

interface LoginResponse {
  accessToken: string;
  person: IPerson;
}

export class AuthService extends APIService {
  login(email: string, password: string) {
    return this.post<LoginResponse>("/auth/login", { email, password });
  }

  logout() {
    return this.post<void>("/auth/logout");
  }

  me() {
    return this.get<IPerson>("/auth/me");
  }

  refresh() {
    return this.post<LoginResponse>("/auth/refresh");
  }
}
