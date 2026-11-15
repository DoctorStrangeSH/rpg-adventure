import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttackFrame } from '../js/entities/Sprite.js';

test('warrior attack advances through four bounded animation frames', () => {
    assert.equal(getAttackFrame(0), 0);
    assert.equal(getAttackFrame(6), 0);
    assert.equal(getAttackFrame(7), 1);
    assert.equal(getAttackFrame(14), 2);
    assert.equal(getAttackFrame(21), 3);
    assert.equal(getAttackFrame(999), 3);
});

test('sprite frame selection handles invalid and negative frame times', () => {
    assert.equal(getAttackFrame(-5), 0);
    assert.equal(getAttackFrame(Number.NaN), 0);
});
