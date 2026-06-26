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
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean | null;
  isActive: boolean | null;
}
