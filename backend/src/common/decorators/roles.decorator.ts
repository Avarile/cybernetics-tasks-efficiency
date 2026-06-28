/**
 * Canonical role list. Retained as the single source of truth for a person's
 * role (used by DTO enums and the CASL ability factory's role switch).
 * The legacy role decorator + RoleGuard were retired in favour of CASL.
 */
export enum Role {
  admin = 'admin',
  manager = 'manager',
  member = 'member',
  executive = 'executive',
}
