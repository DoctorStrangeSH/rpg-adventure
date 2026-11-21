// Экран персонажа
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { SoundSystem } from '../systems/sound.js';
import { applyExperience } from '../systems/progression.js';
import { escapeHtml } from '../core/html.js';
import { createPlayerSnapshot, commitPlayerMutation } from '../systems/playerTransactions.js';
import { TALENTS, getTalentPoints, getTalentAvailability, unlockTalent } from '../systems/talents.js';
import { getEffectiveCombatStats } from '../systems/combat.js';
import { RELICS, RELIC_RARITIES, MAX_ACTIVE_RELICS, getActiveRelicSynergies, toggleRelic } from '../systems/relics.js';

export function updateCharacterScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('character-content');
    const classData = CLASSES[player.class];
    const combatStats = getEffectiveCombatStats(player);
    
    content.innerHTML = `
        <div class="character-header">
            <div class="character-avatar">${classData.icon}</div>
            <div class="character-info">
                <h3>${escapeHtml(player.username)}</h3>
                <p>${classData.name} • Уровень ${player.level}</p>
                <p style="color: var(--gold);">💰 ${player.gold} золота</p>
            </div>
        </div>
        
        <div class="stats-container">
            ${createStatBar('❤️ Здоровье', player.health, player.maxHealth, 'health')}
            ${createStatBar('💙 Мана', player.mana, player.maxMana, 'mana')}
            ${createStatBar('✨ Опыт', player.experience, player.maxExperience, 'exp')}
        </div>
        
        <div class="section-title">⚔️ Атрибуты</div>
        <div class="attributes-grid">
            ${createAttributeCard('⚔️', 'Атака', combatStats.attack)}
            ${createAttributeCard('🛡️', 'Защита', combatStats.defense)}
            ${createAttributeCard('💨', 'Скорость', player.speed)}
            ${createAttributeCard('⭐', 'Уровень', player.level)}
        </div>

        <div class="section-title">🌟 Таланты • свободных очков: ${getTalentPoints(player)}</div>
        <div class="skills-section">
            ${TALENTS[player.class].map(talent => `
                <div class="skill-card talent-card ${talent.specialization ? 'talent-specialization' : ''}">
                    <div class="skill-icon">${talent.icon}</div>
                    <div class="skill-info">
                        <div class="skill-name">${talent.name}</div>
                        <div class="skill-description">${talent.description}${talent.specialization ? ' • Уникальная ветка' : ''}</div>
                    </div>
                    <button class="talent-button" onclick="window.chooseTalent('${talent.id}')" ${!getTalentAvailability(player, talent.id).available ? 'disabled' : ''}>
                        ${getTalentAvailability(player, talent.id).reason}
                    </button>
                </div>
            `).join('')}
        </div>

        <div class="section-title">💎 Реликвии • активных: ${player.activeRelics?.length || 0}/${MAX_ACTIVE_RELICS}</div>
        <div class="skills-section">
            ${(player.relics || []).length ? player.relics.filter(id => RELICS[id]).map(id => `
                <div class="skill-card talent-card relic-card ${player.activeRelics?.includes(id) ? 'relic-card-active' : ''}">
                    <div class="skill-icon relic-icon relic-rarity-${RELICS[id].rarity} relic-art-${id}" role="img" aria-label="${RELICS[id].name}">${RELICS[id].icon}</div>
                    <div class="skill-info">
                        <div class="skill-name">${RELICS[id].name} • ${RELIC_RARITIES[RELICS[id].rarity].name}</div>
                        <div class="skill-description">${RELICS[id].description}</div>
                        ${player.activeRelics?.includes(id) ? '<span class="relic-active-label">Экипирована</span>' : ''}
                    </div>
                    <button class="talent-button relic-toggle-button" aria-pressed="${player.activeRelics?.includes(id) ? 'true' : 'false'}" onclick="window.toggleCharacterRelic('${id}')" ${!player.activeRelics?.includes(id) && (player.activeRelics?.length || 0) >= MAX_ACTIVE_RELICS ? 'disabled' : ''}>
                        ${player.activeRelics?.includes(id) ? 'Снять' : 'Надеть'}
                    </button>
                </div>
            `).join('') : '<p class="skill-description">Реликвии можно найти у элитных врагов и боссов.</p>'}
            ${getActiveRelicSynergies(player).map(synergy => `
                <div class="skill-card"><div class="skill-icon">🔗</div><div class="skill-info">
                    <div class="skill-name">Синергия: ${synergy.name}</div>
                    <div class="skill-description">${synergy.description}</div>
                </div></div>
            `).join('')}
        </div>
        
        <div class="section-title">✨ Навыки</div>
        <div class="skills-section">
            ${classData.skills.map(skill => createSkillCard(skill)).join('')}
        </div>
        
        <div class="section-title">📊 Статистика</div>
        <div class="stats-container">
            ${createStatCard('⚔️ Побед', player.stats.wins)}
            ${createStatCard('💀 Поражений', player.stats.losses)}
            ${createStatCard('👹 Убийств', player.stats.kills)}
        </div>
    `;
}

export function toggleCharacterRelic(id) {
    const player = gameState.player;
    const snapshot = createPlayerSnapshot(player);
    if (!snapshot || !toggleRelic(player, id)) return false;
    if (!commitPlayerMutation(player, snapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить изменение реликвии. Изменения отменены.', 'error');
        return false;
    }
    updateCharacterScreen();
    return true;
}

export function chooseTalent(id) {
    const player = gameState.player;
    const snapshot = createPlayerSnapshot(player);
    if (!snapshot || !unlockTalent(player, id)) return false;
    if (!commitPlayerMutation(player, snapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить талант. Очки талантов восстановлены.', 'error');
        return false;
    }
    updateCharacterScreen();
    window.showNotification?.('🌟 Новый талант изучен!', 'success');
    return true;
}

function createStatBar(label, value, max, type) {
    return `
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-label">${label}</span>
                <span class="stat-value">${value} / ${max}</span>
            </div>
            <div class="stat-bar">
                <div class="stat-bar-fill ${type}" style="width: ${(value / max) * 100}%"></div>
            </div>
        </div>
    `;
}

function createAttributeCard(icon, name, value) {
    return `
        <div class="attribute-card">
            <div class="attribute-icon">${icon}</div>
            <div class="attribute-name">${name}</div>
            <div class="attribute-value">${value}</div>
        </div>
    `;
}

function createSkillCard(skill) {
    return `
        <div class="skill-card">
            <div class="skill-icon skill-art-icon skill-art-${skill.id}" aria-hidden="true">${skill.icon}</div>
            <div class="skill-info">
                <div class="skill-name">${skill.name}</div>
                <div class="skill-description">${skill.description}</div>
            </div>
            <div class="skill-cost">💙 ${skill.manaCost}</div>
        </div>
    `;
}

function createStatCard(label, value) {
    return `
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-label">${label}</span>
                <span class="stat-value">${value}</span>
            </div>
        </div>
    `;
}

export function levelUp({ save = true } = {}) {
    const player = gameState.player;
    if (!player) return false;
    const snapshot = save ? createPlayerSnapshot(player) : null;
    if (save && !snapshot) return false;
    const deferredNotifications = [];
    const gainedLevels = applyExperience(player);

    if (gainedLevels) {
        window.updateQuestProgress?.('level', player.level, {
            save: false,
            notifications: save ? deferredNotifications : null
        });
    }
    window.updateAchievements?.({
        save: false,
        notifications: save ? deferredNotifications : null
    });

    if (save && !commitPlayerMutation(player, snapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить повышение уровня. Опыт и характеристики восстановлены.', 'error');
        return false;
    }

    if (gainedLevels) {
        SoundSystem.playSound('levelup');
        window.showNotification?.(`🎉 +${gainedLevels} ур.! Теперь вы ${player.level} уровня!`, 'success');
    }
    deferredNotifications.forEach(({ kind, name }) => {
        const message = kind === 'quest'
            ? `🎉 Квест выполнен: ${name}!`
            : `🏆 Достижение получено: ${name}!`;
        window.showNotification?.(message, 'success');
    });

    window.updateMainMenu?.();
    updateCharacterScreen();
    window.updateQuestsScreen?.();
    return true;
}
