// Экран квестов
import { gameState } from '../core/state.js';
import { QUESTS, getQuest } from '../data/quests.js';
import { getItem } from '../data/items.js';

export function updateQuestsScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('quests-content');
    
    const activeQuests = [];
    const completedQuests = [];
    
    QUESTS.forEach(quest => {
        const playerQuest = player.quests.find(pq => pq.id === quest.id);
        
        if (playerQuest) {
            if (playerQuest.completed) {
                completedQuests.push({ quest, playerQuest });
            } else {
                activeQuests.push({ quest, playerQuest });
            }
        } else {
            const newQuest = {
                id: quest.id,
                progress: 0,
                completed: false,
                rewardClaimed: false
            };
            player.quests.push(newQuest);
            activeQuests.push({ quest, playerQuest: newQuest });
        }
    });
    
    gameState.save();
    
    content.innerHTML = `
        <div class="section-title">📜 Активные квесты</div>
        <div class="quests-list">
            ${activeQuests.length > 0 ? activeQuests.map(({ quest, playerQuest }) => 
                createQuestCard(quest, playerQuest, false)
            ).join('') : '<p style="text-align: center; color: var(--text-muted);">Нет активных квестов</p>'}
        </div>
        
        <div class="section-title">✅ Выполненные квесты</div>
        <div class="quests-list">
            ${completedQuests.length > 0 ? completedQuests.map(({ quest, playerQuest }) => 
                createQuestCard(quest, playerQuest, true)
            ).join('') : '<p style="text-align: center; color: var(--text-muted);">Нет выполненных квестов</p>'}
        </div>
    `;
}

function createQuestCard(quest, playerQuest, isCompleted) {
    return `
        <div class="quest-card ${isCompleted ? 'completed' : ''}">
            <div class="quest-header">
                <div class="quest-name">${quest.name}</div>
                <div class="quest-progress">${playerQuest.progress}/${quest.target}</div>
            </div>
            <div class="quest-description">${quest.description}</div>
            <div class="quest-progress-bar">
                <div class="quest-progress-fill" style="width: ${(playerQuest.progress / quest.target) * 100}%"></div>
            </div>
            <div class="quest-rewards">
                <span>✨ ${quest.rewardExp} опыта</span>
                <span>💰 ${quest.rewardGold} золота</span>
                ${quest.rewardItems.map(item => 
                    `<span>${getItem(item.id).icon} ${getItem(item.id).name} x${item.quantity}</span>`
                ).join('')}
            </div>
            ${isCompleted && !playerQuest.rewardClaimed ? `
                <button class="quest-claim-btn" onclick="window.claimQuestReward('${quest.id}')">
                    Получить награду
                </button>
            ` : ''}
            ${isCompleted && playerQuest.rewardClaimed ? `
                <div class="quest-status">✅ Награда получена</div>
            ` : ''}
        </div>
    `;
}

export function updateQuestProgress(type, amount = 1) {
    const player = gameState.player;
    if (!player) return;
    
    player.quests.forEach(playerQuest => {
        const questData = getQuest(playerQuest.id);
        
        if (!questData || playerQuest.completed) return;
        
        switch (questData.type) {
            case 'kill':
                if (type === 'kill') {
                    playerQuest.progress = Math.min(questData.target, playerQuest.progress + amount);
                }
                break;
            case 'win':
                if (type === 'win') {
                    playerQuest.progress = Math.min(questData.target, playerQuest.progress + amount);
                }
                break;
            case 'gold':
                if (type === 'gold') {
                    playerQuest.progress = Math.min(questData.target, player.gold);
                }
                break;
            case 'level':
                if (type === 'level') {
                    playerQuest.progress = Math.min(questData.target, player.level);
                }
                break;
        }
        
        if (playerQuest.progress >= questData.target) {
            playerQuest.completed = true;
            window.showNotification(`🎉 Квест выполнен: ${questData.name}!`, 'success');
        }
    });
    
    gameState.save();
}

export function claimQuestReward(questId) {
    const player = gameState.player;
    
    const playerQuest = player.quests.find(pq => pq.id === questId);
    if (!playerQuest || !playerQuest.completed || playerQuest.rewardClaimed) return;
    
    const questData = getQuest(questId);
    if (!questData) return;
    
    player.experience += questData.rewardExp;
    player.gold += questData.rewardGold;
    
    questData.rewardItems.forEach(rewardItem => {
        const existingItem = player.inventory.find(item => item.id === rewardItem.id);
        
        if (existingItem) {
            existingItem.quantity += rewardItem.quantity;
        } else {
            player.inventory.push({
                id: rewardItem.id,
                quantity: rewardItem.quantity
            });
        }
    });
    
    playerQuest.rewardClaimed = true;
    
    if (player.experience >= player.maxExperience) {
        window.levelUp?.();
    }
    
    window.showNotification(`🎁 Награда получена за квест: ${questData.name}!`, 'success');
    
    gameState.save();
    updateQuestsScreen();
    window.updateMainMenu?.();
    window.updateCharacterScreen?.();
}