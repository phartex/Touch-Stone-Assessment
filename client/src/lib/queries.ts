import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AdminCourseStats,
  AdminDashboard,
  AdminLearner,
  AdminLesson,
  CourseDetail,
  CourseInput,
  CourseLearner,
  CourseRecord,
  CourseSummary,
  LearnerDashboard,
  LessonInput,
  LessonView,
} from './types';

/** Centralised query keys so invalidation stays consistent across the app. */
export const keys = {
  catalog: (filters: { search?: string; category?: string }) => ['courses', 'catalog', filters] as const,
  categories: ['courses', 'categories'] as const,
  course: (id: string) => ['courses', 'detail', id] as const,
  lesson: (id: string) => ['lessons', id] as const,
  dashboard: ['dashboard'] as const,
  admin: {
    all: ['admin'] as const,
    dashboard: ['admin', 'dashboard'] as const,
    courses: ['admin', 'courses'] as const,
    course: (id: string) => ['admin', 'courses', id] as const,
    courseLearners: (id: string) => ['admin', 'courses', id, 'learners'] as const,
    learners: ['admin', 'learners'] as const,
  },
};

// ----- Learner -----

export function useCatalog(filters: { search?: string; category?: string }) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  const qs = params.toString();
  return useQuery({
    queryKey: keys.catalog(filters),
    queryFn: () => api.get<{ courses: CourseSummary[] }>(`/courses${qs ? `?${qs}` : ''}`).then((r) => r.courses),
    placeholderData: (previous) => previous,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<{ categories: string[] }>('/courses/categories').then((r) => r.categories),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: keys.course(id),
    queryFn: () => api.get<{ course: CourseDetail }>(`/courses/${id}`).then((r) => r.course),
  });
}

export function useEnroll(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ course: CourseDetail }>(`/courses/${courseId}/enroll`).then((r) => r.course),
    onSuccess: (course) => {
      qc.setQueryData(keys.course(courseId), course);
      void qc.invalidateQueries({ queryKey: ['courses', 'catalog'] });
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: keys.lesson(id),
    queryFn: () => api.get<LessonView>(`/lessons/${id}`),
    // The player owns playback state; don't refetch (and reset the resume point) on window focus.
    refetchOnWindowFocus: false,
    retry: (count, error) => !('status' in error && (error.status === 403 || error.status === 404)) && count < 2,
  });
}

export function useLearnerDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<LearnerDashboard>('/me/dashboard') });
}

// ----- Admin -----

export function useAdminDashboard() {
  return useQuery({ queryKey: keys.admin.dashboard, queryFn: () => api.get<AdminDashboard>('/admin/dashboard') });
}

export function useAdminCourses() {
  return useQuery({
    queryKey: keys.admin.courses,
    queryFn: () => api.get<{ courses: AdminCourseStats[] }>('/admin/courses').then((r) => r.courses),
  });
}

export function useAdminCourse(id: string | undefined) {
  return useQuery({
    queryKey: keys.admin.course(id ?? 'new'),
    queryFn: () => api.get<{ course: CourseRecord; lessons: AdminLesson[] }>(`/admin/courses/${id}`),
    enabled: Boolean(id),
  });
}

export function useAdminCourseLearners(id: string | undefined) {
  return useQuery({
    queryKey: keys.admin.courseLearners(id ?? 'new'),
    queryFn: () => api.get<{ learners: CourseLearner[] }>(`/admin/courses/${id}/learners`).then((r) => r.learners),
    enabled: Boolean(id),
  });
}

export function useAdminLearners() {
  return useQuery({
    queryKey: keys.admin.learners,
    queryFn: () => api.get<{ learners: AdminLearner[] }>('/admin/learners').then((r) => r.learners),
  });
}

/** Admin content changes affect admin views and the learner-facing catalog. */
function useInvalidateContent() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.admin.all });
    void qc.invalidateQueries({ queryKey: ['courses'] });
    void qc.invalidateQueries({ queryKey: ['lessons'] });
  };
}

export function useSaveCourse(id: string | undefined) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (input: Partial<CourseInput>) =>
      (id
        ? api.patch<{ course: CourseRecord }>(`/admin/courses/${id}`, input)
        : api.post<{ course: CourseRecord }>('/admin/courses', input)
      ).then((r) => r.course),
    onSuccess: invalidate,
  });
}

export function useDeleteCourse() {
  const invalidate = useInvalidateContent();
  return useMutation({ mutationFn: (id: string) => api.delete(`/admin/courses/${id}`), onSuccess: invalidate });
}

export function useSaveLesson(courseId: string) {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LessonInput }) =>
      id ? api.patch(`/admin/lessons/${id}`, input) : api.post(`/admin/courses/${courseId}/lessons`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteLesson() {
  const invalidate = useInvalidateContent();
  return useMutation({ mutationFn: (id: string) => api.delete(`/admin/lessons/${id}`), onSuccess: invalidate });
}

export function useReorderLessons(courseId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (lessonIds: string[]) =>
      api.put<{ lessons: AdminLesson[] }>(`/admin/courses/${courseId}/lessons/order`, { lessonIds }),
    // Optimistic update so reordering feels instant; rolled back on error.
    onMutate: async (lessonIds) => {
      const key = keys.admin.course(courseId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ course: CourseRecord; lessons: AdminLesson[] }>(key);
      if (previous) {
        const byId = new Map(previous.lessons.map((l) => [l.id, l]));
        const lessons = lessonIds.map((id, i) => ({ ...byId.get(id)!, position: i + 1 }));
        qc.setQueryData(key, { ...previous, lessons });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) qc.setQueryData(keys.admin.course(courseId), context.previous);
    },
    onSettled: invalidate,
  });
}
