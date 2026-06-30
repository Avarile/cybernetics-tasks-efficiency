import type { ILabel } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateLabelDto {
  name: string;
  color: string;
  description?: string;
}

export class LabelService extends APIService {
  list() {
    return this.get<ILabel[]>("/labels");
  }

  create(data: CreateLabelDto) {
    return this.post<ILabel>("/labels", data);
  }

  update(id: string, data: Partial<CreateLabelDto>) {
    return this.patch<ILabel>(`/labels/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/labels/${id}`);
  }
}
