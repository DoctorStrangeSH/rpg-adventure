// Экран персонажа
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { SoundSystem } from '../systems/sound.js';

export function updateCharacterScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('character-content');
    const classData = CLASSES[player.class];
    
    content.innerHTML = `
        <div class="character-header">
            <div class="character-avatar">${classData.icon}</div>
            <div class="character-info">
                <h3>${player.username}</h3>
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
            ${createAttributeCard('⚔️', 'Атака', player.attack)}
            ${createAttributeCard('🛡️', 'Защита', player.defense)}
            ${createAttributeCard('💨', 'Скорость', player.speed)}
            ${createAttributeCard('⭐', 'Уровень', player.level)}
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
    
    while (player.experience >= player.maxExperience) {
        player.experience -= player.maxExperience;
        player.level++;
        player.maxExperience = Math.floor(player.maxExperience * 1.5);
        
        player.maxHealth += 20;
        player.health = player.maxHealth;
        player.maxMana += 10;
        player.mana = player.maxMana;
        player.attack += 5;
        player.defense += 3;
        
        SoundSystem.playSound('levelup');
        window.showNotification(`🎉 Уровень повышен! Теперь вы ${player.level} уровня!`, 'success');
        
        window.updateQuestProgress?.('level', player.level);
    }
    
    gameState.save();
    updateMainMenu();
    updateCharacterScreen();
    window.updateQuestsScreen?.();
    window.updateAchievements?.();
}