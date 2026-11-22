import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskScope } from '../js/core/asyncScope.js';

function createFakeTimers() {
    let nextId = 1;
    const callbacks = new Map();
    return {
        callbacks,
        schedule(callback, delay) {
            const id = nextId++;
            callbacks.set(id, { callback, delay });
            return id;
        },
        cancel(id) {
            callbacks.delete(id);
        },
        run(id) {
            const task = callbacks.get(id);
            if (!task) return false;
            callbacks.delete(id);
            task.callback();
            return true;
        }
    };
}

test('runs scheduled tasks and removes completed timers from the scope', () => {
    const timers = createFakeTimers();
    const scope = createTaskScope(timers.schedule, timers.cancel);
    let calls = 0;

    const id = scope.schedule(() => calls++, 250);
    assert.equal(scope.pendingCount, 1);
    assert.equal(timers.callbacks.get(id).delay, 250);
    assert.equal(timers.run(id), true);
    assert.equal(calls, 1);
    assert.equal(scope.pendingCount, 0);
});

test('invalidate cancels pending callbacks before they can mutate a later session', () => {
    const timers = createFakeTimers();
    const scope = createTaskScope(timers.schedule, timers.cancel);
    let oldSessionCalls = 0;
    let newSessionCalls = 0;

    const oldTask = scope.schedule(() => oldSessionCalls++, 500);
    scope.invalidate();
    const newTask = scope.schedule(() => newSessionCalls++, 100);

    assert.equal(timers.callbacks.has(oldTask), false);
    assert.equal(timers.run(oldTask), false);
    assert.equal(timers.run(newTask), true);
    assert.equal(oldSessionCalls, 0);
    assert.equal(newSessionCalls, 1);
    assert.equal(scope.pendingCount, 0);
});

test('invalidate cancels every pending task and can be reused for later sessions', () => {
    const timers = createFakeTimers();
    const scope = createTaskScope(timers.schedule, timers.cancel);
    let calls = 0;

    scope.schedule(() => calls++, 100);
    scope.schedule(() => calls++, 200);
    scope.invalidate();

    assert.equal(scope.pendingCount, 0);
    assert.equal(timers.callbacks.size, 0);
    scope.schedule(() => calls++, 300);
    assert.equal(scope.pendingCount, 1);
    scope.invalidate();
    assert.equal(timers.callbacks.size, 0);
    assert.equal(calls, 0);
});

test('rejects invalid callbacks and timer adapters', () => {
    assert.throws(() => createTaskScope(null, () => {}), /requires timeout/);
    const scope = createTaskScope(() => 1, () => {});
    assert.throws(() => scope.schedule(null), /must be a function/);
});
