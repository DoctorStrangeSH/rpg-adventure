// Экран боя
import { gameState } from '../core/state.js';
import { CLASSES } from '../data/classes.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { SoundSystem } from '../systems/sound.js';
import { ParticleSystem, DamageText } from '../systems/particles.js';
import { Sprite } from '../entities/Sprite.js';
import { calculateDamage, applyDamage, consumeHealingPotion, useSkillEffect, tickEnemyEffects, planEnemyTurn, applyEnemyAction, getBossPhase, triggerWeaponEffect, getEffectiveCombatStats, getCriticalMultiplier, triggerRangerEffect, tryPhoenixRebirth, getEnemyTacticHint, interruptEnemyWindup } from '../systems/combat.js';
import { grantItem, rollLoot } from '../systems/loot.js';
import { awardRelic, RELICS, getActiveRelicSynergies } from '../systems/relics.js';

const particleSystem = new ParticleSystem();
const WEAPON_EFFECT_NAMES = { burn: 'горение', bleed: 'кровотечение', freeze: 'заморозка' };
let damageTexts = [];
let isProcessing = false;
let animationRunning = false;

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
    isBossBattle: false,
    isLocationBattle: false,
    guardReduction: 0,
    relicEffects: { phoenixRebirthUsed: false }
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
    
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isBossBattle = false;
    battleState.isLocationBattle = false;
    battleState.guardReduction = 0;
    battleState.relicEffects = { phoenixRebirthUsed: false };
    isProcessing = false;
    player.stats.battles++;
    gameState.save();
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    battleState.playerSprite = new Sprite(player.class, 100, 200);
    battleState.enemySprite = new Sprite(enemyData.id, canvasWidth - 100, 200);
    
    window.showScreen('battle-screen');
    updateBattleUI();
    animateBattle();
}

export function animateBattle() {
    if (animationRunning) return;
    animationRunning = true;
    const frame = () => {
        if (!battleState.isActive) {
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
    const synergies = getActiveRelicSynergies(player);
    const equippedRelicNames = (player.activeRelics || []).filter(id => player.relics?.includes(id) && RELICS[id])
        .slice(0, 2).map(id => RELICS[id].name);
    const activeEffects = [
        enemy.effects?.freezeTurns > 0 ? `❄️ Заморозка: ${enemy.effects.freezeTurns}` : null,
        enemy.effects?.poisonTurns > 0 ? `☠️ Яд: ${enemy.effects.poisonTurns}` : null,
        enemy.effects?.burnTurns > 0 ? `🔥 Горение: ${enemy.effects.burnTurns}` : null,
        enemy.effects?.bleedTurns > 0 ? `🩸 Кровотечение: ${enemy.effects.bleedTurns}` : null,
        enemy.effects?.weakenTurns > 0 ? `🔻 Ослабление: ${enemy.effects.weakenTurns}` : null,
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
        ${equippedRelicNames.length ? `<div class="battle-relics">💎 Реликвии: ${equippedRelicNames.join(' · ')}${synergies.length ? ` <span>🔗 ${synergies.map(entry => entry.name).join(', ')}</span>` : ''}</div>` : ''}
        ${isBoss ? '<div class="boss-indicator">👹 БОСС</div>' : ''}
        ${enemy.behavior === 'boss' ? `<div class="boss-phase">👑 Фаза ${getBossPhase(enemy)} / 3${enemy.intent === 'heavy' ? ' · ⚠️ Следующий удар усиленный!' : ''}</div>` : ''}
        ${activeEffects.length ? `<div class="battle-effects" aria-label="Активные эффекты">${activeEffects.map(effect => `<span class="battle-effect">${effect}</span>`).join('')}</div>` : ''}
        <div class="battle-buttons">
            <button class="battle-btn attack" onclick="window.playerAttack()" ${!canAct ? 'disabled' : ''}>
                ⚔️ Атаковать
            </button>
            <button class="battle-btn defend" onclick="window.playerDefend()" ${!canAct ? 'disabled' : ''}>
                🛡️ Защита
            </button>
            ${skills.map(skill => `
                <button class="battle-btn skill" onclick="window.playerSkill('${skill.id}')"
                        title="${skill.description}" ${!canAct || player.mana < skill.manaCost ? 'disabled' : ''}>
                    <span>${skill.icon} ${skill.name} · ${skill.manaCost} MP</span>
                    <small>${skill.description}</small>
                </button>
            `).join('')}
            <button class="battle-btn item" onclick="window.playerUseItem()" ${!canAct ? 'disabled' : ''}>
                🧪 Зелье
            </button>
            <button class="battle-btn flee" onclick="window.playerFlee()" ${!canAct ? 'disabled' : ''}>
                🏃 Сбежать
            </button>
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

export function playerAttack() {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    if (!battleState.currentEnemy) return;
    
    isProcessing = true;
    disableBattleButtons();
    
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    SoundSystem.playSound('attack');
    
    battleState.playerSprite.isAttacking = true;
    
    const isCrit = Math.random() < getEffectiveCombatStats(player).critChance;
    const baseDamage = calculateDamage(getEffectiveCombatStats(player).attack, enemy.defense, Math.floor(Math.random() * 10));
    const damage = isCrit ? Math.floor(baseDamage * getCriticalMultiplier(player)) : baseDamage;
    
    applyDamage(enemy, damage);
    const weaponEffect = triggerWeaponEffect(player, enemy);
    const rangerBleed = triggerRangerEffect(player, enemy);
    
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
    
    showBattleMessage(`Вы нанесли ${damage} урона!${isCrit ? ' КРИТ!' : ''}${weaponEffect ? ` Эффект оружия: ${WEAPON_EFFECT_NAMES[weaponEffect]}!` : ''}${rangerBleed ? ' Следопыт вызвал кровотечение!' : ''}`);
    
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
    battleState.guardReduction = Math.max(battleState.guardReduction, 0.5);
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
    
    isProcessing = true;
    disableBattleButtons();
    
    player.mana -= skill.manaCost;
    
    battleState.playerSprite.isAttacking = true;
    
    const result = useSkillEffect(player, enemy, skill);
    const weaponEffect = result.damage > 0 ? triggerWeaponEffect(player, enemy) : null;
    if (result.guardReduction) battleState.guardReduction = result.guardReduction;
    gameState.save();
    
    const statuses = [weaponEffect && WEAPON_EFFECT_NAMES[weaponEffect], skill.freeze && enemy.effects?.freezeTurns && 'заморозка',
        skill.poison && enemy.effects?.poisonTurns && 'яд',
        skill.burn && enemy.effects?.burnTurns && 'горение',
        skill.bleed && enemy.effects?.bleedTurns && 'кровотечение',
        skill.weaken && enemy.effects?.weakenTurns && 'ослабление',
        result.phoenixBurn && 'пламя феникса']
        .filter(Boolean).join(', ');
    const effect = statuses ? ` Эффект: ${statuses}.` :
        result.guardReduction ? ' Следующий удар ослаблен!' :
        (skill.freeze || skill.poison || skill.burn || skill.bleed || skill.weaken) ? ' Противник сопротивляется эффекту!' : '';
    showBattleMessage(`${skill.name}! ${result.damage ? `Урон: ${result.damage}.` : ''}${effect}`);
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

export function playerUseItem() {
    if (isProcessing) return;
    if (!battleState.isActive) return;
    if (battleState.turn !== 'player') return;
    
    const player = gameState.player;
    
    const potionIndex = player.inventory.findIndex(item => item.id === 'health_potion' && item.quantity > 0);
    
    if (potionIndex === -1) {
        showBattleMessage('У вас нет зелий!');
        return;
    }
    
    const potion = player.inventory[potionIndex];
    const potionData = getItem(potion.id);
    const healAmount = consumeHealingPotion(player, potion, potionData);
    if (!healAmount) {
        showBattleMessage('Здоровье уже полностью восстановлено!');
        return;
    }
    isProcessing = true;
    disableBattleButtons();
    
    showBattleMessage(`Вы использовали ${potionData.name}! +${healAmount} HP`);
    
    gameState.save();
    
    battleState.turn = 'enemy';
    setTimeout(() => {
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
        showBattleMessage('Вы успешно сбежали!');
        setTimeout(() => {
            if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
            isProcessing = false;
            
            // Проверяем, в локации ли мы
            const locationState = window.getLocationState?.();
            if (locationState && locationState.inLocation) {
                window.fleeLocation?.();
            } else {
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
    
    if (!battleState.isActive || !enemy) return;
    const effects = tickEnemyEffects(enemy);
    if (effects.poisonDamage) {
        showBattleMessage(`Яд наносит ${effects.poisonDamage} урона!`);
    }
    if (effects.burnDamage || effects.bleedDamage) {
        showBattleMessage(`Горение и кровотечение: ${effects.burnDamage + effects.bleedDamage} урона!`);
    }
    if (enemy.health <= 0) {
        battleVictory();
        return;
    }
    if (effects.frozen) {
        const interrupted = interruptEnemyWindup(enemy);
        battleState.guardReduction = 0;
        battleState.turn = 'player';
        isProcessing = false;
        showBattleMessage(`${enemy.name} пропускает ход из-за заморозки!${interrupted ? ' Подготовка опасного удара сорвана!' : ''}`);
        updateBattleUI();
        return;
    }
    const plan = planEnemyTurn(enemy, player);
    if (plan.phaseChanged) showBattleMessage(`⚡ ${enemy.name} переходит в фазу ${plan.phase}!`);
    if (plan.warned) {
        battleState.turn = 'player';
        isProcessing = false;
        showBattleMessage(`⚠️ ${enemy.name} готовит особый удар! Защищайтесь или прервите подготовку!`);
        updateBattleUI();
        return;
    }
    const action = plan.action;
    const actionName = {
        attack: 'атакует', heavy: 'готовит мощный удар',
        mana_burn: 'готовит истощение маны', recover: 'восстанавливается',
        ambush: 'устраивает засаду', crush: 'наносит сокрушительный удар сквозь броню',
        siphon: 'высасывает жизненные силы', flame_breath: 'извергает пламя'
    }[action];
    showBattleMessage(`${enemy.name} ${actionName}!`);
    
    battleState.enemySprite.isAttacking = true;
    
    setTimeout(() => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        SoundSystem.playSound('hit');
        
        const result = applyEnemyAction(enemy, player, action, Math.floor(Math.random() * 5), battleState.guardReduction);
        const damage = result.damage;
        const reborn = tryPhoenixRebirth(player, battleState.relicEffects);
        battleState.guardReduction = 0;
        gameState.save();
        
        if (damage) addDamageText(battleState.playerSprite.x, battleState.playerSprite.y - 50, damage);
        
        particleSystem.createExplosion(
            battleState.playerSprite.x,
            battleState.playerSprite.y,
            '#4444ff',
            10
        );
        
        battleState.enemySprite.isAttacking = false;
        
        showBattleMessage(reborn ? '🔥 Корона феникса спасает вас от гибели! Здоровье восстановлено.' : result.healed ? `${enemy.name} восстанавливает ${result.healed} HP!` :
            `${enemy.name} наносит ${damage} урона!${result.manaBurned ? ` -${result.manaBurned} MP` : ''}${result.reflected ? ` Контратака: ${result.reflected} урона!` : ''}${result.lifeStolen ? ` Вампиризм: +${result.lifeStolen} HP!` : ''}${result.soulDrain ? ` Похищение жизни: +${result.soulDrain} HP!` : ''}${result.enraged ? ' ЯРОСТЬ!' : ''}`);
        
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

function addDamageText(x, y, damage, isCrit = false) {
    const color = isCrit ? '#ff4444' : '#ffd700';
    const text = isCrit ? `CRIT! ${damage}` : `-${damage}`;
    damageTexts.push(new DamageText(x, y, text, color));
}

export function battleVictory() {
    const player = gameState.player;
    const enemy = battleState.currentEnemy;
    
    if (!battleState.isActive || !enemy || enemy.health > 0) return;
    
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
    
    window.updateQuestProgress?.('kill', 1);
    window.updateQuestProgress?.('win', 1);
    window.updateQuestProgress?.('gold', goldGain);
    window.updateQuestProgress?.('level', player.level);
    
    window.updateAchievements?.();
    
    const lootId = rollLoot(battleState.isBossBattle);
    const lootQuantity = lootId ? grantItem(player, lootId) : 0;
    const lootText = lootQuantity ? ` 🎁 Добыча: ${getItem(lootId).name}!` : '';
    const relicId = awardRelic(player, enemy.elite === true || enemy.miniBoss === true, battleState.isBossBattle && !enemy.miniBoss);
    const relicText = relicId ? ` 🌟 Реликвия: ${RELICS[relicId].name}!` : '';
    showBattleMessage(`Победа! +${expGain} EXP, +${goldGain} золота!${lootText}${relicText}`);
    
    if (player.experience >= player.maxExperience) {
        window.levelUp?.();
    }
    
    gameState.save();
    window.updateMainMenu?.();
    
    const locationState = window.getLocationState?.();
    
    if (locationState && locationState.inLocation) {
        if (battleState.isBossBattle) {
            window.handleBossVictory?.();
        } else {
            window.handleVictory?.();
        }
    } else {
        setTimeout(() => {
            exitBattle();
        }, 2000);
    }
}

export function battleDefeat() {
    const player = gameState.player;
    if (!battleState.isActive || !player || player.health > 0) return;
    
    battleState.isActive = false;
    isProcessing = false;
    
    const goldLoss = Math.floor(player.gold * 0.1);
    player.gold -= goldLoss;
    player.health = 1;
    player.stats.losses++;
    
    showBattleMessage(`Вы погибли! Потеряно ${goldLoss} золота!`);
    
    window.handleDefeat?.();
    window.resetLocationState?.();
    
    gameState.save();
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
    battleState.currentEnemy = null;
    battleState.isDungeonBattle = false;
    battleState.isBossBattle = false;
    battleState.isLocationBattle = false;
    battleState.guardReduction = 0;
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
