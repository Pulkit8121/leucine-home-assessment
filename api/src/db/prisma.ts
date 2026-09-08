import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

export const prisma = new PrismaClient({
  // Silent under test: several tests assert on error paths (duplicate codes, bad ids)
  // and the expected Prisma errors would otherwise drown out real failures.
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : env.NODE_ENV === 'test' ? [] : ['error'],
});

export type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
