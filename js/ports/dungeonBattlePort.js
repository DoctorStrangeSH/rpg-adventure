// Port between dungeon orchestration and the battle presentation adapter.
// This module deliberately has no dependencies on UI or gameplay modules.
const EMPTY_BATTLE_STATE = Object.freeze({ isActive: false });
let adapter = Object.freeze({
    getState: () => EMPTY_BATTLE_STATE,
    resetPresentation: () => {},
    restoreEncounter: () => false,
    startEncounter: () => false
});

export function registerDungeonBattleAdapter(nextAdapter) {
    const requiredMethods = ['getState', 'resetPresentation', 'restoreEncounter', 'startEncounter'];
    if (!nextAdapter || requiredMethods.some(method => typeof nextAdapter[method] !== 'function')) {
        throw new TypeError('Dungeon battle adapter must implement the complete presentation contract');
    }
    adapter = Object.freeze({ ...nextAdapter });
}

export function getDungeonBattleState() {
    return adapter.getState() || EMPTY_BATTLE_STATE;
}

export function isDungeonBattleActive() {
    return getDungeonBattleState().isActive === true;
}

export function resetDungeonBattlePresentation() {
    return adapter.resetPresentation();
}

export function restoreDungeonEncounter(snapshot) {
    return adapter.restoreEncounter(snapshot);
}

export function startDungeonEncounter(options) {
    return adapter.startEncounter(options);
}
