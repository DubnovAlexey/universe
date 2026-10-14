// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Гибридный аудио-движок (MP3-эмбиент + Процедурный нейро-резонанс)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Автоматически подхватывает трек '/audio/cosmic_ambient.mp3' из папки public/audio/.
// 2. Если MP3-файл еще не загружен, включает теплый многоголосный Ambient-Pad (Sine/Triangle).
// 3. Пропускает музыку через фильтр Линзы Разрыва (при клике звук раскрывается в кристалл).
// 4. Озвучивает синаптические импульсы и гравитационные волны мягкими глубокими тонами.
// ============================================================================

import type { PhaseId } from '../store/universeState';

interface PhaseAudioProfile {
    chordFreqs: [number, number, number]; // Тonика, квинта и октава теплого аккорда (Гц)
    filterCutoff: number;                 // Частота фильтрации (Гц)
    lfoRate: number;                      // Частота медленного дыхания космоса (Гц)
}

const PHASE_AUDIO_PROFILES: Record<PhaseId, PhaseAudioProfile> = {
    '01_VOID': {
        chordFreqs: [55.0, 82.41, 110.0],    // A1 - E2 - A2 (Глубокий покой)
        filterCutoff: 240,
        lfoRate: 0.12,
    },
    '02_GENESIS': {
        chordFreqs: [65.41, 98.0, 146.83],   // C2 - G2 - D3 (Пробуждение созвездий)
        filterCutoff: 340,
        lfoRate: 0.22,
    },
    '03_EVOLUTION': {
        chordFreqs: [73.42, 110.0, 164.81],  // D2 - A2 - E3 (Гармония нейросети)
        filterCutoff: 460,
        lfoRate: 0.35,
    },
    '04_COLLAPSE': {
        chordFreqs: [58.27, 87.31, 138.59],  // Bb1 - F2 - C#3 (Напряжение синапсов)
        filterCutoff: 640,
        lfoRate: 0.9,
    },
    '05_SINGULARITY': {
        chordFreqs: [110.0, 164.81, 220.0],  // A2 - E3 - A3 (Свет горизонта событий)
        filterCutoff: 980,
        lfoRate: 1.5,
    },
};

class CosmicAudioSynthesizer {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private filterNode: BiquadFilterNode | null = null;
    private padOscillators: OscillatorNode[] = [];
    private padGainNode: GainNode | null = null;
    private lfoOsc: OscillatorNode | null = null;

    // Поддержка пользовательского MP3-файла из frontend/public/audio/cosmic_ambient.mp3
    private mp3Element: HTMLAudioElement | null = null;
    private mp3UsingExternalTrack = false;

    private isInitialized = false;
    private isMuted = true;
    private currentPhase: PhaseId = '01_VOID';

    private initContext(): void {
        if (this.isInitialized) return;

        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();

        // 1. Мастер-громкость
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.0;
        this.masterGain.connect(this.ctx.destination);

        // 2. Мягкий фильтр для эффекта погружения (открывается при наведении Линзы Разрыва)
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = PHASE_AUDIO_PROFILES['01_VOID'].filterCutoff;
        this.filterNode.Q.value = 1.8;
        this.filterNode.connect(this.masterGain);

        // 3. Пытаемся подключить внешний MP3-файл '/audio/cosmic_ambient.mp3', если он положен в папку
        this.setupOptionalMp3Track();

        // 4. Создаем теплый 3-голосный синусоидальный Ambient-Pad (работает как бархатный фон)
        this.padGainNode = this.ctx.createGain();
        this.padGainNode.gain.value = 0.18;
        this.padGainNode.connect(this.filterNode);

        const initialChord = PHASE_AUDIO_PROFILES['01_VOID'].chordFreqs;
        const waveTypes: OscillatorType[] = ['sine', 'sine', 'triangle'];

        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = waveTypes[i];
            osc.frequency.value = initialChord[i];

            const voiceGain = this.ctx.createGain();
            voiceGain.gain.value = i === 0 ? 0.45 : 0.25;

            osc.connect(voiceGain);
            voiceGain.connect(this.padGainNode);
            osc.start();
            this.padOscillators.push(osc);
        }

        // 5. Медленное дыхание фильтра
        this.lfoOsc = this.ctx.createOscillator();
        this.lfoOsc.type = 'sine';
        this.lfoOsc.frequency.value = PHASE_AUDIO_PROFILES['01_VOID'].lfoRate;

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 35;
        this.lfoOsc.connect(lfoGain);
        lfoGain.connect(this.filterNode.frequency);
        this.lfoOsc.start();

        this.isInitialized = true;
    }

    // Проверка наличия файла /audio/cosmic_ambient.mp3
    private setupOptionalMp3Track(): void {
        if (!this.ctx || !this.filterNode) return;

        const audio = new Audio('/audio/cosmic_ambient.mp3');
        audio.loop = true;
        audio.crossOrigin = 'anonymous';

        audio.addEventListener('canplaythrough', () => {
            if (this.mp3UsingExternalTrack || !this.ctx || !this.filterNode) return;
            try {
                const mediaSource = this.ctx.createMediaElementSource(audio);
                const mp3Gain = this.ctx.createGain();
                mp3Gain.gain.value = 0.85;
                mediaSource.connect(mp3Gain);
                mp3Gain.connect(this.filterNode);
                this.mp3Element = audio;
                this.mp3UsingExternalTrack = true;

                // Приглушаем синтезатор, чтобы звучал чистый MP3-трек
                if (this.padGainNode) {
                    this.padGainNode.gain.setTargetAtTime(0.03, this.ctx.currentTime, 0.5);
                }
                if (!this.isMuted) {
                    audio.play().catch(() => {});
                }
            } catch {
                // Остаемся на встроенном Ambient-Pad
            }
        });

        audio.load();
    }

    public setEnabled(enabled: boolean): void {
        if (enabled && !this.isInitialized) {
            this.initContext();
        }
        if (!this.ctx || !this.masterGain) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.isMuted = !enabled;
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(enabled ? 0.32 : 0.0, now, 0.45);

        if (this.mp3Element) {
            if (enabled) {
                this.mp3Element.play().catch(() => {});
            } else {
                this.mp3Element.pause();
            }
        }
    }

    public transitionToPhase(phase: PhaseId): void {
        this.currentPhase = phase;
        if (!this.isInitialized || !this.ctx || !this.filterNode || !this.lfoOsc) return;

        const profile = PHASE_AUDIO_PROFILES[phase];
        const now = this.ctx.currentTime;

        for (let i = 0; i < this.padOscillators.length; i++) {
            this.padOscillators[i].frequency.setTargetAtTime(profile.chordFreqs[i], now, 1.2);
        }
        this.filterNode.frequency.setTargetAtTime(profile.filterCutoff, now, 0.8);
        this.lfoOsc.frequency.setTargetAtTime(profile.lfoRate, now, 0.6);
    }

    public updateRealtimeModulation(
        breachRadius: number,
        isBreaching: boolean,
        globalStress: number,
        fullXRay: boolean
    ): void {
        if (!this.isInitialized || this.isMuted || !this.ctx || !this.filterNode) return;

        const profile = PHASE_AUDIO_PROFILES[this.currentPhase];
        const breachBoost = fullXRay ? 1100 : breachRadius * (isBreaching ? 2.8 : 0.9);
        const stressBoost = globalStress * 380;

        const targetCutoff = Math.min(3200, profile.filterCutoff + breachBoost + stressBoost);
        this.filterNode.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.12);
    }

    public triggerShockwavePulse(strength = 0.8): void {
        if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) return;

        const now = this.ctx.currentTime;
        const pulseOsc = this.ctx.createOscillator();
        const pulseGain = this.ctx.createGain();

        pulseOsc.type = 'sine';
        pulseOsc.frequency.setValueAtTime(160 + strength * 80, now);
        pulseOsc.frequency.exponentialRampToValueAtTime(36, now + 0.75);

        pulseGain.gain.setValueAtTime(0.24 * strength, now);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

        pulseOsc.connect(pulseGain);
        pulseGain.connect(this.masterGain);

        pulseOsc.start(now);
        pulseOsc.stop(now + 0.78);
    }
}

export const audioSync = new CosmicAudioSynthesizer();