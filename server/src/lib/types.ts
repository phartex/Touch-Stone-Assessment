export type Role = 'learner' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
