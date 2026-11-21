import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDataDir, DB_FILENAME } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

/**
 * Open the database, preferring the built-in node:sqlite (Node 22.5+).
 * Falls back to better-sqlite3 when the built-in module is unavailable.
 */
async function openConnection(file) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    return { conn: new DatabaseSync(file), driver: 'node:sqlite' };
  } catch (err) {
    if (err?.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && !/not supported|Cannot find module/i.test(err?.message ?? '')) {
      throw err;
    }
  }

  let Database;
  try {
    ({ default: Database } = await import('better-sqlite3'));
  } catch {
    throw new Error(
      'No SQLite driver available. Node 22.5+ provides node:sqlite; otherwise run `npm install better-sqlite3`.'
    );
  }
  return { conn: new Database(file), driver: 'better-sqlite3' };
}

/** Initialize the database, create tables, and return the handle. */
export async function initDb() {
  if (db) return db;

  const dir = appDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, DB_FILENAME);

  const { conn, driver } = await openConnection(file);

  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA foreign_keys = ON');
  conn.exec('PRAGMA busy_timeout = 5000');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  conn.exec(schema);

  db = conn;
  db.__driver = driver;
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialised — call initDb() first.');
  return db;
}

/** Run a SELECT returning all rows. */
export function all(sql, params = []) {
  const rows = getDb().prepare(sql).all(...params);
  return rows ?? [];
}

/** Run a SELECT returning the first row (or undefined). */
export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params) ?? undefined;
}

/** Run an INSERT/UPDATE/DELETE. Returns { changes, lastInsertRowid }. */
export function run(sql, params = []) {
  const res = getDb().prepare(sql).run(...params);
  return { changes: Number(res.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
}

/** Execute raw SQL (multiple statements). */
export function exec(sql) {
  getDb().exec(sql);
}

/** Wrap a function in a transaction. */
export function transaction(fn) {
  const handle = getDb();
  if (typeof handle.transaction === 'function') return handle.transaction(fn);
  handle.exec('BEGIN');
  try {
    const out = fn();
    handle.exec('COMMIT');
    return out;
  } catch (err) {
    handle.exec('ROLLBACK');
    throw err;
  }
}

export function closeDb() {
  if (!db) return;
  try {
    db.close();
  } catch {
    /* already closed */
  }
  db = null;
}

export default { initDb, getDb, all, get, run, exec, transaction, closeDb };
