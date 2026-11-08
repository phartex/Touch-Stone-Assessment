export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface CourseRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A course as shown on a catalog card, including the current user's progress. */
export interface CourseSummary extends CourseRecord {
  lessonCount: number;
  totalDurationSeconds: number;
  enrolled: boolean;
  completedLessons: number;
  progressPercent: number;
}

export interface LessonWithProgress {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationSeconds: number;
  position: number;
  completed: boolean;
  lastPositionSeconds: number;
}

export interface CourseDetail extends CourseSummary {
  enrolledAt: string | null;
  completedAt: string | null;
  lessons: LessonWithProgress[];
  /** The lesson a learner should open next: first incomplete lesson, or the first lesson. */
  nextLessonId: string | null;
}
