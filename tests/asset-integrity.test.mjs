import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const pngAssets = [
    'assets/characters/heroes/warrior-idle.png',
    'assets/characters/heroes/warrior-attack.png',
    'assets/characters/heroes/warrior-guard.png',
    'assets/characters/heroes/mage-idle.png',
    'assets/characters/heroes/mage-attack.png',
    'assets/characters/heroes/archer-idle.png',
    'assets/characters/heroes/archer-attack.png',
    'assets/characters/enemies/skeleton-idle.png',
    'assets/characters/enemies/skeleton-attack.png',
    'assets/characters/enemies/wolf-idle.png',
    'assets/characters/enemies/wolf-attack.png',
    'assets/characters/enemies/goblin-idle.png',
    'assets/characters/enemies/goblin-attack.png'
];

const webpAssets = [
    'assets/backgrounds/moonlit-courtyard.webp',
    'assets/backgrounds/dark-forest.webp',
    'assets/backgrounds/forgotten-mountains.webp',
    'assets/backgrounds/cursed-ruins.webp',
    'assets/backgrounds/dragon-lair.webp'
];

function readAsset(path) {
    return readFileSync(new URL(`../${path}`, import.meta.url));
}

test('all registered character atlases exist and are valid transparent PNG files', () => {
    for (const path of pngAssets) {
        const bytes = readAsset(path);
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path}: PNG signature`);
        assert.ok(bytes.length >= 33, `${path}: PNG payload is not truncated`);
        assert.ok(bytes.readUInt32BE(16) > 0, `${path}: positive width`);
        assert.ok(bytes.readUInt32BE(20) > 0, `${path}: positive height`);
        assert.ok([4, 6].includes(bytes[25]), `${path}: alpha channel is required`);
    }
});

test('all arena backgrounds exist and have a valid WebP container', () => {
    for (const path of webpAssets) {
        const bytes = readAsset(path);
        assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${path}: RIFF signature`);
        assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', `${path}: WEBP signature`);
        assert.ok(bytes.length > 1000, `${path}: background should not be an empty placeholder`);
    }
});

test('registered visual assets do not contain byte-identical duplicates', () => {
    const paths = [...pngAssets, ...webpAssets];
    const hashes = new Map();
    for (const path of paths) {
        const hash = createHash('sha256').update(readAsset(path)).digest('hex');
        assert.ok(!hashes.has(hash), `${path} duplicates ${hashes.get(hash)}`);
        hashes.set(hash, path);
    }
});
