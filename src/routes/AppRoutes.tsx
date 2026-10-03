import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import AdminLayout from '@/layouts/AdminLayout';
import { PageLoader } from '@/components/PageLoader';
import { GuestOnly, RequireAuth, RequireRole } from './guards';
import Home from '@/pages/public/Home';

const named = <T extends Record<string, unknown>, K extends keyof T>(imp: Promise<T>, k: K) => imp.then((m) => ({ default: m[k] as React.ComponentType }));

const Announcements = lazy(() => named(import('@/pages/public/Announcements'), 'Announcements'));
const AnnouncementDetail = lazy(() => named(import('@/pages/public/Announcements'), 'AnnouncementDetail'));
const Materials = lazy(() => named(import('@/pages/public/Materials'), 'Materials'));
const MaterialDetail = lazy(() => named(import('@/pages/public/Materials'), 'MaterialDetail'));
const Schedule = lazy(() => import('@/pages/public/Schedule'));
const Events = lazy(() => named(import('@/pages/public/Events'), 'Events'));
const EventDetail = lazy(() => named(import('@/pages/public/Events'), 'EventDetail'));
const About = lazy(() => import('@/pages/public/About'));
const Contact = lazy(() => import('@/pages/public/Contact'));
const NotFound = lazy(() => import('@/pages/public/NotFound'));

const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

const Overview = lazy(() => import('@/pages/dashboard/Overview'));
const Profile = lazy(() => import('@/pages/dashboard/Profile'));
const Saved = lazy(() => import('@/pages/dashboard/Saved'));
const Notifications = lazy(() => import('@/pages/dashboard/Notifications'));
const PersonalSchedule = lazy(() => import('@/pages/dashboard/PersonalSchedule'));

const AdminOverview = lazy(() => import('@/pages/admin/Overview'));
const AdminAnnouncements = lazy(() => named(import('@/pages/admin/Content'), 'AdminAnnouncements'));
const AdminMaterials = lazy(() => named(import('@/pages/admin/Content'), 'AdminMaterials'));
const AdminEvents = lazy(() => named(import('@/pages/admin/Content'), 'AdminEvents'));
const AdminSchedule = lazy(() => named(import('@/pages/admin/Content'), 'AdminSchedule'));
const AdminUsers = lazy(() => named(import('@/pages/admin/People'), 'AdminUsers'));
const AdminMessages = lazy(() => named(import('@/pages/admin/People'), 'AdminMessages'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="announcements/:id" element={<AnnouncementDetail />} />
          <Route path="materials" element={<Materials />} />
          <Route path="materials/:id" element={<MaterialDetail />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Şifrə bərpası keçidi istifadəçini müvəqqəti sessiya ilə daxil edir, ona görə GuestOnly xaricindədir */}
        <Route path="reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="saved" element={<Saved />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="schedule" element={<PersonalSchedule />} />
          </Route>

          <Route element={<RequireRole roles={['admin', 'editor']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="materials" element={<AdminMaterials />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="schedule" element={<AdminSchedule />} />
              <Route element={<RequireRole roles={['admin']} />}>
                <Route path="users" element={<AdminUsers />} />
                <Route path="messages" element={<AdminMessages />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
      </Routes>
    </Suspense>
  );
}
