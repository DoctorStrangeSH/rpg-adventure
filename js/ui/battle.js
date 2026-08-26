// Экран боя
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { SoundSystem } from '../systems/sound.js';
import { ParticleSystem, DamageText } from '../systems/particles.js';
import { Sprite } from '../entities/Sprite.js';

const particleSystem = new ParticleSystem();
let damageTexts = [];
let battleState = {
    canvas: null,
    ctx: null,
    isActive: false,
    playerSprite: null,
    enemySprite: null,
    currentEnemy: null,
    animationFrame: 0,
    turn: 'player',
    isDungeonBattle: false,
    isBossBattle: false
};

export function initBattle() {
    battleState.canvas = document.getElementById('battle-canvas');
    battleState.ctx = battleState.canvas.getContext('2d');
    
    resizeBattleCanvas();
    window.addEventListener('resize', resizeBattleCanvas);
}

function resizeBattleCanvas() {
    if (!battleState.canvas) return;
    
    const container = battleState.canvas.parentElement;
    battleState.canvas.width = container.offsetWidth;
    battleState.canvas.height = container.offsetHeight - 150;
}

export function startBattle(location) {
    const player = gameState.player;
    
    const enemyData = getRandomEnemy(location.enemies);
    if (!enemyData) return;
    
    const enemy = {
        ...enemyData,
        health: enemyData.health * (1 + player.level * 0.1),
        maxHealth: enemyData.health * (1 + player.level * 0.1),
        attack: enemyData.attack * (1 + player.level * 0.1),
        defense: enemyData.defense * (1 + player.level * 0.1)
    };
    
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    battleState.playerSprite = new Sprite(player.class, 100, 200);
    battleState.enemySprite = new Sprite(enemyData.id, canvasWidth - 100, 200);
    
    window.showScreen('battle-screen');
    updateBattleUI();
    animateBattle();
}

export function animateBattle() {
    if (!battleState.isActive) return;
    
    battleState.animationFrame++;
    drawBattle();
    
    requestAnimationFrame(animateBattle);
}

function drawBattle() {
    const ctx = battleState.ctx;
    const canvas = battleState.canvas;
    
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87ceeb');
    gradient.addColorStop(0.7, '#90ee90');
    gradient.addColorStop(1, '#8b7355');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    
    if (battleState.playerSprite) {
        battleState.playerSprite.draw(ctx, battleState.animationFrame);
        drawBattleHPBar(ctx, battleState.playerSprite, gameState.player, true);
    }
    
    if (battleState.enemySprite && battleState.currentEnemy) {
        battleState.enemySprite.draw(ctx, battleState.animationFrame);
        drawBattleHPBar(ctx, battleState.enemySprite, battleState.currentEnemy, false);
    }
    
    particleSystem.update();
    particleSystem.draw(ctx);
    
    damageTexts.forEach(text => text.update());
    damageTexts = damageTexts.filter(text => text.life > 0);
    damageTexts.forEach(text => text.draw(ctx));
}

function drawBattleHPBar(ctx, sprite, entity, isPlayer) {
    const barWidth = 100;
    const barHeight = 10;
    const barX = sprite.x - barWidth / 2;
    const barY = sprite.y - 80;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    const fillPercent = entity.health / entity.maxHealth;
    ctx.fillStyle = isPlayer ? '#4caf50' : '#f44336';
    ctx.fillRect(barX, barY, barWidth * fillPercent, barHeight);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(entity.health)}/${Math.floor(entity.maxHealth)}`, sprite.x, barY + barHeight + 10);
}

export function updateBattleUI() {
    const battleUI = document.getElementById('battle-ui');
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    if (!enemy) return;
    
    const hasMana = player.mana >= 10;
    const isBoss = battleState.isBossBattle || false;
    
    battleUI.innerHTML = `
        ${isBoss ? '<div class="boss-indicator">👹 БОСС</div>' : ''}
        <div class="battle-buttons">
            <button class="battle-btn attack" onclick="window.playerAttack()" ${battleState.turn !== 'player' ? 'disabled' : ''}>
                ⚔️ Атаковать
            </button>
            <button class="battle-btn defend" onclick="window.playerDefend()" ${battleState.turn !== 'player' ? 'disabled' : ''}>
                🛡️ Защита
            </button>
            <button class="battle-btn skill" onclick="window.playerSkill()" ${battleState.turn !== 'player' || !hasMana ? 'disabled' : ''}>
                ✨ Навык
            </button>
            <button class="battle-btn item" onclick="window.playerUseItem()" ${battleState.turn !== 'player' ? 'disabled' : ''}>
                🧪 Зелье
            </button>
            <button class="battle-btn flee" onclick="window.playerFlee()" ${battleState.turn !== 'player' ? 'disabled' : ''}>
                🏃 Сбежать
            </button>
        </div>
    `;
}

export function playerAttack() {
    if (battleState.turn !== 'player') return;
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    SoundSystem.playSound('attack');
    
    battleState.playerSprite.isAttacking = true;
    
    const isCrit = Math.random() < 0.15;
    const baseDamage = Math.max(1, player.attack - enemy.defense + Math.floor(Math.random() * 10));
    const damage = isCrit ? Math.floor(baseDamage * 2) : baseDamage;
    
    enemy.health -= damage;
    
    addDamageText(
        battleState.enemySprite.x,
        battleState.enemySprite.y - 50,
        damage,
        isCrit
    );
    
    particleSystem.createExplosion(
        battleState.enemySprite.x,
        battleState.enemySprite.y,
        '#ff4444',
        isCrit ? 30 : 15
    );
    
    showBattleMessage(`Вы нанесли ${damage} урона!${isCrit ? ' КРИТ!' : ''}`);
    
    setTimeout(() => {
        battleState.playerSprite.isAttacking = false;
        
        if (enemy.health <= 0) {
            SoundSystem.playSound('victory');
            battleVictory();
            return;
        }
        
        battleState.turn = 'enemy';
        enemyTurn();
    }, 500);
}

export function playerDefend() {
    if (battleState.turn !== 'player') return;
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    const damage = Math.max(1, Math.floor((enemy.attack - player.defense) / 2));
    player.health -= damage;
    
    showBattleMessage(`Вы защищаетесь! ${enemy.name} наносит ${damage} урона!`);
    
    battleState.turn = 'enemy';
    setTimeout(() => {
        if (player.health <= 0) {
            battleDefeat();
            return;
        }
        
        battleState.turn = 'player';
        updateBattleUI();
        window.updateMainMenu?.();
    }, 1000);
}

export function playerSkill() {
    if (battleState.turn !== 'player') return;
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    const classData = CLASSES[player.class];
    const skill = classData.skills[0];
    
    if (player.mana < skill.manaCost) {
        showBattleMessage('Недостаточно маны!');
        return;
    }
    
    player.mana -= skill.manaCost;
    
    battleState.playerSprite.isAttacking = true;
    
    const damage = Math.max(1, Math.floor(player.attack * skill.damageMultiplier - enemy.defense));
    enemy.health -= damage;
    
    showBattleMessage(`${skill.name}! Нанесено ${damage} урона!`);
    
    setTimeout(() => {
        battleState.playerSprite.isAttacking = false;
        
        if (enemy.health <= 0) {
            battleVictory();
            return;
        }
        
        battleState.turn = 'enemy';
        enemyTurn();
    }, 500);
}

export function playerUseItem() {
    if (battleState.turn !== 'player') return;
    
    const player = gameState.player;
    
    const potionIndex = player.inventory.findIndex(item => item.id === 'health_potion');
    
    if (potionIndex === -1) {
        showBattleMessage('У вас нет зелий!');
        return;
    }
    
    const potion = player.inventory[potionIndex];
    const potionData = getItem(potion.id);
    
    const healAmount = potionData.heal || 50;
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    potion.quantity--;
    
    if (potion.quantity <= 0) {
        player.inventory.splice(potionIndex, 1);
    }
    
    showBattleMessage(`Вы использовали ${potionData.name}! +${healAmount} HP`);
    
    gameState.save();
    
    battleState.turn = 'enemy';
    setTimeout(() => {
        enemyTurn();
    }, 1000);
}

export function playerFlee() {
    if (battleState.turn !== 'player') return;
    
    if (Math.random() < 0.7) {
        showBattleMessage('Вы успешно сбежали!');
        setTimeout(() => {
            exitBattle();
        }, 1000);
    } else {
        showBattleMessage('Побег не удался!');
        battleState.turn = 'enemy';
        enemyTurn();
    }
}

function enemyTurn() {
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    battleState.enemySprite.isAttacking = true;
    
    setTimeout(() => {
        SoundSystem.playSound('hit');
        
        const damage = Math.max(1, enemy.attack - player.defense + Math.floor(Math.random() * 5));
        player.health -= damage;
        
        addDamageText(
            battleState.playerSprite.x,
            battleState.playerSprite.y - 50,
            damage
        );
        
        particleSystem.createExplosion(
            battleState.playerSprite.x,
            battleState.playerSprite.y,
            '#4444ff',
            10
        );
        
        battleState.enemySprite.isAttacking = false;
        
        showBattleMessage(`${enemy.name} наносит ${damage} урона!`);
        
        setTimeout(() => {
            if (player.health <= 0) {
                SoundSystem.playSound('defeat');
                battleDefeat();
                return;
            }
            
            battleState.turn = 'player';
            updateBattleUI();
            window.updateMainMenu?.();
        }, 300);
    }, 500);
}

function addDamageText(x, y, damage, isCrit = false) {
    const color = isCrit ? '#ff4444' : '#ffd700';
    const text = isCrit ? `CRIT! ${damage}` : `-${damage}`;
    damageTexts.push(new DamageText(x, y, text, color));
}

export function battleVictory() {
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    const expGain = Math.floor(enemy.expReward * (1 + Math.random() * 0.5));
    const goldGain = Math.floor(enemy.goldReward * (1 + Math.random() * 0.5));
    
    player.experience += expGain;
    player.gold += goldGain;
    player.stats.kills++;
    player.stats.wins++;
    
    if (battleState.isBossBattle) {
        player.stats.bossesKilled = (player.stats.bossesKilled || 0) + 1;
    }
    
    window.updateQuestProgress?.('kill', 1);
    window.updateQuestProgress?.('win', 1);
    window.updateQuestProgress?.('gold', goldGain);
    window.updateQuestProgress?.('level', player.level);
    
    window.updateAchievements?.();
    
    showBattleMessage(`Победа! +${expGain} EXP, +${goldGain} золота!`);
    
    if (player.experience >= player.maxExperience) {
        window.levelUp?.();
    }
    
    gameState.save();
    window.updateMainMenu?.();
    
    // Проверяем подземелье
    const dungeonState = window.getDungeonState?.();
    
    if (dungeonState && dungeonState.inDungeon) {
        dungeonState.enemiesDefeated++;
        
        const dungeon = dungeonState.currentDungeon;
        const floor = dungeon.floors[dungeonState.currentFloor];
        
        setTimeout(() => {
            if (dungeonState.enemiesDefeated >= floor.enemiesCount) {
                if (floor.boss) {
                    window.startBossFight?.(floor.boss);
                } else {
                    if (dungeonState.currentFloor < dungeon.floors.length - 1) {
                        dungeonState.currentFloor++;
                        dungeonState.enemiesDefeated = 0;
                        window.startDungeonFloor?.();
                    } else {
                        player.stats.dungeonsCompleted = (player.stats.dungeonsCompleted || 0) + 1;
                        window.updateAchievements?.();
                        window.completeDungeon?.();
                    }
                }
            } else {
                window.startDungeonBattle?.();
            }
        }, 2000);
    } else {
        setTimeout(() => {
            exitBattle();
        }, 2000);
    }
}

export function battleDefeat() {
    const player = gameState.player;
    
    const goldLoss = Math.floor(player.gold * 0.1);
    player.gold -= goldLoss;
    player.health = 1;
    player.stats.losses++;
    
    showBattleMessage(`Вы погибли! Потеряно ${goldLoss} золота!`);
    
    window.resetDungeonState?.();
    
    gameState.save();
    window.updateMainMenu?.();
    
    setTimeout(() => {
        exitBattle();
        window.showScreen('map-screen');
    }, 2000);
}

export function exitBattle() {
    battleState.isActive = false;
    battleState.currentEnemy = null;
    battleState.isDungeonBattle = false;
    battleState.isBossBattle = false;
    
    window.showScreen('main-menu');
    window.updateMainMenu?.();
}

export function showBattleMessage(message) {
    const battleContainer = document.querySelector('.battle-container');
    if (!battleContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'battle-message';
    messageElement.textContent = message;
    
    battleContainer.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.remove();
    }, 2000);
}

export function updateBattleScreen() {
    if (!battleState.canvas) {
        initBattle();
    }
    
    if (battleState.isActive) {
        updateBattleUI();
        drawBattle();
    } else {
        const battleUI = document.getElementById('battle-ui');
        battleUI.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="font-size: 18px; margin-bottom: 10px;">Нет активного сражения</p>
                <p style="color: var(--text-secondary);">Вернитесь на карту и выберите локацию для боя</p>
            </div>
        `;
    }
}

export function getBattleState() {
    return battleState;
}