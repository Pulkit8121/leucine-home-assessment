export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. Every audit entry is attributed to this user. */
      user?: AuthUser;
    }
  }
}

export {};
