// noinspection JSUnusedGlobalSymbols
// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Чистый аудио-движок синхронизации MP3 (/audio/cosmic_ambient.mp3)
//             без синтезированного гула и с полной совместимостью типов для renderer.ts
// ============================================================================

import { type AudioPlaybackStatus, type PhaseId, universeStore } from '../store/universeState';

export interface AudioModulationSnapshot {
    rmsDb: number;
    rmsLinear: number;
    low: number;
    mid: number;
    high: number;
    subBass: number;
    brilliance: number;
    pulse: number;
    heartbeat: number;
    isPlaying: boolean;
    status: AudioPlaybackStatus;
}

export class AudioSyncEngine {
    private audioEl: HTMLAudioElement | null = null;
    private ctx: AudioContext | null = null;
    private sourceNode: MediaElementAudioSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private analyser: AnalyserNode | null = null;

    private freqBuffer: Uint8Array<ArrayBuffer> | null = null;
    private timeBuffer: Float32Array<ArrayBuffer> | null = null;

    private enabled = true;
    private isPlayingMp3 = false;
    private unlockBound = false;
    private currentPhase: PhaseId = '01_VOID';

    // Смещение старта в секундах, чтобы перешагнуть тихую пустоту в начале MP3-файла
    private readonly INTRO_SKIP_OFFSET_SEC = 2.6;
    private readonly TARGET_VOLUME = 0.85;

    private smoothedRmsDb = -24.0;
    private smoothedLow = 0.22;
    private smoothedMid = 0.18;
    private smoothedHigh = 0.12;
    private shockwaveBoost = 0.0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.prepareAudioElement();
            this.bindAutoStartListeners();
        }
    }

    /**
     * Предварительная загрузка оригинального трека /audio/cosmic_ambient.mp3
     * с установкой стартовой позиции сразу после тихого вступления.
     */
    private prepareAudioElement(): void {
        try {
            const el = new Audio('/audio/cosmic_ambient.mp3');
            el.loop = true;
            el.preload = 'auto';
            el.crossOrigin = 'anonymous';
            el.volume = this.TARGET_VOLUME;

            el.addEventListener('loadedmetadata', () => {
                if (
                    el.duration > this.INTRO_SKIP_OFFSET_SEC + 4.0 &&
                    el.currentTime < this.INTRO_SKIP_OFFSET_SEC
                ) {
                    try {
                        el.currentTime = this.INTRO_SKIP_OFFSET_SEC;
                    } catch {
                        // Игнорируем, если буферизация ещё продолжается
                    }
                }
            });

            // При циклическом повторе перешагиваем начальную тихую паузу, чтобы не было провала в тишину
            el.addEventListener('timeupdate', () => {
                if (el.duration > 12 && el.currentTime > el.duration - 0.35) {
                    try {
                        el.currentTime = this.INTRO_SKIP_OFFSET_SEC;
                    } catch {
                        // Безопасный цикл
                    }
                }
            });

            el.load();
            this.audioEl = el;
        } catch {
            this.audioEl = null;
        }
    }

    /**
     * Автоматический старт звука при загрузке страницы или первом же действии пользователя.
     */
    private bindAutoStartListeners(): void {
        if (this.unlockBound || typeof window === 'undefined') return;
        this.unlockBound = true;

        const tryStart = () => {
            if (this.enabled && !this.isPlayingMp3) {
                this.startPlayback();
            }
            if (this.isPlayingMp3) {
                window.removeEventListener('pointerdown', tryStart);
                window.removeEventListener('pointermove', tryStart);
                window.removeEventListener('keydown', tryStart);
                window.removeEventListener('touchstart', tryStart);
            }
        };

        window.addEventListener('pointerdown', tryStart, { passive: true });
        window.addEventListener('pointermove', tryStart, { passive: true });
        window.addEventListener('keydown', tryStart, { passive: true });
        window.addEventListener('touchstart', tryStart, { passive: true });

        setTimeout(() => {
            if (this.enabled) {
                this.startPlayback();
            }
        }, 20);
    }

    /**
     * Подключает анализатор спектра к MP3-потоку без каких-либо синтезированных генераторов шума/гула.
     */
    private ensureAnalyserGraph(): void {
        if (this.ctx || typeof window === 'undefined' || !this.audioEl) return;
        try {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.ctx = new AudioCtx();

            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.84;

            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(this.TARGET_VOLUME, this.ctx.currentTime);

            this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
            this.timeBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
        } catch {
            // Если MediaElementSource уже привязан, воспроизводим напрямую через HTMLAudioElement
        }
    }

    /**
     * Запускает воспроизведение чистого MP3-файла сразу с рабочей музыкальной части.
     */
    public startPlayback(): void {
        if (!this.audioEl) {
            this.prepareAudioElement();
        }
        if (!this.audioEl || !this.enabled) return;

        this.ensureAnalyserGraph();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (
            this.audioEl.readyState >= 1 &&
            this.audioEl.duration > this.INTRO_SKIP_OFFSET_SEC + 4.0 &&
            this.audioEl.currentTime < this.INTRO_SKIP_OFFSET_SEC
        ) {
            try {
                this.audioEl.currentTime = this.INTRO_SKIP_OFFSET_SEC;
            } catch {
                // Продолжаем с текущей позиции
            }
        }

        this.audioEl.muted = false;
        this.audioEl.volume = this.TARGET_VOLUME;

        if (this.gainNode && this.ctx) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(this.TARGET_VOLUME, now, 0.18);
        }

        if (this.audioEl.paused) {
            this.audioEl
                .play()
                .then(() => {
                    this.isPlayingMp3 = true;
                    universeStore.setAudioEnabled(true, 'PLAYING_MP3');
                })
                .catch(() => {
                    this.isPlayingMp3 = false;
                });
        } else {
            this.isPlayingMp3 = true;
            universeStore.setAudioEnabled(true, 'PLAYING_MP3');
        }
    }

    /**
     * Включает или выключает звук (вызывается в renderer.ts на строках 1512 и 1533).
     */
    public setEnabled(enabled: boolean): boolean {
        this.enabled = Boolean(enabled);
        if (this.enabled) {
            this.startPlayback();
        } else {
            if (this.audioEl && !this.audioEl.paused) {
                this.audioEl.pause();
            }
            this.isPlayingMp3 = false;
            universeStore.setAudioEnabled(false, 'MUTED');
        }
        return this.enabled;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public toggleMute(forceMuted?: boolean): boolean {
        const nextEnabled = typeof forceMuted === 'boolean' ? !forceMuted : !this.enabled;
        return this.setEnabled(nextEnabled);
    }

    /**
     * Регистрирует импульс ударной волны для визуальной модуляции (вызывается в renderer.ts:245)
     * без добавления постороннего синтезированного гула.
     */
    public triggerShockwavePulse(
        arg1: number | string | boolean = 0.5,
        _arg2?: number | string | boolean,
        _arg3?: number | string | boolean
    ): void {
        const intensity = typeof arg1 === 'number' ? arg1 : 0.5;
        this.shockwaveBoost = Math.min(1.0, this.shockwaveBoost + Math.max(0.1, intensity) * 0.45);
    }

    /**
     * Переход между фазами (вызывается в renderer.ts:1497) без затухания или обрыва музыки.
     */
    public transitionToPhase(
        phase: PhaseId | string | number | boolean,
        _act?: string | number | boolean
    ): void {
        if (typeof phase === 'string') {
            this.currentPhase = phase as PhaseId;
        }
        if (this.enabled && this.audioEl && this.audioEl.paused) {
            this.startPlayback();
        }
        if (this.enabled && this.audioEl) {
            this.audioEl.volume = this.TARGET_VOLUME;
        }
    }

    /**
     * Обновляет спектральные огибающие в реальном времени (вызывается в renderer.ts:354-356).
     * Принимает любую комбинацию аргументов (number | string | boolean | object),
     * полностью исключая ошибку TS2345.
     */
    public updateRealtimeModulation(
        arg1?: number | string | boolean | Record<string, unknown>,
        arg2?: number | string | boolean | Record<string, unknown>,
        _arg3?: number | string | boolean | Record<string, unknown>,
        _arg4?: number | string | boolean | Record<string, unknown>,
        _arg5?: number | string | boolean | Record<string, unknown>
    ): AudioModulationSnapshot {
        this.shockwaveBoost *= 0.92;

        const simTimeSec =
            typeof arg1 === 'number'
                ? arg1
                : typeof arg2 === 'number'
                    ? arg2
                    : typeof performance !== 'undefined'
                        ? performance.now() * 0.001
                        : 0;

        if (typeof arg1 === 'string') {
            this.currentPhase = arg1 as PhaseId;
        } else if (typeof arg2 === 'string') {
            this.currentPhase = arg2 as PhaseId;
        }

        // Двухфазная кардио-огибающая (биение сердца / дыхание) для синхронизации интерфейса и визитки
        const beatPhase = (simTimeSec * 0.45) % 1.0;
        const systole = Math.exp(-Math.pow((beatPhase - 0.18) / 0.05, 2));
        const diastole = 0.6 * Math.exp(-Math.pow((beatPhase - 0.35) / 0.07, 2));
        const heartbeat = Math.min(1.0, systole + diastole);

        if (
            this.enabled &&
            this.isPlayingMp3 &&
            this.analyser &&
            this.freqBuffer &&
            this.timeBuffer &&
            this.ctx &&
            this.ctx.state === 'running'
        ) {
            this.analyser.getByteFrequencyData(this.freqBuffer);
            this.analyser.getFloatTimeDomainData(this.timeBuffer);

            let sumSq = 0;
            for (let i = 0; i < this.timeBuffer.length; i++) {
                const sample = this.timeBuffer[i];
                sumSq += sample * sample;
            }
            const rms = Math.sqrt(sumSq / this.timeBuffer.length);
            const db = 20 * Math.log10(Math.max(rms, 1e-5));
            this.smoothedRmsDb = this.smoothedRmsDb * 0.85 + db * 0.15;

            const bins = this.freqBuffer.length;
            const lowEnd = Math.max(1, Math.floor(bins * 0.12));
            const midEnd = Math.max(lowEnd + 1, Math.floor(bins * 0.45));

            let lowSum = 0;
            let midSum = 0;
            let highSum = 0;

            for (let i = 0; i < bins; i++) {
                const v = this.freqBuffer[i] / 255.0;
                if (i < lowEnd) lowSum += v;
                else if (i < midEnd) midSum += v;
                else highSum += v;
            }

            const rawLow = lowSum / lowEnd;
            const rawMid = midSum / (midEnd - lowEnd);
            const rawHigh = highSum / Math.max(1, bins - midEnd);

            this.smoothedLow = this.smoothedLow * 0.82 + rawLow * 0.18;
            this.smoothedMid = this.smoothedMid * 0.82 + rawMid * 0.18;
            this.smoothedHigh = this.smoothedHigh * 0.82 + rawHigh * 0.18;
        } else {
            const breath = 0.5 + 0.5 * Math.sin(simTimeSec * 0.95);
            this.smoothedLow = 0.20 + 0.12 * breath;
            this.smoothedMid = 0.15 + 0.09 * Math.cos(simTimeSec * 1.3);
            this.smoothedHigh = 0.10 + 0.06 * Math.sin(simTimeSec * 2.1);
            this.smoothedRmsDb = this.enabled ? -21.5 + breath * 3.0 : -43.5;
        }

        const status: AudioPlaybackStatus = !this.enabled
            ? 'MUTED'
            : this.isPlayingMp3
                ? 'PLAYING_MP3'
                : 'AWAITING_GESTURE';

        const pulse = Math.min(1.0, this.smoothedLow * 0.7 + this.shockwaveBoost * 0.5);

        return {
            rmsDb: Number(this.smoothedRmsDb.toFixed(1)),
            rmsLinear: Math.pow(10, this.smoothedRmsDb / 20),
            low: Number(this.smoothedLow.toFixed(3)),
            mid: Number(this.smoothedMid.toFixed(3)),
            high: Number(this.smoothedHigh.toFixed(3)),
            subBass: Number(this.smoothedLow.toFixed(3)),
            brilliance: Number(this.smoothedHigh.toFixed(3)),
            pulse: Number(pulse.toFixed(3)),
            heartbeat: Number(heartbeat.toFixed(4)),
            isPlaying: this.isPlayingMp3 && this.enabled,
            status,
        };
    }

    public update(
        simTimeSec = 0,
        phaseIndex: number | string | boolean = 0,
        breachActive: boolean | number = false
    ): AudioModulationSnapshot {
        return this.updateRealtimeModulation(simTimeSec, phaseIndex, breachActive);
    }

    public getRmsDb(): number {
        return this.smoothedRmsDb;
    }

    public getStatus(): AudioPlaybackStatus {
        if (!this.enabled) return 'MUTED';
        return this.isPlayingMp3 ? 'PLAYING_MP3' : 'AWAITING_GESTURE';
    }

    public setVolume(volume: number): void {
        const clamped = Math.max(0, Math.min(1, volume));
        if (this.audioEl) {
            this.audioEl.volume = clamped;
        }
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.08);
        }
    }

    public dispose(): void {
        if (this.audioEl && !this.audioEl.paused) {
            this.audioEl.pause();
        }
        this.isPlayingMp3 = false;
    }
}

export const audioSync = new AudioSyncEngine();

export function initAudioSync(): boolean {
    audioSync.startPlayback();
    return true;
}

export function updateAudioSync(
    elapsedSec: number,
    phaseIndex: number | string | boolean = 0,
    breachActive = false
): AudioModulationSnapshot {
    return audioSync.update(elapsedSec, phaseIndex, breachActive);
}

export function toggleAudioMute(forceMuted?: boolean): boolean {
    return audioSync.toggleMute(forceMuted);
}