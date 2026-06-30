import { action, computed, makeObservable, observable } from "mobx";
import type { IDepartment } from "@cybernetic/types";
import { DepartmentService } from "~/core/services/department.service";
import type { RootStore } from "../root.store";

const deptService = new DepartmentService();

export class DepartmentStore {
  deptMap: Record<string, IDepartment> = {};
  rootDeptIds: string[] = [];
  childMap: Record<string, string[]> = {};
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      deptMap: observable,
      rootDeptIds: observable,
      childMap: observable,
      isLoading: observable,
      rootDepts: computed,
      fetchRoots: action,
      fetchChildren: action,
      reset: action,
    });
  }

  get rootDepts(): IDepartment[] {
    return this.rootDeptIds.map((id) => this.deptMap[id]).filter(Boolean) as IDepartment[];
  }

  fetchRoots = async () => {
    this.isLoading = true;
    try {
      const { data } = await deptService.getRoots();
      const map: Record<string, IDepartment> = {};
      const ids: string[] = [];
      for (const dept of data) {
        map[dept.id] = dept;
        ids.push(dept.id);
      }
      this.deptMap = { ...this.deptMap, ...map };
      this.rootDeptIds = ids;
    } finally {
      this.isLoading = false;
    }
  };

  fetchChildren = async (id: string) => {
    this.isLoading = true;
    try {
      const { data } = await deptService.getChildren(id);
      const map: Record<string, IDepartment> = {};
      const ids: string[] = [];
      for (const dept of data) {
        map[dept.id] = dept;
        ids.push(dept.id);
      }
      this.deptMap = { ...this.deptMap, ...map };
      this.childMap = { ...this.childMap, [id]: ids };
    } finally {
      this.isLoading = false;
    }
  };

  reset = () => {
    this.deptMap = {};
    this.rootDeptIds = [];
    this.childMap = {};
    this.isLoading = false;
  };
}
