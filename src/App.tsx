import { lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import AppRoutes from '@/routes/AppRoutes';

// Sosial İş AI çatı ayrıca (lazy) yüklənir: ilk səhifə yükünə təsir etmir
const ChatWidget = lazy(() => import('@/components/chat/ChatWidget'));

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
              <Suspense fallback={null}><ChatWidget /></Suspense>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
