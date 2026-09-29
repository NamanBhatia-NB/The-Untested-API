/**
 * Task Manager API — Express Application Entry Point
 *
 * Sets up the Express server with JSON body parsing, task routes,
 * and a global error handler. Exports the app instance for Supertest
 * integration testing (the server only starts when run directly).
 */
const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Mount all task-related routes under the /tasks prefix
app.use('/tasks', taskRoutes);

/**
 * Global error handler — catches unhandled errors thrown in route handlers.
 * Logs the full stack trace server-side and returns a generic 500 response
 * to avoid leaking internal details to the client.
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

// Only start listening when this file is run directly (not when imported by tests)
if (require.main === module) {
  const taskService = require('./services/taskService');

  // Seed sample tasks so the live demo instance has immediate data across cold starts
  const sampleTasks = [
    {
      title: 'Fix legacy migration scripts',
      description: 'Resolve database schema conflicts in v1 to v2 migration',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-08-01T00:00:00.000Z',
      assignee: 'Naman',
    },
    {
      title: 'Audit API security & authentication',
      description: 'Review JWT validation and rate limiting policies across public routes',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-10-15T00:00:00.000Z',
      assignee: 'Sarah',
    },
    {
      title: 'Implement Redis caching for stats endpoint',
      description: 'Cache aggregate metrics to reduce database load under high traffic',
      status: 'in_progress',
      priority: 'medium',
      dueDate: '2026-10-20T00:00:00.000Z',
      assignee: 'Alex',
    },
    {
      title: 'Design Swagger / OpenAPI 3.0 specification',
      description: 'Document all REST endpoints, request payloads, and status codes',
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-10-30T00:00:00.000Z',
      assignee: 'Priya',
    },
    {
      title: 'Optimize PostgreSQL query indexes',
      description: 'Add compound index on status and dueDate for fast pagination',
      status: 'todo',
      priority: 'low',
      dueDate: '2026-11-05T00:00:00.000Z',
    },
    {
      title: 'Set up CI/CD GitHub Actions workflow',
      description: 'Automate linting, unit tests, and coverage reporting on push',
      status: 'done',
      priority: 'high',
      dueDate: '2026-09-25T00:00:00.000Z',
      assignee: 'Alex',
      complete: true,
    },
    {
      title: 'Write unit tests for validators',
      description: 'Ensure boundary testing for title, status, priority, and dates',
      status: 'done',
      priority: 'medium',
      dueDate: '2026-09-28T00:00:00.000Z',
      assignee: 'Naman',
      complete: true,
    },
  ];

  sampleTasks.forEach((item) => {
    const { assignee, complete, ...payload } = item;
    const task = taskService.create(payload);
    if (assignee) taskService.assignTask(task.id, assignee);
    if (complete) taskService.completeTask(task.id);
  });

  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
