import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { migrate } from './migrate.js';
import { pool, withTransaction } from './pool.js';

/**
 * Demo data. Most lessons use short (10s) public sample clips so completion can be
 * demonstrated quickly; a few longer videos exist to demonstrate resume and seeking.
 */
const CLIPS = {
  bunny: { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', duration: 10 },
  jellyfish: { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4', duration: 10 },
  sintel: { url: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4', duration: 10 },
  sintelTrailer: { url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4', duration: 52 },
  bunnyFull: { url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4', duration: 596 },
} as const;

type ClipKey = keyof typeof CLIPS;

interface SeedCourse {
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail: string;
  published: boolean;
  lessons: { title: string; description: string; clip: ClipKey }[];
}

const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/640/360`;

const COURSES: SeedCourse[] = [
  {
    title: 'React Fundamentals',
    description: 'Learn components, props, state and hooks by building small, focused UI pieces from scratch.',
    category: 'Frontend',
    level: 'beginner',
    thumbnail: thumb('react-fundamentals'),
    published: true,
    lessons: [
      { title: 'Why React?', description: 'The problem React solves and how declarative UI works.', clip: 'bunny' },
      { title: 'Components and Props', description: 'Composing UIs from small, reusable pieces.', clip: 'jellyfish' },
      { title: 'State with useState', description: 'Making components interactive.', clip: 'sintel' },
      { title: 'Effects and Data Fetching', description: 'Synchronising with the outside world.', clip: 'sintelTrailer' },
      { title: 'Project: Todo App', description: 'Putting it all together in a small app.', clip: 'bunnyFull' },
    ],
  },
  {
    title: 'TypeScript for JavaScript Developers',
    description: 'Add static types to your JavaScript: interfaces, generics, narrowing and practical patterns.',
    category: 'Programming',
    level: 'intermediate',
    thumbnail: thumb('typescript-course'),
    published: true,
    lessons: [
      { title: 'Types vs Interfaces', description: 'When to use each.', clip: 'jellyfish' },
      { title: 'Narrowing and Unions', description: 'Writing code the compiler can reason about.', clip: 'bunny' },
      { title: 'Generics in Practice', description: 'Reusable, type-safe helpers.', clip: 'sintel' },
    ],
  },
  {
    title: 'Node.js APIs with Express',
    description: 'Design and build a clean REST API with routing, validation, error handling and tests.',
    category: 'Backend',
    level: 'intermediate',
    thumbnail: thumb('node-express-api'),
    published: true,
    lessons: [
      { title: 'Project Structure', description: 'Routes, services and data access.', clip: 'sintel' },
      { title: 'Validation with Zod', description: 'Never trust the client.', clip: 'bunny' },
      { title: 'Centralised Error Handling', description: 'Consistent error responses.', clip: 'jellyfish' },
      { title: 'Testing Endpoints', description: 'Integration tests with Supertest.', clip: 'sintelTrailer' },
    ],
  },
  {
    title: 'PostgreSQL Essentials',
    description: 'Model data with tables, keys and constraints, and write the queries your app actually needs.',
    category: 'Data',
    level: 'beginner',
    thumbnail: thumb('postgres-essentials'),
    published: true,
    lessons: [
      { title: 'Tables and Keys', description: 'Primary keys, foreign keys and relationships.', clip: 'jellyfish' },
      { title: 'Constraints', description: 'Let the database protect your invariants.', clip: 'sintel' },
      { title: 'Joins and Aggregates', description: 'Answering real questions with SQL.', clip: 'bunny' },
    ],
  },
  {
    title: 'Accessible UI Design',
    description: 'Practical accessibility: semantics, keyboard support, focus management and colour contrast.',
    category: 'Design',
    level: 'beginner',
    thumbnail: thumb('accessible-ui'),
    published: true,
    lessons: [
      { title: 'Semantic HTML First', description: 'The foundation of accessible interfaces.', clip: 'bunny' },
      { title: 'Keyboard and Focus', description: 'Making every interaction reachable.', clip: 'jellyfish' },
    ],
  },
  {
    title: 'System Design Basics (Draft)',
    description: 'Caching, queues and scaling fundamentals. Still being written, so it is not visible to learners.',
    category: 'Backend',
    level: 'advanced',
    thumbnail: thumb('system-design'),
    published: false,
    lessons: [{ title: 'Thinking in Trade-offs', description: 'There are no perfect architectures.', clip: 'sintel' }],
  },
];

const USERS = [
  { email: 'admin@touchstone.dev', name: 'Ada Admin', password: 'Admin1234', role: 'admin' },
  { email: 'learner@touchstone.dev', name: 'Lola Learner', password: 'Learner1234', role: 'learner' },
  { email: 'sam@touchstone.dev', name: 'Sam Student', password: 'Learner1234', role: 'learner' },
  { email: 'kemi@touchstone.dev', name: 'Kemi Coder', password: 'Learner1234', role: 'learner' },
] as const;

export async function seed() {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');
  await migrate(false);

  await withTransaction(async (client) => {
    await client.query('TRUNCATE lesson_progress, enrollments, lessons, courses, users RESTART IDENTITY CASCADE');

    const userIds: Record<string, string> = {};
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
        [user.email, user.name, hash, user.role],
      );
      userIds[user.email] = rows[0]!.id;
    }

    const courseLessons: string[][] = [];
    for (const [index, course] of COURSES.entries()) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO courses (title, description, category, level, thumbnail_url, is_published, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(days => $8)) RETURNING id`,
        [
          course.title,
          course.description,
          course.category,
          course.level,
          course.thumbnail,
          course.published,
          userIds['admin@touchstone.dev'],
          COURSES.length - index,
        ],
      );
      const courseId = rows[0]!.id;
      const lessonIds: string[] = [];
      for (const [position, lesson] of course.lessons.entries()) {
        const clip = CLIPS[lesson.clip];
        const result = await client.query<{ id: string }>(
          `INSERT INTO lessons (course_id, title, description, video_url, duration_seconds, position)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [courseId, lesson.title, lesson.description, clip.url, clip.duration, position + 1],
        );
        lessonIds.push(result.rows[0]!.id);
      }
      courseLessons.push(lessonIds);
    }

    // Enrollments + progress so the dashboards have something meaningful to show.
    const enroll = async (email: string, courseIndex: number, completedCount: number, partial?: number) => {
      const userId = userIds[email]!;
      const lessons = courseLessons[courseIndex]!;
      const courseId = (
        await client.query<{ course_id: string }>('SELECT course_id FROM lessons WHERE id = $1', [lessons[0]])
      ).rows[0]!.course_id;
      const done = completedCount >= lessons.length;
      await client.query(
        `INSERT INTO enrollments (user_id, course_id, enrolled_at, completed_at)
         VALUES ($1, $2, now() - interval '5 days', CASE WHEN $3 THEN now() - interval '1 day' END)`,
        [userId, courseId, done],
      );
      for (const lessonId of lessons.slice(0, completedCount)) {
        await client.query(
          `INSERT INTO lesson_progress (user_id, lesson_id, last_position_seconds, completed, completed_at, updated_at)
           SELECT $1, id, duration_seconds, true, now() - interval '2 days', now() - interval '2 days'
           FROM lessons WHERE id = $2`,
          [userId, lessonId],
        );
      }
      const partialLesson = lessons[completedCount];
      if (partial !== undefined && partialLesson) {
        await client.query(
          `INSERT INTO lesson_progress (user_id, lesson_id, last_position_seconds, updated_at)
           VALUES ($1, $2, $3, now() - interval '3 hours')`,
          [userId, partialLesson, partial],
        );
      }
    };

    await enroll('learner@touchstone.dev', 0, 3, 20); // React: 3/5 done, part-way through lesson 4
    await enroll('learner@touchstone.dev', 4, 2); // Accessibility: complete
    await enroll('learner@touchstone.dev', 1, 0); // TypeScript: just enrolled
    await enroll('sam@touchstone.dev', 0, 5); // React: complete
    await enroll('sam@touchstone.dev', 2, 1, 4);
    await enroll('kemi@touchstone.dev', 3, 1);
    await enroll('kemi@touchstone.dev', 0, 1);
  });

  console.log('Seed complete. Demo accounts:');
  for (const user of USERS) console.log(`  ${user.role.padEnd(8)} ${user.email} / ${user.password}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
