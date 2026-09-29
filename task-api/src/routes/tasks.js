/**
 * Route Handlers — Task API endpoints
 *
 * All routes are mounted under `/tasks` by app.js.
 * Each handler delegates business logic to taskService and validation to validators.
 *
 * Endpoints:
 *   GET    /tasks            — List all tasks (supports ?status=, ?page=, ?limit=)
 *   GET    /tasks/stats      — Aggregate counts by status + overdue count
 *   POST   /tasks            — Create a new task
 *   PUT    /tasks/:id        — Full update of a task
 *   DELETE /tasks/:id        — Delete a task (returns 204 No Content)
 *   PATCH  /tasks/:id/complete — Mark a task as done
 *   PATCH  /tasks/:id/assign   — Assign a task to a user (NEW FEATURE)
 */
const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
} = require('../utils/validators');

/**
 * GET /tasks/stats
 * Returns counts grouped by status ({ todo, in_progress, done, overdue }).
 * Note: This route is defined BEFORE the `/:id` routes to prevent Express
 * from interpreting 'stats' as a task ID parameter.
 */
router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

/**
 * GET /tasks
 * Supports three modes:
 *   1. ?page=N&limit=M           → paginated list (optionally filtered by status)
 *   2. ?status=X                  → filtered list (no pagination)
 *   3. (no query params)          → full list of all tasks
 *
 * When both pagination and status params are present, they combine:
 * e.g. ?status=todo&page=1&limit=5 returns the first 5 todo tasks.
 */
router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  // If pagination params are provided, use paginated fetch (with optional status filter)
  if (page !== undefined || limit !== undefined) {
    const tasks = taskService.getPaginated(page, limit, status || null);
    return res.json(tasks);
  }

  // Filter by status without pagination
  if (status) {
    const tasks = taskService.getByStatus(status);
    return res.json(tasks);
  }

  // Default: return all tasks
  const tasks = taskService.getAll();
  res.json(tasks);
});

/**
 * POST /tasks
 * Creates a new task. Requires `title` in the body.
 * Optional fields: description, status, priority, dueDate.
 * Returns 201 with the created task, or 400 if validation fails.
 */
router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

/**
 * PUT /tasks/:id
 * Full update of an existing task.
 * Returns the updated task (200), 404 if not found, or 400 if validation fails.
 */
router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

/**
 * DELETE /tasks/:id
 * Permanently removes a task. Returns 204 No Content on success, 404 if not found.
 */
router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

/**
 * PATCH /tasks/:id/complete
 * Marks a task as done by setting status='done' and recording completedAt.
 * Returns the updated task (200) or 404 if not found.
 */
router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

/**
 * PATCH /tasks/:id/assign (NEW FEATURE)
 *
 * Assigns a task to a user.
 * Body: { "assignee": "string" }
 *
 * Validation:
 *   - `assignee` must be present, a string, and non-empty after trimming
 *   - The assignee value is trimmed before persisting (e.g. "  Alice  " → "Alice")
 *
 * Design decisions:
 *   - Reassignment is allowed: sending a new name overwrites the current one
 *   - Validation errors (400) are returned before checking task existence (404)
 *     so clients get actionable error messages even with a wrong task ID
 *   - No status restriction: tasks can be assigned regardless of their current status
 *
 * Returns the updated task (200), 400 for invalid body, or 404 if not found.
 */
router.patch('/:id/assign', (req, res) => {
  const error = validateAssignTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  // Trim whitespace from assignee before persisting to prevent UI inconsistencies
  const task = taskService.assignTask(req.params.id, req.body.assignee.trim());
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

module.exports = router;
