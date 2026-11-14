// Optional encounters between dungeon stages; deterministic rolls are injected
// for regression tests and the outcome is applied exactly once by the caller.
export const ADVENTURE_EVENTS = [
    { id: 'cache', icon: '🎒', name: 'Забытый тайник', description: 'Старый сундук закрыт ржавым замком.',
        choices: [{ id: 'risk', label: 'Вскрыть замок — риск ранения' }, { id: 'safe', label: 'Оставить тайник' }] },
    { id: 'shrine', icon: '✨', name: 'Древнее святилище', description: 'Магический свет может исцелить или обжечь.',
        choices: [{ id: 'risk', label: 'Прикоснуться к алтарю' }, { id: 'safe', label: 'Пройти мимо' }] },
    { id: 'traveler', icon: '🧭', name: 'Заблудившийся торговец', description: 'Странник предлагает рискованную сделку.',
        choices: [{ id: 'risk', label: 'Обменять 20 золота на припасы' }, { id: 'safe', label: 'Отказаться' }] }
];

export function rollAdventureEvent(roll = Math.random()) {
    const value = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
    return ADVENTURE_EVENTS[Math.floor(value * ADVENTURE_EVENTS.length)];
}

export function resolveAdventureEvent(player, eventId, choiceId, roll = Math.random()) {
    const event = ADVENTURE_EVENTS.find(entry => entry.id === eventId);
    if (!player || !event || !event.choices.some(choice => choice.id === choiceId)) return null;
    if (choiceId === 'safe') return { message: 'Вы продолжили путь без происшествий.', gold: 0, health: 0 };
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const lucky = roll < 0.6;
    let gold = 0;
    let health = 0;
    let message = '';
    if (eventId === 'cache') {
        if (lucky) { gold = 40 + Math.max(0, player.level - 1) * 8; message = `В тайнике найдено ${gold} золота!`; }
        else { health = -Math.min(Math.max(0, player.health - 1), 12); message = 'Ловушка задела вас!'; }
    } else if (eventId === 'shrine') {
        if (lucky) { health = Math.min(30, Math.max(0, player.maxHealth - player.health)); message = 'Святилище восстанавливает здоровье!'; }
        else { health = -Math.min(Math.max(0, player.health - 1), 10); message = 'Алтарь обжигает ладони!'; }
    } else if (eventId === 'traveler') {
        if (player.gold < 20) return null;
        gold = -20;
        if (lucky) { health = Math.min(45, Math.max(0, player.maxHealth - player.health)); message = 'Зелье странника помогло!'; }
        else message = 'Зелье оказалось простой водой.';
    }
    player.gold = Math.max(0, player.gold + gold);
    player.health = Math.max(1, Math.min(player.maxHealth, player.health + health));
    return { message, gold, health };
}
