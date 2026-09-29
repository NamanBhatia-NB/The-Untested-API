/**
 * Input Validation Helpers
 *
 * Each validator returns null if the input is valid, or an error message string
 * if validation fails. This convention makes it easy for route handlers to check:
 *   const error = validateCreateTask(req.body);
 *   if (error) return res.status(400).json({ error });
 */

/** Allowed values for the task status field */
const VALID_STATUSES = ['todo', 'in_progress', 'done'];

/** Allowed values for the task priority field */
const VALID_PRIORITIES = ['low', 'medium', 'high'];

/**
 * Validates the request body for creating a new task (POST /tasks).
 * - `title` is required, must be a non-empty string
 * - `status`, `priority`, `dueDate` are optional but must be valid if present
 *
 * @param {object} body - The parsed request body
 * @returns {string|null} Error message or null if valid
 */
const validateCreateTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be an object';
  }
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

/**
 * Validates the request body for updating a task (PUT /tasks/:id).
 * All fields are optional, but if provided they must be valid.
 * Title, if present, must be a non-empty string (prevents accidental blanking).
 *
 * @param {object} body - The parsed request body
 * @returns {string|null} Error message or null if valid
 */
const validateUpdateTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be an object';
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

/**
 * Validates the request body for assigning a task (PATCH /tasks/:id/assign).
 *
 * Design decisions:
 *   - `assignee` must be present and a non-empty string after trimming
 *   - Rejects null, numbers, booleans, empty strings, and whitespace-only strings
 *   - Does NOT reject already-assigned tasks — reassignment is a valid workflow
 *   - Trimming happens in the route layer, not here, to keep validation pure
 *
 * @param {object} body - The parsed request body (expected: { assignee: "string" })
 * @returns {string|null} Error message or null if valid
 */
const validateAssignTask = (body) => {
  if (!body || typeof body !== 'object') {
    return 'request body must be an object';
  }
  if (!body.assignee || typeof body.assignee !== 'string' || body.assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }
  return null;
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
};
