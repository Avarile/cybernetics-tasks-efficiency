import type { IOrganization } from "@cybernetic/types";
import { APIService } from "./api.service";

export class OrganizationService extends APIService {
  getBySlug(slug: string) {
    return this.get<IOrganization>(`/organizations/slug/${slug}`);
  }

  update(id: string, data: Partial<Pick<IOrganization, "name" | "description">>) {
    return this.patch<IOrganization>(`/organizations/${id}`, data);
  }
}
