import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

export const app: Express = createApp();
export const api = () => request(app);

/** Wipe every table between tests. Order matters only for readability; FKs cascade. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_changes", "audit_entries", "cleaning_records", "equipment", "users" RESTART IDENTITY CASCADE',
  );
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
  authHeader: [string, string];
}

export async function createTestUser(
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? 'operator@test.local';
  const name = overrides.name ?? 'Priya Nair';
  const password = overrides.password ?? 'password123';

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 4) },
  });

  const response = await api().post('/api/auth/login').send({ email, password }).expect(200);
  const token: string = response.body.data.token;

  return {
    id: user.id,
    email,
    name,
    token,
    authHeader: ['Authorization', `Bearer ${token}`],
  };
}

export async function createTestEquipment(
  overrides: Partial<{ name: string; code: string; status: 'ACTIVE' | 'RETIRED' }> = {},
) {
  return prisma.equipment.create({
    data: {
      name: overrides.name ?? 'Granulation Mixer 1',
      code: overrides.code ?? `MIX-${Math.floor(Math.random() * 100000)}`,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}
