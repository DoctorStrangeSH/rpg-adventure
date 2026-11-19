import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectileFx, projectilePosition } from '../js/systems/projectileFx.js';

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
