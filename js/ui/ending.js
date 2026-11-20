import { gameState } from '../core/state.js';
import { startNewGamePlus } from '../systems/newGamePlus.js';

export function updateEndingScreen() {
    const content = document.getElementById('ending-content');
    const player = gameState.player;
    if (!content) return;

    if (!player?.campaignCompleted) {
        content.innerHTML = `
            <div class="ending-emblem">✦</div>
            <p class="ending-eyebrow">ПУТЬ ЕЩЁ НЕ ЗАВЕРШЁН</p>
            <h1 class="ending-title">Финал впереди</h1>
            <p class="ending-copy">Этот эпилог откроется после победы над Пожирателем миров и сохранения завершённой кампании.</p>
            <div class="ending-actions">
                <button class="menu-btn" onclick="window.showScreen('main-menu')">Вернуться в меню</button>
            </div>`;
        return;
    }

    const className = player.class === 'warrior' ? 'Воин' : player.class === 'mage' ? 'Маг' : 'Лучник';
    content.innerHTML = `
        <div class="ending-emblem">✦</div>
        <p class="ending-eyebrow">КОНЕЦ ПЕРВОГО ПУТИ</p>
        <h1 class="ending-title">Пепел рассеялся</h1>
        <p class="ending-copy">
            Пожиратель миров пал, и разлом, пожиравший земли, наконец сомкнулся.
            Дороги вновь принадлежат живым. Там, где вчера стояла тьма, загораются первые огни.
            Но мир помнит цену победы — и твой путь останется в его легендах.
        </p>
        <div class="ending-record">
            Завершено циклов: ${player.completedCampaignCycles || 1}<br>
            Текущий класс: ${className}<br>
            Уровень героя: ${player.level}
        </div>
        <div class="ending-actions">
            <button class="menu-btn" onclick="window.startNewGamePlus()">
                <span class="btn-icon">♻️</span>
                <span class="btn-text">Начать новую игру+</span>
                <span class="btn-arrow">→</span>
            </button>
            <button class="menu-btn" onclick="window.showScreen('main-menu')">
                <span class="btn-text">Вернуться в меню</span>
            </button>
        </div>`;
}

export function startNewGamePlusFromEnding() {
    if (!startNewGamePlus(gameState)) {
        window.showNotification?.('Не удалось начать новую игру+. Проверьте сохранение и попробуйте ещё раз.', 'error');
        return false;
    }
    window.initUI?.();
    window.showScreen?.('main-menu');
    window.updateMainMenu?.();
    window.showNotification?.(`Новый цикл ${gameState.player.campaignCycle} начался. Прогресс героя сохранён.`, 'success');
    return true;
}
