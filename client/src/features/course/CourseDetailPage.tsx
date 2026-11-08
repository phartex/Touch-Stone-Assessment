import { ArrowLeft, BarChart3, Clock, PlayCircle, Trophy } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge, StatusBadge, statusFromProgress } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CourseThumbnail } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ApiError, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDuration, pluralize } from '../../lib/format';
import { useCourse, useEnroll } from '../../lib/queries';
import type { CourseDetail } from '../../lib/types';
import { LessonCard } from './LessonCard';

function primaryAction(course: CourseDetail) {
  const complete = course.lessonCount > 0 && course.completedLessons === course.lessonCount;
  const started = course.lessons.some((l) => l.completed || l.lastPositionSeconds > 0);
  if (complete) return 'Review course';
  if (started) return 'Continue learning';
  return 'Start course';
}

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const course = useCourse(courseId);
  const enroll = useEnroll(courseId);

  if (course.isPending) return <CourseDetailSkeleton />;
  if (course.isError) {
    const missing = course.error instanceof ApiError && (course.error.status === 404 || course.error.status === 400);
    return missing ? (
      <EmptyState
        title="Course not found"
        description="It may have been removed or is not published yet."
        action={<ButtonLink to="/courses">Browse the catalog</ButtonLink>}
      />
    ) : (
      <ErrorState error={course.error} onRetry={() => course.refetch()} />
    );
  }

  const data = course.data;
  const complete = data.lessonCount > 0 && data.completedLessons === data.lessonCount;
  const canWatch = data.enrolled || user?.role === 'admin';

  const handleEnroll = () => {
    enroll.mutate(undefined, {
      onSuccess: (updated) => {
        if (updated.nextLessonId) navigate(`/lessons/${updated.nextLessonId}`);
      },
    });
  };

  return (
    <div className="space-y-8">
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden /> Back to catalog
      </Link>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-5">
          <CourseThumbnail src={data.thumbnailUrl} title={data.title} className="lg:col-span-2 lg:aspect-auto lg:h-full" />
          <div className="p-6 sm:p-8 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{data.category}</Badge>
              {!data.isPublished && <Badge tone="warning">Draft</Badge>}
              {data.enrolled && <StatusBadge status={statusFromProgress(complete, data.completedLessons)} />}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{data.title}</h1>
            <p className="mt-3 text-slate-600">{data.description}</p>

            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Lessons</dt>
                <PlayCircle className="size-4 text-slate-400" aria-hidden />
                <dd>{pluralize(data.lessonCount, 'lesson')}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Total duration</dt>
                <Clock className="size-4 text-slate-400" aria-hidden />
                <dd>{formatDuration(data.totalDurationSeconds)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Level</dt>
                <BarChart3 className="size-4 text-slate-400" aria-hidden />
                <dd className="capitalize">{data.level}</dd>
              </div>
            </dl>

            {data.enrolled && (
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Your progress</span>
                  <span className="text-slate-500">
                    {data.completedLessons} of {data.lessonCount} lessons
                  </span>
                </div>
                <ProgressBar value={data.progressPercent} label="Course progress" showValue />
              </div>
            )}

            {complete && (
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200">
                <Trophy className="size-6 shrink-0" aria-hidden />
                <p className="text-sm font-medium">You completed this course. Nice work!</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {data.enrolled ? (
                data.nextLessonId && (
                  <ButtonLink to={`/lessons/${data.nextLessonId}`} size="lg" icon={<PlayCircle className="size-5" aria-hidden />}>
                    {primaryAction(data)}
                  </ButtonLink>
                )
              ) : (
                <Button size="lg" onClick={handleEnroll} loading={enroll.isPending} disabled={data.lessonCount === 0}>
                  Enroll for free
                </Button>
              )}
              {!data.enrolled && user?.role === 'admin' && data.nextLessonId && (
                <ButtonLink to={`/lessons/${data.nextLessonId}`} variant="secondary" size="lg">
                  Preview as admin
                </ButtonLink>
              )}
            </div>
            {enroll.isError && (
              <div className="mt-4">
                <Alert>{errorMessage(enroll.error)}</Alert>
              </div>
            )}
          </div>
        </div>
      </Card>

      <section aria-labelledby="lessons-heading">
        <h2 id="lessons-heading" className="mb-4 text-xl font-semibold text-slate-900">
          Lessons
        </h2>
        {data.lessons.length === 0 ? (
          <EmptyState title="No lessons yet" description="Lessons for this course are on their way." />
        ) : (
          <ol className="grid gap-3 md:grid-cols-2">
            {data.lessons.map((lesson) => (
              <li key={lesson.id}>
                <LessonCard lesson={lesson} locked={!canWatch} active={false} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function CourseDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading course" className="space-y-8">
      <Skeleton className="h-5 w-32" />
      <div className="grid overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 lg:grid-cols-5">
        <Skeleton className="aspect-video rounded-none lg:col-span-2" />
        <div className="space-y-4 p-8 lg:col-span-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
