import test from 'node:test';
import assert from 'node:assert/strict';
import { drawArenaAtmosphere, getArenaTheme } from '../js/ui/arenaTheme.js';

test('every adventure region receives a distinct stable atmosphere', () => {
    const regions = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    const themes = regions.map(region => getArenaTheme(region));
    assert.equal(new Set(themes.map(theme => theme.top)).size, 4);
    assert.equal(getArenaTheme('unknown'), null);
    assert.equal(getArenaTheme(null, 'ancient_dragon'), themes[3]);
    assert.equal(getArenaTheme('forest', 'dragon'), themes[0]);
});

test('unknown locations leave the original background untouched', () => {
    drawArenaAtmosphere(null, 320, 240, null);
    const calls = [];
    const ctx = {
        save() { calls.push('save'); }, restore() { calls.push('restore'); },
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        fillRect() { calls.push('fill'); }
    };
    drawArenaAtmosphere(ctx, 320, 240, getArenaTheme('forest'), 60);
    assert.deepEqual(calls, ['save', 'fill', 'fill', 'restore']);
});
