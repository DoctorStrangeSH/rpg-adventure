import test from 'node:test';
import assert from 'node:assert/strict';
import { getItem, getItemsByType } from '../js/data/items.js';
import { CRAFTING_RECIPES } from '../js/systems/crafting.js';
import {
    getEquipmentSetBonuses, getEffectiveCombatStats, triggerWeaponEffect
} from '../js/systems/combat.js';
import {
    getRuneSocketCount, getRuneSynergy, getWeaponRuneBonuses
} from '../js/systems/enchanting.js';
import { LOCATIONS } from '../js/data/locations.js';

const SETS = [
    {
        id: 'emberguard', weapon: 'ember_sword', armor: 'guardian_armor',
        partial: { attack: 0, defense: 2 }, complete: { attack: 6, defense: 2 },
        procRoll: 0.35, proc: 'burn'
    },
    {
        id: 'frostwarden', weapon: 'frost_blade', armor: 'frost_armor',
        partial: { attack: 0, defense: 3 }, complete: { attack: 0, defense: 10 },
        procRoll: 0.23, proc: 'freeze'
    },
    {
        id: 'bloodhunter', weapon: 'blood_dagger', armor: 'blood_armor',
        partial: { attack: 2, defense: 0 }, complete: { attack: 6, defense: 3 },
        procRoll: 0.4, proc: 'bleed'
    }
];

test('all existing equipment sets have a real weapon crafting path and shop-listed armor', () => {
    const shopWeapons = getItemsByType('weapon');
    const shopArmor = getItemsByType('armor');

    for (const set of SETS) {
        const weapon = getItem(set.weapon);
        const armor = getItem(set.armor);
        assert.ok(weapon && armor, `${set.id} pieces must exist in the item catalog`);
        assert.equal(weapon.setId, set.id);
        assert.equal(armor.setId, set.id);
        assert.ok(shopWeapons.some(item => item.id === set.weapon), `${set.weapon} must appear in the weapon shop`);
        assert.ok(shopArmor.some(item => item.id === set.armor), `${set.armor} must appear in the armor shop`);
        assert.ok(CRAFTING_RECIPES.some(recipe => recipe.output === set.weapon),
            `${set.weapon} must be craftable as an alternate acquisition path`);
        assert.ok(Number.isSafeInteger(weapon.requiredLevel || 1));
        assert.ok(Number.isSafeInteger(armor.requiredLevel || 1));
    }
});

test('every set grants its documented partial and complete combat bonuses', () => {
    for (const set of SETS) {
        const player = {
            attack: 20, defense: 10,
            equipment: { weapon: set.weapon, armor: null }
        };
        const partial = getEquipmentSetBonuses(player);
        assert.deepEqual(
            { attack: partial.attack, defense: partial.defense },
            set.partial,
            `${set.id} partial bonus`
        );
        assert.equal(partial.activeSets.length, 0);

        player.equipment.armor = set.armor;
        const complete = getEquipmentSetBonuses(player);
        assert.deepEqual(
            { attack: complete.attack, defense: complete.defense },
            set.complete,
            `${set.id} complete bonus`
        );
        assert.deepEqual(complete.activeSets.map(entry => entry.id), [set.id]);
        const effective = getEffectiveCombatStats(player);
        assert.equal(effective.attack, player.attack + set.complete.attack);
        assert.equal(effective.defense, player.defense + set.complete.defense);
    }
});

test('complete sets improve their matching weapon proc chance by ten percentage points', () => {
    for (const set of SETS) {
        const enemy = () => ({ health: 100, maxHealth: 100, effects: {} });
        const incomplete = {
            equipment: { weapon: set.weapon, armor: null },
            weaponRunes: {}
        };
        const complete = {
            equipment: { weapon: set.weapon, armor: set.armor },
            weaponRunes: {}
        };

        assert.equal(triggerWeaponEffect(incomplete, enemy(), set.procRoll), null,
            `${set.id} must not receive the full-set proc bonus early`);
        const target = enemy();
        assert.equal(triggerWeaponEffect(complete, target, set.procRoll), set.proc,
            `${set.id} full set should cross the boosted proc threshold`);
    }
});

test('rune sockets unlock at the intended upgrade milestones and rune pairs stay deterministic', () => {
    const player = {
        equipment: { weapon: 'iron_sword' },
        itemUpgrades: { iron_sword: 0 }
    };
    assert.equal(getRuneSocketCount(player, 'iron_sword'), 0);
    player.itemUpgrades.iron_sword = 1;
    assert.equal(getRuneSocketCount(player, 'iron_sword'), 1);
    player.itemUpgrades.iron_sword = 4;
    assert.equal(getRuneSocketCount(player, 'iron_sword'), 2);
    player.itemUpgrades.iron_sword = 8;
    assert.equal(getRuneSocketCount(player, 'iron_sword'), 3);

    player.weaponRunes = { iron_sword: ['blood', 'flame'] };
    assert.equal(getRuneSynergy(player).id, 'crimson_flare');
    assert.deepEqual(getWeaponRuneBonuses(player), { attack: 6, defense: 0, critChance: 0 });

    player.weaponRunes.iron_sword = ['frost', 'storm'];
    assert.equal(getRuneSynergy(player).id, 'frozen_tempest');
    assert.deepEqual(getWeaponRuneBonuses(player), { attack: 0, defense: 2, critChance: 0.07 });
});

test('all four regional boss rune materials are guaranteed by their region completion rewards', () => {
    const expected = new Map([
        ['forest', 'rune_verdant_heart'],
        ['mountains', 'rune_dragon_heart'],
        ['ruins', 'rune_lich_soul'],
        ['dragon_lair', 'rune_world_fragment']
    ]);

    for (const [locationId, itemId] of expected) {
        const location = LOCATIONS.find(entry => entry.id === locationId);
        assert.ok(location, `missing region ${locationId}`);
        assert.equal(location.rewards.items.filter(item => item.id === itemId)
            .reduce((sum, item) => sum + item.quantity, 0), 1);
    }
});
