export interface ICreatePersonDTO {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
}

export interface IPersonRecord {
  id: number;
  slug: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: 'admin' | 'manager' | 'member' | 'executive';
  departmentId: number | null;
  teamId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean | null;
  isActive: boolean | null;
}

export interface ICreateAuthSession {
  personId: number;
  refreshTokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: string; // ISO 8601
}

export interface IAuthSessionRecord {
  id: number;
  slug: string;
  personId: number;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean | null;
  isActive: boolean | null;
}
