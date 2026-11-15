import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readPngSize(path) {
    const bytes = readFileSync(new URL(path, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
    return {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        colorType: bytes[25]
    };
}

test('gothic skeleton idle has the expected transparent sprite dimensions', () => {
    assert.deepEqual(readPngSize('../assets/characters/enemies/skeleton-idle.png'), {
        width: 600, height: 613, colorType: 6
    });
});

test('gothic skeleton attack atlas has four equal transparent cells', () => {
    const image = readPngSize('../assets/characters/enemies/skeleton-attack.png');
    assert.equal(image.width, 1088);
    assert.equal(image.width / 4, 272);
    assert.equal(image.height, 363);
    assert.equal(image.colorType, 6);
});

test('spectral wolf idle uses the wide quadruped silhouette and alpha', () => {
    assert.deepEqual(readPngSize('../assets/characters/enemies/wolf-idle.png'), {
        width: 960, height: 540, colorType: 6
    });
});

test('spectral wolf pounce atlas has four equal cropped frames', () => {
    const image = readPngSize('../assets/characters/enemies/wolf-attack.png');
    assert.equal(image.width, 1088);
    assert.equal(image.width / 4, 272);
    assert.equal(image.height, 200);
    assert.equal(image.colorType, 6);
});

test('gothic goblin has a transparent idle cutout', () => {
    assert.deepEqual(readPngSize('../assets/characters/enemies/goblin-idle.png'), {
        width: 400, height: 533, colorType: 6
    });
});

test('gothic goblin dagger attack atlas contains four equal cells', () => {
    const image = readPngSize('../assets/characters/enemies/goblin-attack.png');
    assert.equal(image.width, 1088);
    assert.equal(image.width / 4, 272);
    assert.equal(image.height, 363);
    assert.equal(image.colorType, 6);
});

test('death knight boss uses a larger transparent character atlas', () => {
    assert.deepEqual(readPngSize('../assets/characters/enemies/death_knight-idle.png'), {
        width: 570, height: 605, colorType: 6
    });
});

test('death knight sword animation has four alpha frames', () => {
    const image = readPngSize('../assets/characters/enemies/death_knight-attack.png');
    assert.equal(image.width, 1088);
    assert.equal(image.width / 4, 272);
    assert.equal(image.height, 363);
    assert.equal(image.colorType, 6);
});
