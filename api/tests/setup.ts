import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Each test worker is a fresh process, so it needs the test env loaded too.
process.env.NODE_ENV = 'test';
const envPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}
