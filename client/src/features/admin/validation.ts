import type { CourseLevel } from '../../lib/types';

/** Client-side validation mirroring the API's Zod schemas, for instant feedback. */

export interface CourseFormValues {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string;
}

export interface LessonFormValues {
  title: string;
  description: string;
  videoUrl: string;
  durationSeconds: string;
}

type Errors<T> = Partial<Record<keyof T, string>>;

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCourse(values: CourseFormValues): Errors<CourseFormValues> {
  const errors: Errors<CourseFormValues> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  const category = values.category.trim();
  if (title.length < 3) errors.title = 'Title must be at least 3 characters';
  else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer';
  if (description.length < 10) errors.description = 'Description must be at least 10 characters';
  else if (description.length > 2000) errors.description = 'Description must be 2000 characters or fewer';
  if (category.length < 2) errors.category = 'Category must be at least 2 characters';
  else if (category.length > 50) errors.category = 'Category must be 50 characters or fewer';
  if (values.thumbnailUrl.trim() && !isHttpUrl(values.thumbnailUrl.trim()))
    errors.thumbnailUrl = 'Must be a valid http(s) URL';
  return errors;
}

export function validateLesson(values: LessonFormValues): Errors<LessonFormValues> {
  const errors: Errors<LessonFormValues> = {};
  if (values.title.trim().length < 3) errors.title = 'Title must be at least 3 characters';
  if (values.description.length > 2000) errors.description = 'Description must be 2000 characters or fewer';
  if (!isHttpUrl(values.videoUrl.trim())) errors.videoUrl = 'Video URL must be a valid http(s) URL';
  const duration = Number(values.durationSeconds);
  if (!values.durationSeconds.trim() || !Number.isInteger(duration) || duration < 1)
    errors.durationSeconds = 'Duration must be a whole number of seconds (at least 1)';
  else if (duration > 86_400) errors.durationSeconds = 'Duration must be 24 hours or less';
  return errors;
}

/** Reads a video's duration from its metadata, so admins don't have to type it in. */
export function detectVideoDuration(url: string, timeoutMs = 15_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out reading the video'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(Math.round(duration));
      else reject(new Error('Could not determine the video duration'));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load the video from that URL'));
    };
    video.src = url;
  });
}
