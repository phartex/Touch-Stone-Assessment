import { BookOpen, CheckCircle2, Clock, Flame, PlayCircle } from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { Card, CourseThumbnail, PageHeader, StatCard } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { useAuth } from '../../lib/auth';
import { formatRelative, formatTimestamp } from '../../lib/format';
import { useLearnerDashboard } from '../../lib/queries';
import { CourseCard } from '../catalog/CourseCard';

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useLearnerDashboard();
  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description="Pick up where you left off and keep your streak going." />

      {dashboard.isPending ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <CardGridSkeleton count={3} />
        </div>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <div className="space-y-10">
          <section aria-label="Learning summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Enrolled courses" value={dashboard.data.stats.enrolledCourses} icon={<BookOpen className="size-5" aria-hidden />} />
            <StatCard label="In progress" value={dashboard.data.stats.inProgressCourses} icon={<Flame className="size-5" aria-hidden />} />
            <StatCard
              label="Courses completed"
              value={dashboard.data.stats.completedCourses}
              hint={`${dashboard.data.stats.completedLessons} lessons completed`}
              icon={<CheckCircle2 className="size-5" aria-hidden />}
            />
            <StatCard label="Minutes watched" value={dashboard.data.stats.minutesWatched} icon={<Clock className="size-5" aria-hidden />} />
          </section>

          {dashboard.data.continueWatching.length > 0 && (
            <section aria-labelledby="continue-heading">
              <h2 id="continue-heading" className="mb-4 text-xl font-semibold text-slate-900">
                Continue watching
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {dashboard.data.continueWatching.map((item) => (
                  <Card key={item.lessonId} className="group relative overflow-hidden transition hover:shadow-md">
                    <div className="relative">
                      <CourseThumbnail src={item.thumbnailUrl} title={item.courseTitle} />
                      <div className="absolute inset-0 grid place-items-center bg-slate-900/30 opacity-0 transition group-hover:opacity-100">
                        <PlayCircle className="size-12 text-white" aria-hidden />
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="truncate text-xs font-medium text-slate-500">{item.courseTitle}</p>
                      <h3 className="mt-0.5 truncate font-semibold text-slate-900">
                        <Link to={`/lessons/${item.lessonId}`} className="after:absolute after:inset-0">
                          {item.lessonTitle}
                        </Link>
                      </h3>
                      <ProgressBar
                        value={(item.lastPositionSeconds / item.durationSeconds) * 100}
                        label={`${item.lessonTitle} watched`}
                        size="sm"
                        className="mt-3"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {formatTimestamp(item.lastPositionSeconds)} / {formatTimestamp(item.durationSeconds)} ·{' '}
                        {formatRelative(item.updatedAt)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="my-courses-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="my-courses-heading" className="text-xl font-semibold text-slate-900">
                My courses
              </h2>
              {dashboard.data.courses.length > 0 && (
                <Link to="/courses" className="text-sm font-medium text-brand-600 hover:underline">
                  Browse more
                </Link>
              )}
            </div>
            {dashboard.data.courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-6" aria-hidden />}
                title="You haven't enrolled in any courses yet"
                description="Explore the catalog and enroll in a course to start tracking your progress."
                action={<ButtonLink to="/courses">Explore courses</ButtonLink>}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.data.courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
