import { AuthStore } from "./auth/auth.store";
import { DepartmentStore } from "./department/department.store";
import { LabelStore } from "./label/label.store";
import { OrganizationStore } from "./organization/organization.store";
import { PersonStore } from "./person/person.store";
import { TeamStore } from "./team/team.store";
import { ThemeStore } from "./theme/theme.store";

export class RootStore {
  auth: AuthStore;
  department: DepartmentStore;
  label: LabelStore;
  org: OrganizationStore;
  person: PersonStore;
  team: TeamStore;
  theme: ThemeStore;

  constructor() {
    this.auth = new AuthStore(this);
    this.department = new DepartmentStore(this);
    this.label = new LabelStore(this);
    this.org = new OrganizationStore(this);
    this.person = new PersonStore(this);
    this.team = new TeamStore(this);
    this.theme = new ThemeStore(this);
  }

  resetOnSignOut() {
    this.auth.reset();
    this.department.reset();
    this.label.reset();
    this.org.reset();
    this.person.reset();
    this.team.reset();
    this.theme.reset();
  }
}
