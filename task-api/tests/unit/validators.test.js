/**
 * Unit Tests — Input Validators
 *
 * Tests the validation functions used by route handlers to reject
 * malformed or invalid request bodies before they reach the service layer.
 *
 * Covers:
 *   - validateCreateTask: title required, valid status/priority/dueDate
 *   - validateUpdateTask: optional fields, valid constraints, empty title rejection
 *   - validateAssignTask (NEW FEATURE): assignee required, non-empty string validation
 */
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
} = require('../../src/utils/validators');

describe('Validators Unit Tests', () => {
  describe('validateCreateTask', () => {
    test('passes with valid required fields', () => {
      const result = validateCreateTask({ title: 'Finish assignment' });
      expect(result).toBeNull();
    });

    test('passes with valid optional fields', () => {
      const result = validateCreateTask({
        title: 'Review PR',
        description: 'Code review for frontend',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-10-01T12:00:00.000Z',
      });
      expect(result).toBeNull();
    });

    test('fails when body is not an object', () => {
      expect(validateCreateTask(null)).toBe('request body must be an object');
      expect(validateCreateTask('string body')).toBe('request body must be an object');
    });

    test('fails when title is missing', () => {
      const result = validateCreateTask({});
      expect(result).toBe('title is required and must be a non-empty string');
    });

    test('fails when title is not a string', () => {
      const result = validateCreateTask({ title: 12345 });
      expect(result).toBe('title is required and must be a non-empty string');
    });

    test('fails when title is empty string or only whitespace', () => {
      expect(validateCreateTask({ title: '' })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: '   ' })).toBe('title is required and must be a non-empty string');
    });

    test('fails when status is invalid', () => {
      const result = validateCreateTask({ title: 'Task', status: 'invalid_status' });
      expect(result).toBe('status must be one of: todo, in_progress, done');
    });

    test('fails when priority is invalid', () => {
      const result = validateCreateTask({ title: 'Task', priority: 'urgent' });
      expect(result).toBe('priority must be one of: low, medium, high');
    });

    test('fails when dueDate is not a valid date string', () => {
      const result = validateCreateTask({ title: 'Task', dueDate: 'not-a-date' });
      expect(result).toBe('dueDate must be a valid ISO date string');
    });

    test('passes when dueDate is null or undefined', () => {
      expect(validateCreateTask({ title: 'Task', dueDate: null })).toBeNull();
      expect(validateCreateTask({ title: 'Task', dueDate: undefined })).toBeNull();
    });
  });

  describe('validateUpdateTask', () => {
    test('passes with empty object (no updates specified)', () => {
      const result = validateUpdateTask({});
      expect(result).toBeNull();
    });

    test('fails when body is not an object', () => {
      expect(validateUpdateTask(null)).toBe('request body must be an object');
    });

    test('passes with valid partial updates', () => {
      expect(validateUpdateTask({ title: 'Updated title' })).toBeNull();
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
      expect(validateUpdateTask({ dueDate: '2026-12-31T00:00:00.000Z' })).toBeNull();
    });

    test('fails when title is empty string or whitespace', () => {
      expect(validateUpdateTask({ title: '' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: '   ' })).toBe('title must be a non-empty string');
    });

    test('fails when title is not a string', () => {
      expect(validateUpdateTask({ title: null })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: 123 })).toBe('title must be a non-empty string');
    });

    test('fails when status is invalid', () => {
      const result = validateUpdateTask({ status: 'completed' });
      expect(result).toBe('status must be one of: todo, in_progress, done');
    });

    test('fails when priority is invalid', () => {
      const result = validateUpdateTask({ priority: 'critical' });
      expect(result).toBe('priority must be one of: low, medium, high');
    });

    test('fails when dueDate is an invalid date string', () => {
      const result = validateUpdateTask({ dueDate: 'yesterday' });
      expect(result).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('validateAssignTask', () => {
    test('passes with valid assignee string', () => {
      const result = validateAssignTask({ assignee: 'Alice Johnson' });
      expect(result).toBeNull();
    });

    test('fails when body is not an object', () => {
      expect(validateAssignTask(null)).toBe('request body must be an object');
      expect(validateAssignTask(123)).toBe('request body must be an object');
    });

    test('fails when assignee is missing', () => {
      const result = validateAssignTask({});
      expect(result).toBe('assignee is required and must be a non-empty string');
    });

    test('fails when assignee is not a string', () => {
      expect(validateAssignTask({ assignee: 123 })).toBe(
        'assignee is required and must be a non-empty string'
      );
      expect(validateAssignTask({ assignee: null })).toBe(
        'assignee is required and must be a non-empty string'
      );
    });

    test('fails when assignee is empty or whitespace only', () => {
      expect(validateAssignTask({ assignee: '' })).toBe(
        'assignee is required and must be a non-empty string'
      );
      expect(validateAssignTask({ assignee: '   ' })).toBe(
        'assignee is required and must be a non-empty string'
      );
    });
  });
});
