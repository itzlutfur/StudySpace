import express from 'express';

import { pickFolder } from '../lib/nativePicker.js';

const router = express.Router();

/**
 * Only one picker may be open at a time.
 *
 * The native dialog is a single shared OS resource, and a second request while
 * one is open would stack a second dialog behind the first with no way for the
 * user to tell which one they are answering. One at a time is the only sane
 * behaviour, so a second request is rejected rather than queued.
 */
let dialogOpen = false;

/**
 * POST /api/pick-folder
 *
 * Opens the operating system's own folder-selection dialog and returns the
 * absolute path of the chosen folder.
 *
 * Response: `{ path }` on success, `{ cancelled: true }` when the user
 * dismisses the dialog, `409` when a dialog is already open.
 */
router.post('/', async (req, res) => {
  if (dialogOpen) {
    return res.status(409).json({
      error: 'A folder picker is already open',
      detail: 'Close the open dialog and try again.',
    });
  }

  dialogOpen = true;
  try {
    const chosen = await pickFolder();
    if (!chosen) {
      return res.json({ cancelled: true });
    }
    return res.json({ path: chosen });
  } catch (err) {
    return res.status(500).json({
      error: 'Could not open the folder picker',
      detail: err?.message ?? String(err),
    });
  } finally {
    dialogOpen = false;
  }
});

export default router;
