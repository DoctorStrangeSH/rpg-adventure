import test from 'node:test';
import assert from 'node:assert/strict';
import { BossSpellFx, getSoulDrainPhase, getFlameBreathPhase } from '../js/systems/bossSpellFx.js';

test('soul drain has bounded, fading visual phases', () => {
    assert.equal(getSoulDrainPhase(-1), null);
    assert.equal(getSoulDrainPhase(30), null);
    assert.equal(getSoulDrainPhase(Number.NaN), null);
    assert.equal(getSoulDrainPhase(0).opacity, 0);
    assert.equal(getSoulDrainPhase(15).opacity, 1);
    assert.ok(getSoulDrainPhase(29).opacity < 1);
});

test('dragon fire breath extends towards the target and fades out', () => {
    assert.equal(getFlameBreathPhase(-1), null);
    assert.equal(getFlameBreathPhase(30), null);
    assert.equal(getFlameBreathPhase(Number.NaN), null);
    assert.equal(getFlameBreathPhase(0).reach, 0);
    assert.equal(getFlameBreathPhase(15).reach, 1);
    assert.ok(getFlameBreathPhase(29).opacity < 1);
});

test('fire breath is tracked as a distinct finite visual effect', () => {
    const effects = new BossSpellFx();
    effects.start('flame_breath', { x: 300, y: 160 }, { x: 100, y: 200 }, 5);
    assert.equal(effects.spells.length, 1);
    assert.equal(effects.spells[0].kind, 'flame_breath');
    effects.draw({}, 35);
    assert.equal(effects.spells.length, 0);
});

test('necromancy effect only starts for siphon and clears between battles', () => {
    const effect = new BossSpellFx();
    const knight = { x: 300, y: 200 };
    const hero = { x: 100, y: 200 };
    effect.start('heavy', knight, hero, 5);
    assert.equal(effect.spells.length, 0);
    effect.start('siphon', knight, hero, 5);
    assert.equal(effect.spells.length, 1);
    assert.deepEqual(effect.spells[0].source, { x: 300, y: 160 });
    effect.draw({}, 35);
    assert.equal(effect.spells.length, 0);
    effect.start('siphon', knight, hero, 40);
    effect.clear();
    assert.equal(effect.spells.length, 0);
});
