import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/States';
import { ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';

const DEMO_ACCOUNTS = [
  { label: 'Learner', email: 'learner@touchstone.dev', password: 'Learner1234' },
  { label: 'Admin', email: 'admin@touchstone.dev', password: 'Admin1234' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldErrors = error instanceof ApiError ? error.byField : {};

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login({ email, password });
      navigate(from ?? (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error !== null && Object.keys(fieldErrors).length === 0 && <Alert>{errorMessage(error)}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-xl bg-slate-100 p-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Demo accounts</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.label}
              size="sm"
              variant="secondary"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
            >
              Use {account.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
