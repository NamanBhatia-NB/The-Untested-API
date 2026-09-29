# Bug Report — Task Manager API

Bugs discovered through systematic test writing and code review of the original codebase.

---

## Bug #1: `getPaginated` uses wrong offset calculation (Off-by-one)

**File:** `src/services/taskService.js`, line 12  
**Severity:** High — pagination is broken for all consumers

### What should happen
`getPaginated(1, 2)` on a 5-task store should return the **first 2 tasks** (Task 1, Task 2).  
Page numbers are conventionally 1-indexed from the API consumer's perspective.

### What actually happens
The original code calculates `offset = page * limit`, which means:
- Page 1 → offset 2 (skips the first 2 items, returns items 3–4)
- Page 2 → offset 4 (returns item 5 only)
- Page 3 → offset 6 (returns nothing)

The first page of results is effectively unreachable.

### How I found it
Unit test `getPaginated → page 1 with limit 2` expected `['Task 1', 'Task 2']` but received `['Task 3', 'Task 4']`. The offset was `1 * 2 = 2` instead of the correct `(1 - 1) * 2 = 0`.

### Root cause
```js
// Original (buggy)
const offset = page * limit;

// Should be (1-indexed page convention)
const offset = (page - 1) * limit;
```

### Fix applied
Changed offset formula to `(page - 1) * limit` and added input sanitisation (`Math.max(1, ...)`) so negative or zero pages default safely.

---

## Bug #2: `getByStatus` uses substring matching instead of exact equality

**File:** `src/services/taskService.js`, line 9  
**Severity:** Medium — returns incorrect results for certain filter values

### What should happen
`getByStatus('do')` should return **no tasks** because `'do'` is not a valid status. Only exact status values (`todo`, `in_progress`, `done`) should match.

### What actually happens
The original code uses `t.status.includes(status)` which performs a **substring search**. Filtering by `'do'` incorrectly matches both `'todo'` and `'done'`, since both strings contain the substring `'do'`.

### How I found it
Unit test `getByStatus → should only match exact status` created tasks with statuses `'todo'` and `'done'`, then filtered by `'do'`. Expected `[]`, got both tasks.

### Root cause
```js
// Original (buggy) — substring match
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));

// Should be — exact match
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

### Fix applied
Replaced `.includes()` with strict equality `===`.

---

## Bug #3: `completeTask` silently resets priority to `'medium'`

**File:** `src/services/taskService.js`, lines 67–69  
**Severity:** Medium — data corruption, user-set priority is lost

### What should happen
Completing a task should change `status` to `'done'` and set `completedAt` to the current timestamp. The task's **existing priority should be preserved**.

### What actually happens
The original `completeTask` function spreads the existing task but then **hardcodes** `priority: 'medium'` in the object literal. This silently overwrites whatever priority the task originally had.

### How I found it
Unit test `completeTask → preserves existing task priority` created a task with `priority: 'high'`, completed it, and expected the priority to remain `'high'`. Received `'medium'`.

### Root cause
```js
// Original (buggy) — hardcoded priority override
const updated = {
  ...task,
  priority: 'medium',  // ← This line should not exist
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

### Fix applied
Removed the `priority: 'medium'` line so the spread `...task` preserves the original priority. Also made `completedAt` idempotent — if the task was already completed, the original `completedAt` timestamp is preserved instead of being overwritten on each call.

---

## Bug #4 (Minor): `update` allows overwriting immutable fields (`id`, `createdAt`)

**File:** `src/services/taskService.js`, line 50  
**Severity:** Low — no route currently exposes this, but it's a latent security issue

### What should happen
A `PUT /tasks/:id` request should not be able to change a task's `id` or `createdAt` timestamp.

### What actually happens
The original `update` function does `{ ...tasks[index], ...fields }`, which blindly spreads **all** incoming fields. If a malicious or careless client sends `{ "id": "new-id", "createdAt": "1970-01-01" }`, those fields would be overwritten.

### How I found it
Code review during test writing. While the route-level validators don't explicitly block these fields, the service layer should enforce immutability as a defense-in-depth measure.

### Fix applied
Destructured `id` and `createdAt` out of the incoming `fields` before spreading:
```js
const { id: _id, createdAt: _createdAt, ...allowedUpdates } = fields;
const updated = { ...tasks[index], ...allowedUpdates };
```

---

## Coverage Summary

```
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.57 |    99.07 |   93.54 |   97.33 |
 src             |   69.23 |       75 |       0 |   69.23 |
  app.js         |   69.23 |       75 |       0 |   69.23 | 25-26,33-34
 src/routes      |     100 |      100 |     100 |     100 |
  tasks.js       |     100 |      100 |     100 |     100 |
 src/services    |     100 |      100 |     100 |     100 |
  taskService.js |     100 |      100 |     100 |     100 |
 src/utils       |     100 |      100 |     100 |     100 |
  validators.js  |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|-------------------
Tests:       85 passed, 85 total
```

> **routes, services, and validators are all at 100% coverage.** The only uncovered lines are in `app.js`: the Express error handler middleware (lines 25–26) which can't be triggered without monkey-patching the middleware stack, and the `app.listen` boot block (lines 33–34) which is behind `if (require.main === module)` and is deliberately unreachable during testing.

