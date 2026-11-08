import { z } from 'zod';

const optionalUrl = z
  .union([z.url({ protocol: /^https?$/, message: 'Must be a valid http(s) URL' }), z.literal(''), z.null()])
  .transform((value) => (value ? value : null));

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(50),
  level: z.enum(LEVELS).default('beginner'),
  thumbnailUrl: optionalUrl.optional().transform((v) => v ?? null),
  isPublished: z.boolean().default(false),
});

export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
    category: z.string().trim().min(2, 'Category must be at least 2 characters').max(50),
    level: z.enum(LEVELS),
    thumbnailUrl: optionalUrl,
    isPublished: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const catalogQuerySchema = z.object({
  search: z.string().trim().max(100).optional().transform((v) => v || undefined),
  category: z.string().trim().max(50).optional().transform((v) => v || undefined),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
