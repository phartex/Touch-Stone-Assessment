import { badRequest, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../lib/types.js';
import { pickNextLesson, progressPercent } from '../progress/progress.logic.js';
import { coursesRepository, type CourseSummaryRow } from './courses.repository.js';
import type { CatalogQuery, CreateCourseInput, UpdateCourseInput } from './courses.schemas.js';
import type { CourseDetail, CourseSummary } from './courses.types.js';

export function toSummary(row: CourseSummaryRow): CourseSummary {
  const { enrolledAt: _e, completedAt: _c, ...rest } = row;
  return { ...rest, progressPercent: progressPercent(row.completedLessons, row.lessonCount) };
}

/** Learners may only see published courses; admins can see drafts too. */
function canView(user: AuthUser, course: { isPublished: boolean }) {
  return course.isPublished || user.role === 'admin';
}

export const coursesService = {
  async listCatalog(user: AuthUser, filters: CatalogQuery): Promise<CourseSummary[]> {
    const rows = await coursesRepository.listPublished(user.id, filters);
    return rows.map(toSummary);
  },

  listCategories() {
    return coursesRepository.listCategories();
  },

  async getDetail(user: AuthUser, courseId: string): Promise<CourseDetail> {
    const row = await coursesRepository.findSummary(user.id, courseId);
    if (!row || !canView(user, row)) throw notFound('Course');
    const lessons = await coursesRepository.listLessonsWithProgress(user.id, courseId);
    return {
      ...toSummary(row),
      enrolledAt: row.enrolledAt,
      completedAt: row.completedAt,
      lessons,
      nextLessonId: pickNextLesson(lessons)?.id ?? null,
    };
  },

  async enroll(user: AuthUser, courseId: string): Promise<CourseDetail> {
    const course = await coursesRepository.findById(courseId);
    // Drafts are invisible to learners, so report them as missing rather than forbidden.
    if (!course || !course.isPublished) throw notFound('Course');
    await coursesRepository.enroll(user.id, courseId);
    return this.getDetail(user, courseId);
  },

  // ----- Admin -----

  async create(user: AuthUser, input: CreateCourseInput) {
    if (input.isPublished) {
      throw badRequest('Add at least one lesson before publishing a course');
    }
    const id = await coursesRepository.create(input, user.id);
    return (await coursesRepository.findById(id))!;
  },

  async update(courseId: string, input: UpdateCourseInput) {
    const course = await coursesRepository.findById(courseId);
    if (!course) throw notFound('Course');
    if (input.isPublished === true && !course.isPublished) {
      const lessonCount = await coursesRepository.countLessons(courseId);
      if (lessonCount === 0) throw badRequest('Add at least one lesson before publishing a course');
    }
    await coursesRepository.update(courseId, input);
    return (await coursesRepository.findById(courseId))!;
  },

  async remove(courseId: string) {
    const deleted = await coursesRepository.remove(courseId);
    if (!deleted) throw notFound('Course');
  },
};
