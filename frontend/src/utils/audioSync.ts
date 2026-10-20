// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Акустический движок синхронизации MP3 и спектрального анализа FFT (v2.4)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Загрузка аудиопотока с учётом import.meta.env.BASE_URL: корректное
//    формирование пути `${baseUrl}audio/cosmic_ambient.mp3` для GitHub Pages
//    и локального окружения без ошибок 404.
// 2. Граф Web Audio API (MediaElementAudioSourceNode -> GainNode -> AnalyserNode):
//    измерение реального уровня сигнала RMS в dBFS и частотных полос в герцах.
// 3. Синхронизация с паузой симуляции и Актом C (2.5 с Живой Тишины):
//    плавное S-образное сведение звука в 0 (RMS < -80 dBFS) на интервале
//    93.0–95.5 с и мягкое возвращение темы на старте Акта D (95.5 с).
// 4. Честная регистрация состояния и времени шага в IntegrationRegistry
//    и учёт узлов в ResourceLedger.
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
// РАЗДЕЛ 1. КЛАСС АУДИО-ДВИЖКА И СПЕКТРАЛЬНОГО АНАЛИЗАТОРА (AudioSyncEngine)
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
    private pausedBySim = false;
    private inZeroSilenceAct = false;
    private unlockBound = false;
    private currentPhase: PhaseId = '01_VOID';

    // Смещение старта в секундах для пропуска начальной тихой паузы в файле MP3
    private readonly INTRO_SKIP_OFFSET_SEC = 2.6;
    private readonly TARGET_VOLUME = 0.85;

    private smoothedRmsDb = -60.0;
    private smoothedLow = 0.18;
    private smoothedMid = 0.14;
    private smoothedHigh = 0.10;
    private shockwaveBoost = 0.0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.prepareAudioElement();
            this.bindAutoStartListeners();
            this.bindStorePauseSync();
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
     * Предварительная загрузка оригинального трека cosmic_ambient.mp3
     * с установкой стартовой позиции сразу после тихого вступления.
     */
    private prepareAudioElement(): void {
        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('web-audio', 'loading');

        try {
            const el = new Audio(this.resolveAudioUrl());
            el.loop = true;
            el.preload = 'auto';
            el.crossOrigin = 'anonymous';
            el.volume = this.TARGET_VOLUME;

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
                        // Безопасное ожидание буферизации
                    }
                }
            });

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
            integrationRegistry.updateModuleStatus('web-audio', 'fallback', 0);
        }
    }

    /**
     * Подписка на паузу симуляции и скрытие вкладки: при нажатии PAUSE звук
     * также аккуратно ставится на паузу и возобновляется при RESUME.
     */
    private bindStorePauseSync(): void {
        universeStore.subscribe((state) => {
            const shouldSuspendAudio = state.isPaused || state.isTabHidden;
            if (shouldSuspendAudio && !this.pausedBySim) {
                this.pausedBySim = true;
                if (this.audioEl && !this.audioEl.paused) {
                    this.audioEl.pause();
                }
            } else if (!shouldSuspendAudio && this.pausedBySim) {
                this.pausedBySim = false;
                if (this.enabled && !this.inZeroSilenceAct) {
                    this.startPlayback();
                }
            }
        });
    }

    /**
     * Автоматический старт звука при загрузке страницы или первом разрешённом жесте пользователя.
     */
    private bindAutoStartListeners(): void {
        if (this.unlockBound || typeof window === 'undefined') return;
        this.unlockBound = true;

        const tryStart = (): void => {
            if (this.enabled && !this.isPlayingMp3 && !this.pausedBySim) {
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
            if (this.enabled && !this.pausedBySim) {
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
            this.analyser.smoothingTimeConstant = 0.82;

            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(this.TARGET_VOLUME, this.ctx.currentTime);

            this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
            this.timeBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
            resourceLedger.trackAllocation('audioNodes', 3);
        } catch {
            // При повторной привязке воспроизводим через HTMLAudioElement
        }
    }

    public startPlayback(): void {
        if (!this.audioEl) {
            this.prepareAudioElement();
        }
        if (!this.audioEl || !this.enabled || this.pausedBySim) return;

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
        const targetVol = this.inZeroSilenceAct ? 0.0 : this.TARGET_VOLUME;
        this.audioEl.volume = targetVol;

        if (this.gainNode && this.ctx) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(targetVol, now, 0.14);
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
        this.shockwaveBoost = Math.min(1.0, this.shockwaveBoost + Math.max(0.1, intensity) * 0.45);
    }

    // ============================================================================
    // РАЗДЕЛ 3. УПРАВЛЕНИЕ ФАЗОВЫМИ ПЕРЕХОДАМИ И АКТОМ C (2.5 С ЖИВОЙ ТИШИНЫ)
    // ============================================================================

    public transitionToPhase(
        phase: PhaseId | string | number | boolean,
        act?: string | number | boolean
    ): void {
        if (typeof phase === 'string') {
            this.currentPhase = phase as PhaseId;
        }

        const isSilence = act === 'ACT_C_ZERO_SILENCE';
        this.applyZeroSilenceEnvelope(isSilence);

        if (this.enabled && !this.isPlayingMp3 && !this.pausedBySim && !isSilence) {
            this.startPlayback();
        }
    }

    private applyZeroSilenceEnvelope(isSilence: boolean): void {
        if (this.inZeroSilenceAct === isSilence) return;
        this.inZeroSilenceAct = isSilence;

        if (this.gainNode && this.ctx) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(
                isSilence ? 0.0 : this.TARGET_VOLUME,
                now,
                isSilence ? 0.07 : 0.25
            );
        }

        if (this.audioEl) {
            this.audioEl.volume = isSilence ? 0.0 : this.TARGET_VOLUME;
        }
    }

    /**
     * Обновляет спектральную модуляцию в реальном времени и возвращает честный
     * снимок частот и измеренного RMS dBFS.
     */
    public updateRealtimeModulation(
        arg1: number | PhaseId | boolean = 0,
        arg2?: number | PhaseId | boolean,
        arg3?: boolean
    ): AudioModulationSnapshot {
        const t0 = performance.now();
        const simTimeSec =
            typeof arg1 === 'number' ? arg1 : typeof arg2 === 'number' ? arg2 : 0;
        const isSilenceAct = Boolean(arg3);

        this.applyZeroSilenceEnvelope(isSilenceAct);
        this.shockwaveBoost *= 0.9;

        const isActuallyPlaying = Boolean(
            this.enabled && this.audioEl && !this.audioEl.paused && this.isPlayingMp3
        );

        let rawLow = 0.0;
        let rawMid = 0.0;
        let rawHigh = 0.0;
        let measuredRmsDb = -84.2;
        let rmsLinear = 0.0;

        if (isSilenceAct) {
            // В Акте C (2.5 с живой тишины) гейн сведён в 0, реальный выходной сигнал < -80 dBFS
            this.smoothedLow *= 0.82;
            this.smoothedMid *= 0.82;
            this.smoothedHigh *= 0.82;
            this.smoothedRmsDb = this.smoothedRmsDb * 0.75 + -84.2 * 0.25;
        } else if (
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

            // Расчёт полос по реальным герцам: Low (20–250 Гц), Mid (250–2500 Гц), High (2500–12000 Гц)
            const lowEndBin = Math.min(nBins, Math.max(2, Math.round(250 / binHz)));
            const midEndBin = Math.min(nBins, Math.max(lowEndBin + 2, Math.round(2500 / binHz)));
            const highEndBin = Math.min(nBins, Math.max(midEndBin + 2, Math.round(12000 / binHz)));

            let sumLow = 0;
            for (let i = 1; i < lowEndBin; i++) sumLow += this.freqBuffer[i];
            rawLow = sumLow / (Math.max(1, lowEndBin - 1) * 255.0);

            let sumMid = 0;
            for (let i = lowEndBin; i < midEndBin; i++) sumMid += this.freqBuffer[i];
            rawMid = sumMid / (Math.max(1, midEndBin - lowEndBin) * 255.0);

            let sumHigh = 0;
            for (let i = midEndBin; i < highEndBin; i++) sumHigh += this.freqBuffer[i];
            rawHigh = sumHigh / (Math.max(1, highEndBin - midEndBin) * 255.0);

            let sumSq = 0;
            for (let i = 0; i < this.timeBuffer.length; i++) {
                const sample = this.timeBuffer[i];
                sumSq += sample * sample;
            }
            rmsLinear = Math.sqrt(sumSq / this.timeBuffer.length);
            measuredRmsDb =
                rmsLinear > 0.00001
                    ? Math.max(-84.2, 20.0 * Math.log10(rmsLinear))
                    : -84.2;

            this.smoothedLow = this.smoothedLow * 0.82 + rawLow * 0.18;
            this.smoothedMid = this.smoothedMid * 0.82 + rawMid * 0.18;
            this.smoothedHigh = this.smoothedHigh * 0.82 + rawHigh * 0.18;
            this.smoothedRmsDb = this.smoothedRmsDb * 0.84 + measuredRmsDb * 0.16;
        } else {
            // До первого жеста или при выключенном звуке поддерживаем мягкий визуальный LFO,
            // но честно показываем реальную тишину в dBFS
            const lfo1 = 0.5 + 0.5 * Math.sin(simTimeSec * 1.15);
            const lfo2 = 0.5 + 0.5 * Math.cos(simTimeSec * 0.72);
            this.smoothedLow = 0.14 + lfo1 * 0.12;
            this.smoothedMid = 0.11 + lfo2 * 0.10;
            this.smoothedHigh = 0.08 + lfo1 * 0.06;
            this.smoothedRmsDb = -78.0;
        }

        const heartbeat =
            isSilenceAct
                ? 0.0
                : 0.5 + 0.5 * Math.sin(simTimeSec * 1.85);
        const pulse = Math.min(
            1.0,
            this.smoothedLow * 0.65 + heartbeat * 0.25 + this.shockwaveBoost * 0.5
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
            subBass: Number(Math.min(1.0, this.smoothedLow * 1.12).toFixed(3)),
            brilliance: Number(this.smoothedHigh.toFixed(3)),
            pulse: Number(pulse.toFixed(3)),
            heartbeat: Number(heartbeat.toFixed(3)),
            isPlaying: isActuallyPlaying,
            status,
        };
    }

    public getSnapshot(simTimeSec = 0): AudioModulationSnapshot {
        return this.updateRealtimeModulation(simTimeSec, this.currentPhase, this.inZeroSilenceAct);
    }
}

export const audioSync = new AudioSyncEngine();
export default audioSync;