import { ArrowDown, ArrowLeft, ArrowUp, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CourseThumbnail } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { ApiError, errorMessage } from '../../lib/api';
import { formatDuration, formatRelative, pluralize } from '../../lib/format';
import {
  useAdminCourse,
  useAdminCourseLearners,
  useDeleteCourse,
  useDeleteLesson,
  useReorderLessons,
  useSaveCourse,
} from '../../lib/queries';
import type { AdminLesson, CourseRecord } from '../../lib/types';
import { LessonFormDialog } from './LessonFormDialog';
import { validateCourse, type CourseFormValues } from './validation';

export function CourseEditorPage() {
  const { courseId } = useParams();
  const isNew = !courseId;
  const query = useAdminCourse(courseId);

  return (
    <div className="space-y-6">
      <Link to="/admin/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden /> All courses
      </Link>

      {isNew ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">New course</h1>
          <CourseForm course={null} />
        </>
      ) : query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-96" />
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400) ? (
          <EmptyState title="Course not found" action={<ButtonLink to="/admin/courses">Back to courses</ButtonLink>} />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )
      ) : (
        <EditCourse course={query.data.course} lessons={query.data.lessons} />
      )}
    </div>
  );
}

function EditCourse({ course, lessons }: { course: CourseRecord; lessons: AdminLesson[] }) {
  const navigate = useNavigate();
  const deleteCourse = useDeleteCourse();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={course.isPublished ? 'success' : 'warning'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>
            <span className="text-xs text-slate-500">Updated {formatRelative(course.updatedAt)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{course.title}</h1>
        </div>
        <div className="flex gap-2">
          <ButtonLink to={`/courses/${course.id}`} variant="secondary" icon={<Eye className="size-4" aria-hidden />}>
            View as learner
          </ButtonLink>
          <PublishToggle course={course} lessonCount={lessons.length} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <LessonsManager courseId={course.id} lessons={lessons} />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <CourseForm course={course} />
          <Card className="p-5 ring-red-200">
            <h2 className="font-semibold text-red-700">Delete course</h2>
            <p className="mt-1 text-sm text-slate-600">Removes the course, its lessons and all learner progress.</p>
            <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmDelete(true)}>
              Delete course
            </Button>
          </Card>
        </div>
      </div>

      <CourseLearners courseId={course.id} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete course?"
        message={
          <>
            <strong>{course.title}</strong> will be permanently deleted with all lessons and learner progress.
          </>
        }
        loading={deleteCourse.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteCourse.mutate(course.id, { onSuccess: () => navigate('/admin/courses', { replace: true }) })}
      />
    </>
  );
}

function PublishToggle({ course, lessonCount }: { course: CourseRecord; lessonCount: number }) {
  const save = useSaveCourse(course.id);
  const cannotPublish = !course.isPublished && lessonCount === 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={course.isPublished ? 'secondary' : 'primary'}
        loading={save.isPending}
        disabled={cannotPublish}
        title={cannotPublish ? 'Add at least one lesson before publishing' : undefined}
        onClick={() => save.mutate({ isPublished: !course.isPublished })}
      >
        {course.isPublished ? 'Unpublish' : 'Publish'}
      </Button>
      {save.isError && <p className="text-xs text-red-600">{errorMessage(save.error)}</p>}
    </div>
  );
}

function toFormValues(course: CourseRecord | null): CourseFormValues {
  return {
    title: course?.title ?? '',
    description: course?.description ?? '',
    category: course?.category ?? '',
    level: course?.level ?? 'beginner',
    thumbnailUrl: course?.thumbnailUrl ?? '',
  };
}

function CourseForm({ course }: { course: CourseRecord | null }) {
  const navigate = useNavigate();
  const save = useSaveCourse(course?.id);
  const [values, setValues] = useState<CourseFormValues>(() => toFormValues(course));
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormValues, string>>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => setValues(toFormValues(course)), [course]);

  const set = (field: keyof CourseFormValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setSaved(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validateCourse(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    save.mutate(
      {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category.trim(),
        level: values.level,
        thumbnailUrl: values.thumbnailUrl.trim() || null,
      },
      {
        onSuccess: (result) => {
          if (!course) navigate(`/admin/courses/${result.id}`, { replace: true });
          else setSaved(true);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors.length) setErrors(error.byField);
        },
      },
    );
  };

  const serverError = save.isError && !(save.error instanceof ApiError && save.error.fieldErrors.length);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-semibold text-slate-900">Course details</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && <Alert>{errorMessage(save.error)}</Alert>}
        {saved && <Alert tone="success">Course details saved.</Alert>}
        <TextField label="Title" value={values.title} onChange={(e) => set('title')(e.target.value)} error={errors.title} />
        <TextAreaField
          label="Description"
          rows={4}
          value={values.description}
          onChange={(e) => set('description')(e.target.value)}
          error={errors.description}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Category"
            placeholder="e.g. Frontend"
            value={values.category}
            onChange={(e) => set('category')(e.target.value)}
            error={errors.category}
          />
          <SelectField label="Level" value={values.level} onChange={(e) => set('level')(e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </SelectField>
        </div>
        <TextField
          label="Thumbnail URL"
          type="url"
          placeholder="https://…"
          value={values.thumbnailUrl}
          onChange={(e) => set('thumbnailUrl')(e.target.value)}
          error={errors.thumbnailUrl}
          hint="Optional. A 16:9 image works best; a colour placeholder is used otherwise."
        />
        <CourseThumbnail src={values.thumbnailUrl.trim() || null} title={values.title || 'Preview'} className="max-w-xs rounded-xl" />
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            {course ? 'Save changes' : 'Create course'}
          </Button>
        </div>
        {!course && <p className="text-xs text-slate-500">New courses start as drafts. Add lessons, then publish.</p>}
      </form>
    </Card>
  );
}

function LessonsManager({ courseId, lessons }: { courseId: string; lessons: AdminLesson[] }) {
  const reorder = useReorderLessons(courseId);
  const deleteLesson = useDeleteLesson();
  const [editing, setEditing] = useState<AdminLesson | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminLesson | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    const ids = lessons.map((l) => l.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  };

  const openForm = (lesson: AdminLesson | null) => {
    setEditing(lesson);
    setFormOpen(true);
  };

  const totalDuration = lessons.reduce((sum, l) => sum + l.durationSeconds, 0);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">Lessons</h2>
          <p className="text-sm text-slate-500">
            {pluralize(lessons.length, 'lesson')} · {formatDuration(totalDuration)}
          </p>
        </div>
        <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => openForm(null)}>
          Add lesson
        </Button>
      </div>

      {(reorder.isError || deleteLesson.isError) && (
        <div className="mb-4">
          <Alert>{errorMessage(reorder.error ?? deleteLesson.error)}</Alert>
        </div>
      )}

      {lessons.length === 0 ? (
        <EmptyState title="No lessons yet" description="Add the first lesson to this course. You'll need at least one to publish." />
      ) : (
        <ol className="space-y-2">
          {lessons.map((lesson, index) => (
            <li key={lesson.id} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                {lesson.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{lesson.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {formatDuration(lesson.durationSeconds)} · {lesson.videoUrl}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${lesson.title} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${lesson.title} down`}
                  disabled={index === lessons.length - 1 || reorder.isPending}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Edit ${lesson.title}`} onClick={() => openForm(lesson)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Delete ${lesson.title}`} onClick={() => setToDelete(lesson)}>
                  <Trash2 className="size-4 text-red-600" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <LessonFormDialog courseId={courseId} open={formOpen} lesson={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete lesson?"
        message={
          <>
            <strong>{toDelete?.title}</strong> and learners' progress on it will be deleted.
          </>
        }
        loading={deleteLesson.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteLesson.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}
      />
    </Card>
  );
}

function CourseLearners({ courseId }: { courseId: string }) {
  const learners = useAdminCourseLearners(courseId);
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-900">Learner progress</h2>
      {learners.isPending ? (
        <div className="p-5">
          <Skeleton className="h-24" />
        </div>
      ) : learners.isError ? (
        <div className="p-5">
          <ErrorState error={learners.error} onRetry={() => learners.refetch()} />
        </div>
      ) : learners.data.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No learners have enrolled in this course yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">Learner</th>
                <th scope="col" className="min-w-48 px-5 py-3">Progress</th>
                <th scope="col" className="px-5 py-3">Enrolled</th>
                <th scope="col" className="px-5 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {learners.data.map((learner) => (
                <tr key={learner.userId}>
                  <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                    {learner.name}
                    <div className="text-xs font-normal text-slate-500">{learner.email}</div>
                  </th>
                  <td className="px-5 py-3">
                    <ProgressBar value={learner.progressPercent} label={`${learner.name} progress`} size="sm" showValue />
                    <p className="mt-1 text-xs text-slate-500">
                      {learner.completedLessons}/{learner.lessonCount} lessons
                    </p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatRelative(learner.enrolledAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{formatRelative(learner.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
