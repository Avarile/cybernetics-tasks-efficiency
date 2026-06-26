import { SetMetadata } from '@nestjs/common';

export enum Role {
  admin = 'admin',
  manager = 'manager',
  member = 'member',
  executive = 'executive',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
