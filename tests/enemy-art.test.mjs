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
