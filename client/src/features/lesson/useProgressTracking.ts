import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { api } from '../../lib/api';
import { keys } from '../../lib/queries';
import type { LessonView, ProgressResponse } from '../../lib/types';
import { ProgressSyncer, type ProgressPayload } from './progressSyncer';

/**
 * Connects the video element's events to the progress API. Returns event handlers for the player.
 * Disabled (no-op) when the viewer isn't enrolled, e.g. an admin previewing a lesson.
 */
export function useProgressTracking(lessonId: string, enabled: boolean, onCompleted?: () => void) {
  const qc = useQueryClient();
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const syncer = useMemo(() => {
    const send = async (payload: ProgressPayload) => {
      const result = await api.put<ProgressResponse>(`/lessons/${lessonId}/progress`, payload);
      // Keep the lesson page's sidebar and header in sync without a refetch.
      qc.setQueryData<LessonView>(keys.lesson(lessonId), (view) => {
        if (!view) return view;
        const patch = { completed: result.progress.completed, lastPositionSeconds: result.progress.lastPositionSeconds };
        return {
          ...view,
          lesson: { ...view.lesson, ...patch },
          lessons: view.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
          course: {
            ...view.course,
            completedLessons: result.course.completedLessons,
            progressPercent: result.course.progressPercent,
          },
        };
      });
      // Other screens (course page, dashboard, catalog, other lessons) refetch next time they're viewed.
      void qc.invalidateQueries({ queryKey: keys.course(result.course.id) });
      void qc.invalidateQueries({ queryKey: keys.dashboard });
      void qc.invalidateQueries({ queryKey: ['courses', 'catalog'] });
      void qc.invalidateQueries({
        queryKey: ['lessons'],
        predicate: (query) => query.queryKey[1] !== lessonId,
      });
      if (result.justCompleted) onCompletedRef.current?.();
      return result;
    };
    return new ProgressSyncer(send);
  }, [lessonId, qc]);

  // Save when the tab is hidden or the page unloads, and when navigating away inside the app.
  useEffect(() => {
    if (!enabled) return;
    const sendBeacon = () => {
      const payload = syncer.takeUnsentPayload();
      if (!payload) return;
      void fetch(`/api/lessons/${lessonId}/progress`, {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendBeacon();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', sendBeacon);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', sendBeacon);
      void syncer.flush();
    };
  }, [enabled, lessonId, syncer]);

  return useMemo(
    () => ({
      onTimeUpdate: (time: number) => enabled && syncer.update(time),
      onPause: (time: number) => {
        if (!enabled) return;
        syncer.update(time);
        void syncer.flush();
      },
      onSeeked: (time: number) => enabled && syncer.update(time),
      onEnded: (time: number) => {
        if (!enabled) return;
        syncer.update(time);
        void syncer.flush({ ended: true });
      },
    }),
    [enabled, syncer],
  );
}
