import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../js/data/locations.js';
import { BOSS_FALLBACKS, Sprite } from '../js/entities/Sprite.js';

test('all location bosses have either their own drawing or a visible fallback', () => {
    const drawn = new Set(['dragon', 'goblin_king', 'death_knight', 'ancient_dragon']);
    for (const location of LOCATIONS.filter(location => location.stages)) {
        const bossIds = location.stages.filter(stage => stage.boss).map(stage => stage.boss.id);
        assert.ok(bossIds.length > 0, `${location.id} has no bosses to check`);
        for (const id of bossIds.filter(Boolean)) {
            assert.ok(drawn.has(id) || drawn.has(BOSS_FALLBACKS[id]), `${id} is not visible`);
        }
    }
});

test('every explicitly aliased boss renders a fallback without throwing', () => {
    const calls = [];
    const ctx = new Proxy({}, {
        get(target, prop) {
            if (prop in target) return target[prop];
            return (...args) => { calls.push(prop); return args; };
        },
        set(target, prop, value) { target[prop] = value; return true; }
    });
    for (const boss of Object.keys(BOSS_FALLBACKS)) {
        new Sprite(boss, 100, 200).draw(ctx, 10);
    }
    assert.ok(calls.includes('fill'));
    assert.ok(calls.includes('scale'));
});
