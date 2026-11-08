import { Clock, PlayCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, StatusBadge, statusFromProgress } from '../../components/ui/Badge';
import { CourseThumbnail } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatDuration, pluralize } from '../../lib/format';
import type { CourseSummary } from '../../lib/types';

/** Catalog card: thumbnail, category, title, description, duration and the learner's progress. */
export function CourseCard({ course }: { course: CourseSummary }) {
  const complete = course.lessonCount > 0 && course.completedLessons === course.lessonCount;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-brand-500">
      <div className="relative">
        <CourseThumbnail src={course.thumbnailUrl} title={course.title} />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs font-medium text-white">
          <Clock className="size-3.5" aria-hidden />
          <span className="sr-only">Duration:</span>
          {formatDuration(course.totalDurationSeconds)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{course.category}</Badge>
          <Badge className="capitalize">{course.level}</Badge>
        </div>
        <h3 className="mt-3 text-lg leading-snug font-semibold text-slate-900">
          {/* Stretched link: the whole card is clickable, with one link in the tab order. */}
          <Link to={`/courses/${course.id}`} className="after:absolute after:inset-0 focus:outline-none">
            {course.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{course.description}</p>

        <div className="mt-auto pt-5">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="size-3.5" aria-hidden />
              {pluralize(course.lessonCount, 'lesson')}
            </span>
            {course.enrolled ? (
              <StatusBadge status={statusFromProgress(complete, course.completedLessons)} />
            ) : (
              <span className="font-medium text-brand-600">Enroll to start</span>
            )}
          </div>
          {course.enrolled && (
            <ProgressBar value={course.progressPercent} label={`${course.title} progress`} size="sm" showValue />
          )}
        </div>
      </div>
    </article>
  );
}
