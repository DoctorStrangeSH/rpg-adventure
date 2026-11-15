import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttackFrame } from '../js/entities/Sprite.js';

test('hero attacks advance through four bounded animation frames', () => {
    assert.equal(getAttackFrame(0), 0);
    assert.equal(getAttackFrame(6), 0);
    assert.equal(getAttackFrame(7), 1);
    assert.equal(getAttackFrame(14), 2);
    assert.equal(getAttackFrame(21), 3);
    assert.equal(getAttackFrame(999), 3);
});

test('four-frame attacks support a configurable render cadence', () => {
    assert.equal(getAttackFrame(9, 4, 10), 0);
    assert.equal(getAttackFrame(10, 4, 10), 1);
    assert.equal(getAttackFrame(20, 4, 10), 2);
    assert.equal(getAttackFrame(30, 4, 10), 3);
});

test('sprite frame selection handles invalid and negative frame times', () => {
    assert.equal(getAttackFrame(-5), 0);
    assert.equal(getAttackFrame(Number.NaN), 0);
});
