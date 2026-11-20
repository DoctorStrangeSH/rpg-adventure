import { ENEMY_REGISTRY } from './enemies.js';
import { ITEM_REGISTRY } from './items.js';
import { QUEST_REGISTRY } from './quests.js';
import { LOCATION_REGISTRY } from './locations.js';

/** Checks cross-links between content catalogs before a release is accepted. */
export function validateContentReferences({
    enemies = ENEMY_REGISTRY,
    items = ITEM_REGISTRY,
    quests = QUEST_REGISTRY,
    locations = LOCATION_REGISTRY
} = {}) {
    const errors = [];
    for (const location of locations.list()) {
        for (const stage of location.stages || []) {
            for (const enemyId of stage.enemies || []) {
                if (!enemies.has(enemyId)) errors.push(`location:${location.id} references missing enemy:${enemyId}`);
            }
        }
        for (const reward of location.rewards?.items || []) {
            if (!items.has(reward.id)) errors.push(`location:${location.id} rewards missing item:${reward.id}`);
        }
    }
    for (const quest of quests.list()) {
        for (const reward of quest.rewardItems || []) {
            if (!items.has(reward.id)) errors.push(`quest:${quest.id} rewards missing item:${reward.id}`);
        }
    }
    return { valid: errors.length === 0, errors };
}
