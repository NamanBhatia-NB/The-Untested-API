/**
 * Unit Tests — taskService (Business Logic)
 *
 * Tests the service layer directly without HTTP, verifying each function's
 * behavior in isolation. The in-memory store is reset before each test.
 *
 * Covers:
 *   - create: defaults, custom fields, persistence
 *   - getAll / findById: retrieval and not-found cases
 *   - getByStatus: exact match (verifies bug fix for substring matching)
 *   - getPaginated: 1-indexed pages (verifies bug fix for off-by-one), combined filtering
 *   - getStats: status counts, overdue detection, unrecognised status handling
 *   - update: field merging, immutable field protection (id, createdAt)
 *   - remove: deletion and not-found
 *   - completeTask: status change, timestamp, priority preservation (verifies bug fix)
 *   - assignTask (NEW FEATURE): assign, reassign, not-found
 */
const taskService = require('../../src/services/taskService');

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    test('creates a task with required fields and proper defaults', () => {
      const task = taskService.create({ title: 'New Task' });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('New Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.assignee).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });

    test('creates a task with custom fields provided', () => {
      const task = taskService.create({
        title: 'Important task',
        description: 'Detailed description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-10-15T09:00:00.000Z',
        assignee: 'Alice',
      });

      expect(task.title).toBe('Important task');
      expect(task.description).toBe('Detailed description');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe('2026-10-15T09:00:00.000Z');
      expect(task.assignee).toBe('Alice');
      expect(task.completedAt).toBeNull();
    });

    test('persists task in in-memory array', () => {
      const task = taskService.create({ title: 'Persisted task' });
      const all = taskService.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(task.id);
    });
  });

  describe('getAll', () => {
    test('returns empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    test('returns all created tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      const tasks = taskService.getAll();
      expect(tasks).toHaveLength(3);
      expect(tasks.map((t) => t.title)).toEqual(['Task 1', 'Task 2', 'Task 3']);
    });
  });

  describe('findById', () => {
    test('returns task matching given id', () => {
      const created = taskService.create({ title: 'Find Me' });
      const found = taskService.findById(created.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Find Me');
    });

    test('returns undefined for non-existent id', () => {
      const found = taskService.findById('non-existent-uuid');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
    test('returns tasks filtered by matching status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'todo' });

      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(2);
      expect(todoTasks.map((t) => t.title)).toEqual(['Task 1', 'Task 3']);
    });

    test('returns empty array when no tasks match status', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      expect(taskService.getByStatus('done')).toEqual([]);
    });

    test('should only match exact status, not substring matches', () => {
      taskService.create({ title: 'Todo Task', status: 'todo' });
      taskService.create({ title: 'Done Task', status: 'done' });

      // Exact match test: 'do' should NOT match 'todo' or 'done'
      const matched = taskService.getByStatus('do');
      expect(matched).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({
          title: `Task ${i}`,
          status: i <= 3 ? 'todo' : 'done',
        });
      }
    });

    test('page 1 with limit 2 returns the first 2 tasks (Task 1 and Task 2)', () => {
      const page1 = taskService.getPaginated(1, 2);
      expect(page1).toHaveLength(2);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[1].title).toBe('Task 2');
    });

    test('page 2 with limit 2 returns tasks 3 and 4', () => {
      const page2 = taskService.getPaginated(2, 2);
      expect(page2).toHaveLength(2);
      expect(page2[0].title).toBe('Task 3');
      expect(page2[1].title).toBe('Task 4');
    });

    test('returns remaining tasks on the last partial page', () => {
      const page3 = taskService.getPaginated(3, 2);
      expect(page3).toHaveLength(1);
      expect(page3[0].title).toBe('Task 5');
    });

    test('returns empty array when page is out of bounds', () => {
      const emptyPage = taskService.getPaginated(10, 2);
      expect(emptyPage).toEqual([]);
    });

    test('supports combined status filtering with pagination', () => {
      const todoPage1 = taskService.getPaginated(1, 2, 'todo');
      expect(todoPage1).toHaveLength(2);
      expect(todoPage1[0].title).toBe('Task 1');
      expect(todoPage1[1].title).toBe('Task 2');

      const todoPage2 = taskService.getPaginated(2, 2, 'todo');
      expect(todoPage2).toHaveLength(1);
      expect(todoPage2[0].title).toBe('Task 3');
    });

    test('paginates without status filter when status is omitted (default null)', () => {
      // Exercises the default parameter status=null branch
      const page1 = taskService.getPaginated(1, 3);
      expect(page1).toHaveLength(3);
      expect(page1.map((t) => t.title)).toEqual(['Task 1', 'Task 2', 'Task 3']);
    });

    test('uses all default parameters when called with no arguments', () => {
      // Exercises all 3 default parameter branches: page=1, limit=10, status=null
      const result = taskService.getPaginated();
      expect(result).toHaveLength(5); // all 5 tasks fit within default limit of 10
    });
  });

  describe('getStats', () => {
    test('returns zero counts when store is empty', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });

    test('correctly tallies task counts across statuses', () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'todo' });
      taskService.create({ title: 'Task 3', status: 'in_progress' });
      taskService.create({ title: 'Task 4', status: 'done' });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(2);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(0);
    });

    test('ignores tasks with unrecognized status in counts', () => {
      // Manually create a task with a status not in the counts map.
      // This exercises the false branch of `counts[t.status] !== undefined`.
      const task = taskService.create({ title: 'Rogue task', status: 'todo' });
      // Force an invalid status directly on the returned reference via update
      taskService.update(task.id, { status: 'archived' });

      const stats = taskService.getStats();
      // 'archived' should not crash and should not appear in counts
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
    });

    test('identifies overdue tasks accurately', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Overdue: todo with past dueDate
      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      // Overdue: in_progress with past dueDate
      taskService.create({ title: 'Overdue In Progress', status: 'in_progress', dueDate: pastDate });
      // NOT overdue: completed task with past dueDate
      taskService.create({ title: 'Completed Past', status: 'done', dueDate: pastDate });
      // NOT overdue: todo with future dueDate
      taskService.create({ title: 'Future Todo', status: 'todo', dueDate: futureDate });
      // NOT overdue: task with no dueDate
      taskService.create({ title: 'No Due Date', status: 'todo', dueDate: null });

      const stats = taskService.getStats();
      expect(stats.overdue).toBe(2);
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
    });
  });

  describe('update', () => {
    test('updates existing task fields and returns updated task', () => {
      const task = taskService.create({ title: 'Original Title', priority: 'low' });
      const updated = taskService.update(task.id, {
        title: 'Updated Title',
        priority: 'high',
        status: 'in_progress',
      });

      expect(updated).toBeDefined();
      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
      expect(updated.status).toBe('in_progress');
      expect(updated.id).toBe(task.id);
    });

    test('does not allow overwriting immutable fields id and createdAt', () => {
      const task = taskService.create({ title: 'Protected Task' });
      const originalId = task.id;
      const originalCreatedAt = task.createdAt;

      const updated = taskService.update(task.id, {
        id: 'new-malicious-id',
        createdAt: '1970-01-01T00:00:00.000Z',
        title: 'New safe title',
      });

      expect(updated.id).toBe(originalId);
      expect(updated.createdAt).toBe(originalCreatedAt);
      expect(updated.title).toBe('New safe title');
    });

    test('returns null when updating non-existent id', () => {
      const updated = taskService.update('non-existent-id', { title: 'New Title' });
      expect(updated).toBeNull();
    });
  });

  describe('remove', () => {
    test('removes task and returns true', () => {
      const task = taskService.create({ title: 'To Delete' });
      const result = taskService.remove(task.id);

      expect(result).toBe(true);
      expect(taskService.getAll()).toHaveLength(0);
      expect(taskService.findById(task.id)).toBeUndefined();
    });

    test('returns false when task id does not exist', () => {
      const result = taskService.remove('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('completeTask', () => {
    test('marks task as done and sets completedAt timestamp', () => {
      const task = taskService.create({ title: 'Task to Complete', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).toISOString()).toBe(completed.completedAt);
    });

    test('preserves existing task priority when completing task', () => {
      const task = taskService.create({ title: 'High priority task', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      // Maintains 'high' priority rather than silently resetting to 'medium'
      expect(completed.priority).toBe('high');
    });

    test('is idempotent: preserves original completedAt if already completed', () => {
      const task = taskService.create({ title: 'Already completed' });
      const firstComplete = taskService.completeTask(task.id);
      const originalCompletedAt = firstComplete.completedAt;

      const secondComplete = taskService.completeTask(task.id);
      expect(secondComplete.completedAt).toBe(originalCompletedAt);
    });

    test('returns null when task id does not exist', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('assignTask (New Feature)', () => {
    test('assigns an assignee name to the specified task', () => {
      const task = taskService.create({ title: 'Unassigned task' });
      expect(task.assignee).toBeNull();

      const assigned = taskService.assignTask(task.id, 'Bob Martin');
      expect(assigned).toBeDefined();
      expect(assigned.assignee).toBe('Bob Martin');
      expect(taskService.findById(task.id).assignee).toBe('Bob Martin');
    });

    test('allows reassigning a task to a different user', () => {
      const task = taskService.create({ title: 'Task to reassign', assignee: 'Alice' });
      const reassigned = taskService.assignTask(task.id, 'Charlie');
      expect(reassigned.assignee).toBe('Charlie');
    });

    test('returns null when task id does not exist', () => {
      const result = taskService.assignTask('non-existent-id', 'Nobody');
      expect(result).toBeNull();
    });
  });

  describe('_reset', () => {
    test('clears all tasks in the store', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});
