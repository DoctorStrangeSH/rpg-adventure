import test from 'node:test';
import assert from 'node:assert/strict';
import { addEventListenerOnce } from '../js/core/listeners.js';

test('registers the same listener only once for a target and event type', () => {
    const target = new EventTarget();
    let calls = 0;
    const listener = () => calls++;

    assert.equal(addEventListenerOnce(target, 'ping', listener), true);
    assert.equal(addEventListenerOnce(target, 'ping', listener), false);
    target.dispatchEvent(new Event('ping'));
    assert.equal(calls, 1);
});

test('allows independent listeners and event types', () => {
    const target = new EventTarget();
    let firstCalls = 0;
    let secondCalls = 0;
    const first = () => firstCalls++;
    const second = () => secondCalls++;

    assert.equal(addEventListenerOnce(target, 'ping', first), true);
    assert.equal(addEventListenerOnce(target, 'ping', second), true);
    assert.equal(addEventListenerOnce(target, 'pong', first), true);
    target.dispatchEvent(new Event('ping'));
    target.dispatchEvent(new Event('pong'));

    assert.equal(firstCalls, 2);
    assert.equal(secondCalls, 1);
});

test('rejects invalid targets and listener arguments without throwing', () => {
    assert.equal(addEventListenerOnce(null, 'ping', () => {}), false);
    assert.equal(addEventListenerOnce({}, 'ping', () => {}), false);
    assert.equal(addEventListenerOnce(new EventTarget(), '', () => {}), false);
    assert.equal(addEventListenerOnce(new EventTarget(), 'ping', null), false);
});
