import { useState } from 'react';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('operator@cleen.test');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : 'Could not reach the API.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="panel login-card">
        <div className="panel-body">
          <h1>Equipment Cleaning Log</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            Sign in to record and verify cleanings.
          </p>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            {error ? <p className="alert">{error}</p> : null}

            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="hint">
            Seeded accounts: <code>operator@cleen.test</code> and{' '}
            <code>supervisor@cleen.test</code>, both with password <code>password123</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
