import { action, computed, makeObservable, observable } from "mobx";
import type { IPerson } from "@cybernetic/types";
import { PersonService } from "~/core/services/person.service";
import type { RootStore } from "../root.store";

const personService = new PersonService();

export class PersonStore {
  personMap: Record<string, IPerson> = {};
  personIds: string[] = [];
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      personMap: observable,
      personIds: observable,
      isLoading: observable,
      persons: computed,
      fetchPersons: action,
      searchPersons: action,
      reset: action,
    });
  }

  get persons(): IPerson[] {
    return this.personIds.map((id) => this.personMap[id]).filter(Boolean) as IPerson[];
  }

  fetchPersons = async () => {
    this.isLoading = true;
    try {
      const { data } = await personService.list();
      const map: Record<string, IPerson> = {};
      const ids: string[] = [];
      for (const person of data) {
        map[person.id] = person;
        ids.push(person.id);
      }
      this.personMap = map;
      this.personIds = ids;
    } finally {
      this.isLoading = false;
    }
  };

  searchPersons = async (query: string): Promise<IPerson[]> => {
    const { data } = await personService.search({ query });
    return data;
  };

  reset = () => {
    this.personMap = {};
    this.personIds = [];
    this.isLoading = false;
  };
}
