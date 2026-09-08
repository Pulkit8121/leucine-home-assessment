import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseOrThrow } from '../../lib/validate.js';
import { currentUser, requireAuth } from '../../middleware/require-auth.js';
import { login } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().trim().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authRouter: Router = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parseOrThrow(loginSchema, req.body);
    res.json({ data: await login(email, password) });
  }),
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: currentUser(req) });
});
