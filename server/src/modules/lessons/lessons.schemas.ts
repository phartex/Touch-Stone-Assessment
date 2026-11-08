import { z } from 'zod';

const MAX_DURATION_SECONDS = 24 * 60 * 60;

const videoUrl = z.url({ protocol: /^https?$/, message: 'Video URL must be a valid http(s) URL' }).max(2048);

export const createLessonSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().max(2000).default(''),
  videoUrl,
  durationSeconds: z
    .number({ message: 'Duration is required' })
    .int('Duration must be a whole number of seconds')
    .min(1, 'Duration must be at least 1 second')
    .max(MAX_DURATION_SECONDS, 'Duration must be 24 hours or less'),
  /** 1-based position. Omit to append to the end of the course. */
  position: z.number().int().min(1).optional(),
});

export const updateLessonSchema = createLessonSchema
  .omit({ position: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const reorderLessonsSchema = z.object({
  lessonIds: z.array(z.uuid()).min(1, 'Provide the lessons in their new order'),
});

export const progressSchema = z.object({
  positionSeconds: z.number().finite().min(0).max(MAX_DURATION_SECONDS),
  ended: z.boolean().default(false),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
