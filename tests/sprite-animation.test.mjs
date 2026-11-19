import test from 'node:test';
import assert from 'node:assert/strict';
import { getDamageTextStyle } from '../js/systems/particles.js';
import { ParticleSystem } from '../js/systems/particles.js';
import { getAttackFrame, getHeroStateBlend, getHorizontalAtlasFrame, getGridAtlasFrame, getHitFeedback, getDeathKnightPose, getDragonWingLift, getWarriorVisualPose, getWarriorComboPose, getWarriorCounterPose, getWarriorGuardMotion, getWarriorParryPulse, getWarriorDeathPose, getHeroDeathPose, getMageDeathMotes, getMageCastEffect, getHeroHitPose, Sprite } from '../js/entities/Sprite.js';

test('warrior guards while protected but attacks take visual priority', () => {
    assert.equal(getWarriorVisualPose(false, false), 'idle');
    assert.equal(getWarriorVisualPose(false, true), 'guard');
    assert.equal(getWarriorVisualPose(true, true), 'attack');
    assert.equal(getWarriorVisualPose(true, false), 'attack');
    assert.equal(new Sprite('warrior', 0, 0).isGuarding, false);
});

test('dragon wing motion is smooth, bounded and slower for ancient dragons', () => {
    assert.equal(getDragonWingLift(0), 0);
    assert.equal(getDragonWingLift(Number.NaN), 0);
    for (let frame = 0; frame < 180; frame++) {
        assert.ok(Math.abs(getDragonWingLift(frame)) <= 13);
        assert.ok(Math.abs(getDragonWingLift(frame, true)) <= 19);
    }
    assert.notEqual(getDragonWingLift(20), getDragonWingLift(20, true));
    assert.ok(Math.abs(getDragonWingLift(21) - getDragonWingLift(20)) < 2);
});

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

test('warrior shield raise eases into a stable guard pose', () => {
    assert.deepEqual(getWarriorGuardMotion(-1), { lift: 0, tilt: 0 });
    assert.deepEqual(getWarriorGuardMotion(Number.NaN), { lift: 0, tilt: 0 });
    assert.equal(getWarriorGuardMotion(0).lift, 0);
    assert.ok(getWarriorGuardMotion(4).lift > 0);
    assert.ok(getWarriorGuardMotion(8).lift > getWarriorGuardMotion(4).lift);
    assert.deepEqual(getWarriorGuardMotion(80), getWarriorGuardMotion(8));
});

test('successful parry produces a short bounded visual pulse', () => {
    assert.equal(getWarriorParryPulse(-1), null);
    assert.equal(getWarriorParryPulse(14), null);
    assert.equal(getWarriorParryPulse(Number.NaN), null);
    const first = getWarriorParryPulse(0);
    const middle = getWarriorParryPulse(7);
    assert.equal(first.alpha, 1);
    assert.ok(middle.radius > first.radius);
    assert.ok(middle.alpha < first.alpha);
    assert.ok(getWarriorParryPulse(13).alpha > 0);
});

test('parry animation restarts on a new successful parry', () => {
    const sprite = new Sprite('warrior', 0, 0);
    sprite.startParry(40);
    assert.equal(sprite.parryStartFrame, 40);
    sprite.startParry(47);
    assert.equal(sprite.parryStartFrame, 47);
});

test('warrior defeat animation progresses through stagger, kneel and fall', () => {
    const start = getWarriorDeathPose(0);
    const stagger = getWarriorDeathPose(6);
    const kneel = getWarriorDeathPose(21);
    const fall = getWarriorDeathPose(42);
    const settle = getWarriorDeathPose(63);
    const done = getWarriorDeathPose(72);
    assert.equal(start.rotation, 0);
    assert.ok(Math.abs(stagger.rotation) > 0);
    assert.ok(kneel.offsetY > stagger.offsetY);
    assert.ok(Math.abs(fall.rotation) > Math.abs(kneel.rotation));
    assert.ok(settle.alpha < 1);
    assert.equal(done.active, false);
    assert.equal(getWarriorDeathPose(Number.NaN).active, false);
});

test('sprite death transition clears attack and guard states', () => {
    const sprite = new Sprite('warrior', 10, 20);
    sprite.isAttacking = true;
    sprite.isGuarding = true;
    sprite.beginDeath(90);
    assert.equal(sprite.deathStartFrame, 90);
    assert.equal(sprite.isAttacking, false);
    assert.equal(sprite.isGuarding, false);
    assert.equal(sprite.attackStartFrame, null);
    assert.equal(sprite.guardStartFrame, null);
});

test('mage dissolves upwards while archer falls forward, distinct from warrior', () => {
    const mageStart = getHeroDeathPose('mage', 0);
    const mageMid = getHeroDeathPose('mage', 36);
    const mageEnd = getHeroDeathPose('mage', 72);
    const archerMid = getHeroDeathPose('archer', 36);
    const archerEnd = getHeroDeathPose('archer', 72);
    assert.equal(mageStart.alpha, 1);
    assert.ok(mageMid.offsetY < 0);
    assert.ok(mageMid.alpha < 1);
    assert.equal(mageEnd.alpha, 0);
    assert.equal(mageEnd.active, false);
    assert.ok(archerMid.rotation > 0);
    assert.ok(archerMid.offsetX > 0);
    assert.ok(archerEnd.rotation > 1);
    assert.equal(archerEnd.active, false);
    assert.ok(getWarriorDeathPose(36).rotation < 0);
    assert.equal(getHeroDeathPose('mage', Number.NaN).active, false);
    assert.equal(getHeroDeathPose('archer', -1).active, false);
    assert.deepEqual(getHeroDeathPose('warrior', 36), getWarriorDeathPose(36));
});

test('mage defeat emits deterministic motes that fade out by the end', () => {
    assert.deepEqual(getMageDeathMotes(-1), []);
    assert.deepEqual(getMageDeathMotes(Number.NaN), []);
    assert.deepEqual(getMageDeathMotes(9), []);
    assert.deepEqual(getMageDeathMotes(72), []);
    const early = getMageDeathMotes(20);
    const late = getMageDeathMotes(60);
    assert.equal(early.length, 14);
    assert.deepEqual(getMageDeathMotes(20), early);
    assert.ok(late[0].y < early[0].y);
    assert.ok(late[0].alpha < early[0].alpha);
    assert.ok(early.every(mote => Number.isFinite(mote.x) && Number.isFinite(mote.y)));
});

test('mage cast sigil charges, releases and expires within its animation window', () => {
    assert.equal(getMageCastEffect(-1), null);
    assert.equal(getMageCastEffect(Number.NaN), null);
    assert.equal(getMageCastEffect(28), null);
    const start = getMageCastEffect(0);
    const charged = getMageCastEffect(14);
    const release = getMageCastEffect(24);
    assert.equal(start.progress, 0);
    assert.ok(charged.charge > start.charge);
    assert.ok(charged.radius > start.radius);
    assert.ok(release.alpha < charged.alpha);
    assert.ok(start.alpha > 0);
});

test('hero hit reactions have distinct class silhouettes and expire safely', () => {
    const warrior = getHeroHitPose('warrior', 4);
    const mage = getHeroHitPose('mage', 4);
    const archer = getHeroHitPose('archer', 4);
    assert.equal(warrior.active, true);
    assert.equal(mage.active, true);
    assert.equal(archer.active, true);
    assert.notEqual(warrior.rotation, mage.rotation);
    assert.notEqual(mage.offsetY, archer.offsetY);
    assert.ok(mage.glow > archer.glow);
    assert.equal(getHeroHitPose('mage', 16).active, false);
    assert.equal(getHeroHitPose('archer', Number.NaN).active, false);
    assert.equal(getHeroHitPose('warrior', -1).active, false);
});

test('damage text distinguishes critical hits and elemental damage types', () => {
    const physical = getDamageTextStyle({ damageType: 'physical' });
    const fire = getDamageTextStyle({ damageType: 'fire' });
    const ice = getDamageTextStyle({ damageType: 'ice' });
    const critical = getDamageTextStyle({ isCrit: true, damageType: 'fire' });
    assert.notEqual(physical.color, fire.color);
    assert.notEqual(fire.color, ice.color);
    assert.equal(critical.color, '#ffdf91');
    assert.ok(critical.fontSize > physical.fontSize);
    assert.equal(critical.label, 'КРИТ!');
    assert.equal(getDamageTextStyle({ damageType: 'unknown' }).color, physical.color);
});

test('impact bursts use deterministic radial shards and elemental palettes', () => {
    const system = new ParticleSystem();
    system.createImpactBurst(40, 60, 'ice', true);
    assert.equal(system.particles.length, 22);
    const first = system.particles[0];
    const opposite = system.particles[11];
    assert.equal(first.x, 40);
    assert.equal(first.y, 60);
    assert.ok(first.vx > 0);
    assert.ok(opposite.vx < 0);
    assert.equal(first.color, '#65dfff');
    assert.equal(first.impactShard, true);
    system.update();
    assert.ok(system.particles[0].life < 1);
});

test('normal and critical impact bursts have distinct intensity', () => {
    const system = new ParticleSystem();
    system.createImpactBurst(0, 0, 'physical', false);
    assert.equal(system.particles.length, 10);
    system.particles = [];
    system.createImpactBurst(0, 0, 'physical', true);
    assert.equal(system.particles.length, 22);
    assert.ok(system.particles[0].size >= 3);
});

test('warrior attack presentation has three distinct beats in one unchanged window', () => {
    const first = getWarriorComboPose(4);
    const second = getWarriorComboPose(13);
    const finisher = getWarriorComboPose(23);
    assert.equal(first.phase, 0);
    assert.equal(second.phase, 1);
    assert.equal(finisher.phase, 2);
    assert.equal(getWarriorComboPose(28), null);
    assert.equal(getWarriorComboPose(-1), null);
    assert.equal(getWarriorComboPose(Number.NaN), null);
    assert.equal(getWarriorComboPose(0).scaleX, 1);
    assert.equal(getWarriorComboPose(13).scaleX, -1);
    assert.ok(getWarriorComboPose(23).scaleX > 1);
});

test('warrior counter cue has a short bounded strike and recovery', () => {
    assert.equal(getWarriorCounterPose(-1), null);
    assert.equal(getWarriorCounterPose(18), null);
    assert.equal(getWarriorCounterPose(Number.NaN), null);
    const start = getWarriorCounterPose(0);
    const strike = getWarriorCounterPose(8);
    const recovery = getWarriorCounterPose(15);
    assert.equal(start.offsetX, 0);
    assert.ok(strike.offsetX > start.offsetX);
    assert.ok(strike.radius > start.radius);
    assert.ok(recovery.alpha < strike.alpha);
});

test('successful parry starts only a visual counter cue', () => {
    const sprite = new Sprite('warrior', 0, 0);
    sprite.startCounter(120);
    assert.equal(sprite.counterStartFrame, 120);
    sprite.startCounter(128);
    assert.equal(sprite.counterStartFrame, 128);
});

test('horizontal sprite atlas validation returns exact integer frame rectangles', () => {
    assert.deepEqual(getHorizontalAtlasFrame(512, 128, 4, 0),
        { x: 0, y: 0, width: 128, height: 128 });
    assert.deepEqual(getHorizontalAtlasFrame(512, 128, 4, 3),
        { x: 384, y: 0, width: 128, height: 128 });
    assert.equal(getHorizontalAtlasFrame(510, 128, 4, 0), null);
    assert.equal(getHorizontalAtlasFrame(512, 0, 4, 0), null);
    assert.equal(getHorizontalAtlasFrame(512, 128, 0, 0), null);
    assert.equal(getHorizontalAtlasFrame(512, 128, 4, 4), null);
    assert.equal(getHorizontalAtlasFrame(Number.NaN, 128, 4, 0), null);
});

test('grid atlas validation supports directional rows with exact frame bounds', () => {
    assert.deepEqual(getGridAtlasFrame(512, 512, 4, 4, 0),
        { x: 0, y: 0, width: 128, height: 128 });
    assert.deepEqual(getGridAtlasFrame(512, 512, 4, 4, 6),
        { x: 256, y: 128, width: 128, height: 128 });
    assert.deepEqual(getGridAtlasFrame(512, 512, 4, 4, 15),
        { x: 384, y: 384, width: 128, height: 128 });
    assert.equal(getGridAtlasFrame(510, 512, 4, 4, 0), null);
    assert.equal(getGridAtlasFrame(512, 510, 4, 4, 0), null);
    assert.equal(getGridAtlasFrame(512, 512, 4, 4, 16), null);
    assert.equal(getGridAtlasFrame(512, 512, 0, 4, 0), null);
});

test('hero state blends are bounded and complete without changing action timing', () => {
    assert.equal(getHeroStateBlend(-1), 0);
    assert.equal(getHeroStateBlend(0), 0);
    assert.equal(getHeroStateBlend(2), 0.5);
    assert.equal(getHeroStateBlend(4), 1);
    assert.equal(getHeroStateBlend(100), 1);
    assert.equal(getHeroStateBlend(Number.NaN), 0);
    assert.equal(getHeroStateBlend(2, 0), 0);
});
