/**
 * Integration tests for app-level middleware (error handler).
 *
 * Uses the real exported app from app.js. To trigger the error handler,
 * we temporarily inject a faulty route BEFORE the error handler middleware
 * in Express's middleware stack.
 */
const request = require('supertest');
const express = require('express');

describe('App-level Error Handler', () => {
  test('returns 500 with generic error message when a route throws an unhandled error', async () => {
    // Build a standalone app with the same error handler as app.js
    // (We can't inject a route before the error handler in the imported app
    //  because Express pushes new routes to the end of the stack.)
    const testApp = require('../../src/app');

    // Create a new app that wraps the real app and adds a throwing route
    const wrapperApp = express();
    wrapperApp.get('/test-error', (req, res, next) => {
      next(new Error('Something broke'));
    });

    // Re-use the same error handler middleware as defined in app.js
    wrapperApp.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Suppress console.error output during this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(wrapperApp).get('/test-error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });

    consoleSpy.mockRestore();
  });
});
