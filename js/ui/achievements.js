// Экран достижений
import { gameState } from '../core/state.js';
import { ACHIEVEMENTS, getAchievement, getAchievementsByCategory } from '../data/achievements.js';
import { ACHIEVEMENT_CATEGORIES } from '../config/constants.js';
import { createPlayerSnapshot, commitPlayerMutation } from '../systems/playerTransactions.js';

export function updateAchievementsScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('achievements-content');
    
    const playerAchievements = player.achievements || [];
    
    const totalAchievements = ACHIEVEMENTS.length;
    const completedCount = playerAchievements.filter(a => a.completed).length;
    
    content.innerHTML = `
        <div class="achievements-summary">
            <div class="summary-count">${completedCount}/${totalAchievements}</div>
            <div class="summary-label">Достижений получено</div>
        </div>
        
        ${Object.entries(ACHIEVEMENT_CATEGORIES).map(([categoryId, category]) => {
            const categoryAchievements = getAchievementsByCategory(categoryId);
            
            return `
                <div class="section-title">${category.name}</div>
                <div class="achievements-list">
                    ${categoryAchievements.map(achievement => 
                        createAchievementCard(achievement, playerAchievements)
                    ).join('')}
                </div>
            `;
        }).join('')}
    `;
}

function createAchievementCard(achievement, playerAchievements) {
    const playerAchievement = playerAchievements.find(a => a.id === achievement.id);
    const progress = playerAchievement ? playerAchievement.progress : 0;
    const completed = playerAchievement ? playerAchievement.completed : false;
    const claimed = playerAchievement ? playerAchievement.claimed : false;
    
    return `
        <div class="achievement-card ${completed ? 'completed' : ''} ${claimed ? 'claimed' : ''}">
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-description">${achievement.description}</div>
                <div class="achievement-progress-bar">
                    <div class="achievement-progress-fill" style="width: ${Math.min(100, (progress / achievement.target) * 100)}%"></div>
                </div>
                <div class="achievement-progress-text">${progress}/${achievement.target}</div>
            </div>
            <div class="achievement-status">
                ${completed ? (claimed ? '✅' : '🎁') : '🔒'}
            </div>
            ${completed && !claimed ? `
                <button class="achievement-claim-btn" onclick="window.claimAchievement('${achievement.id}')">
                    Получить
                </button>
            ` : ''}
        </div>
    `;
}

export function updateAchievements({ save = true, notifications = null } = {}) {
    const player = gameState.player;
    if (!player) return false;
    const snapshot = save ? createPlayerSnapshot(player) : null;
    if (save && !snapshot) return false;
    const newlyCompleted = [];

    if (!player.achievements) player.achievements = [];
    ACHIEVEMENTS.forEach(achievement => {
        let playerAchievement = player.achievements.find(entry => entry.id === achievement.id);
        if (!playerAchievement) {
            playerAchievement = { id: achievement.id, progress: 0, completed: false, claimed: false };
            player.achievements.push(playerAchievement);
        }

        switch (achievement.stat) {
            case 'kills': playerAchievement.progress = player.stats.kills; break;
            case 'wins': playerAchievement.progress = player.stats.wins; break;
            case 'level': playerAchievement.progress = player.level; break;
            case 'gold': playerAchievement.progress = player.gold; break;
            case 'dungeons_completed': playerAchievement.progress = player.stats.dungeonsCompleted || 0; break;
            case 'bosses_killed': playerAchievement.progress = player.stats.bossesKilled || 0; break;
        }

        if (playerAchievement.progress >= achievement.target && !playerAchievement.completed) {
            playerAchievement.completed = true;
            newlyCompleted.push(achievement.name);
        }
    });

    if (save && !commitPlayerMutation(player, snapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить прогресс достижений. Изменения отменены.', 'error');
        return false;
    }
    newlyCompleted.forEach(name => {
        if (Array.isArray(notifications)) notifications.push({ kind: 'achievement', name });
        else window.showNotification?.(`🏆 Достижение получено: ${name}!`, 'success');
    });
    return true;
}

export function claimAchievement(achievementId) {
    const player = gameState.player;
    if (!player) return false;

    const playerAchievement = player.achievements.find(entry => entry.id === achievementId);
    if (!playerAchievement || !playerAchievement.completed || playerAchievement.claimed) return false;
    const achievementData = getAchievement(achievementId);
    if (!achievementData ||
        !Number.isSafeInteger(player.experience) || player.experience < 0 ||
        !Number.isSafeInteger(player.gold) || player.gold < 0 ||
        !Number.isSafeInteger(achievementData.rewardExp) || achievementData.rewardExp < 0 ||
        !Number.isSafeInteger(achievementData.rewardGold) || achievementData.rewardGold < 0 ||
        player.experience > Number.MAX_SAFE_INTEGER - achievementData.rewardExp ||
        player.gold > Number.MAX_SAFE_INTEGER - achievementData.rewardGold) return false;

    const snapshot = createPlayerSnapshot(player);
    if (!snapshot) return false;
    player.experience += achievementData.rewardExp;
    player.gold += achievementData.rewardGold;
    playerAchievement.claimed = true;

    if (player.experience >= player.maxExperience) window.levelUp?.({ save: false });
    if (!commitPlayerMutation(player, snapshot, () => gameState.save())) {
        window.showNotification?.('Не удалось сохранить награду достижения. Награда не выдана — попробуйте ещё раз.', 'error');
        return false;
    }

    window.showNotification?.(`🎁 Награда получена: ${achievementData.name}!`, 'success');
    updateAchievementsScreen();
    window.updateMainMenu?.();
    window.updateCharacterScreen?.();
    return true;
}
