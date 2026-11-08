import { Activity, BookOpen, CheckCircle2, GraduationCap, Plus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card, PageHeader, StatCard } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { formatRelative, pluralize } from '../../lib/format';
import { useAdminDashboard } from '../../lib/queries';
import { AdminNav } from './AdminNav';

export function AdminDashboardPage() {
  const dashboard = useAdminDashboard();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Monitor learner activity and manage course content."
        actions={
          <ButtonLink to="/admin/courses/new" icon={<Plus className="size-4" aria-hidden />}>
            New course
          </ButtonLink>
        }
      />
      <AdminNav />

      {dashboard.isPending ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <div className="space-y-8">
          <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Learners"
              value={dashboard.data.totals.learners}
              hint={`${dashboard.data.totals.activeLearners7d} active in the last 7 days`}
              icon={<Users className="size-5" aria-hidden />}
            />
            <StatCard
              label="Courses"
              value={dashboard.data.totals.courses}
              hint={`${dashboard.data.totals.publishedCourses} published · ${dashboard.data.totals.lessons} lessons`}
              icon={<BookOpen className="size-5" aria-hidden />}
            />
            <StatCard label="Enrollments" value={dashboard.data.totals.enrollments} icon={<GraduationCap className="size-5" aria-hidden />} />
            <StatCard
              label="Completion rate"
              value={`${dashboard.data.totals.completionRatePercent}%`}
              hint={`${dashboard.data.totals.completedEnrollments} courses completed`}
              icon={<CheckCircle2 className="size-5" aria-hidden />}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2">
              <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">Course performance</h2>
              {dashboard.data.courses.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No courses yet" action={<ButtonLink to="/admin/courses/new">Create a course</ButtonLink>} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th scope="col" className="px-5 py-3">Course</th>
                        <th scope="col" className="px-5 py-3 text-right">Enrolled</th>
                        <th scope="col" className="px-5 py-3 text-right">Completed</th>
                        <th scope="col" className="min-w-40 px-5 py-3">Avg. progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.data.courses.map((course) => (
                        <tr key={course.id} className="hover:bg-slate-50">
                          <th scope="row" className="px-5 py-3 font-medium">
                            <Link to={`/admin/courses/${course.id}`} className="text-slate-900 hover:text-brand-600">
                              {course.title}
                            </Link>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge tone={course.isPublished ? 'success' : 'warning'}>
                                {course.isPublished ? 'Published' : 'Draft'}
                              </Badge>
                              <span className="text-xs font-normal text-slate-500">{pluralize(course.lessonCount, 'lesson')}</span>
                            </div>
                          </th>
                          <td className="px-5 py-3 text-right tabular-nums">{course.enrollmentCount}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{course.completedCount}</td>
                          <td className="px-5 py-3">
                            <ProgressBar value={course.avgProgressPercent} label={`${course.title} average progress`} size="sm" showValue />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">
                <Activity className="size-4 text-brand-600" aria-hidden /> Recent activity
              </h2>
              {dashboard.data.recentActivity.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No learner activity yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dashboard.data.recentActivity.map((item) => (
                    <li key={`${item.userEmail}-${item.lessonId}`} className="px-5 py-3 text-sm">
                      <p className="text-slate-800">
                        <span className="font-medium">{item.userName}</span>{' '}
                        {item.completed ? 'completed' : 'watched'} <span className="font-medium">{item.lessonTitle}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.courseTitle} · {formatRelative(item.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
