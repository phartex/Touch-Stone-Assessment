import { Wand2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextAreaField, TextField } from '../../components/ui/Field';
import { Alert } from '../../components/ui/States';
import { ApiError, errorMessage } from '../../lib/api';
import { formatTimestamp } from '../../lib/format';
import { useSaveLesson } from '../../lib/queries';
import type { AdminLesson } from '../../lib/types';
import { detectVideoDuration, isHttpUrl, validateLesson, type LessonFormValues } from './validation';

const EMPTY: LessonFormValues = { title: '', description: '', videoUrl: '', durationSeconds: '' };

interface Props {
  courseId: string;
  open: boolean;
  /** Lesson being edited, or null to create a new one. */
  lesson: AdminLesson | null;
  onClose: () => void;
}

export function LessonFormDialog({ courseId, open, lesson, onClose }: Props) {
  const save = useSaveLesson(courseId);
  const [values, setValues] = useState<LessonFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof LessonFormValues, string>>>({});
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(
      lesson
        ? {
            title: lesson.title,
            description: lesson.description,
            videoUrl: lesson.videoUrl,
            durationSeconds: String(lesson.durationSeconds),
          }
        : EMPTY,
    );
    setErrors({});
    setDetectError(null);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);

  const set = (field: keyof LessonFormValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const detect = async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      set('durationSeconds')(String(await detectVideoDuration(values.videoUrl.trim())));
    } catch (error) {
      setDetectError(errorMessage(error));
    } finally {
      setDetecting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validateLesson(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    save.mutate(
      {
        id: lesson?.id,
        input: {
          title: values.title.trim(),
          description: values.description.trim(),
          videoUrl: values.videoUrl.trim(),
          durationSeconds: Number(values.durationSeconds),
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors.length) setErrors(error.byField);
        },
      },
    );
  };

  const duration = Number(values.durationSeconds);
  const serverError = save.isError && !(save.error instanceof ApiError && save.error.fieldErrors.length);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lesson ? 'Edit lesson' : 'Add lesson'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lesson-form" loading={save.isPending}>
            {lesson ? 'Save lesson' : 'Add lesson'}
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && <Alert>{errorMessage(save.error)}</Alert>}
        <TextField label="Title" value={values.title} onChange={(e) => set('title')(e.target.value)} error={errors.title} />
        <TextAreaField
          label="Description"
          value={values.description}
          onChange={(e) => set('description')(e.target.value)}
          error={errors.description}
          hint="Optional. Shown under the video."
        />
        <TextField
          label="Video URL"
          type="url"
          placeholder="https://…/lesson.mp4"
          value={values.videoUrl}
          onChange={(e) => set('videoUrl')(e.target.value)}
          error={errors.videoUrl}
          hint="A direct link to an MP4/WebM file."
        />
        <TextField
          label="Duration (seconds)"
          type="number"
          inputMode="numeric"
          min={1}
          value={values.durationSeconds}
          onChange={(e) => set('durationSeconds')(e.target.value)}
          error={errors.durationSeconds}
          hint={Number.isInteger(duration) && duration > 0 ? `= ${formatTimestamp(duration)}` : undefined}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={detect}
            loading={detecting}
            disabled={!isHttpUrl(values.videoUrl.trim())}
            icon={<Wand2 className="size-4" aria-hidden />}
          >
            Detect duration from video
          </Button>
          {detectError && (
            <p role="alert" className="text-xs text-amber-700">
              {detectError}. Enter the duration manually.
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
