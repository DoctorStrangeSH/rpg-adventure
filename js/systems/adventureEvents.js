// Optional encounters between dungeon stages; deterministic rolls are injected
// for regression tests and the outcome is applied exactly once by the caller.
import { RELICS } from './relics.js';

export const ADVENTURE_EVENTS = [
    { id: 'cache', icon: '🎒', name: 'Забытый тайник', description: 'Старый сундук закрыт ржавым замком.',
        choices: [{ id: 'risk', label: 'Вскрыть замок — риск ранения' }, { id: 'safe', label: 'Оставить тайник' }] },
    { id: 'moonwell', icon: '🌊', name: 'Лунный источник', description: 'Вода искрится маной, но таит неизвестную силу.',
        choices: [{ id: 'risk', label: 'Напиться — восстановить ману или потерять часть' }, { id: 'safe', label: 'Не трогать воду' }] },
    { id: 'blood_contract', icon: '🩸', name: 'Кровавый договор', description: 'Странная печать обещает сокровища тому, кто рискнёт своей жизнью.',
        choices: [{ id: 'risk', label: 'Коснуться печати — сокровище или рана' }, { id: 'safe', label: 'Разорвать договор' }] },
    { id: 'shrine', icon: '✨', name: 'Древнее святилище', description: 'Магический свет может исцелить или обжечь.',
        choices: [{ id: 'risk', label: 'Прикоснуться к алтарю' }, { id: 'safe', label: 'Пройти мимо' }] },
    { id: 'astral_study', icon: '📜', name: 'Астральная рукопись', description: 'Расшифровка рукописи требует 12 маны и может раскрыть тайник.',
        choices: [{ id: 'risk', label: 'Потратить 12 маны на изучение' }, { id: 'safe', label: 'Закрыть рукопись' }] },
    { id: 'campfire', icon: '🔥', name: 'Привал странников', description: 'За 25 золота путники предлагают лечебные припасы или магический настой.',
        choices: [{ id: 'risk', label: 'Купить припасы за 25 золота' }, { id: 'safe', label: 'Продолжить путь' }] },
    { id: 'vault', icon: '💎', name: 'Запечатанная сокровищница', description: 'За проклятой печатью спрятаны древние реликвии.',
        choices: [{ id: 'risk', label: 'Взломать печать — редкая находка или ловушка' }, { id: 'safe', label: 'Не тревожить печать' }] },
    { id: 'spark_altar', icon: '⚡', name: 'Алтарь искр', description: 'Древний механизм предлагает обменять 15 здоровья на 30 маны. Решение необратимо.',
        choices: [{ id: 'risk', label: 'Отдать 15 здоровья за 30 маны' }, { id: 'safe', label: 'Не трогать механизм' }] },
    { id: 'wounded_traveler', icon: '🩹', name: 'Раненый странник', description: 'Путник просит исцелить его за 18 маны. Взамен он даст 70 золота и защитит героя в трёх следующих боях.',
        choices: [{ id: 'risk', label: 'Исцелить странника — 18 маны → 70 золота' }, { id: 'safe', label: 'Пожелать удачи и уйти' }] },
    { id: 'traveler_return', followUp: true, icon: '🎁', name: 'Возвращение странника', description: 'Спасённый путник догнал героя и принёс целебный отвар в благодарность.',
        choices: [{ id: 'risk', label: 'Принять отвар — восстановить здоровье и ману' }, { id: 'safe', label: 'Поблагодарить и продолжить путь' }] },
    { id: 'traveler', icon: '🧭', name: 'Заблудившийся торговец', description: 'Странник предлагает рискованную сделку.',
        choices: [{ id: 'risk', label: 'Обменять 20 золота на припасы' }, { id: 'safe', label: 'Отказаться' }] }
];

export function getAdventureEvent(eventId) {
    return ADVENTURE_EVENTS.find(event => event.id === eventId) || null;
}

export function rollAdventureEvent(roll = Math.random()) {
    const value = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
    const randomEvents = ADVENTURE_EVENTS.filter(event => !event.followUp);
    return randomEvents[Math.floor(value * randomEvents.length)];
}

// A single source of truth for event costs, shared by the UI and resolver.
export function getAdventureChoiceLock(player, eventId, choiceId) {
    if (!player || choiceId !== 'risk') return null;
    if (eventId === 'astral_study' && player.mana < 12) return 'Нужно 12 маны';
    if (eventId === 'campfire' && player.gold < 25) return 'Нужно 25 золота';
    if (eventId === 'traveler' && player.gold < 20) return 'Нужно 20 золота';
    if (eventId === 'wounded_traveler' && player.mana < 18) return 'Нужно 18 маны';
    if (eventId === 'spark_altar') {
        if (player.health <= 15) return 'Нужно более 15 здоровья';
        if (player.mana >= player.maxMana) return 'Запас маны уже полный';
    }
    return null;
}

export function resolveAdventureEvent(player, eventId, choiceId, roll = Math.random()) {
    const event = ADVENTURE_EVENTS.find(entry => entry.id === eventId);
    if (!player || !event || !event.choices.some(choice => choice.id === choiceId)) return null;
    if (choiceId === 'safe') return { message: 'Вы продолжили путь без происшествий.', gold: 0, health: 0, mana: 0, relicId: null };
    if (getAdventureChoiceLock(player, eventId, choiceId)) return null;
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const lucky = roll < 0.6;
    let gold = 0;
    let health = 0;
    let mana = 0;
    let relicId = null;
    let message = '';
    if (eventId === 'cache') {
        if (lucky) { gold = 40 + Math.max(0, player.level - 1) * 8; message = `В тайнике найдено ${gold} золота!`; }
        else { health = -Math.min(Math.max(0, player.health - 1), 12); message = 'Ловушка задела вас!'; }
    } else if (eventId === 'shrine') {
        if (lucky) { health = Math.min(30, Math.max(0, player.maxHealth - player.health)); message = 'Святилище восстанавливает здоровье!'; }
        else { health = -Math.min(Math.max(0, player.health - 1), 10); message = 'Алтарь обжигает ладони!'; }
    } else if (eventId === 'moonwell') {
        if (lucky) { mana = Math.min(35, Math.max(0, player.maxMana - player.mana)); message = `Источник восстанавливает ${mana} маны!`; }
        else { mana = Math.max(0, player.mana) > 0 ? -Math.min(10, player.mana) : 0; message = 'Вода вытягивает магическую силу!'; }
    } else if (eventId === 'vault') {
        if (lucky) {
            const available = Object.values(RELICS).filter(relic => relic.rarity !== 'common' && !player.relics?.includes(relic.id));
            if (available.length) {
                relicId = available[Math.min(available.length - 1, Math.floor(roll / 0.6 * available.length))].id;
                if (!Array.isArray(player.relics)) player.relics = [];
                player.relics.push(relicId);
                message = `В сокровищнице найдена реликвия «${RELICS[relicId].name}»!`;
            } else {
                gold = 75;
                message = 'Все реликвии уже собраны — внутри оказалось 75 золота!';
            }
        } else { health = -Math.min(Math.max(0, player.health - 1), 18); message = 'Проклятая печать обожгла вас!'; }
    } else if (eventId === 'blood_contract') {
        if (lucky) { gold = 65 + Math.max(0, player.level - 1) * 10; message = `Печать открыла тайник: +${gold} золота!`; }
        else { health = -Math.min(Math.max(0, player.health - 1), 15); message = 'Договор потребовал кровь, а сокровища исчезли!'; }
    } else if (eventId === 'astral_study') {
        if (player.mana < 12) return null;
        mana = -12;
        if (lucky) { gold = 55; message = 'Рукопись указала на тайник с 55 золотыми!'; }
        else { health = -Math.min(Math.max(0, player.health - 1), 8); message = 'Астральное эхо обожгло разум и тело!'; }
    } else if (eventId === 'campfire') {
        if (player.gold < 25) return null;
        gold = -25;
        if (lucky) { health = Math.min(35, Math.max(0, player.maxHealth - player.health)); message = 'Тёплая похлёбка восстановила здоровье!'; }
        else { mana = Math.min(25, Math.max(0, player.maxMana - player.mana)); message = 'Магический настой восстановил ману!'; }
    } else if (eventId === 'spark_altar') {
        // A deliberate trade, not a random roll: never spend HP if the hero
        // cannot afford it or if the mana reward would be wasted.
        if (player.health <= 15 || player.mana >= player.maxMana) return null;
        health = -15;
        mana = Math.min(30, player.maxMana - player.mana);
        message = `Алтарь забрал 15 здоровья и восстановил ${mana} маны.`;
    } else if (eventId === 'wounded_traveler') {
        if (player.mana < 18) return null;
        mana = -18;
        gold = 70;
        message = 'Странник дарит 70 золота и благословляет вас: атака врагов в трёх следующих боях −15%.';
    } else if (eventId === 'traveler_return') {
        health = Math.min(25, Math.max(0, player.maxHealth - player.health));
        mana = Math.min(15, Math.max(0, player.maxMana - player.mana));
        message = `Спасённый странник восстановил ${health} здоровья и ${mana} маны.`;
    } else if (eventId === 'traveler') {
        if (player.gold < 20) return null;
        gold = -20;
        if (lucky) { health = Math.min(45, Math.max(0, player.maxHealth - player.health)); message = 'Зелье странника помогло!'; }
        else message = 'Зелье оказалось простой водой.';
    }
    player.gold = Math.max(0, player.gold + gold);
    player.health = Math.max(1, Math.min(player.maxHealth, player.health + health));
    player.mana = Math.max(0, Math.min(player.maxMana, player.mana + mana));
    return { message, gold, health, mana, relicId };
}
