import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapCanvasSize, getMapPlayerPosition } from '../js/ui/map.js';

test('map canvas dimensions normalize compact and invalid containers safely', () => {
    assert.deepEqual(getMapCanvasSize(375, 620), { width: 375, height: 620 });
    assert.deepEqual(getMapCanvasSize(320.4, 480.6), { width: 320, height: 481 });
    assert.deepEqual(getMapCanvasSize(0, 0), { width: 1, height: 1 });
    assert.deepEqual(getMapCanvasSize(Number.NaN, Number.POSITIVE_INFINITY), { width: 1, height: 1 });
});

test('player marker coordinates are recalculated from canonical map coordinates at every viewport size', () => {
    assert.deepEqual(getMapPlayerPosition(400, 450), { x: 100, y: 100 });
    assert.deepEqual(getMapPlayerPosition(375, 620), { x: 93.75, y: 137.77777777777777 });
    assert.deepEqual(getMapPlayerPosition(800, 450), { x: 200, y: 100 });
});

test('world map observes container, orientation and visual viewport size changes', () => {
    const source = readFileSync(new URL('../js/ui/map.js', import.meta.url), 'utf8');
    assert.match(source, /new ResizeObserver\(resizeMap\)/);
    assert.match(source, /resizeObserver\.observe\(container\)/);
    assert.match(source, /orientationchange', resizeMap/);
    assert.match(source, /visualViewport, 'resize', resizeMap/);
    assert.match(source, /scaleLocations\(width, height\)/);
});
