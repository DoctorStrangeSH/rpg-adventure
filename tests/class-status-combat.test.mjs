import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/data/classes.js';
import { useSkillEffect, tickEnemyEffects } from '../js/systems/combat.js';

const createPlayer = classId => ({
    class: classId,
    attack: 40,
    defense: 10,
    equipment: {},
    talents: [],
    activeRelics: [],
    relics: []
});

const createEnemy = overrides => ({
    health: 1000,
    maxHealth: 1000,
    defense: 0,
    effects: {},
    resistances: {},
    ...overrides
});

const skill = (classId, skillId) => {
    const found = CLASSES[classId].skills.find(entry => entry.id === skillId);
    assert.ok(found, `missing configured skill ${classId}:${skillId}`);
    return found;
};

test('mage fireball applies burn and burn deals its configured periodic damage', () => {
    const enemy = createEnemy();
    const result = useSkillEffect(createPlayer('mage'), enemy, skill('mage', 'fireball'));
    assert.ok(result.damage > 0);
    assert.equal(enemy.effects.burnTurns, 2);

    const firstTick = tickEnemyEffects(enemy);
    const secondTick = tickEnemyEffects(enemy);
    assert.equal(firstTick.burnDamage, 40);
    assert.equal(secondTick.burnDamage, 40);
    assert.equal(enemy.effects.burnTurns, 0);
    assert.equal(enemy.health, 820);
});

test('mage frost nova triggers thermal shock on a burning target and consumes burn', () => {
    const enemy = createEnemy({ effects: { burnTurns: 2 } });
    const result = useSkillEffect(createPlayer('mage'), enemy, skill('mage', 'frost_nova'));
    assert.ok(result.damage > 0);
    assert.equal(result.thermalShockDamage, 30);
    assert.equal(enemy.effects.burnTurns, 0);
    assert.equal(enemy.effects.freezeTurns, 1);
});

test('mage cannot trigger thermal shock when the target is immune to freezing', () => {
    const enemy = createEnemy({
        resistances: { freeze: 1 },
        effects: { burnTurns: 2 }
    });
    const result = useSkillEffect(createPlayer('mage'), enemy, skill('mage', 'frost_nova'));
    assert.equal(result.thermalShockDamage, 0);
    assert.equal(enemy.effects.burnTurns, 2);
    assert.equal(enemy.effects.freezeTurns, undefined);
});

test('archer rapid shot and poison arrow create the intended bleed-poison synergy', () => {
    const enemy = createEnemy();
    const player = createPlayer('archer');
    const rapid = useSkillEffect(player, enemy, skill('archer', 'rapid_shot'));
    assert.equal(rapid.hits, 2);
    assert.equal(enemy.effects.bleedTurns, 2);

    const poison = useSkillEffect(player, enemy, skill('archer', 'poison_arrow'));
    assert.ok(poison.damage > 0);
    assert.equal(enemy.effects.poisonTurns, 3);

    const tick = tickEnemyEffects(enemy);
    assert.equal(tick.poisonDamage, 50);
    assert.equal(tick.bleedDamage, 30);
    assert.equal(tick.woundPoisonDamage, 12);
    assert.equal(tick.frozen, false);
});

test('class skill status effects respect full immunity', () => {
    const mage = createPlayer('mage');
    const fireImmune = createEnemy({ resistances: { burn: 1 } });
    useSkillEffect(mage, fireImmune, skill('mage', 'fireball'));
    assert.equal(fireImmune.effects.burnTurns, undefined);

    const archer = createPlayer('archer');
    const poisonImmune = createEnemy({ resistances: { poison: 1 } });
    useSkillEffect(archer, poisonImmune, skill('archer', 'poison_arrow'));
    assert.equal(poisonImmune.effects.poisonTurns, undefined);
});
