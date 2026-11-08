import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CourseThumbnail, PageHeader } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { errorMessage } from '../../lib/api';
import { formatDuration, pluralize } from '../../lib/format';
import { useAdminCourses, useDeleteCourse } from '../../lib/queries';
import type { AdminCourseStats } from '../../lib/types';
import { AdminNav } from './AdminNav';

export function AdminCoursesPage() {
  const courses = useAdminCourses();
  const deleteCourse = useDeleteCourse();
  const [toDelete, setToDelete] = useState<AdminCourseStats | null>(null);

  return (
    <>
      <PageHeader
        title="Admin"
        description="Create, edit and publish courses."
        actions={
          <ButtonLink to="/admin/courses/new" icon={<Plus className="size-4" aria-hidden />}>
            New course
          </ButtonLink>
        }
      />
      <AdminNav />

      {deleteCourse.isError && (
        <div className="mb-4">
          <Alert>{errorMessage(deleteCourse.error)}</Alert>
        </div>
      )}

      {courses.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create your first course, add lessons, then publish it to learners."
          action={<ButtonLink to="/admin/courses/new">Create a course</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {courses.data.map((course) => (
            <li key={course.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <CourseThumbnail src={course.thumbnailUrl} title={course.title} className="w-full shrink-0 rounded-xl sm:w-40" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={course.isPublished ? 'success' : 'warning'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>
                    <Badge tone="brand">{course.category}</Badge>
                  </div>
                  <h2 className="mt-2 truncate font-semibold text-slate-900">{course.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {pluralize(course.lessonCount, 'lesson')} · {formatDuration(course.totalDurationSeconds)} ·{' '}
                    {pluralize(course.enrollmentCount, 'learner')}
                  </p>
                  <ProgressBar
                    value={course.avgProgressPercent}
                    label={`${course.title} average learner progress`}
                    size="sm"
                    showValue
                    className="mt-2 max-w-xs"
                  />
                </div>
                <div className="flex shrink-0 gap-2">
                  <ButtonLink to={`/courses/${course.id}`} variant="ghost" size="sm" aria-label={`View ${course.title}`}>
                    <Eye className="size-4" aria-hidden />
                  </ButtonLink>
                  <ButtonLink to={`/admin/courses/${course.id}`} variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />}>
                    Edit
                  </ButtonLink>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${course.title}`} onClick={() => setToDelete(course)}>
                    <Trash2 className="size-4 text-red-600" aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete course?"
        message={
          <>
            <strong>{toDelete?.title}</strong> and all of its lessons will be permanently deleted, along with{' '}
            {pluralize(toDelete?.enrollmentCount ?? 0, 'enrollment')} and learner progress. This cannot be undone.
          </>
        }
        loading={deleteCourse.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteCourse.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}
      />
    </>
  );
}
