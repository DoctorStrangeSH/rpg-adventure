import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectileFx, projectilePosition, getProjectileEffectPhase } from '../js/systems/projectileFx.js';

test('projectile travels between combatants with a bounded arc', () => {
    const start = { x: 20, y: 80 };
    const end = { x: 220, y: 80 };
    assert.deepEqual(projectilePosition(start, end, 0), { ...start, progress: 0 });
    assert.deepEqual(projectilePosition(start, end, 9), { x: 120, y: 62, progress: 0.5 });
    assert.equal(projectilePosition(start, end, 30).x, 220);
    assert.deepEqual(projectilePosition(start, end, Number.NaN), { ...start, progress: 0 });
});

test('projectile effects ignore melee classes and can be cleared between fights', () => {
    const fx = new ProjectileFx();
    fx.launch('warrior', { x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    assert.equal(fx.effects.length, 0);
    fx.launch('mage', { x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    fx.launch('archer', { x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    assert.equal(fx.effects.length, 2);
    fx.clear();
    assert.equal(fx.effects.length, 0);
});

test('expired effects are removed without leaking into later rounds', () => {
    const fx = new ProjectileFx();
    fx.launch('mage', { x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    fx.draw({}, 30);
    assert.equal(fx.effects.length, 0);
});

test('mage elemental projectiles have distinct bounded flight and impact phases', () => {
    assert.equal(getProjectileEffectPhase('fireball', 0), 'flight');
    assert.equal(getProjectileEffectPhase('fireball', 18), 'impact');
    assert.equal(getProjectileEffectPhase('fireball', 30), 'inactive');
    assert.equal(getProjectileEffectPhase('frost_nova', 11), 'flight');
    assert.equal(getProjectileEffectPhase('frost_nova', 12), 'impact');
    assert.equal(getProjectileEffectPhase('frost_nova', 30), 'inactive');
    assert.equal(getProjectileEffectPhase('frost_nova', Number.NaN), 'inactive');
});

test('projectile system accepts mage skill effects and rejects malformed coordinates', () => {
    const fx = new ProjectileFx();
    const source = { x: 2, y: 3 };
    const target = { x: 80, y: 90 };
    fx.launch('fireball', source, target, 10);
    fx.launch('frost_nova', source, target, 10);
    fx.launch('mage', source, target, 10);
    fx.launch('fireball', { x: Number.NaN, y: 0 }, target, 10);
    assert.equal(fx.effects.length, 3);
    fx.draw({}, 40);
    assert.equal(fx.effects.length, 0);
});
