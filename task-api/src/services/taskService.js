/**
 * Task Service — Business logic and in-memory data store
 *
 * All task CRUD operations live here. The data store is a simple array
 * that resets on server restart (no database). Each function is a pure
 * operation on the shared `tasks` array.
 *
 * Bugs found and fixed (see BUG_REPORT.md for full details):
 *   1. getPaginated used `page * limit` instead of `(page - 1) * limit` — off-by-one
 *   2. getByStatus used `.includes()` (substring) instead of `===` (exact match)
 *   3. completeTask hardcoded `priority: 'medium'`, silently overwriting existing priority
 *   4. update allowed overwriting immutable fields (`id`, `createdAt`)
 */
const { v4: uuidv4 } = require('uuid');

let tasks = [];

/** Returns a shallow copy of all tasks (prevents external mutation of the store) */
const getAll = () => [...tasks];

/** Finds a single task by its UUID. Returns undefined if not found. */
const findById = (id) => tasks.find((t) => t.id === id);

/**
 * Filters tasks by exact status match.
 *
 * BUG FIX: The original code used `t.status.includes(status)` which does
 * substring matching — e.g. filtering by 'do' would incorrectly match
 * both 'todo' and 'done'. Changed to strict equality `===`.
 */
const getByStatus = (status) => tasks.filter((t) => t.status === status);

/**
 * Returns a paginated slice of tasks (1-indexed pages).
 *
 * BUG FIX: The original code calculated offset as `page * limit`, which
 * made page 1 skip the first `limit` items entirely. Fixed to use
 * `(page - 1) * limit` for correct 1-indexed pagination.
 *
 * Enhancement: Also accepts an optional `status` parameter to combine
 * filtering with pagination in a single call (used when both query params
 * are present, e.g. `?status=todo&page=1&limit=5`).
 *
 * @param {number} page  - 1-indexed page number (defaults to 1)
 * @param {number} limit - items per page (defaults to 10)
 * @param {string|null} status - optional status filter
 * @returns {Array} slice of tasks for the requested page
 */
const getPaginated = (page = 1, limit = 10, status = null) => {
  let source = tasks;
  if (status) {
    source = source.filter((t) => t.status === status);
  }
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const offset = (pageNum - 1) * limitNum;
  return source.slice(offset, offset + limitNum);
};

/**
 * Returns aggregate counts by status and a count of overdue tasks.
 * A task is "overdue" if it has a dueDate in the past and is NOT done.
 */
const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    // Only count statuses we recognise; tasks with invalid statuses are ignored
    if (counts[t.status] !== undefined) counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

/**
 * Creates a new task with sensible defaults.
 * The `assignee` field defaults to null (unassigned) — added for the assign feature.
 */
const create = ({
  title,
  description = '',
  status = 'todo',
  priority = 'medium',
  dueDate = null,
  assignee = null,
}) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

/**
 * Updates a task by merging the provided fields into the existing task.
 *
 * BUG FIX: The original code blindly spread all fields, allowing clients
 * to overwrite immutable fields like `id` and `createdAt`. Now those are
 * destructured out before merging as a defense-in-depth measure.
 */
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  // Strip immutable fields to prevent accidental or malicious overwrites
  const { id: _id, createdAt: _createdAt, ...allowedUpdates } = fields;
  const updated = { ...tasks[index], ...allowedUpdates };
  tasks[index] = updated;
  return updated;
};

/** Removes a task by id. Returns true if found and deleted, false otherwise. */
const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

/**
 * Marks a task as done and records the completion timestamp.
 *
 * BUG FIX: The original code hardcoded `priority: 'medium'` in the update
 * object, which silently reset whatever priority the task originally had.
 * Removed that line so the existing priority is preserved via the spread.
 *
 * Enhancement: Made completedAt idempotent — if the task was already
 * completed, the original timestamp is preserved rather than overwritten.
 */
const completeTask = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const task = tasks[index];
  const updated = {
    ...task,
    status: 'done',
    completedAt: task.completedAt || new Date().toISOString(),
  };

  tasks[index] = updated;
  return updated;
};

/**
 * NEW FEATURE: Assigns a task to a user by storing the assignee name.
 *
 * Design decisions:
 *   - Reassignment is allowed: sending a new name simply overwrites the old one
 *   - The route layer handles validation (non-empty string) and trimming
 *   - Returns null if the task is not found (route responds with 404)
 *
 * @param {string} id       - UUID of the task to assign
 * @param {string} assignee - Name of the person to assign the task to
 * @returns {object|null}   - Updated task object, or null if not found
 */
const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = {
    ...tasks[index],
    assignee,
  };

  tasks[index] = updated;
  return updated;
};

/** Clears the in-memory store. Used by tests to reset state between runs. */
const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
