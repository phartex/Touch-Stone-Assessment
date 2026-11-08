import { query, queryOne } from '../../db/pool.js';
import type { AuthUser, Role } from '../../lib/types.js';

interface UserRow extends AuthUser {
  password_hash: string;
}

const PUBLIC_COLUMNS = 'id, email, name, role';

export const usersRepository = {
  findById(id: string) {
    return queryOne<AuthUser>(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  },

  findByEmailWithHash(email: string) {
    return queryOne<UserRow>(
      `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
  },

  async create(input: { email: string; name: string; passwordHash: string; role?: Role }) {
    const rows = await query<AuthUser>(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}`,
      [input.email, input.name, input.passwordHash, input.role ?? 'learner'],
    );
    return rows[0]!;
  },
};
