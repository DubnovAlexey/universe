// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Непрерывный аудио-движок синхронизации cosmic_ambient.mp3 и
//             спектрального анализа ритма/дыхания сцены (UNIVERSE v2.5)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Загрузка аудиопотока через import.meta.env.BASE_URL: бесшовное непрерывное
//    воспроизведение трека cosmic_ambient.mp3 без пауз при переключении фаз
//    или нажатии кнопки паузы симуляции (пользователь изучает сцену под музыку).
// 2. Граф Web Audio API (MediaElementAudioSourceNode -> GainNode -> AnalyserNode):
//    точный размер временного буфера Float32Array(fftSize) для расчёта RMS dBFS
//    и разделение спектра на Sub-Bass (20–90 Гц), Low (90–250 Гц), Mid и High.
// 3. Детектор музыкального дыхания (heartbeat и pulse): извлечение плавной
//    низкочастотной волны из реального аудиопотока для синхронизации дыхания
//    колец, туманностей, цифр водопада и финальной визитки с музыкой.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import {
    type AudioPlaybackStatus,
    type PhaseId,
    universeStore,
} from '../store/universeState';

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

// ============================================================================
// РАЗДЕЛ 1. КЛАСС НЕПРЕРЫВНОГО АУДИО-ДВИЖКА И СПЕКТРАЛЬНОГО АНАЛИЗАТОРА
// ============================================================================

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

    // Смещение старта в секундах для пропуска начальной тихой паузы в файле MP3
    private readonly INTRO_SKIP_OFFSET_SEC = 2.6;
    private readonly TARGET_VOLUME = 0.85;

    private smoothedRmsDb = -60.0;
    private smoothedSubBass = 0.2;
    private smoothedLow = 0.2;
    private smoothedMid = 0.16;
    private smoothedHigh = 0.12;
    private smoothedHeartbeat = 0.35;
    private shockwaveBoost = 0.0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.prepareAudioElement();
            this.bindAutoStartListeners();
        }
    }

    /**
     * Формирует корректный путь к MP3 с учётом подкаталога BASE_URL (/universe/ на GitHub Pages).
     */
    private resolveAudioUrl(): string {
        const rawBase =
            (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
        return `${normalizedBase}audio/cosmic_ambient.mp3`;
    }

    /**
     * Предварительная загрузка оригинального трека cosmic_ambient.mp3.
     * Трек играет непрерывно и не прерывается при паузе визуальной симуляции.
     */
    private prepareAudioElement(): void {
        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('web-audio', 'loading');

        try {
            const el = new Audio(this.resolveAudioUrl());
            el.loop = true;
            el.preload = 'auto';
            el.crossOrigin = 'anonymous';
            el.volume = 1.0; // Уровень громкости регулируется единым GainNode

            el.addEventListener('loadedmetadata', () => {
                integrationRegistry.updateModuleStatus(
                    'web-audio',
                    this.isPlayingMp3 ? 'ready' : 'fallback',
                    performance.now() - t0
                );
                if (
                    el.duration > this.INTRO_SKIP_OFFSET_SEC + 4.0 &&
                    el.currentTime < this.INTRO_SKIP_OFFSET_SEC
                ) {
                    try {
                        el.currentTime = this.INTRO_SKIP_OFFSET_SEC;
                    } catch {
                        // Ожидание буферизации
                    }
                }
            });

            // Мягкий бесшовный возврат перед самым концом дорожки без попадания в начальную тишину
            el.addEventListener('timeupdate', () => {
                if (el.duration > 12 && el.currentTime > el.duration - 0.28) {
                    try {
                        el.currentTime = this.INTRO_SKIP_OFFSET_SEC;
                    } catch {
                        // Штатный loop
                    }
                }
            });

            el.load();
            this.audioEl = el;
        } catch {
            this.audioEl = null;
            integrationRegistry.updateModuleStatus('web-audio', 'fallback', 0);
        }
    }

    /**
     * Автоматический старт звука при загрузке страницы или первом разрешённом жесте пользователя.
     */
    private bindAutoStartListeners(): void {
        if (this.unlockBound || typeof window === 'undefined') return;
        this.unlockBound = true;

        const tryStart = (): void => {
            if (this.enabled && !this.isPlayingMp3) {
                this.startPlayback();
            }
            if (this.isPlayingMp3) {
                window.removeEventListener('pointerdown', tryStart);
                window.removeEventListener('keydown', tryStart);
                window.removeEventListener('touchstart', tryStart);
            }
        };

        window.addEventListener('pointerdown', tryStart, { passive: true });
        window.addEventListener('keydown', tryStart, { passive: true });
        window.addEventListener('touchstart', tryStart, { passive: true });

        setTimeout(() => {
            if (this.enabled) {
                this.startPlayback();
            }
        }, 25);
    }

    // ============================================================================
    // РАЗДЕЛ 2. ИНИЦИАЛИЗАЦИЯ ГРАФА WEB AUDIO API И СПЕКТРАЛЬНОГО АНАЛИЗАТОРА
    // ============================================================================

    private ensureAnalyserGraph(): void {
        if (this.ctx || typeof window === 'undefined' || !this.audioEl) return;
        try {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
            this.ctx = new AudioCtx();

            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 1024;
            this.analyser.smoothingTimeConstant = 0.84;

            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(this.TARGET_VOLUME, this.ctx.currentTime);

            this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            // Длина timeBuffer строго равна fftSize отсчётов Float32 (по 4 байта на отсчёт)
            this.freqBuffer = new Uint8Array(
                new ArrayBuffer(this.analyser.frequencyBinCount)
            );
            this.timeBuffer = new Float32Array(
                new ArrayBuffer(this.analyser.fftSize * 4)
            );
            resourceLedger.trackAllocation('audioNodes', 3);
        } catch {
            // При повторной привязке воспроизводим через HTMLAudioElement
        }
    }

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
        this.audioEl.volume = 1.0;

        if (this.gainNode && this.ctx) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(this.TARGET_VOLUME, now, 0.22);
        }

        if (this.audioEl.paused) {
            this.audioEl
                .play()
                .then(() => {
                    this.isPlayingMp3 = true;
                    integrationRegistry.updateModuleStatus('web-audio', 'ready');
                    universeStore.setAudioEnabled(true, 'PLAYING_MP3');
                })
                .catch(() => {
                    this.isPlayingMp3 = false;
                    integrationRegistry.updateModuleStatus('web-audio', 'fallback');
                    universeStore.setAudioEnabled(true, 'AWAITING_GESTURE');
                });
        } else {
            this.isPlayingMp3 = true;
            integrationRegistry.updateModuleStatus('web-audio', 'ready');
            universeStore.setAudioEnabled(true, 'PLAYING_MP3');
        }
    }

    public setEnabled(enabled: boolean): boolean {
        this.enabled = Boolean(enabled);
        if (this.enabled) {
            this.startPlayback();
        } else {
            if (this.audioEl && !this.audioEl.paused) {
                this.audioEl.pause();
            }
            this.isPlayingMp3 = false;
            integrationRegistry.updateModuleStatus('web-audio', 'fallback');
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

    public triggerShockwavePulse(
        arg1: number | string | boolean = 0.5,
        _arg2?: number | string | boolean,
        _arg3?: number | string | boolean
    ): void {
        const intensity = typeof arg1 === 'number' ? arg1 : 0.5;
        this.shockwaveBoost = Math.min(
            1.0,
            this.shockwaveBoost + Math.max(0.1, intensity) * 0.45
        );
    }

    // ============================================================================
    // РАЗДЕЛ 3. НЕПРЕРЫВНОЕ ЗВУЧАНИЕ МЕЖДУ ФАЗАМИ И СИНХРОНИЗАЦИЯ ДЫХАНИЯ С ТРЕКОМ
    // ============================================================================

    /**
     * Переход между фазами и подактами: музыка играет непрерывно без пауз и без обрывов.
     */
    public transitionToPhase(
        phase: PhaseId | string | number | boolean,
        _act?: string | number | boolean
    ): void {
        if (typeof phase === 'string') {
            this.currentPhase = phase as PhaseId;
        }
        if (this.enabled && !this.isPlayingMp3) {
            this.startPlayback();
        }
    }

    /**
     * Извлекает реальные частотные полосы из играющего трека cosmic_ambient.mp3
     * и формирует плавные кривые heartbeat и pulse в такт низким частотам музыки.
     */
    public updateRealtimeModulation(
        arg1: number | PhaseId | boolean = 0,
        arg2?: number | PhaseId | boolean,
        _arg3?: boolean
    ): AudioModulationSnapshot {
        const t0 = performance.now();
        const simTimeSec =
            typeof arg1 === 'number' ? arg1 : typeof arg2 === 'number' ? arg2 : 0;

        this.shockwaveBoost *= 0.9;

        const isActuallyPlaying = Boolean(
            this.enabled && this.audioEl && !this.audioEl.paused && this.isPlayingMp3
        );

        let rawSubBass = 0.0;
        let rawLow = 0.0;
        let rawMid = 0.0;
        let rawHigh = 0.0;
        let measuredRmsDb = -78.0;
        let rmsLinear = 0.0;

        if (
            isActuallyPlaying &&
            this.analyser &&
            this.freqBuffer &&
            this.timeBuffer
        ) {
            this.analyser.getByteFrequencyData(this.freqBuffer);
            this.analyser.getFloatTimeDomainData(this.timeBuffer);

            const sampleRate = this.ctx?.sampleRate ?? 48000;
            const binHz = sampleRate / this.analyser.fftSize;
            const nBins = this.freqBuffer.length;

            // Sub-Bass (20–90 Гц) — основа глубокого дыхания космического эмбиента
            const subEndBin = Math.min(nBins, Math.max(2, Math.round(90 / binHz)));
            const lowEndBin = Math.min(
                nBins,
                Math.max(subEndBin + 2, Math.round(250 / binHz))
            );
            const midEndBin = Math.min(
                nBins,
                Math.max(lowEndBin + 2, Math.round(2500 / binHz))
            );
            const highEndBin = Math.min(
                nBins,
                Math.max(midEndBin + 2, Math.round(12000 / binHz))
            );

            let sumSub = 0;
            for (let i = 1; i < subEndBin; i++) sumSub += this.freqBuffer[i];
            rawSubBass = sumSub / (Math.max(1, subEndBin - 1) * 255.0);

            let sumLow = 0;
            for (let i = 1; i < lowEndBin; i++) sumLow += this.freqBuffer[i];
            rawLow = sumLow / (Math.max(1, lowEndBin - 1) * 255.0);

            let sumMid = 0;
            for (let i = lowEndBin; i < midEndBin; i++) sumMid += this.freqBuffer[i];
            rawMid = sumMid / (Math.max(1, midEndBin - lowEndBin) * 255.0);

            let sumHigh = 0;
            for (let i = midEndBin; i < highEndBin; i++) sumHigh += this.freqBuffer[i];
            rawHigh = sumHigh / (Math.max(1, highEndBin - midEndBin) * 255.0);

            const validSamples = this.analyser.fftSize;
            let sumSq = 0;
            for (let i = 0; i < validSamples; i++) {
                const sample = this.timeBuffer[i];
                sumSq += sample * sample;
            }
            rmsLinear = Math.sqrt(sumSq / Math.max(1, validSamples));
            measuredRmsDb =
                rmsLinear > 0.00001
                    ? Math.max(-84.2, 20.0 * Math.log10(rmsLinear))
                    : -84.2;

            this.smoothedSubBass = this.smoothedSubBass * 0.86 + rawSubBass * 0.14;
            this.smoothedLow = this.smoothedLow * 0.85 + rawLow * 0.15;
            this.smoothedMid = this.smoothedMid * 0.85 + rawMid * 0.15;
            this.smoothedHigh = this.smoothedHigh * 0.85 + rawHigh * 0.15;
            this.smoothedRmsDb = this.smoothedRmsDb * 0.86 + measuredRmsDb * 0.14;

            // Музыкальное дыхание (heartbeat) следует за реальной волной суб-баса и середины трека
            const targetBeat = Math.min(
                1.0,
                this.smoothedSubBass * 0.75 + this.smoothedMid * 0.35
            );
            this.smoothedHeartbeat =
                this.smoothedHeartbeat * 0.9 + targetBeat * 0.1;
        } else {
            const lfo1 = 0.5 + 0.5 * Math.sin(simTimeSec * 1.15);
            const lfo2 = 0.5 + 0.5 * Math.cos(simTimeSec * 0.72);
            this.smoothedSubBass = 0.16 + lfo1 * 0.12;
            this.smoothedLow = 0.15 + lfo1 * 0.12;
            this.smoothedMid = 0.12 + lfo2 * 0.1;
            this.smoothedHigh = 0.08 + lfo1 * 0.06;
            this.smoothedHeartbeat = 0.3 + lfo1 * 0.25;
            this.smoothedRmsDb = -78.0;
        }

        const pulse = Math.min(
            1.0,
            this.smoothedLow * 0.62 +
            this.smoothedHeartbeat * 0.28 +
            this.shockwaveBoost * 0.45
        );

        const status: AudioPlaybackStatus = !this.enabled
            ? 'MUTED'
            : isActuallyPlaying
                ? 'PLAYING_MP3'
                : 'AWAITING_GESTURE';

        integrationRegistry.recordModuleStep('web-audio', performance.now() - t0);

        return {
            rmsDb: Number(this.smoothedRmsDb.toFixed(1)),
            rmsLinear: Number(rmsLinear.toFixed(4)),
            low: Number(this.smoothedLow.toFixed(3)),
            mid: Number(this.smoothedMid.toFixed(3)),
            high: Number(this.smoothedHigh.toFixed(3)),
            subBass: Number(this.smoothedSubBass.toFixed(3)),
            brilliance: Number(this.smoothedHigh.toFixed(3)),
            pulse: Number(pulse.toFixed(3)),
            heartbeat: Number(this.smoothedHeartbeat.toFixed(3)),
            isPlaying: isActuallyPlaying,
            status,
        };
    }

    public getSnapshot(simTimeSec = 0): AudioModulationSnapshot {
        return this.updateRealtimeModulation(simTimeSec, this.currentPhase, false);
    }
}

export const audioSync = new AudioSyncEngine();
export default audioSync;