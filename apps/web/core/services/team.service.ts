import type { IPerson, ITeam } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateTeamDto {
  name: string;
  departmentId?: string;
  leadPersonId?: string;
}

export class TeamService extends APIService {
  list() {
    return this.get<ITeam[]>("/teams");
  }

  getMembers(id: string) {
    return this.get<IPerson[]>(`/teams/${id}/members`);
  }

  create(data: CreateTeamDto) {
    return this.post<ITeam>("/teams", data);
  }

  update(id: string, data: Partial<CreateTeamDto>) {
    return this.patch<ITeam>(`/teams/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/teams/${id}`);
  }
}
