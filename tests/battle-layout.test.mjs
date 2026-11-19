import test from 'node:test';
import assert from 'node:assert/strict';
import { getBattlePositions } from '../js/ui/battleLayout.js';

test('narrow canvases keep player and enemy ordered and within bounds', () => {
    for (const width of [240, 280, 320, 400, 960]) {
        const positions = getBattlePositions(width, 300);
        assert.ok(positions.player.x > 0);
        assert.ok(positions.player.x < positions.enemy.x);
        assert.ok(positions.enemy.x < width);
        assert.equal(positions.enemy.x - positions.player.x, Math.round(width * 0.75) - Math.round(width * 0.25));
    }
});

test('bosses are raised without moving the horizontal target positions', () => {
    const normal = getBattlePositions(320, 300);
    const boss = getBattlePositions(320, 300, true);
    assert.equal(boss.player.x, normal.player.x);
    assert.equal(boss.enemy.x, normal.enemy.x);
    assert.equal(boss.enemy.y, 150);
    assert.equal(normal.enemy.y, 200);
});

test('short or uninitialized canvases still yield finite positions', () => {
    const compact = getBattlePositions(280, 145, true);
    assert.equal(compact.player.y, 105);
    assert.equal(compact.enemy.y, 105);
    assert.deepEqual(getBattlePositions(undefined, undefined), {
        player: { x: 100, y: 200 }, enemy: { x: 300, y: 200 }
    });
});
