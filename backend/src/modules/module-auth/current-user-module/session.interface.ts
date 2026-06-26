export interface IUserSession {
  id: number;
  slug: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
}
