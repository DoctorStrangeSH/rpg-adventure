// Экран персонажа
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { SoundSystem } from '../systems/sound.js';
import { applyExperience } from '../systems/progression.js';
import { escapeHtml } from '../core/html.js';
import { TALENTS, getTalentPoints, getTalentAvailability, unlockTalent } from '../systems/talents.js';
import { getEffectiveCombatStats } from '../systems/combat.js';
import { RELICS, MAX_ACTIVE_RELICS, toggleRelic } from '../systems/relics.js';

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
                <div class="skill-card talent-card">
                    <div class="skill-icon">${RELICS[id].icon}</div>
                    <div class="skill-info"><div class="skill-name">${RELICS[id].name}</div><div class="skill-description">${RELICS[id].description}</div></div>
                    <button class="talent-button" onclick="window.toggleCharacterRelic('${id}')" ${!player.activeRelics?.includes(id) && (player.activeRelics?.length || 0) >= MAX_ACTIVE_RELICS ? 'disabled' : ''}>
                        ${player.activeRelics?.includes(id) ? 'Снять' : 'Надеть'}
                    </button>
                </div>
            `).join('') : '<p class="skill-description">Реликвии можно найти у элитных врагов и боссов.</p>'}
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
    if (!toggleRelic(gameState.player, id)) return false;
    gameState.save();
    updateCharacterScreen();
    return true;
}

export function chooseTalent(id) {
    const player = gameState.player;
    if (!unlockTalent(player, id)) return false;
    gameState.save();
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
            <div class="skill-icon">${skill.icon}</div>
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

export function levelUp() {
    const player = gameState.player;
    if (!player) return;
    const gainedLevels = applyExperience(player);
    if (gainedLevels) {
        SoundSystem.playSound('levelup');
        window.showNotification(`🎉 +${gainedLevels} ур.! Теперь вы ${player.level} уровня!`, 'success');
        window.updateQuestProgress?.('level', player.level);
    }
    gameState.save();
    window.updateMainMenu?.();
    updateCharacterScreen();
    window.updateQuestsScreen?.();
    window.updateAchievements?.();
}
