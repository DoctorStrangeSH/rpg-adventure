// Звуковая система
export const SoundSystem = {
    audioContext: null,
    enabled: true,
    
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },
    
    playSound(type) {
        if (!this.enabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const sounds = {
            attack: { freq: 200, endFreq: 100, duration: 0.1, volume: 0.3 },
            hit: { freq: 100, endFreq: 50, duration: 0.15, volume: 0.4 },
            victory: { freq: 400, endFreq: 800, duration: 0.3, volume: 0.3, type: 'square' },
            defeat: { freq: 300, endFreq: 100, duration: 0.5, volume: 0.3, type: 'sawtooth' },
            levelup: { freq: 500, endFreq: 1000, duration: 0.4, volume: 0.3, type: 'sine' },
            item: { freq: 600, endFreq: 800, duration: 0.2, volume: 0.2, type: 'sine' }
        };
        
        const sound = sounds[type];
        if (!sound) return;
        
        if (sound.type) {
            oscillator.type = sound.type;
        }
        
        oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(sound.endFreq, this.audioContext.currentTime + sound.duration);
        
        gainNode.gain.setValueAtTime(sound.volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + sound.duration);
    }
};