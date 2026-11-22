import { Navigate, Route, Routes, useLocation } from 'react-router';

import AppShell from './components/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyCourses from './pages/MyCourses.jsx';
import AddCourse from './pages/AddCourse.jsx';
import CourseRedirect from './pages/CourseRedirect.jsx';
import Player from './pages/Player.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

/**
 * The player is a full-screen layout with its own sticky header, so it
 * renders outside the app shell. Everything else sits inside it.
 */
function isFullScreen(pathname) {
  return pathname.startsWith('/player/');
}

export default function App() {
  const { pathname } = useLocation();

  if (isFullScreen(pathname)) {
    return (
      <Routes>
        <Route path="/player/:lessonId" element={<Player />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses" element={<MyCourses />} />
        <Route path="/courses/add" element={<AddCourse />} />
        <Route path="/courses/:id" element={<CourseRedirect />} />
        <Route path="/settings" element={<Settings />} />
        {/* Legacy paths from before the course page was retired. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
