// Главное меню
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { ScreenManager } from '../core/screen.js';

export function initUI() {
    const mainMenu = document.getElementById('main-menu');
    
    mainMenu.innerHTML = `
        <div class="menu-container">
            <div class="game-logo">
                <div class="logo-icon">⚔️</div>
                <h1 class="game-title">RPG ADVENTURE</h1>
                <p class="game-subtitle">Эпическое приключение</p>
            </div>
            
            <div class="player-info" id="menu-player-info"></div>
            
            <div class="menu-buttons">
                <button class="menu-btn" onclick="window.showScreen('character-screen')">
                    <span class="btn-icon">👤</span>
                    <span class="btn-text">Персонаж</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('map-screen')">
                    <span class="btn-icon">🗺️</span>
                    <span class="btn-text">Карта мира</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('battle-screen')">
                    <span class="btn-icon">⚔️</span>
                    <span class="btn-text">Сражения</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('inventory-screen')">
                    <span class="btn-icon">🎒</span>
                    <span class="btn-text">Инвентарь</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('quests-screen')">
                    <span class="btn-icon">📜</span>
                    <span class="btn-text">Квесты</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('achievements-screen')">
                    <span class="btn-icon">🏆</span>
                    <span class="btn-text">Достижения</span>
                    <span class="btn-arrow">→</span>
                </button>
                <button class="menu-btn" onclick="window.showScreen('shop-screen')">
                    <span class="btn-icon">🏪</span>
                    <span class="btn-text">Магазин</span>
                    <span class="btn-arrow">→</span>
                </button>
            </div>
        </div>
    `;
}

export function showClassSelection() {
    const mainMenu = document.getElementById('main-menu');
    
    mainMenu.innerHTML = `
        <div class="menu-container">
            <div class="game-logo">
                <div class="logo-icon">⚔️</div>
                <h1 class="game-title">ВЫБОР КЛАССА</h1>
                <p class="game-subtitle">Выберите свой путь</p>
            </div>
            
            <div class="class-cards">
                ${Object.values(CLASSES).map(classData => `
                    <div class="class-card" onclick="window.selectClass('${classData.id}')">
                        <div class="class-icon">${classData.icon}</div>
                        <h3>${classData.name}</h3>
                        <p>${classData.description}</p>
                        <div class="class-stats">
                            <span>❤️ ${classData.stats.health}</span>
                            <span>⚔️ ${classData.stats.attack}</span>
                            <span>🛡️ ${classData.stats.defense}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    mainMenu.classList.add('active');
}

export function updateMainMenu() {
    const player = gameState.player;
    if (!player) return;
    
    const playerInfo = document.getElementById('menu-player-info');
    if (!playerInfo) return;
    
    const classData = CLASSES[player.class];
    
    playerInfo.innerHTML = `
        <div class="player-info-header">
            <div class="player-avatar">${classData.icon}</div>
            <div>
                <div class="player-name">${player.username}</div>
                <div class="player-level">Уровень ${player.level} • ${classData.name}</div>
            </div>
        </div>
        <div class="player-stats">
            <div class="mini-stat">
                <span>❤️</span>
                <div class="mini-bar">
                    <div class="mini-bar-fill health" style="width: ${(player.health / player.maxHealth) * 100}%"></div>
                </div>
                <span class="mini-text">${player.health}/${player.maxHealth}</span>
            </div>
            <div class="mini-stat">
                <span>💙</span>
                <div class="mini-bar">
                    <div class="mini-bar-fill mana" style="width: ${(player.mana / player.maxMana) * 100}%"></div>
                </div>
                <span class="mini-text">${player.mana}/${player.maxMana}</span>
            </div>
            <div class="mini-stat">
                <span>✨</span>
                <div class="mini-bar">
                    <div class="mini-bar-fill exp" style="width: ${(player.experience / player.maxExperience) * 100}%"></div>
                </div>
                <span class="mini-text">${player.experience}/${player.maxExperience}</span>
            </div>
        </div>
    `;
}