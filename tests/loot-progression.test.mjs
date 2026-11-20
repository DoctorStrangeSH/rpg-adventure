import test from 'node:test';
import assert from 'node:assert/strict';
import { getItem } from '../js/data/items.js';
import { rollLoot, rollDeepChest } from '../js/systems/loot.js';
import {
    awardRelic, toggleRelic, getRelicBonuses, MAX_ACTIVE_RELICS, RELICS
} from '../js/systems/relics.js';

const fixedRoll = value => () => value;

test('ordinary enemy loot uses the documented 18% drop gate and stable pool boundaries', () => {
    const cases = [
        [0, 'ember_sword'],
        [0.050399, 'ember_sword'],
        [0.0504, 'guardian_armor'],
        [0.072, 'blood_dagger'],
        [0.0864, 'big_health_potion'],
        [0.1296, 'mana_potion'],
        [0.18, null],
        [0.999999, null]
    ];

    for (const [roll, expected] of cases) {
        assert.equal(rollLoot(false, fixedRoll(roll)), expected, `ordinary loot roll ${roll}`);
    }
});

test('story boss loot preserves its 18% rune, 47% trophy and 35% fallback bands', () => {
    const cases = [
        [0, 'rune_verdant_heart'],
        [0.179999, 'rune_verdant_heart'],
        [0.18, 'guardian_armor'],
        [0.649999, 'guardian_armor'],
        [0.65, 'big_health_potion'],
        [0.72, 'mana_potion'],
        [1, null]
    ];

    for (const [roll, expected] of cases) {
        assert.equal(rollLoot(true, fixedRoll(roll), 'forest_guardian'), expected,
            `story boss loot roll ${roll}`);
    }
});

test('deep chests only appear at major milestones and their tier boundaries are deterministic', () => {
    assert.equal(rollDeepChest(19, 0), null);
    assert.equal(rollDeepChest(21, 0), null);
    assert.equal(rollDeepChest(20, 0.35), null);
    assert.equal(rollDeepChest(30, 0.45), null);
    assert.equal(rollDeepChest(40, 0.55), null);

    assert.equal(rollDeepChest(20, 0), 'moonblade');
    assert.equal(rollDeepChest(20, 0.35 * 0.7), 'frost_blade');
    assert.equal(rollDeepChest(30, 0.45 * 0.9), 'dragon_sword');
    assert.equal(rollDeepChest(40, 0.55 * 0.75), 'dragon_sword');
    assert.equal(rollDeepChest(60, 0.55 * 0.25), 'frost_blade');
});

test('every possible loot result resolves to a catalog item with valid progression metadata', () => {
    const possibleDrops = [
        'ember_sword', 'guardian_armor', 'blood_dagger',
        'big_health_potion', 'mana_potion',
        'rune_verdant_heart', 'moonblade', 'frost_blade', 'dragon_sword'
    ];

    for (const id of possibleDrops) {
        const item = getItem(id);
        assert.ok(item, `missing loot item: ${id}`);
        if (item.requiredLevel !== undefined) {
            assert.ok(Number.isSafeInteger(item.requiredLevel) && item.requiredLevel >= 1,
                `${id} has an invalid required level`);
        }
    }
});

test('boss relic weighting can reach every rarity, including the legendary tier', () => {
    const player = { relics: [] };
    // The final 3.1% of the weighted boss-drop interval maps to phoenix_crown.
    assert.equal(awardRelic(player, false, true, 0.59), 'phoenix_crown');
    assert.equal(player.relics.includes('phoenix_crown'), true);
    assert.equal(awardRelic({ relics: [] }, false, true, 0.6), null);
});

test('relic collection is unique and no more than two relics can be active', () => {
    const player = {
        relics: ['ash_heart', 'stone_oath', 'eagle_eye'],
        activeRelics: []
    };

    assert.equal(awardRelic(player, true, true, 0.01), null);
    assert.equal(toggleRelic(player, 'ash_heart'), true);
    assert.equal(toggleRelic(player, 'stone_oath'), true);
    assert.equal(toggleRelic(player, 'eagle_eye'), false);
    assert.equal(player.activeRelics.length, MAX_ACTIVE_RELICS);
    assert.equal(getRelicBonuses(player).attack, RELICS.ash_heart.attack);
    assert.equal(toggleRelic(player, 'ash_heart'), true);
    assert.equal(toggleRelic(player, 'eagle_eye'), true);
    assert.deepEqual(player.activeRelics, ['stone_oath', 'eagle_eye']);
});
