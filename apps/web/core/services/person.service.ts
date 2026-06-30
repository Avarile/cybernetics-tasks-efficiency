import type { IPerson } from "@cybernetic/types";
import { APIService } from "./api.service";

interface SearchPersonDto {
  query: string;
  limit?: number;
}

export class PersonService extends APIService {
  list() {
    return this.get<IPerson[]>("/persons");
  }

  search(data: SearchPersonDto) {
    return this.post<IPerson[]>("/persons/search", data);
  }

  getBySlug(slug: string) {
    return this.get<IPerson>(`/persons/slug/${slug}`);
  }

  update(id: string, data: Partial<Pick<IPerson, "firstName" | "lastName" | "position" | "role">>) {
    return this.patch<IPerson>(`/persons/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/persons/${id}`);
  }
}
