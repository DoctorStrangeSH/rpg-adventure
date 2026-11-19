const DEFAULT_BACKDROP = 'assets/backgrounds/moonlit-courtyard.webp';
const REGION_BACKDROPS = Object.freeze({
    forest: 'assets/backgrounds/dark-forest.webp',
    mountains: 'assets/backgrounds/forgotten-mountains.webp',
    ruins: 'assets/backgrounds/cursed-ruins.webp'
});

export function getArenaBackdropPath(locationId) {
    return REGION_BACKDROPS[locationId] || DEFAULT_BACKDROP;
}

// Images are cached across encounters: switching regions never downloads a
// new copy and a still-loading image always falls back to the shared arena.
export function createArenaBackdropCache(ImageConstructor = globalThis.Image) {
    const images = new Map();
    return {
        get(locationId) {
            if (typeof ImageConstructor !== 'function') return null;
            const path = getArenaBackdropPath(locationId);
            if (!images.has(path)) {
                const image = new ImageConstructor();
                image.src = path;
                images.set(path, image);
            }
            const image = images.get(path);
            if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
                return image;
            if (path === DEFAULT_BACKDROP) return null;
            return this.get(null);
        }
    };
}
