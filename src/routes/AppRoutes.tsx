import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
const Staff = lazy(() => import('@/pages/public/Staff'));
const SpecialtyDetail = lazy(() => import('@/pages/public/SpecialtyDetail'));
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
const SentMessages = lazy(() => import('@/pages/dashboard/SentMessages'));

const AdminOverview = lazy(() => import('@/pages/admin/Overview'));
const AdminAnnouncements = lazy(() => named(import('@/pages/admin/Content'), 'AdminAnnouncements'));
const AdminMaterials = lazy(() => named(import('@/pages/admin/Content'), 'AdminMaterials'));
const AdminEvents = lazy(() => named(import('@/pages/admin/Content'), 'AdminEvents'));
const AdminSpecialties = lazy(() => named(import('@/pages/admin/Specialties'), 'AdminSpecialties'));
const AdminUsers = lazy(() => named(import('@/pages/admin/People'), 'AdminUsers'));
const AdminMessages = lazy(() => named(import('@/pages/admin/People'), 'AdminMessages'));
const AdminSite = lazy(() => named(import('@/pages/admin/Site'), 'AdminSite'));
const AdminFaq = lazy(() => named(import('@/pages/admin/Site'), 'AdminFaq'));
const AdminFooter = lazy(() => named(import('@/pages/admin/Site'), 'AdminFooter'));
const AdminInbox = lazy(() => named(import('@/pages/admin/Inbox'), 'AdminInbox'));
const AdminTeam = lazy(() => named(import('@/pages/admin/Team'), 'AdminTeam'));
const AdminForms = lazy(() => named(import('@/pages/admin/Forms'), 'AdminForms'));
const AdminFormEditor = lazy(() => named(import('@/pages/admin/FormEditor'), 'AdminFormEditor'));
const AdminFormResponses = lazy(() => named(import('@/pages/admin/FormResponses'), 'AdminFormResponses'));
const StudentForms = lazy(() => import('@/pages/dashboard/Forms'));
const FormSubmission = lazy(() => import('@/pages/dashboard/FormSubmission'));
const FormEntry = lazy(() => import('@/pages/public/FormEntry'));

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
          <Route path="specialties/:code" element={<SpecialtyDetail />} />
          <Route path="staff" element={<Staff />} />
          <Route path="team" element={<Navigate to="/staff" replace />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Şifrə bərpası keçidi istifadəçini müvəqqəti sessiya ilə daxil edir, ona görə GuestOnly xaricindədir */}
        <Route path="reset-password" element={<ResetPassword />} />

        {/* Formun paylaşım linki: giriş tələb etmir. Qonaq ad, soyad və e-poçt yazıb davam edir; məhdud auditoriyalı formlar yenə də giriş istəyir. */}
        <Route element={<PublicLayout />}><Route path="f/:slug" element={<FormEntry />} /></Route>

        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="saved" element={<Saved />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="schedule" element={<PersonalSchedule />} />
            <Route path="forms" element={<StudentForms />} />
            <Route path="forms/:formId" element={<FormSubmission />} />
            <Route path="messages" element={<SentMessages />} />
          </Route>

          <Route element={<RequireRole roles={['admin', 'editor']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="materials" element={<AdminMaterials />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="inbox" element={<AdminInbox />} />
              <Route element={<RequireRole roles={['admin']} />}>
                <Route path="specialties" element={<AdminSpecialties />} />
                <Route path="team" element={<AdminTeam />} />
                <Route path="faq" element={<AdminFaq />} />
                <Route path="footer" element={<AdminFooter />} />
                <Route path="site" element={<AdminSite />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="forms" element={<AdminForms />} />
                <Route path="forms/new" element={<AdminFormEditor />} />
                <Route path="forms/:id" element={<AdminFormEditor />} />
                <Route path="forms/:id/responses" element={<AdminFormResponses />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
      </Routes>
    </Suspense>
  );
}
