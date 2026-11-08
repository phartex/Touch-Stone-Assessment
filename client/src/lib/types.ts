// API response shapes. These mirror the server's types; in a larger project they would live in a
// shared workspace package, but duplicating a small surface keeps the build simple here.

export type Role = 'learner' | 'admin';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

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
  nextLessonId: string | null;
}

export interface LessonView {
  lesson: LessonWithProgress & { videoUrl: string };
  course: {
    id: string;
    title: string;
    category: string;
    lessonCount: number;
    completedLessons: number;
    progressPercent: number;
  };
  enrolled: boolean;
  lessons: LessonWithProgress[];
  prevLessonId: string | null;
  nextLessonId: string | null;
}

export interface ProgressResponse {
  progress: { lessonId: string; lastPositionSeconds: number; completed: boolean; completedAt: string | null };
  justCompleted: boolean;
  course: { id: string; lessonCount: number; completedLessons: number; progressPercent: number; completed: boolean };
}

export interface LearnerDashboard {
  stats: {
    enrolledCourses: number;
    inProgressCourses: number;
    completedCourses: number;
    completedLessons: number;
    minutesWatched: number;
  };
  continueWatching: {
    lessonId: string;
    lessonTitle: string;
    courseId: string;
    courseTitle: string;
    thumbnailUrl: string | null;
    lastPositionSeconds: number;
    durationSeconds: number;
    updatedAt: string;
  }[];
  courses: (CourseSummary & { enrolledAt: string; completedAt: string | null; lastActivityAt: string | null })[];
}

export interface AdminCourseStats {
  id: string;
  title: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  isPublished: boolean;
  lessonCount: number;
  totalDurationSeconds: number;
  enrollmentCount: number;
  completedCount: number;
  avgProgressPercent: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

export interface AdminDashboard {
  totals: {
    learners: number;
    courses: number;
    publishedCourses: number;
    lessons: number;
    enrollments: number;
    completedEnrollments: number;
    activeLearners7d: number;
    completionRatePercent: number;
  };
  courses: AdminCourseStats[];
  recentActivity: {
    userName: string;
    userEmail: string;
    lessonId: string;
    lessonTitle: string;
    courseId: string;
    courseTitle: string;
    completed: boolean;
    lastPositionSeconds: number;
    durationSeconds: number;
    updatedAt: string;
  }[];
}

export interface AdminLesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string;
  durationSeconds: number;
  position: number;
}

export interface AdminLearner {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  enrolledCourses: number;
  completedCourses: number;
  avgProgressPercent: number;
  lastActivityAt: string | null;
}

export interface CourseLearner {
  userId: string;
  name: string;
  email: string;
  enrolledAt: string;
  completedLessons: number;
  lessonCount: number;
  progressPercent: number;
  lastActivityAt: string | null;
}

export interface CourseInput {
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  isPublished?: boolean;
}

export interface LessonInput {
  title: string;
  description: string;
  videoUrl: string;
  durationSeconds: number;
}
