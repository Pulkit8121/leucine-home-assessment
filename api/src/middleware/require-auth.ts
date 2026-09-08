import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { verifyToken } from '../modules/auth/auth.service.js';

/**
 * Reads `Authorization: Bearer <jwt>` and attaches the caller to req.user.
 * Every mutating route sits behind this, which is what makes the audit trail's
 * "who" a real identity rather than a client-supplied string.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(ApiError.unauthorized('Missing Bearer token'));
    return;
  }

  try {
    req.user = verifyToken(header.slice('Bearer '.length).trim());
    next();
  } catch (error) {
    next(error);
  }
}

/** Narrowing helper so handlers get a non-optional user without repeating the check. */
export function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
