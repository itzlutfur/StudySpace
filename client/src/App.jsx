import { Routes, Route } from 'react-router';

import TopBar from './components/TopBar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AddCourse from './pages/AddCourse.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import Player from './pages/Player.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <>
      <TopBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/courses/add" element={<AddCourse />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/player/:lessonId" element={<Player />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
