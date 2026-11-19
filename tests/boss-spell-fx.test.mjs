import test from 'node:test';
import assert from 'node:assert/strict';
import { BossSpellFx, getSoulDrainPhase } from '../js/systems/bossSpellFx.js';

test('soul drain has bounded, fading visual phases', () => {
    assert.equal(getSoulDrainPhase(-1), null);
    assert.equal(getSoulDrainPhase(30), null);
    assert.equal(getSoulDrainPhase(Number.NaN), null);
    assert.equal(getSoulDrainPhase(0).opacity, 0);
    assert.equal(getSoulDrainPhase(15).opacity, 1);
    assert.ok(getSoulDrainPhase(29).opacity < 1);
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
