import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={<ButtonLink to="/">Go home</ButtonLink>}
    />
  );
}
