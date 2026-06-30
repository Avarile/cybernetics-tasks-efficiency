import { action, computed, makeObservable, observable } from "mobx";
import type { ILabel } from "@cybernetic/types";
import { LabelService } from "~/core/services/label.service";
import type { RootStore } from "../root.store";

const labelService = new LabelService();

export class LabelStore {
  labelMap: Record<string, ILabel> = {};
  labelIds: string[] = [];
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      labelMap: observable,
      labelIds: observable,
      isLoading: observable,
      labels: computed,
      fetchLabels: action,
      reset: action,
    });
  }

  get labels(): ILabel[] {
    return this.labelIds.map((id) => this.labelMap[id]).filter(Boolean) as ILabel[];
  }

  fetchLabels = async () => {
    this.isLoading = true;
    try {
      const { data } = await labelService.list();
      const map: Record<string, ILabel> = {};
      const ids: string[] = [];
      for (const label of data) {
        map[label.id] = label;
        ids.push(label.id);
      }
      this.labelMap = map;
      this.labelIds = ids;
    } finally {
      this.isLoading = false;
    }
  };

  reset = () => {
    this.labelMap = {};
    this.labelIds = [];
    this.isLoading = false;
  };
}
