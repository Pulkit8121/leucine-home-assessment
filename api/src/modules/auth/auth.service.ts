import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthUser } from './auth.types.js';

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, name: user.name };
  const options = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return { id: decoded.sub, email: decoded.email, name: decoded.name };
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Compare against a dummy hash when the user does not exist so that a wrong email and
  // a wrong password take the same time and cannot be told apart by an attacker.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
  return { token: signToken(authUser), user: authUser };
}
