import type { IDepartment } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateDepartmentDto {
  name: string;
  description?: string;
  parentId?: string;
  leadPersonId?: string;
}

export class DepartmentService extends APIService {
  getRoots() {
    return this.get<IDepartment[]>("/departments/roots");
  }

  getChildren(id: string) {
    return this.get<IDepartment[]>(`/departments/${id}/children`);
  }

  create(data: CreateDepartmentDto) {
    return this.post<IDepartment>("/departments", data);
  }

  update(id: string, data: Partial<CreateDepartmentDto>) {
    return this.patch<IDepartment>(`/departments/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/departments/${id}`);
  }
}
