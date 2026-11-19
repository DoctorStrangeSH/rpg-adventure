import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttackFrame, getHitFeedback, getDeathKnightPose, Sprite } from '../js/entities/Sprite.js';

test('death knight attack has distinct windup, slash, and recovery poses', () => {
    assert.equal(getDeathKnightPose(0, true), 'windup');
    assert.equal(getDeathKnightPose(6, true), 'slash');
    assert.equal(getDeathKnightPose(13, true), 'recovery');
    assert.equal(getDeathKnightPose(20, true), 'idle');
    assert.equal(getDeathKnightPose(7, false), 'idle');
    assert.equal(getDeathKnightPose(Number.NaN, true), 'idle');
});

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

test('hit feedback flashes twice then settles without recoil', () => {
    assert.deepEqual(getHitFeedback(-1), { recoil: 0, flash: false, active: false });
    assert.equal(getHitFeedback(1).flash, true);
    assert.equal(getHitFeedback(6).flash, false);
    assert.equal(getHitFeedback(8).flash, true);
    assert.equal(getHitFeedback(12).flash, false);
    assert.equal(getHitFeedback(16).active, false);
    assert.equal(getHitFeedback(Number.NaN).active, false);
    assert.ok(getHitFeedback(8).recoil > getHitFeedback(2).recoil);
});

test('receiving a second hit restarts the feedback timer', () => {
    const sprite = new Sprite('mage', 100, 200);
    sprite.receiveHit(30);
    assert.equal(sprite.hitStartFrame, 30);
    sprite.receiveHit(34);
    assert.equal(sprite.hitStartFrame, 34);
    assert.equal(getHitFeedback(37 - sprite.hitStartFrame).active, true);
});
