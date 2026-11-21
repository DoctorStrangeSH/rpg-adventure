// Экран боя
import { gameState } from '../core/state.js';
import { addEventListenerOnce } from '../core/listeners.js';
import { CLASSES } from '../data/classes.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { SoundSystem } from '../systems/sound.js';
import { ParticleSystem, DamageText } from '../systems/particles.js';
import { Sprite } from '../entities/Sprite.js';
import { getBattlePositions, getBattleCanvasSize } from './battleLayout.js';
import { getArenaTheme, drawArenaAtmosphere } from './arenaTheme.js';
import { createArenaBackdropCache } from './arenaBackdrop.js';
import { ProjectileFx } from '../systems/projectileFx.js';
import { BossSpellFx } from '../systems/bossSpellFx.js';
import { calculateDamage, applyDamage, consumeHealingPotion, consumeManaPotion, useSkillEffect, tickEnemyEffects, planEnemyTurn, applyEnemyAction, getBossPhase, triggerWeaponEffect, getEffectiveCombatStats, getCriticalMultiplier, triggerDragonSwordEcho, triggerMoonbladeMana, triggerRangerEffect, tryPhoenixRebirth, getEnemyTacticHint, interruptEnemyWindup, getClassTacticalBonus, consumeWarriorOpening, resolveWarriorParry, addArcherMark, calculateTypedDamage, getWeaponDamageType, getDamageFeedback, getEnemyDamageProfile, recordEnemyDamageType } from '../systems/combat.js';
import { grantItem, hasBossTrophy, rollLoot } from '../systems/loot.js';
import { awardRelic, RELICS, getActiveRelicSynergies } from '../systems/relics.js';
import { createPlayerSnapshot, restorePlayerSnapshot, commitPlayerMutation } from '../systems/playerTransactions.js';

const particleSystem = new ParticleSystem();
const projectileFx = new ProjectileFx();
const bossSpellFx = new BossSpellFx();
const WEAPON_EFFECT_NAMES = { burn: 'горение', bleed: 'кровотечение', freeze: 'заморозка' };
let damageTexts = [];
let isProcessing = false;
let animationRunning = false;
let battleResizeObserver = null;
// Region illustrations are lazy-loaded and cached. The courtyard and the
// gradient remain available when a new background has not loaded yet.
const arenaBackdrops = createArenaBackdropCache();

let battleState = {
    canvas: null,
    ctx: null,
    isActive: false,
    playerSprite: null,
    enemySprite: null,
    currentEnemy: null,
    animationFrame: 0,
    deathAnimationEndFrame: null,
    turn: 'player',
    isDungeonBattle: false,
    isBossBattle: false,
    isLocationBattle: false,
    guardReduction: 0,
    relicEffects: { phoenixRebirthUsed: false },
    pendingVictorySave: false,
    pendingDefeatSave: false
};


function cloneBattleEntity(entity) {
    if (!entity || typeof entity !== 'object') return null;
    try {
        return JSON.parse(JSON.stringify(entity));
    } catch {
        return null;
    }
}

function restoreBattleEntity(entity, snapshot) {
    if (!entity || !snapshot || typeof snapshot !== 'object') return false;
    try {
        const restored = JSON.parse(JSON.stringify(snapshot));
        Object.keys(entity).forEach(key => delete entity[key]);
        Object.assign(entity, restored);
        return true;
    } catch {
        return false;
    }
}

function commitBattleMutation(player, playerSnapshot, enemy, enemySnapshot, failureMessage) {
    const location = window.getLocationState?.();
    const previousTurn = battleState.turn;
    const previousEncounter = location?.activeEncounter ? cloneBattleEntity(location.activeEncounter) : null;
    const nextTurn = previousTurn === 'player' ? 'enemy' : 'player';
    let hadSavedEncounter = false;
    if (location?.inLocation && location.currentLocation?.id) {
        const progress = player.dungeonProgress?.[location.currentLocation.id];
        if (!progress) {
            restorePlayerSnapshot(player, playerSnapshot);
            restoreBattleEntity(enemy, enemySnapshot);
            window.showNotification?.('Не найдено сохранение текущей экспедиции. Боевое действие отменено.', 'error');
            return false;
        }
        hadSavedEncounter = Object.hasOwn(progress, 'activeEncounter');
        battleState.turn = nextTurn;
        const encounter = {
            enemy: cloneBattleEntity(enemy),
            isBossBattle: battleState.isBossBattle === true,
            turn: nextTurn,
            guardReduction: battleState.guardReduction,
            relicEffects: { ...battleState.relicEffects }
        };
        location.activeEncounter = encounter;
        progress.activeEncounter = cloneBattleEntity(encounter);
    }
    if (commitPlayerMutation(player, playerSnapshot, () => gameState.save())) return true;
    restoreBattleEntity(enemy, enemySnapshot);
    if (location?.inLocation) {
        location.activeEncounter = previousEncounter;
        const progress = player.dungeonProgress?.[location.currentLocation?.id];
        if (progress) {
            if (hadSavedEncounter) progress.activeEncounter = previousEncounter;
            else delete progress.activeEncounter;
        }
    }
    battleState.turn = previousTurn;
    window.showNotification?.(failureMessage, 'error');
    return false;
}

function commitCurrentBattleState(player, playerSnapshot, failureMessage) {
    return commitBattleMutation(player, playerSnapshot, battleState.currentEnemy,
        cloneBattleEntity(battleState.currentEnemy), failureMessage);
}

export function restoreDungeonEncounter(snapshot) {
    const player = gameState.player;
    if (!snapshot?.enemy || !player) return false;
    const enemy = cloneBattleEntity(snapshot.enemy);
    if (!enemy || enemy.health < 0 || enemy.health > enemy.maxHealth) return false;
    resetBattlePresentation();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.deathAnimationEndFrame = null;
    battleState.turn = snapshot.turn === 'enemy' ? 'enemy' : 'player';
    battleState.isBossBattle = snapshot.isBossBattle === true;
    battleState.isLocationBattle = true;
    battleState.isDungeonBattle = true;
    battleState.guardReduction = Number.isFinite(snapshot.guardReduction) ? snapshot.guardReduction : 0;
    battleState.relicEffects = snapshot.relicEffects && typeof snapshot.relicEffects === 'object'
        ? { ...snapshot.relicEffects } : { phoenixRebirthUsed: false };
    battleState.pendingVictorySave = false;
    battleState.pendingDefeatSave = false;
    const positions = getBattlePositions(battleState.canvas?.width, battleState.canvas?.height,
        battleState.isBossBattle);
    battleState.playerSprite = new Sprite(player.class, positions.player.x, positions.player.y);
    battleState.enemySprite = new Sprite(enemy.id, positions.enemy.x, positions.enemy.y);
    window.showScreen?.('battle-screen');
    updateBattleUI();
    if (battleState.canvas) animateBattle();
    window.showBattleMessage?.('⚔️ Экспедиция восстановлена. Продолжайте с сохранённого хода.');
    if (enemy.health <= 0) {
        battleState.turn = 'player';
        battleVictory();
        return true;
    }
    if (battleState.turn === 'enemy') {
        setTimeout(() => {
            if (battleState.isActive && battleState.turn === 'enemy') enemyTurn();
        }, 250);
    }
    return true;
}

export function initBattle() {
    battleState.canvas = document.getElementById('battle-canvas');
    if (!battleState.canvas) return;
    battleState.ctx = battleState.canvas.getContext('2d');
    
    const container = battleState.canvas.parentElement;
    resizeBattleCanvas();
    addEventListenerOnce(window, 'resize', resizeBattleCanvas);
    addEventListenerOnce(window, 'orientationchange', resizeBattleCanvas);
    if (window.visualViewport) {
        addEventListenerOnce(window.visualViewport, 'resize', resizeBattleCanvas);
    }
    if (typeof ResizeObserver !== 'undefined' && !battleResizeObserver) {
        battleResizeObserver = new ResizeObserver(resizeBattleCanvas);
        battleResizeObserver.observe(container);
    }
}

function resizeBattleCanvas() {
    if (!battleState.canvas) return;

    const container = battleState.canvas.parentElement;
    if (!container) return;
    const size = getBattleCanvasSize(container.clientWidth, container.clientHeight);
    battleState.canvas.width = size.width;
    battleState.canvas.height = size.height;
    const positions = getBattlePositions(size.width, size.height,
        battleState.isBossBattle);
    if (battleState.playerSprite) Object.assign(battleState.playerSprite, positions.player);
    if (battleState.enemySprite) Object.assign(battleState.enemySprite, positions.enemy);
}

// Dungeon stages and boss fights share this canvas, but start in dungeon.js.
// Always discard transient effects before reusing it for another encounter.
export function resetBattlePresentation() {
    projectileFx.clear();
    bossSpellFx.clear();
    particleSystem.particles.length = 0;
    damageTexts = [];
    isProcessing = false;
}

export function startBattle(location) {
    const player = gameState.player;
    if (!player || !location?.enemies?.length || battleState.isActive) return;
    
    const enemyData = getRandomEnemy(location.enemies);
    if (!enemyData) return;
    
    const enemy = {
        ...enemyData,
        health: enemyData.health * (1 + player.level * 0.1),
        maxHealth: enemyData.health * (1 + player.level * 0.1),
        attack: enemyData.attack * (1 + player.level * 0.1),
        defense: enemyData.defense * (1 + player.level * 0.1)
    };
    
    const playerSnapshot = createPlayerSnapshot(player);
    if (!playerSnapshot) return;
    player.stats.battles++;
    if (!commitPlayerMutation(player, playerSnapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить начало боя. Попробуйте ещё раз.', 'error');
        return;
    }

    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.deathAnimationEndFrame = null;
    resetBattlePresentation();
    battleState.turn = 'player';
    battleState.isBossBattle = false;
    battleState.isLocationBattle = false;
    battleState.guardReduction = 0;
    battleState.relicEffects = { phoenixRebirthUsed: false };
    battleState.pendingVictorySave = false;
    battleState.pendingDefeatSave = false;
    
    const positions = getBattlePositions(battleState.canvas?.width, battleState.canvas?.height);
    battleState.playerSprite = new Sprite(player.class, positions.player.x, positions.player.y);
    battleState.enemySprite = new Sprite(enemyData.id, positions.enemy.x, positions.enemy.y);
    
    window.showScreen('battle-screen');
    updateBattleUI();
    animateBattle();
}

export function animateBattle() {
    if (animationRunning) return;
    animationRunning = true;
    const frame = () => {
        const playingDeath = battleState.deathAnimationEndFrame !== null &&
            battleState.animationFrame < battleState.deathAnimationEndFrame;
        if (!battleState.isActive && !playingDeath) {
            battleState.deathAnimationEndFrame = null;
            animationRunning = false;
            return;
        }
        battleState.animationFrame++;
        drawBattle();
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

function drawBattle() {
    const ctx = battleState.ctx;
    const canvas = battleState.canvas;
    
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const locationId = window.getLocationState?.()?.currentLocation?.id;
    const arenaBackdrop = arenaBackdrops.get(locationId);
    if (arenaBackdrop) {
        // Cover the canvas without distorting pixel proportions on tall phones.
        const scale = Math.max(canvas.width / arenaBackdrop.naturalWidth,
            canvas.height / arenaBackdrop.naturalHeight);
        const width = arenaBackdrop.naturalWidth * scale;
        const height = arenaBackdrop.naturalHeight * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(arenaBackdrop, (canvas.width - width) / 2,
            (canvas.height - height) / 2, width, height);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#121c31');
        gradient.addColorStop(0.7, '#30324c');
        gradient.addColorStop(1, '#51495e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#393343';
        ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    }
    drawArenaAtmosphere(ctx, canvas.width, canvas.height,
        getArenaTheme(locationId, battleState.currentEnemy?.id), battleState.animationFrame);
    
    if (battleState.playerSprite) {
        battleState.playerSprite.isGuarding = gameState.player?.class === 'warrior' &&
            battleState.guardReduction > 0;
        battleState.playerSprite.draw(ctx, battleState.animationFrame);
        if (battleState.playerSprite.deathStartFrame === null) {
            drawBattleHPBar(ctx, battleState.playerSprite, gameState.player, true);
        }
    }
    
    if (battleState.enemySprite && battleState.currentEnemy && battleState.playerSprite?.deathStartFrame === null) {
        battleState.enemySprite.draw(ctx, battleState.animationFrame);
        drawBattleHPBar(ctx, battleState.enemySprite, battleState.currentEnemy, false);
    }
    projectileFx.draw(ctx, battleState.animationFrame);
    bossSpellFx.draw(ctx, battleState.animationFrame);
    
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
    
    const currentHealth = Math.max(0, Math.min(entity.health, entity.maxHealth));
    const fillPercent = currentHealth / entity.maxHealth;
    
    ctx.fillStyle = isPlayer ? '#4caf50' : '#f44336';
    ctx.fillRect(barX, barY, barWidth * fillPercent, barHeight);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
        `${Math.floor(currentHealth)}/${Math.floor(entity.maxHealth)}`, 
        sprite.x, 
        barY + barHeight + 10
    );
}

export function updateBattleUI() {
    const battleUI = document.getElementById('battle-ui');
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    if (!battleUI || !enemy || !player) return;
    
    const skills = CLASSES[player.class]?.skills || [];
    const isBoss = battleState.isBossBattle || false;
    const canAct = battleState.turn === 'player' && !isProcessing;
    const tacticHint = getEnemyTacticHint(enemy);
    const damageProfile = getEnemyDamageProfile(enemy);
    const damageProfileHint = [
        damageProfile.weaknesses.length
            ? '🎯 Уязвим: ' + damageProfile.weaknesses.map(entry => entry.label + ' (+' + entry.percent + '%)').join(', ')
            : null,
        damageProfile.resistances.length
            ? '🛡️ Сопротивление: ' + damageProfile.resistances.map(entry => entry.label + ' (−' + entry.percent + '%)').join(', ')
            : null
    ].filter(Boolean).join(' · ');
    const synergies = getActiveRelicSynergies(player);
    const equippedRelicNames = (player.activeRelics || []).filter(id => player.relics?.includes(id) && RELICS[id])
        .slice(0, 2).map(id => RELICS[id].name);
    const activeEffects = [
        enemy.effects?.freezeTurns > 0 ? `❄️ Заморозка: ${enemy.effects.freezeTurns}` : null,
        enemy.effects?.poisonTurns > 0 ? `☠️ Яд: ${enemy.effects.poisonTurns}` : null,
        enemy.effects?.burnTurns > 0 ? `🔥 Горение: ${enemy.effects.burnTurns}` : null,
        enemy.effects?.bleedTurns > 0 ? `🩸 Кровотечение: ${enemy.effects.bleedTurns}` : null,
        enemy.effects?.weakenTurns > 0 ? `🔻 Ослабление: ${enemy.effects.weakenTurns}` : null,
        enemy.archerMarks > 0 ? `🎯 Метки лучника: ${enemy.archerMarks}/2` : null,
        battleState.guardReduction > 0 ? '🛡️ Защитная стойка' : null
    ].filter(Boolean);
    
    // Получаем информацию о локации
    const locationState = window.getLocationState?.();
    let stageInfo = '';
    
    if (locationState && locationState.inLocation && locationState.currentLocation) {
        const location = locationState.currentLocation;
        const stage = location.stages[locationState.currentStage];
        
        if (stage) {
            const isMiniBoss = stage.boss && stage.stage % 10 !== 0;
            const isBossStage = stage.boss && stage.stage % 10 === 0;
            
            let bossText = '';
            if (isMiniBoss) {
                bossText = '👹 МИНИ-БОСС';
            } else if (isBossStage) {
                bossText = '👑 ГЛАВНЫЙ БОСС';
            }
            
            stageInfo = `
                <div class="stage-info">
                    <span>📍 ${location.name}</span>
                    <span>Этап ${stage.stage}/${location.stages.length}</span>
                    <span>Врагов: ${locationState.enemiesDefeated}/${stage.enemiesCount}</span>
                    ${bossText ? `<span style="color: #ff4444;">${bossText}</span>` : ''}
                </div>
            `;
        }
    }
    
    battleUI.innerHTML = `
        <div class="combat-overview" aria-label="Состояние участников боя">
            <div class="combat-entity">
                <div class="combat-entity-title"><span>${CLASSES[player.class]?.icon || '⚔️'} Герой</span><span>❤️ ${Math.ceil(player.health)} / ${player.maxHealth}</span></div>
                <div class="combat-meter" role="progressbar" aria-label="Здоровье героя" aria-valuenow="${Math.ceil(player.health)}" aria-valuemin="0" aria-valuemax="${player.maxHealth}">
                    <span class="combat-meter-fill" style="width:${Math.max(0, Math.min(100, player.health / player.maxHealth * 100))}%"></span>
                </div>
                <div class="combat-mana">💙 Мана: ${Math.floor(player.mana)} / ${player.maxMana}</div>
            </div>
            <div class="combat-entity">
                <div class="combat-entity-title"><span>${enemy.icon || '👹'} ${enemy.name}</span><span>❤️ ${Math.ceil(enemy.health)} / ${Math.ceil(enemy.maxHealth)}</span></div>
                <div class="combat-meter enemy" role="progressbar" aria-label="Здоровье врага" aria-valuenow="${Math.ceil(enemy.health)}" aria-valuemin="0" aria-valuemax="${Math.ceil(enemy.maxHealth)}">
                    <span class="combat-meter-fill" style="width:${Math.max(0, Math.min(100, enemy.health / enemy.maxHealth * 100))}%"></span>
                </div>
            </div>
        </div>
        ${stageInfo}
        <div class="battle-turn" role="status" aria-live="polite">${canAct ? '🟢 Ваш ход — выберите действие' : '⏳ Ход противника — ожидайте'}</div>
        ${tacticHint ? `<div class="battle-tactic" aria-label="Подсказка о враге">${tacticHint}</div>` : ''}
        ${damageProfileHint ? `<div class="battle-tactic elemental-profile" aria-label="Стихийные уязвимости и сопротивления">${damageProfileHint}</div>` : ''}
        ${enemy.intent && player.class === 'warrior' ? '<div class="battle-tactic">🛡️ Воин: защита блокирует 75% следующего удара.</div>' : ''}
        ${enemy.intent && player.class === 'archer' ? '<div class="battle-tactic">🏹 Лучник: обычная атака наносит на 30% больше урона по готовящемуся врагу.</div>' : ''}
        ${enemy.intent && player.class === 'mage' ? '<div class="battle-tactic">❄️ Маг: ледяная нова может сорвать подготовку врага.</div>' : ''}
        ${player.class === 'mage' && enemy.effects?.burnTurns > 0 ? '<div class="battle-tactic">🔥❄️ Комбинация: ледяная нова по горящему врагу вызывает термошок (до 30 урона)!</div>' : ''}
        ${player.class === 'archer' && (enemy.effects?.poisonTurns > 0 || enemy.effects?.bleedTurns > 0) ? '<div class="battle-tactic">☠️🩸 Комбинация: яд и кровотечение вместе наносят дополнительный урон каждый ход (до 12)!</div>' : ''}
        ${player.class === 'warrior' && enemy.effects?.weakenTurns > 0 ? '<div class="battle-tactic">⚔️ Комбинация: обычная атака по ослабленному врагу наносит на 25% больше урона, расходуя один ход ослабления.</div>' : ''}
        ${equippedRelicNames.length ? `<div class="battle-relics">💎 Реликвии: ${equippedRelicNames.join(' · ')}${synergies.length ? ` <span>🔗 ${synergies.map(entry => entry.name).join(', ')}</span>` : ''}</div>` : ''}
        ${isBoss ? '<div class="boss-indicator">👹 БОСС</div>' : ''}
        ${enemy.behavior === 'boss' ? `<div class="boss-phase">👑 Фаза ${getBossPhase(enemy)} / 3${enemy.intent === 'heavy' ? ' · ⚠️ Следующий удар усиленный!' : ''}</div>` : ''}
        ${activeEffects.length ? `<div class="battle-effects" aria-label="Активные эффекты">${activeEffects.map(effect => `<span class="battle-effect">${effect}</span>`).join('')}</div>` : ''}
        <div class="battle-buttons">
            ${battleState.pendingVictorySave ? `
                <button class="battle-btn item" onclick="window.battleVictory()">💾 Повторить сохранение победы</button>
            ` : battleState.pendingDefeatSave ? `
                <button class="battle-btn item" onclick="window.battleDefeat()">💾 Повторить сохранение результата</button>
            ` : `
            <button class="battle-btn attack" onclick="window.playerAttack()" ${!canAct ? 'disabled' : ''}>
                ⚔️ Атаковать
            </button>
            <button class="battle-btn defend" onclick="window.playerDefend()" ${!canAct ? 'disabled' : ''}>
                🛡️ Защита${player.class === 'warrior' && enemy.intent ? ' · Парирование' : ''}
            </button>
            ${skills.map(skill => `
                <button class="battle-btn skill" onclick="window.playerSkill('${skill.id}')"
                        title="${skill.description}" ${!canAct || player.mana < skill.manaCost ? 'disabled' : ''}>
                    <span>${skill.icon} ${skill.name} · ${skill.manaCost} MP</span>
                    <small>${skill.description}</small>
                </button>
            `).join('')}
            ${player.health < player.maxHealth && player.inventory?.some(item => item.id === 'health_potion' && item.quantity > 0) ? `
                <button class="battle-btn item" onclick="window.playerUseItem('health_potion')" ${!canAct ? 'disabled' : ''}>
                    ❤️ Зелье здоровья
                </button>
            ` : ''}
            ${player.mana < player.maxMana && player.inventory?.some(item => item.id === 'mana_potion' && item.quantity > 0) ? `
                <button class="battle-btn item" onclick="window.playerUseItem('mana_potion')" ${!canAct ? 'disabled' : ''}>
                    💙 Зелье маны
                </button>
            ` : ''}
            <button class="battle-btn flee" onclick="window.playerFlee()" ${!canAct ? 'disabled' : ''}>
                🏃 Сбежать
            </button>
            `}
        </div>
    `;
}

function disableBattleButtons() {
    const buttons = document.querySelectorAll('.battle-btn');
    buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
    });
}

function launchPlayerProjectile(skillId = null) {
    const classId = gameState.player?.class;
    const kind = classId === 'mage' && ['fireball', 'frost_nova'].includes(skillId)
        ? skillId : classId;
    const source = battleState.playerSprite;
    const target = battleState.enemySprite;
    if (!source || !target) return;
    projectileFx.launch(kind, { x: source.x + 20, y: source.y - 25 },
        { x: target.x - 12, y: target.y - 25 }, battleState.animationFrame);
}

export function playerAttack() {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    if (!battleState.currentEnemy) return;
    
    isProcessing = true;
    disableBattleButtons();
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    const playerSnapshot = createPlayerSnapshot(player);
    const enemySnapshot = cloneBattleEntity(enemy);
    if (!playerSnapshot || !enemySnapshot) {
        isProcessing = false;
        updateBattleUI();
        return;
    }

    const isCrit = Math.random() < getEffectiveCombatStats(player).critChance;
    const tacticalBonus = getClassTacticalBonus(player, enemy);
    const warriorOpening = consumeWarriorOpening(player, enemy);
    const damageType = getWeaponDamageType(player);
    const baseDamage = calculateTypedDamage(
        getEffectiveCombatStats(player).attack, enemy.defense, Math.floor(Math.random() * 10),
        tacticalBonus.attackMultiplier * (warriorOpening ? 1.25 : 1), enemy, damageType
    );
    const damage = isCrit ? Math.floor(baseDamage * getCriticalMultiplier(player)) : baseDamage;
    const damageFeedback = getDamageFeedback(enemy, damageType);
    
    applyDamage(enemy, damage);
    const archerMarks = addArcherMark(player, enemy, damage);
    recordEnemyDamageType(enemy, damageType, damage);
    const weaponEffect = triggerWeaponEffect(player, enemy);
    const rangerBleed = triggerRangerEffect(player, enemy);
    const dragonEcho = triggerDragonSwordEcho(player, enemy, damage, isCrit);
    const moonMana = triggerMoonbladeMana(player, damage, isCrit);
    if (!commitBattleMutation(player, playerSnapshot, enemy, enemySnapshot,
        'Не удалось сохранить эффект оружия или ход боя. Урон и эффекты отменены.')) {
        isProcessing = false;
        updateBattleUI();
        return;
    }

    SoundSystem.playSound('attack');
    battleState.playerSprite.isAttacking = true;
    launchPlayerProjectile();
    if (damage > 0) battleState.enemySprite?.receiveHit(battleState.animationFrame);

    addDamageText(
        battleState.enemySprite.x,
        battleState.enemySprite.y - 50,
        damage,
        isCrit,
        damageType
    );
    
    particleSystem.createImpactBurst(
        battleState.enemySprite.x, battleState.enemySprite.y - 18, damageType, isCrit
    );
    particleSystem.createExplosion(
        battleState.enemySprite.x,
        battleState.enemySprite.y,
        damageFeedback.color || '#ff4444',
        isCrit ? 30 : 15
    );
    
    showBattleMessage(`Вы нанесли ${damage} урона!${damageFeedback ? ` ${damageFeedback}!` : ''}${warriorOpening ? ' ⚔️ Добивающий удар по ослабленной цели!' : ''}${tacticalBonus.attackMultiplier > 1 ? ' 🎯 Удар по открытой цели!' : ''}${isCrit ? ' КРИТ!' : ''}${weaponEffect ? ` Эффект оружия: ${WEAPON_EFFECT_NAMES[weaponEffect]}!` : ''}${rangerBleed ? ' Следопыт вызвал кровотечение!' : ''}${archerMarks ? ` 🎯 Метки: ${archerMarks}/2 (усилят следующий навык)!` : ''}${dragonEcho ? ` 🐉 Эхо дракона: +${dragonEcho} урона!` : ''}${moonMana ? ` 🌙 Лунный прилив: +${moonMana} маны!` : ''}`);
    
    setTimeout(() => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        battleState.playerSprite.isAttacking = false;
        
        if (enemy.health <= 0) {
            SoundSystem.playSound('victory');
            isProcessing = false;
            battleVictory();
            return;
        }
        
        battleState.turn = 'enemy';
        enemyTurn();
    }, 500);
}

export function playerDefend() {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    if (!battleState.currentEnemy) return;
    
    isProcessing = true;
    disableBattleButtons();
    
    const enemy = battleState.currentEnemy;
    const player = gameState.player;
    const playerSnapshot = createPlayerSnapshot(player);
    const previousGuardReduction = battleState.guardReduction;
    if (!playerSnapshot) {
        isProcessing = false;
        updateBattleUI();
        return;
    }
    battleState.guardReduction = Math.max(battleState.guardReduction, getClassTacticalBonus(player, enemy).guardReduction);
    if (!commitCurrentBattleState(player, playerSnapshot,
        'Не удалось сохранить защитную стойку. Действие отменено.')) {
        battleState.guardReduction = previousGuardReduction;
        isProcessing = false;
        updateBattleUI();
        return;
    }
    showBattleMessage('Вы готовитесь отразить следующий удар!');
    
    battleState.turn = 'enemy';
    setTimeout(() => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        enemyTurn();
    }, 350);
}

export function playerSkill(skillId) {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    if (!battleState.currentEnemy) return;
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    const classData = CLASSES[player.class];
    const skill = classData?.skills?.find(value => value.id === skillId);
    if (!skill) return;
    
    if (player.mana < skill.manaCost) {
        showBattleMessage('Недостаточно маны!');
        return;
    }
    
    const playerSnapshot = createPlayerSnapshot(player);
    const enemySnapshot = cloneBattleEntity(enemy);
    const previousGuardReduction = battleState.guardReduction;
    if (!playerSnapshot || !enemySnapshot) return;

    isProcessing = true;
    disableBattleButtons();
    player.mana -= skill.manaCost;

    const result = useSkillEffect(player, enemy, skill);
    const weaponEffect = result.damage > 0 ? triggerWeaponEffect(player, enemy) : null;
    if (result.guardReduction) battleState.guardReduction = result.guardReduction;
    if (!commitBattleMutation(player, playerSnapshot, enemy, enemySnapshot,
        'Не удалось сохранить применение навыка. Мана и состояние противника восстановлены.')) {
        battleState.guardReduction = previousGuardReduction;
        isProcessing = false;
        updateBattleUI();
        return;
    }

    battleState.playerSprite.isAttacking = true;
    launchPlayerProjectile(skill.id);
    if (result.damage > 0) battleState.enemySprite?.receiveHit(battleState.animationFrame);
    
    const statuses = [weaponEffect && WEAPON_EFFECT_NAMES[weaponEffect], skill.freeze && enemy.effects?.freezeTurns && 'заморозка',
        skill.poison && enemy.effects?.poisonTurns && 'яд',
        skill.burn && enemy.effects?.burnTurns && 'горение',
        skill.bleed && enemy.effects?.bleedTurns && 'кровотечение',
        skill.weaken && enemy.effects?.weakenTurns && 'ослабление',
        result.phoenixBurn && 'пламя феникса',
        result.thermalShockDamage && `термошок: ${result.thermalShockDamage} урона`,
        result.marksConsumed && `метки лучника: +${result.marksConsumed * 15}% к навыку`]
        .filter(Boolean).join(', ');
    const damageFeedback = result.damage ? getDamageFeedback(enemy, result.element) : '';
    const effect = statuses ? ` Эффект: ${statuses}.` :
        result.guardReduction ? ' Следующий удар ослаблен!' :
        (skill.freeze || skill.poison || skill.burn || skill.bleed || skill.weaken) ? ' Противник сопротивляется эффекту!' : '';
    showBattleMessage(`${skill.name}! ${result.damage ? `Урон: ${result.damage}.` : ''}${damageFeedback ? ` ${damageFeedback}.` : ''}${effect}`);
    updateBattleUI();
    
    setTimeout(() => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        battleState.playerSprite.isAttacking = false;
        
        if (enemy.health <= 0) {
            isProcessing = false;
            battleVictory();
            return;
        }
        
        battleState.turn = 'enemy';
        enemyTurn();
    }, 500);
}

export function playerUseItem(potionId = 'health_potion') {
    if (isProcessing || !battleState.isActive || battleState.turn !== 'player') return;
    if (!['health_potion', 'mana_potion'].includes(potionId)) return;

    const player = gameState.player;
    if (!Array.isArray(player?.inventory)) return;
    const potion = player.inventory.find(item => item.id === potionId && item.quantity > 0);
    if (!potion) {
        showBattleMessage('Такого зелья нет в инвентаре!');
        return;
    }

    const potionData = getItem(potion.id);
    const playerSnapshot = createPlayerSnapshot(player);
    if (!playerSnapshot) return;
    const restored = potionId === 'mana_potion'
        ? consumeManaPotion(player, potion, potionData)
        : consumeHealingPotion(player, potion, potionData);
    if (!restored) {
        showBattleMessage(potionId === 'mana_potion'
            ? 'Запас маны уже полностью восстановлен!'
            : 'Здоровье уже полностью восстановлено!');
        return;
    }

    if (!commitCurrentBattleState(player, playerSnapshot,
        'Не удалось сохранить использование зелья. Зелье и ресурсы восстановлены.')) {
        restorePlayerSnapshot(player, playerSnapshot);
        updateBattleUI();
        return;
    }

    isProcessing = true;
    disableBattleButtons();
    const resourceLabel = potionId === 'mana_potion' ? 'MP' : 'HP';
    showBattleMessage(`Вы использовали ${potionData.name}! +${restored} ${resourceLabel}`);
    battleState.turn = 'enemy';
    setTimeout(() => {
        if (!battleState.isActive) return;
        enemyTurn();
    }, 1000);
}

export function playerFlee() {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    
    isProcessing = true;
    disableBattleButtons();
    const enemy = battleState.currentEnemy;
    
    if (Math.random() < 0.7) {
            setTimeout(() => {
            if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
            isProcessing = false;
            
            // Проверяем, в локации ли мы
            const locationState = window.getLocationState?.();
            if (locationState && locationState.inLocation) {
                const fled = window.fleeLocation?.();
                if (fled !== true) {
                    isProcessing = false;
                    battleState.turn = 'player';
                    updateBattleUI();
                }
            } else {
                showBattleMessage('Вы успешно сбежали!');
                exitBattle();
            }
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
    const locationState = window.getLocationState?.();
    const isDungeonBattle = Boolean(locationState?.inLocation);
    
    if (!battleState.isActive || !enemy) return;
    const enemyTurnSnapshot = cloneBattleEntity(enemy);
    const playerTurnSnapshot = createPlayerSnapshot(player);
    const guardBeforeEnemyTurn = battleState.guardReduction;
    if (!enemyTurnSnapshot || !playerTurnSnapshot) return;
    const effects = tickEnemyEffects(enemy);
    if (effects.poisonDamage) {
        showBattleMessage(`Яд наносит ${effects.poisonDamage} урона!`);
    }
    if (effects.burnDamage || effects.bleedDamage) {
        showBattleMessage(`Горение и кровотечение: ${effects.burnDamage + effects.bleedDamage} урона!`);
    }
    if (effects.woundPoisonDamage) {
        showBattleMessage(`☠️🩸 Яд попадает в раны! Дополнительно ${effects.woundPoisonDamage} урона!`);
    }
    if (enemy.health <= 0) {
        battleVictory();
        return;
    }
    if (effects.frozen) {
        const interrupted = interruptEnemyWindup(enemy);
        battleState.guardReduction = 0;
        if (!commitBattleMutation(player, playerTurnSnapshot, enemy, enemyTurnSnapshot,
            'Не удалось сохранить пропуск хода замороженного противника.')) {
            battleState.turn = 'enemy';
            battleState.guardReduction = guardBeforeEnemyTurn;
            isProcessing = false;
            updateBattleUI();
            return;
        }
        isProcessing = false;
        showBattleMessage(`${enemy.name} пропускает ход из-за заморозки!${interrupted ? ' Подготовка опасного удара сорвана!' : ''}`);
        updateBattleUI();
        return;
    }
    const guardedWindup = Boolean(enemy.intent);
    const plan = planEnemyTurn(enemy, player);
    if (plan.phaseChanged) showBattleMessage(`⚡ ${enemy.name} переходит в фазу ${plan.phase}!`);
    if (plan.warned) {
        if (!commitBattleMutation(player, playerTurnSnapshot, enemy, enemyTurnSnapshot,
            'Не удалось сохранить подготовку особого удара.')) {
            battleState.turn = 'enemy';
            isProcessing = false;
            updateBattleUI();
            return;
        }
        isProcessing = false;
        showBattleMessage(getEnemyTacticHint(enemy) || `⚠️ ${enemy.name} готовит особый удар! Защищайтесь или прервите подготовку!`);
        updateBattleUI();
        return;
    }
    const action = plan.action;
    if (action === 'adapt') {
        const result = applyEnemyAction(enemy, player, 'adapt');
        if (!commitBattleMutation(player, playerTurnSnapshot, enemy, enemyTurnSnapshot,
            'Не удалось сохранить адаптацию противника.')) {
            battleState.turn = 'enemy';
            isProcessing = false;
            updateBattleUI();
            return;
        }
        isProcessing = false;
        const label = { physical: 'физическим атакам', fire: 'огню', ice: 'льду', poison: 'яду' }[result.adapted] || result.adapted;
        showBattleMessage(`🛡️ ${enemy.name} анализирует ваши действия и адаптируется к ${label}! Сопротивление продержится два ваших хода.`);
        updateBattleUI();
        return;
    }
    const actionName = {
        attack: 'атакует', heavy: 'наносит сокрушительный удар',
        pounce: 'прыгает на вас', mana_burn: 'истощает вашу ману',
        recover: 'восстанавливается', cleanse: 'снимает с себя отрицательный эффект',
        ambush: 'устраивает засаду', crush: 'наносит сокрушительный удар сквозь броню',
        siphon: 'высасывает жизненные силы', flame_breath: 'извергает пламя',
        cataclysm: 'обрушивает катаклизм', thorn_burst: 'обрушивает град шипастых корней'
    }[action];
    showBattleMessage(`${enemy.name} ${actionName}!`);
    
    battleState.enemySprite.isAttacking = true;
    bossSpellFx.start(action, battleState.enemySprite, battleState.playerSprite,
        battleState.animationFrame);
    
    setTimeout(() => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        SoundSystem.playSound('hit');
        
        const playerSnapshot = createPlayerSnapshot(player);
        const enemySnapshot = enemyTurnSnapshot;
        const previousGuardReduction = battleState.guardReduction;
        const previousRelicEffects = { ...battleState.relicEffects };
        if (!playerSnapshot || !enemySnapshot) {
            isProcessing = false;
            battleState.turn = 'player';
            window.showNotification?.('Не удалось подготовить сохранение результата хода противника.', 'error');
            updateBattleUI();
            return;
        }

        const result = applyEnemyAction(enemy, player, action, Math.floor(Math.random() * 5), battleState.guardReduction);
        const damage = result.damage;
        const parried = resolveWarriorParry(player, enemy, guardedWindup, battleState.guardReduction);
        const reborn = tryPhoenixRebirth(player, battleState.relicEffects);
        battleState.guardReduction = 0;
        // A lethal enemy action and its defeat penalty must share one save.
        // Never persist a standalone zero-HP profile before the defeat transaction.
        if (player.health <= 0) {
            battleState.enemySprite.isAttacking = false;
            battleDefeat();
            return;
        }
        if (!commitBattleMutation(player, playerSnapshot, enemy, enemySnapshot,
            'Не удалось сохранить ход противника. Здоровье и эффекты боя восстановлены.')) {
            battleState.guardReduction = previousGuardReduction;
            battleState.relicEffects = previousRelicEffects;
            isProcessing = false;
            battleState.turn = 'player';
            updateBattleUI();
            return;
        }

        if (damage > 0) battleState.playerSprite?.receiveHit(battleState.animationFrame);
        if (parried) battleState.playerSprite?.startParry(battleState.animationFrame);
        if (parried) battleState.playerSprite?.startCounter(battleState.animationFrame);
        
        if (damage) addDamageText(battleState.playerSprite.x, battleState.playerSprite.y - 50, damage);
        
        particleSystem.createExplosion(
            battleState.playerSprite.x,
            battleState.playerSprite.y,
            '#4444ff',
            10
        );
        
        battleState.enemySprite.isAttacking = false;
        
        const cleansedNames = { burn: 'горение', poison: 'яд', bleed: 'кровотечение', weaken: 'ослабление' };
        showBattleMessage(reborn ? '🔥 Корона феникса спасает вас от гибели! Здоровье восстановлено.' :
            result.cleansed ? `${enemy.name} очищается от эффекта: ${cleansedNames[result.cleansed] || result.cleansed}!` :
            result.healed ? `${enemy.name} восстанавливает ${result.healed} HP!` :
            `${enemy.name} наносит ${damage} урона!${result.manaBurned ? ` -${result.manaBurned} MP` : ''}${result.reflected ? ` Контратака: ${result.reflected} урона!` : ''}${result.lifeStolen ? ` Вампиризм: +${result.lifeStolen} HP!` : ''}${result.soulDrain ? ` Похищение жизни: +${result.soulDrain} HP!` : ''}${result.enraged ? ' ЯРОСТЬ!' : ''}${result.armorEffect === 'freeze' ? ' ❄️ Ледяная броня заморозила врага!' : ''}${result.armorHealed ? ` 🩸 Кровавый доспех: +${result.armorHealed} HP!` : ''}${parried ? ` ⚔️ Идеальный блок! Контрудар: ${parried} урона!` : ''}`);
        
        setTimeout(() => {
            if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
            if (player.health <= 0) {
                SoundSystem.playSound('defeat');
                isProcessing = false;
                battleDefeat();
                return;
            }
            if (enemy.health <= 0) {
                isProcessing = false;
                battleVictory();
                return;
            }
            
            battleState.turn = 'player';
            isProcessing = false;
            updateBattleUI();
            window.updateMainMenu?.();
        }, 300);
    }, 500);
}

function addDamageText(x, y, damage, isCrit = false, damageType = 'physical') {
    const text = isCrit ? `КРИТ! ${damage}` : `-${damage}`;
    damageTexts.push(new DamageText(x, y, text,
        isCrit ? '#ffdf91' : undefined, { isCrit, damageType }));
}

export function battleVictory() {
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    const locationState = window.getLocationState?.();
    const isDungeonBattle = Boolean(locationState?.inLocation);
    const playerBeforeBattle = createPlayerSnapshot(player);
    
    if (!battleState.isActive || !enemy || enemy.health > 0) return;
    if (!playerBeforeBattle) {
        window.showNotification?.('Не удалось подготовить награды боя. Победа не засчитана.', 'error');
        return;
    }
    
    battleState.isActive = false;
    isProcessing = false;
    
    const expGain = Math.floor(enemy.expReward * (1 + Math.random() * 0.5));
    const goldGain = Math.floor(enemy.goldReward * (1 + Math.random() * 0.5));
    
    player.experience += expGain;
    player.gold += goldGain;
    player.stats.kills++;
    player.stats.wins++;
    
    if (battleState.isBossBattle && !enemy.miniBoss) {
        player.stats.bossesKilled = (player.stats.bossesKilled || 0) + 1;
    }
    
    window.updateQuestProgress?.('kill', 1, { save: false });
    window.updateQuestProgress?.('win', 1, { save: false });
    window.updateQuestProgress?.('gold', goldGain, { save: false });
    window.updateQuestProgress?.('level', player.level, { save: false });
    
    window.updateAchievements?.({ save: false });
    
    const storyBossId = battleState.isBossBattle && !enemy.miniBoss ? enemy.id : null;
    const lootId = rollLoot(battleState.isBossBattle, Math.random, storyBossId,
        hasBossTrophy(player, storyBossId));
    const lootQuantity = lootId ? grantItem(player, lootId) : 0;
    const lootText = lootQuantity ? ` 🎁 Добыча: ${getItem(lootId).name}!` : '';
    const relicId = awardRelic(player, enemy.elite === true || enemy.miniBoss === true, battleState.isBossBattle && !enemy.miniBoss);
    const relicText = relicId ? ` 🌟 Реликвия: ${RELICS[relicId].name}!` : '';
    
    if (player.experience >= player.maxExperience) {
        window.levelUp?.({ save: false });
    }
    
    if (isDungeonBattle) {
        // Dungeon handlers persist the player reward and the advanced resume
        // marker together. Saving before them would let a reload replay a paid fight.
        if (battleState.isBossBattle) {
            const committed = window.handleBossVictory?.(playerBeforeBattle);
            if (committed !== true) {
                restorePlayerSnapshot(player, playerBeforeBattle);
                window.showNotification?.('Не удалось сохранить награды босса. Бой будет предложен повторно.', 'error');
                setTimeout(() => {
                    if (locationState?.inLocation && !battleState.isActive) window.startStageBattle?.();
                }, 500);
                return;
            }
        } else {
            const committed = window.handleVictory?.(playerBeforeBattle);
            if (committed !== true) {
                restorePlayerSnapshot(player, playerBeforeBattle);
                window.showNotification?.('Не удалось сохранить награду боя. Бой будет предложен повторно.', 'error');
                setTimeout(() => {
                    if (locationState?.inLocation && !battleState.isActive) window.startStageBattle?.();
                }, 500);
                return;
            }
        }
    } else {
        if (!commitPlayerMutation(player, playerBeforeBattle, () => gameState.save())) {
            battleState.isActive = true;
            battleState.pendingVictorySave = true;
            battleState.turn = 'player';
            isProcessing = false;
            window.showNotification?.('Победа не сохранена. Награды отменены — повторите сохранение, когда хранилище будет доступно.', 'error');
            updateBattleUI();
            return;
        }
        battleState.pendingVictorySave = false;
        setTimeout(() => {
            exitBattle();
        }, 2000);
    }
    showBattleMessage(`Победа! +${expGain} EXP, +${goldGain} золота!${lootText}${relicText}`);
    window.updateMainMenu?.();
}

export function battleDefeat() {
    const player = gameState.player;
    if (!battleState.isActive || !player || player.health > 0) return;
    
    const playerBeforeDefeat = createPlayerSnapshot(player);
    if (!playerBeforeDefeat) return;
    battleState.isActive = false;
    isProcessing = false;
    battleState.deathAnimationEndFrame = battleState.animationFrame + 72;
    battleState.playerSprite?.beginDeath(battleState.animationFrame);
    animateBattle();
    
    const goldLoss = Math.floor(player.gold * 0.1);
    player.gold -= goldLoss;
    player.health = 1;
    player.stats.losses++;
    
    
    // The dungeon handler owns the combined penalty + expedition reset save.
    // Pass the pre-penalty snapshot so a failed write can roll back everything.
    const defeatCommitted = typeof window.handleDefeat === 'function'
        ? window.handleDefeat(playerBeforeDefeat)
        : commitPlayerMutation(player, playerBeforeDefeat, () => gameState.save());
    if (defeatCommitted !== true) {
        restorePlayerSnapshot(player, playerBeforeDefeat);
        battleState.isActive = true;
        battleState.pendingDefeatSave = true;
        battleState.turn = 'player';
        battleState.deathAnimationEndFrame = null;
        if (battleState.playerSprite) battleState.playerSprite.deathStartFrame = null;
        isProcessing = false;
        window.showNotification?.('Поражение не сохранено. Потеря золота и сброс экспедиции отменены — повторите сохранение.', 'error');
        updateBattleUI();
        return;
    }
    battleState.pendingDefeatSave = false;
    showBattleMessage(`Вы погибли! Потеряно ${goldLoss} золота!`);
    window.updateMainMenu?.();
    
    setTimeout(() => {
        exitBattle();
        window.showScreen('map-screen');
    }, 2000);
}

export function exitBattle() {
    // The header back button can exit an active dungeon directly. Clear the
    // run before leaving, otherwise its inLocation flag blocks new attempts.
    if (window.getLocationState?.()?.inLocation) window.resetLocationState?.();
    battleState.isActive = false;
    battleState.pendingVictorySave = false;
    battleState.pendingDefeatSave = false;
    battleState.currentEnemy = null;
    battleState.isDungeonBattle = false;
    battleState.isBossBattle = false;
    battleState.isLocationBattle = false;
    battleState.guardReduction = 0;
    battleState.deathAnimationEndFrame = null;
    isProcessing = false;
    
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
        if (battleUI && !battleState.currentEnemy) {
            battleUI.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="font-size: 18px; margin-bottom: 10px;">Нет активного сражения</p>
                    <p style="color: var(--text-secondary);">Вернитесь на карту и выберите локацию для боя</p>
                </div>
            `;
        }
    }
}

export function getBattleState() {
    return battleState;
}
