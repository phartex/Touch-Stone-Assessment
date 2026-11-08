import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { CourseSummary, LessonWithProgress } from '../../lib/types';
import { LessonCard } from '../course/LessonCard';
import { CourseCard } from './CourseCard';

const course: CourseSummary = {
  id: 'c1',
  title: 'React Fundamentals',
  description: 'Learn components and hooks.',
  category: 'Frontend',
  level: 'beginner',
  thumbnailUrl: null,
  isPublished: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lessonCount: 4,
  totalDurationSeconds: 1800,
  enrolled: true,
  completedLessons: 1,
  progressPercent: 25,
};

const lesson: LessonWithProgress = {
  id: 'l1',
  courseId: 'c1',
  title: 'Components and Props',
  description: 'Composing UIs',
  durationSeconds: 100,
  position: 2,
  completed: false,
  lastPositionSeconds: 40,
};

const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProgressBar', () => {
  it('exposes an accessible, clamped value', () => {
    render(<ProgressBar value={140} label="Course progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Course progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('CourseCard', () => {
  it('shows title, category, duration, lesson count and progress for an enrolled course', () => {
    renderWithRouter(<CourseCard course={course} />);
    const card = screen.getByRole('article');
    expect(within(card).getByRole('link', { name: 'React Fundamentals' })).toHaveAttribute('href', '/courses/c1');
    expect(within(card).getByText('Frontend')).toBeInTheDocument();
    expect(within(card).getByText('30 min')).toBeInTheDocument();
    expect(within(card).getByText('4 lessons')).toBeInTheDocument();
    expect(within(card).getByText('In progress')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('invites enrollment and hides progress when not enrolled', () => {
    renderWithRouter(<CourseCard course={{ ...course, enrolled: false, completedLessons: 0, progressPercent: 0 }} />);
    expect(screen.getByText('Enroll to start')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('marks fully completed courses', () => {
    renderWithRouter(<CourseCard course={{ ...course, completedLessons: 4, progressPercent: 100 }} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});

describe('LessonCard', () => {
  it('links to the lesson and shows watch progress for a partially watched lesson', () => {
    renderWithRouter(<LessonCard lesson={lesson} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/lessons/l1');
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('is not a link when locked', () => {
    renderWithRouter(<LessonCard lesson={lesson} locked />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/locked: enroll to watch/)).toBeInTheDocument();
  });

  it('marks the active lesson for assistive tech', () => {
    renderWithRouter(<LessonCard lesson={{ ...lesson, completed: true }} active compact />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
