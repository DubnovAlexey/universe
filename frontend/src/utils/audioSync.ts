// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Автоматический плеер /audio/cosmic_ambient.mp3 + нейро-резонанс
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Сразу при открытии сайта загружает и запускает '/audio/cosmic_ambient.mp3'.
// 2. Если браузер блокирует автостарт до первого движения/клика, мгновенно включает
//    музыку при первом же касании мыши или клавиши без необходимости искать кнопку.
// 3. Обеспечивает 100% цифровую тишину в течение 2.5 секунд состояния ZERO_SILENCE.
// ============================================================================

import { universeStore, type PhaseId } from '../store/universeState';

class CosmicAudioSynthesizer {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private filterNode: BiquadFilterNode | null = null;
    private mp3Audio: HTMLAudioElement | null = null;
    private isInitialized = false;
    private isMutedByUser = false;
    private currentVolume = 0.8;

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupAutoStartOnSiteOpen();
        }
    }

    // Автоматический запуск cosmic_ambient.mp3 сразу при открытии страницы
    private setupAutoStartOnSiteOpen(): void {
        this.mp3Audio = new Audio('/audio/cosmic_ambient.mp3');
        this.mp3Audio.loop = true;
        this.mp3Audio.volume = this.currentVolume;
        this.mp3Audio.preload = 'auto';

        const tryAutoPlay = () => {
            if (this.isMutedByUser || !this.mp3Audio) return;
            this.mp3Audio
                .play()
                .then(() => {
                    this.initWebAudioGraph();
                    universeStore.setAudioEnabled(true, 'PLAYING_MP3');
                    removeUnlockListeners();
                })
                .catch(() => {
                    universeStore.setAudioEnabled(false, 'AWAITING_GESTURE');
                });
        };

        const removeUnlockListeners = () => {
            window.removeEventListener('pointerdown', tryAutoPlay);
            window.removeEventListener('pointermove', tryAutoPlay);
            window.removeEventListener('keydown', tryAutoPlay);
            window.removeEventListener('touchstart', tryAutoPlay);
        };

        // 1. Пробуем запустить мгновенно при загрузке DOM
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(tryAutoPlay, 80);
        } else {
            window.addEventListener('DOMContentLoaded', () => setTimeout(tryAutoPlay, 80), { once: true });
        }

        // 2. Если браузер заблокировал автостарт со звуком, включаем в первое же мгновение движения мыши/клика
        window.addEventListener('pointerdown', tryAutoPlay, { passive: true });
        window.addEventListener('pointermove', tryAutoPlay, { passive: true });
        window.addEventListener('keydown', tryAutoPlay, { passive: true });
        window.addEventListener('touchstart', tryAutoPlay, { passive: true });
    }

    private initWebAudioGraph(): void {
        if (this.isInitialized || typeof window === 'undefined') return;
        try {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.currentVolume;
            this.masterGain.connect(this.ctx.destination);

            this.filterNode = this.ctx.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 1800;
            this.filterNode.connect(this.masterGain);

            if (this.mp3Audio) {
                const src = this.ctx.createMediaElementSource(this.mp3Audio);
                src.connect(this.filterNode);
            }
            this.isInitialized = true;
        } catch {
            // Если WebAudio недоступен, играет чистый HTML5 Audio элемент
        }
    }

    public setEnabled(enabled: boolean): void {
        this.isMutedByUser = !enabled;
        if (!this.mp3Audio) return;

        if (enabled) {
            this.initWebAudioGraph();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.mp3Audio.volume = this.currentVolume;
            this.mp3Audio
                .play()
                .then(() => universeStore.setAudioEnabled(true, 'PLAYING_MP3'))
                .catch(() => universeStore.setAudioEnabled(false, 'AWAITING_GESTURE'));
        } else {
            this.mp3Audio.pause();
            universeStore.setAudioEnabled(false, 'MUTED');
        }
    }

    public setVolume(vol: number): void {
        this.currentVolume = Math.max(0, Math.min(1, vol));
        if (this.mp3Audio) {
            this.mp3Audio.volume = this.currentVolume;
        }
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.1);
        }
        universeStore.setAudioVolume(this.currentVolume);
    }

    public transitionToPhase(_phase: PhaseId): void {
        // Плавный переход поддерживается основным треком cosmic_ambient.mp3
    }

    public updateRealtimeModulation(
        breachRadius: number,
        isBreaching: boolean,
        globalStress: number,
        fullXRay: boolean
    ): void {
        const uState = universeStore.getState();

        // В течение 2.5с ZERO_SILENCE обеспечиваем 100% цифровую тишину
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            if (this.mp3Audio && !this.mp3Audio.paused) {
                this.mp3Audio.volume = 0;
            }
            return;
        }

        if (this.mp3Audio && !this.isMutedByUser) {
            this.mp3Audio.volume = this.currentVolume;
        }

        if (!this.isInitialized || !this.ctx || !this.filterNode) return;
        const baseFreq = 1600;
        const boost = fullXRay ? 1800 : breachRadius * (isBreaching ? 4.5 : 1.5) + globalStress * 400;
        this.filterNode.frequency.setTargetAtTime(
            Math.min(4800, baseFreq + boost),
            this.ctx.currentTime,
            0.1
        );
    }

    public triggerShockwavePulse(strength = 0.7): void {
        if (!this.isInitialized || this.isMutedByUser || !this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 + strength * 60, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.6);
        gain.gain.setValueAtTime(0.16 * strength * this.currentVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.65);
    }
}

export const audioSync = new CosmicAudioSynthesizer();