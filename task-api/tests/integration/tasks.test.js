/**
 * Integration Tests — Task API Routes
 *
 * Tests all HTTP endpoints end-to-end using Supertest against the real Express app.
 * Each test verifies correct status codes, response shapes, and data persistence.
 * The in-memory store is reset before each test via taskService._reset() to ensure
 * test isolation — no test depends on the state left by another.
 *
 * Covers:
 *   - GET /tasks (list, filter by status, pagination, combined status+pagination)
 *   - POST /tasks (create with validation)
 *   - PUT /tasks/:id (update with validation)
 *   - DELETE /tasks/:id (delete and 404 handling)
 *   - PATCH /tasks/:id/complete (mark done, priority preservation)
 *   - PATCH /tasks/:id/assign (NEW FEATURE — assign with validation)
 *   - GET /tasks/stats (aggregate counts and overdue detection)
 */
const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

describe('Tasks API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    test('returns 200 and empty list when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns 200 and all tasks', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    test('filters tasks by exact status', async () => {
      taskService.create({ title: 'Todo Task', status: 'todo' });
      taskService.create({ title: 'In Progress Task', status: 'in_progress' });
      taskService.create({ title: 'Done Task', status: 'done' });

      const res = await request(app).get('/tasks?status=in_progress');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('In Progress Task');
    });

    test('paginates tasks with page and limit query params', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService.create({ title: 'Task 3' });

      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');

      const page2 = await request(app).get('/tasks?page=2&limit=2');
      expect(page2.status).toBe(200);
      expect(page2.body).toHaveLength(1);
      expect(page2.body[0].title).toBe('Task 3');
    });

    test('supports combining status filter and pagination', async () => {
      taskService.create({ title: 'Todo 1', status: 'todo' });
      taskService.create({ title: 'Todo 2', status: 'todo' });
      taskService.create({ title: 'Todo 3', status: 'todo' });
      taskService.create({ title: 'Done 1', status: 'done' });

      const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Todo 1');
      expect(res.body[1].title).toBe('Todo 2');
    });

    test('handles fallback defaults for non-numeric pagination parameters', async () => {
      taskService.create({ title: 'Task 1' });
      const res = await request(app).get('/tasks?page=invalid&limit=xyz');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /tasks', () => {
    test('returns 201 and creates task with valid body', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({
          title: 'Implement tests',
          description: 'Writing unit and integration tests',
          priority: 'high',
          dueDate: '2026-11-01T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Implement tests');
      expect(res.body.description).toBe('Writing unit and integration tests');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('todo');
      expect(res.body.dueDate).toBe('2026-11-01T00:00:00.000Z');
      expect(res.body.assignee).toBeNull();
      expect(res.body.completedAt).toBeNull();
      expect(res.body).toHaveProperty('createdAt');
    });

    test('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ description: 'No title provided' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/title is required/);
    });

    test('returns 400 when title is empty string or only whitespace', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title is required/);
    });

    test('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', status: 'unknown_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/status must be one of/);
    });

    test('returns 400 when priority is invalid', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', priority: 'extreme' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/priority must be one of/);
    });

    test('returns 400 when dueDate is invalid format', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Task', dueDate: 'invalid-date-format' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/dueDate must be a valid ISO date/);
    });
  });

  describe('PUT /tasks/:id', () => {
    test('returns 200 and updates task with valid payload', async () => {
      const task = taskService.create({ title: 'Old title', priority: 'low' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({
          title: 'Updated title',
          priority: 'high',
          status: 'in_progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.title).toBe('Updated title');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('in_progress');
    });

    test('returns 404 when updating non-existent task', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-uuid')
        .send({ title: 'New title' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    test('returns 400 when update payload has invalid fields', async () => {
      const task = taskService.create({ title: 'Valid task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: 'super-urgent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/priority must be one of/);
    });

    test('returns 400 when update payload has empty title', async () => {
      const task = taskService.create({ title: 'Valid task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title must be a non-empty string/);
    });
  });

  describe('DELETE /tasks/:id', () => {
    test('returns 204 when deleting existing task', async () => {
      const task = taskService.create({ title: 'Delete me' });

      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      // Verify deletion in store
      expect(taskService.findById(task.id)).toBeUndefined();
    });

    test('returns 404 when deleting non-existent task', async () => {
      const res = await request(app).delete('/tasks/non-existent-uuid');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    test('returns 200 and marks task done with completedAt timestamp while preserving priority', async () => {
      const task = taskService.create({ title: 'Finish work', priority: 'high' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(res.body.priority).toBe('high');
    });

    test('returns 404 when marking non-existent task complete', async () => {
      const res = await request(app).patch('/tasks/non-existent-uuid/complete');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('PATCH /tasks/:id/assign (New Feature)', () => {
    test('returns 200 and assigns task to specified user', async () => {
      const task = taskService.create({ title: 'Implement feature' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Sarah Connor' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Sarah Connor');
    });

    test('returns 200 when reassigning already assigned task', async () => {
      const task = taskService.create({ title: 'Reassign task', assignee: 'Sarah Connor' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'John Doe' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('John Doe');
    });

    test('returns 404 when task does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-uuid/assign')
        .send({ assignee: 'Alice' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    test('returns 400 when assignee is missing from payload', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assignee is required/);
    });

    test('returns 400 when assignee is empty or only whitespace', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assignee is required and must be a non-empty string/);
    });

    test('returns 400 when assignee is not a string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assignee is required and must be a non-empty string/);
    });
  });

  describe('GET /tasks/stats', () => {
    test('returns 200 with stats counts', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      taskService.create({ title: 'Task 1', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Task 2', status: 'in_progress', dueDate: futureDate });
      taskService.create({ title: 'Task 3', status: 'done', dueDate: pastDate });

      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 1,
      });
    });
  });
});
