import dashboardRoutes from './dashboard.js';
import apiCourseRoutes from './api-courses.js';
import pageCourseRoutes from './pages-courses.js';
import playerRoutes from './player.js';
import progressRoutes from './progress.js';
import browseRoutes from './browse.js';
import { getSetting } from '../lib/settings.js';

export function registerRoutes(app) {
  app.use('/', dashboardRoutes);
  app.use('/api/courses', apiCourseRoutes);
  app.use('/courses', pageCourseRoutes);
  app.use('/player', playerRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/browse', browseRoutes);

  // 404 for anything unmatched.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.status(404).render('error', {
      title: 'Not found',
      message: 'That page does not exist.',
      theme: getSetting('theme', 'dark'),
    });
  });

  // Central error handler — never let the process die on a request.
  app.use((err, req, res, _next) => {
    console.error('[coursestream] request error:', err?.message ?? err);
    if (res.headersSent) return;
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: err?.message ?? 'Internal error' });
    }
    res.status(500).render('error', {
      title: 'Something went wrong',
      message: err?.message ?? 'Unexpected error.',
      theme: getSetting('theme', 'dark'),
    });
  });
}

export default registerRoutes;
