import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import { GuestOnly, RequireAuth } from './components/layout/RouteGuards';
import { AdminCoursesPage } from './features/admin/AdminCoursesPage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminLearnersPage } from './features/admin/AdminLearnersPage';
import { CourseEditorPage } from './features/admin/CourseEditorPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { CourseDetailPage } from './features/course/CourseDetailPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LessonPage } from './features/lesson/LessonPage';
import { NotFoundPage } from './features/NotFoundPage';
import { useAuth } from './lib/auth';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/courses" element={<CatalogPage />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/lessons/:lessonId" element={<LessonPage />} />

          <Route path="/admin" element={<RequireAuth role="admin" />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="courses/new" element={<CourseEditorPage />} />
            <Route path="courses/:courseId" element={<CourseEditorPage />} />
            <Route path="learners" element={<AdminLearnersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
