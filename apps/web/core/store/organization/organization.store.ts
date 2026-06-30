import { action, makeObservable, observable } from "mobx";
import type { IOrganization } from "@cybernetic/types";
import { OrganizationService } from "~/core/services/organization.service";
import type { RootStore } from "../root.store";

const orgService = new OrganizationService();

export class OrganizationStore {
  currentOrg: IOrganization | null = null;
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      currentOrg: observable,
      isLoading: observable,
      setCurrentOrg: action,
      setLoading: action,
      fetchBySlug: action,
      reset: action,
    });
  }

  setCurrentOrg = (org: IOrganization | null) => {
    this.currentOrg = org;
  };

  setLoading = (v: boolean) => {
    this.isLoading = v;
  };

  fetchBySlug = async (slug: string) => {
    if (this.currentOrg?.slug === slug) return;
    this.setLoading(true);
    try {
      const { data } = await orgService.getBySlug(slug);
      this.setCurrentOrg(data);
    } finally {
      this.setLoading(false);
    }
  };

  reset = () => {
    this.currentOrg = null;
    this.isLoading = false;
  };
}
