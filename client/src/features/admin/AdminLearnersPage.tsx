import { Users } from 'lucide-react';
import { Card, PageHeader } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { formatRelative } from '../../lib/format';
import { useAdminLearners } from '../../lib/queries';
import { AdminNav } from './AdminNav';

export function AdminLearnersPage() {
  const learners = useAdminLearners();

  return (
    <>
      <PageHeader title="Admin" description="Review learner engagement across all courses." />
      <AdminNav />

      {learners.isPending ? (
        <Skeleton className="h-80" />
      ) : learners.isError ? (
        <ErrorState error={learners.error} onRetry={() => learners.refetch()} />
      ) : learners.data.length === 0 ? (
        <EmptyState icon={<Users className="size-6" aria-hidden />} title="No learners yet" description="Learners appear here once they sign up." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Learners and their progress</caption>
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">Learner</th>
                  <th scope="col" className="px-5 py-3 text-right">Enrolled</th>
                  <th scope="col" className="px-5 py-3 text-right">Completed</th>
                  <th scope="col" className="min-w-44 px-5 py-3">Avg. progress</th>
                  <th scope="col" className="px-5 py-3">Last active</th>
                  <th scope="col" className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {learners.data.map((learner) => (
                  <tr key={learner.id} className="hover:bg-slate-50">
                    <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                      {learner.name}
                      <div className="text-xs font-normal text-slate-500">{learner.email}</div>
                    </th>
                    <td className="px-5 py-3 text-right tabular-nums">{learner.enrolledCourses}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{learner.completedCourses}</td>
                    <td className="px-5 py-3">
                      <ProgressBar value={learner.avgProgressPercent} label={`${learner.name} average progress`} size="sm" showValue />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatRelative(learner.lastActivityAt)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatRelative(learner.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
