# Submission Notes

## What I'd test next if I had more time

- **Concurrency / race conditions:** The in-memory store uses a mutable array with no locking. Under concurrent requests, `findIndex` + `splice` or `findIndex` + reassignment could race. I'd write stress tests with parallel Supertest requests to surface this.
- **Input boundary testing:** Very long titles (e.g. 10,000 characters), Unicode/emoji in titles, SQL injection-like payloads in string fields — even though there's no DB, it's good hygiene.
- **Error handler middleware:** The global Express error handler in `app.js` (lines 9–12) is currently uncovered. I'd write a test that forces an unhandled error to verify the 500 response format.
- **Edge cases around dueDate:** Tasks created with a dueDate in the past — should that be allowed? What about timezone handling inconsistencies between server and client?
- **Response shape contracts:** Snapshot tests or schema validation (e.g. with Joi or Zod) to ensure the API response shape doesn't silently drift.
- **Performance testing with large datasets:** getPaginated with 100,000+ tasks to verify `Array.slice` doesn't degrade.

## Anything that surprised me in the codebase

1. **`getByStatus` using `.includes()` for matching** — This was the sneakiest bug. `String.prototype.includes` does substring matching, so filtering by `'do'` would return both `todo` and `done` tasks. It looked correct at first glance since it reads naturally as "filter where status includes the value", but the semantics are wrong for an exact match.

2. **`completeTask` hardcoding `priority: 'medium'`** — This was almost certainly a copy-paste accident. The line `priority: 'medium'` sits right above `status: 'done'`, and silently corrupts the task's priority. There's no test to catch it and no error thrown — the data just quietly changes.

3. **Pagination offset was using `page * limit` instead of `(page - 1) * limit`** — A classic off-by-one. Page 1 would skip the first `limit` items entirely, making the first page of results unreachable.

## Questions I'd ask before shipping this to production

1. **Data persistence:** The in-memory store resets on every restart. Is there a plan for a database? If so, should the service layer be refactored to use a repository pattern now to ease the transition?

2. **Authentication & authorization:** There's no auth. Should tasks be scoped per user? Should the `/assign` endpoint require the caller to have a specific role?

3. **Rate limiting and request size limits:** Express parses JSON bodies with no size cap. Is there a reverse proxy (nginx, API gateway) in front, or should we add `express.json({ limit: '1mb' })` and rate limiting middleware?

4. **Validation strictness:** The validators allow extra fields to pass through silently (e.g. `POST /tasks` with `{ title: "X", foo: "bar" }` succeeds and `foo` is ignored). Should we reject unknown fields to prevent client bugs from going unnoticed?

5. **Status transitions:** Currently any status can be set to any other status. Should there be a state machine (e.g. `todo → in_progress → done`, no going backwards)?

6. **Soft delete vs hard delete:** `DELETE /tasks/:id` permanently removes the task. Should we soft-delete instead for audit trails?

---

## New Feature: `PATCH /tasks/:id/assign`

### Design decisions

- **Validation:** The `assignee` field must be a non-empty string (after trimming). I reject `null`, numbers, empty strings, and whitespace-only strings with a 400 error. This prevents accidentally clearing an assignment or storing garbage data.

- **Reassignment is allowed:** If a task is already assigned to someone, sending a new `assignee` value simply overwrites it. I chose not to require explicit "unassign" because reassignment is the more common workflow. To unassign, a future enhancement could accept `{ "assignee": null }` explicitly.

- **Trimming on save:** The route trims the assignee string before persisting (`req.body.assignee.trim()`), so `"  Alice  "` is stored as `"Alice"`. This prevents UI inconsistencies.

- **404 before 400:** The route validates the payload first (400 if invalid), then checks if the task exists (404). This order means clients get actionable validation errors even if they have the wrong task ID, which is better UX.

- **No status restriction:** I allow assigning tasks regardless of their status (including `done`). A completed task might need reassignment for record-keeping or follow-up.
