import { useState } from 'react';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { LogoMark } from '../components/icons';

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

  function fillDemo(role: 'operator' | 'supervisor') {
    setEmail(`${role}@cleen.test`);
    setPassword('password123');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <LogoMark size={40} />
        </div>
        <h1>Equipment Cleaning Log</h1>
        <p className="login-subtitle">Sign in to record and verify cleanings.</p>

        <form onSubmit={onSubmit} className="login-form">
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

        <div className="login-demo">
          <span>Try a seeded account:</span>
          <div className="login-demo-buttons">
            <button type="button" className="btn btn-sm" onClick={() => fillDemo('operator')}>
              Operator
            </button>
            <button type="button" className="btn btn-sm" onClick={() => fillDemo('supervisor')}>
              Supervisor
            </button>
          </div>
          <p className="hint">Password for both: <code>password123</code></p>
        </div>
      </div>
    </div>
  );
}
