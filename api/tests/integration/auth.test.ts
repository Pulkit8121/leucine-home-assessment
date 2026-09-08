import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { api, createTestUser, resetDatabase } from '../helpers.js';

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('issues a token for valid credentials', async () => {
    await createTestUser({ email: 'operator@test.local', password: 'password123' });

    const response = await api()
      .post('/api/auth/login')
      .send({ email: 'operator@test.local', password: 'password123' })
      .expect(200);

    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('operator@test.local');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    await createTestUser({ email: 'operator@test.local', password: 'password123' });

    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ email: 'operator@test.local', password: 'nope' })
      .expect(401);

    const unknownEmail = await api()
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: 'password123' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('returns the current user for a valid token', async () => {
    const user = await createTestUser();

    const response = await api()
      .get('/api/auth/me')
      .set(...user.authHeader)
      .expect(200);

    expect(response.body.data).toEqual({ id: user.id, email: user.email, name: user.name });
  });

  it('rejects a missing or malformed token', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
  });
});
