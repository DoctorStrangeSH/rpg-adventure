// Optional discoveries inside a dungeon run. The caller owns the one-time
// interaction guard, while rewards are resolved here for deterministic tests.
import { grantItem } from './loot.js';
import { RELICS } from './relics.js';

export const SECRET_ROOMS = Object.freeze([
    { id: 'armory', icon: '⚔️', name: 'Забытая оружейная', description: 'За пыльной дверью лежат припасы, но пол может обрушиться.' },
    { id: 'sanctuary', icon: '🕯️', name: 'Тихое убежище', description: 'Древний очаг обещает отдых, но его пламя нестабильно.' },
    { id: 'crypt', icon: '🔮', name: 'Тайный склеп', description: 'Под каменной плитой спрятана реликвия, охраняемая проклятием.' }
]);

export function rollSecretRoom(roll = Math.random()) {
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    return SECRET_ROOMS[Math.floor(roll * SECRET_ROOMS.length)];
}

export function resolveSecretRoom(player, roomId, choice, roll = Math.random()) {
    if (!player || !SECRET_ROOMS.some(room => room.id === roomId) || !['explore', 'leave'].includes(choice)) return null;
    if (choice === 'leave') return { message: 'Вы оставили тайную комнату позади.', itemId: null, relicId: null, health: 0, mana: 0 };
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;

    const success = roll < 0.65;
    let health = 0;
    let mana = 0;
    let itemId = null;
    let relicId = null;
    let message = '';
    if (!success) {
        health = -Math.min(Math.max(0, player.health - 1), roomId === 'crypt' ? 20 : 12);
        message = `Сработала ловушка! Потеряно ${-health} здоровья.`;
    } else if (roomId === 'armory') {
        itemId = roll < 0.3 ? 'big_health_potion' : 'mana_potion';
        if (!grantItem(player, itemId)) return null;
        message = 'В оружейной найден полезный припас!';
    } else if (roomId === 'sanctuary') {
        health = Math.min(40, Math.max(0, player.maxHealth - player.health));
        mana = Math.min(25, Math.max(0, player.maxMana - player.mana));
        message = `Очаг восстанавливает ${health} здоровья и ${mana} маны.`;
    } else {
        const available = Object.values(RELICS).filter(relic => relic.rarity !== 'common' && !player.relics?.includes(relic.id));
        if (available.length) {
            relicId = available[Math.min(available.length - 1, Math.floor(roll / 0.65 * available.length))].id;
            if (!Array.isArray(player.relics)) player.relics = [];
            player.relics.push(relicId);
            message = `Найдена реликвия «${RELICS[relicId].name}»!`;
        } else {
            itemId = 'big_health_potion';
            if (!grantItem(player, itemId)) return null;
            message = 'Реликвии уже собраны. В склепе осталось лечебное зелье.';
        }
    }
    player.health = Math.max(1, Math.min(player.maxHealth, player.health + health));
    player.mana = Math.max(0, Math.min(player.maxMana, player.mana + mana));
    return { message, itemId, relicId, health, mana };
}
