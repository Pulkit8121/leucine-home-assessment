import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { ApiError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
}

/** Translates Prisma's error codes into the same shape as our own ApiErrors. */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): ApiError | null {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return ApiError.conflict(`A record with this ${target} already exists`);
    }
    case 'P2025':
      return ApiError.notFound('Resource not found');
    case 'P2003':
      return ApiError.badRequest('Referenced record does not exist');
    default:
      return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let apiError: ApiError | null = err instanceof ApiError ? err : null;

  if (!apiError && err instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = fromPrisma(err);
  }

  if (!apiError && err instanceof SyntaxError && 'body' in err) {
    apiError = ApiError.badRequest('Request body is not valid JSON');
  }

  if (apiError) {
    res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details ? { details: apiError.details } : {}),
      },
    });
    return;
  }

  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err);
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
