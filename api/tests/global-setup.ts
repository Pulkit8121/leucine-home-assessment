import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Runs once before the whole suite: point Prisma at the dedicated test database and
 * push the schema into it. `migrate deploy` is used rather than `db push` so the tests
 * exercise the same migrations that production runs.
 */
export default function setup(): void {
  process.env.NODE_ENV = 'test';

  const envPath = path.resolve(process.cwd(), '.env.test');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set for tests. Copy api/.env.test.example to api/.env.test ' +
        'and make sure the test database exists (docker compose up -d db creates it).',
    );
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
