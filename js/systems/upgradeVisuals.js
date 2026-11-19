const THEMES = Object.freeze({iron_sword:'steel',ember_sword:'ember',dragon_sword:'dragon',frost_blade:'frost',blood_dagger:'blood',moonblade:'moon',guardian_armor:'ember',frost_armor:'frost',blood_armor:'blood'});
export function getUpgradeVisualProfile(itemId, level=0) {
 const safeLevel=Math.max(0,Math.min(10,Math.floor(Number(level)||0)));
 const theme=THEMES[itemId]||'arcane';
 const tier=safeLevel===0?'base':safeLevel<=3?'etched':safeLevel<=6?'glowing':safeLevel<=9?'awakened':'ascended';
 return {level:safeLevel,theme,tier,className:safeLevel?'upgrade-'+tier+' theme-'+theme:''};
}