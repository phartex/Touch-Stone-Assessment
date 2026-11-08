import bcrypt from 'bcryptjs';
import { conflict, unauthorized } from '../../lib/errors.js';
import type { AuthUser } from '../../lib/types.js';
import { usersRepository } from './users.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

export const authService = {
  async register(input: RegisterInput): Promise<AuthUser> {
    const existing = await usersRepository.findByEmailWithHash(input.email);
    if (existing) throw conflict('An account with this email already exists');
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    // Self-registration always creates learners; admins are provisioned by seed/ops.
    return usersRepository.create({ email: input.email, name: input.name, passwordHash });
  },

  async login(input: LoginInput): Promise<AuthUser> {
    const user = await usersRepository.findByEmailWithHash(input.email);
    const valid = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid) throw unauthorized('Invalid email or password');
    const { password_hash: _ignored, ...publicUser } = user;
    return publicUser;
  },
};
