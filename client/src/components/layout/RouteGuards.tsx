import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import type { Role } from '../../lib/types';
import { Spinner } from '../ui/States';

function FullPageSpinner() {
  return <Spinner label="Loading your session" className="min-h-screen" />;
}

/**
 * Client-side guard for UX only: it decides what to render. The API enforces the same rules,
 * so bypassing this guard grants no access to data.
 */
export function RequireAuth({ role, children }: { role?: Role; children?: ReactNode }) {
  const { user, isLoading, signedOutByUser } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!user) {
    // Remember the page only when the session ended unexpectedly, so signing back in returns there.
    // After a deliberate sign-out the next person should land on their own home page.
    if (signedOutByUser) return <Navigate to="/login" replace />;
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children ?? <Outlet />;
}

/** Sends already-signed-in users away from the login/register pages. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <Outlet />;
}
