import fs from 'node:fs';
import path from 'node:path';

import apiCourseRoutes from './api-courses.js';
import apiDashboardRoutes from './api-dashboard.js';
import apiLessonRoutes from './api-lessons.js';
import playerRoutes from './player.js';
import progressRoutes from './progress.js';
import browseRoutes from './browse.js';
import config from '../config.js';

const SPA_INDEX = path.join(config.DIST_DIR, 'index.html');

/** Serve the SPA shell for an unmatched front-end route. */
function sendSpa(res) {
  if (!fs.existsSync(SPA_INDEX)) {
    return res
      .status(503)
      .json({ error: 'The front-end has not been built yet. Run `npm run build`.' });
  }
  res.sendFile(SPA_INDEX);
}

export function registerRoutes(app) {
  app.use('/api/courses', apiCourseRoutes);
  app.use('/api/dashboard', apiDashboardRoutes);
  app.use('/api/lessons', apiLessonRoutes);
  app.use('/player', playerRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/browse', browseRoutes);

  // 404 for anything unmatched.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    sendSpa(res);
  });

  // Central error handler — never let the process die on a request.
  app.use((err, req, res, _next) => {
    console.error('[coursestream] request error:', err?.message ?? err);
    if (res.headersSent) return;
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: err?.message ?? 'Internal error' });
    }
    res.status(500);
    sendSpa(res);
  });
}

export default registerRoutes;
