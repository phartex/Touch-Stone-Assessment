import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Lock, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge, StatusBadge, statusFromProgress } from '../../components/ui/Badge';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ApiError } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { useLesson } from '../../lib/queries';
import type { LessonView } from '../../lib/types';
import { LessonCard } from '../course/LessonCard';
import { useProgressTracking } from './useProgressTracking';
import { VideoPlayer } from './VideoPlayer';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = useLesson(lessonId);

  if (lesson.isPending) return <LessonSkeleton />;
  if (lesson.isError) return <LessonError error={lesson.error} onRetry={() => lesson.refetch()} />;
  // Keyed by lesson so player and tracking state reset cleanly when moving between lessons.
  return <LessonContent key={lessonId} view={lesson.data} />;
}

function LessonContent({ view }: { view: LessonView }) {
  const navigate = useNavigate();
  const { lesson, course, lessons, enrolled, nextLessonId, prevLessonId } = view;
  const [justCompleted, setJustCompleted] = useState(false);
  // Capture the resume point once; later cache updates during playback must not move the video.
  const [startAt] = useState(lesson.lastPositionSeconds);
  const tracking = useProgressTracking(lesson.id, enrolled, () => setJustCompleted(true));

  const next = lessons.find((l) => l.id === nextLessonId);
  const courseComplete = course.lessonCount > 0 && course.completedLessons === course.lessonCount;
  // "Up next" shows the following lessons; related lessons are the rest of the course.
  const upNext = lessons.filter((l) => l.position > lesson.position).slice(0, 3);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          to={`/courses/${course.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden /> {course.title}
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content card with the video player */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <VideoPlayer
              src={lesson.videoUrl}
              title={lesson.title}
              startAt={startAt}
              {...tracking}
              onNext={next ? () => navigate(`/lessons/${next.id}`) : undefined}
              nextTitle={next?.title}
            />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{course.category}</Badge>
                <span className="text-sm text-slate-500">
                  Lesson {lesson.position} of {course.lessonCount} · {formatDuration(lesson.durationSeconds)}
                </span>
                {enrolled && <StatusBadge status={statusFromProgress(lesson.completed, lesson.lastPositionSeconds > 0)} />}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{lesson.title}</h1>
              {lesson.description && <p className="mt-2 text-slate-600">{lesson.description}</p>}

              {!enrolled && (
                <div className="mt-4">
                  <Alert tone="info">
                    <span className="inline-flex items-center gap-2">
                      <Eye className="size-4" aria-hidden /> Admin preview: progress is not tracked.
                    </span>
                  </Alert>
                </div>
              )}

              {justCompleted && (
                <div
                  role="status"
                  className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
                >
                  <PartyPopper className="size-5 shrink-0" aria-hidden />
                  {courseComplete ? 'Course complete! You finished every lesson.' : 'Lesson complete. Your progress has been saved.'}
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
                {prevLessonId ? (
                  <ButtonLink to={`/lessons/${prevLessonId}`} variant="secondary" icon={<ChevronLeft className="size-4" aria-hidden />}>
                    Previous
                  </ButtonLink>
                ) : (
                  <span />
                )}
                {nextLessonId ? (
                  <ButtonLink to={`/lessons/${nextLessonId}`}>
                    Next lesson <ChevronRight className="size-4" aria-hidden />
                  </ButtonLink>
                ) : (
                  <ButtonLink to={`/courses/${course.id}`} variant="secondary">
                    Back to course
                  </ButtonLink>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Side column: course progress, up next, full lesson list */}
        <aside className="space-y-6" aria-label="Course content">
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900">Course progress</span>
              <span className="text-slate-500">
                {course.completedLessons}/{course.lessonCount} lessons
              </span>
            </div>
            <ProgressBar value={course.progressPercent} label="Course progress" showValue />
          </Card>

          {upNext.length > 0 && (
            <section aria-labelledby="up-next-heading">
              <h2 id="up-next-heading" className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
                Up next
              </h2>
              <ul className="space-y-2">
                {upNext.map((l) => (
                  <li key={l.id}>
                    <LessonCard lesson={l} compact />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="all-lessons-heading">
            <h2 id="all-lessons-heading" className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              All lessons
            </h2>
            <ol className="space-y-2">
              {lessons.map((l) => (
                <li key={l.id}>
                  <LessonCard lesson={l} compact active={l.id === lesson.id} />
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function LessonError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.code === 'NOT_ENROLLED') {
    const courseId = (error.details as { courseId?: string } | undefined)?.courseId;
    return (
      <EmptyState
        icon={<Lock className="size-6" aria-hidden />}
        title="Enroll to watch this lesson"
        description="This lesson is part of a course you haven't joined yet. Enrolling is free."
        action={courseId && <ButtonLink to={`/courses/${courseId}`}>View course</ButtonLink>}
      />
    );
  }
  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
    return (
      <EmptyState
        title="Lesson not found"
        description="It may have been moved or removed."
        action={<ButtonLink to="/courses">Browse courses</ButtonLink>}
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

function LessonSkeleton() {
  return (
    <div role="status" aria-label="Loading lesson" className="grid gap-6 lg:grid-cols-3">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 lg:col-span-2">
        <Skeleton className="aspect-video rounded-none" />
        <div className="space-y-3 p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
