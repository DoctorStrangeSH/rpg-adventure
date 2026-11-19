import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaBackdropCache, getArenaBackdropPath } from '../js/ui/arenaBackdrop.js';

test('forest and mountains use their own illustrated arenas', () => {
    assert.equal(getArenaBackdropPath('forest'), 'assets/backgrounds/dark-forest.webp');
    assert.equal(getArenaBackdropPath('mountains'), 'assets/backgrounds/forgotten-mountains.webp');
    for (const location of ['ruins', 'dragon_lair', null])
        assert.equal(getArenaBackdropPath(location), 'assets/backgrounds/moonlit-courtyard.webp');
});

test('arena art is cached and gracefully falls back while loading or on error', () => {
    const created = [];
    class FakeImage {
        complete = false;
        naturalWidth = 0;
        naturalHeight = 0;
        set src(path) { this.path = path; created.push(this); }
    }
    const cache = createArenaBackdropCache(FakeImage);
    assert.equal(cache.get('forest'), null);
    assert.equal(created.length, 2); // forest + fallback courtyard
    created[1].complete = true;
    created[1].naturalWidth = 1200;
    created[1].naturalHeight = 800;
    assert.equal(cache.get('forest'), created[1]);
    assert.equal(cache.get('ruins'), created[1]);
    assert.equal(cache.get('mountains'), created[1]);
    assert.equal(created.length, 3); // one image per region + shared fallback
    created[0].complete = true;
    created[0].naturalWidth = 1536;
    created[0].naturalHeight = 1024;
    assert.equal(cache.get('forest'), created[0]);
    assert.equal(created.length, 3);
    assert.equal(createArenaBackdropCache(undefined).get('forest'), null);
});
