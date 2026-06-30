import { action, computed, makeObservable, observable } from "mobx";
import type { IPerson, ITeam } from "@cybernetic/types";
import { TeamService } from "~/core/services/team.service";
import type { RootStore } from "../root.store";

const teamService = new TeamService();

export class TeamStore {
  teamMap: Record<string, ITeam> = {};
  teamIds: string[] = [];
  memberMap: Record<string, IPerson[]> = {};
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      teamMap: observable,
      teamIds: observable,
      memberMap: observable,
      isLoading: observable,
      teams: computed,
      fetchTeams: action,
      fetchMembers: action,
      reset: action,
    });
  }

  get teams(): ITeam[] {
    return this.teamIds.map((id) => this.teamMap[id]).filter(Boolean) as ITeam[];
  }

  fetchTeams = async () => {
    this.isLoading = true;
    try {
      const { data } = await teamService.list();
      const map: Record<string, ITeam> = {};
      const ids: string[] = [];
      for (const team of data) {
        map[team.id] = team;
        ids.push(team.id);
      }
      this.teamMap = map;
      this.teamIds = ids;
    } finally {
      this.isLoading = false;
    }
  };

  fetchMembers = async (id: string) => {
    const { data } = await teamService.getMembers(id);
    this.memberMap = { ...this.memberMap, [id]: data };
  };

  reset = () => {
    this.teamMap = {};
    this.teamIds = [];
    this.memberMap = {};
    this.isLoading = false;
  };
}
