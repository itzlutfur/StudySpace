import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

/**
 * Native OS folder picker.
 *
 * The browser cannot hand the app an absolute path for a chosen folder — the
 * File System Access API and `<input webkitdirectory>` both withhold it. The
 * only way to get a real path out of a real OS dialog is to raise the dialog
 * from the process that can see the filesystem, which is this server.
 *
 * The app binds to loopback only, so the dialog is raised on behalf of the
 * user sitting in front of this machine.
 */

/**
 * Windows: the shell's own "Browse for Folder" dialog, via WinForms.
 * Returns the chosen path on stdout, or exits 1 when the user cancels.
 */
function windowsPicker() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select the course folder'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
  exit 0
}
exit 1
`;
  return {
    command: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
    // A cancelled dialog exits 1; anything else is a real failure.
    cancelledOn: [1],
  };
}

/** macOS: the standard "choose folder" sheet. */
function macPicker() {
  return {
    command: 'osascript',
    args: [
      '-e',
      'POSIX path of (choose folder with prompt "Select the course folder")',
    ],
    cancelledOn: [1],
  };
}

/**
 * Linux: zenity when present, otherwise kdialog. Both are the common
 * desktop-native choices; there is no single portable dialog on Linux.
 */
function linuxPicker() {
  return {
    command: 'zenity',
    args: ['--file-selection', '--directory', '--title=Select the course folder'],
    fallback: {
      command: 'kdialog',
      args: ['--getexistingdirectory', os.homedir()],
    },
    cancelledOn: [1],
  };
}

function pickerForPlatform() {
  if (process.platform === 'win32') return windowsPicker();
  if (process.platform === 'darwin') return macPicker();
  return linuxPicker();
}

/**
 * Run a picker command and resolve with its stdout.
 * Resolves with `null` when the command is missing or the user cancels.
 */
function run(command, args, cancelledOn) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
    } catch {
      resolve(null);
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => finish(null));
    child.on('close', (code) => {
      const trimmed = stdout.trim();
      if (code === 0 && trimmed) {
        finish(trimmed);
        return;
      }
      if (cancelledOn.includes(code)) {
        finish(null);
        return;
      }
      finish({ error: stderr.trim() || `The folder picker exited with code ${code}.` });
    });
  });
}

/**
 * Open the native folder picker and resolve with the chosen absolute path.
 *
 * Resolves with `null` when the user cancels. Rejects when no native dialog
 * is available on this machine.
 */
export async function pickFolder() {
  const picker = pickerForPlatform();

  let result = await run(picker.command, picker.args, picker.cancelledOn);

  // Linux: fall back to kdialog when zenity is not installed.
  if (!result && picker.fallback) {
    result = await run(picker.fallback.command, picker.fallback.args, picker.fallback.cancelledOn ?? [1]);
  }

  if (result === null) return null; // cancelled
  if (result?.error) throw new Error(result.error);

  const chosen = path.resolve(String(result));
  // A dialog can return a trailing separator; the scanner wants a clean path.
  return chosen.length > 1 ? chosen.replace(/[\\/]+$/, '') : chosen;
}

/** True when this machine has a dialog we know how to raise. */
export function nativePickerAvailable() {
  return true;
}

export default { pickFolder, nativePickerAvailable };
