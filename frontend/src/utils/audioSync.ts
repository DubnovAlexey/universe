// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Непрерывный аудио-движок синхронизации cosmic_ambient.mp3 с
//             поддержкой мобильных браузеров iOS Safari / Android (UNIVERSE v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Функции модуля: smoothAudioEnvelope.
//   3. AudioSyncEngine: constructor, configureIosAudioSession, resolveAudioUrl, prepareAudioElement,
//      bindAutoStartListeners, removeUnlockListeners, onFirstUserGesture, isExplicitAudioCommand,
//      ensureAnalyserGraph, startPlayback, setEnabled, isEnabled, toggleMute, triggerShockwavePulse,
//      toggleFromUserCommand, transitionToPhase, updateRealtimeModulation, getSnapshot.
// ============================================================================


import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import {
    type AudioPlaybackStatus,
    type PhaseId,
    universeStore,
} from '../store/universeState';

/** Справочные данные фонограммы; отображаются только в раскрываемой справке. */
export const SOUNDTRACK_CREDIT = Object.freeze({
    title: 'Photosynthesis',
    artist: 'Carbon Based Lifeforms',
    album: 'World of Sleepers',
});

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

/**
 * Frame-rate-independent envelope smoothing for audio-reactive visuals.
 * A shorter attack keeps transients legible; a longer release avoids flicker.
 */
// ============================================================================
// РАЗДЕЛ. ФУНКЦИЯ smoothAudioEnvelope
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ smoothAudioEnvelope ---
export function smoothAudioEnvelope(
    current: number,
    target: number,
    deltaSeconds: number,
    attackSeconds = 0.075,
    releaseSeconds = 0.24
): number {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeTarget = Number.isFinite(target) ? target : safeCurrent;
    const safeDelta = Number.isFinite(deltaSeconds)
        ? Math.max(0, Math.min(0.1, deltaSeconds))
        : 0;
    const tau = safeTarget >= safeCurrent ? attackSeconds : releaseSeconds;
    if (!Number.isFinite(tau) || tau <= 0) return safeTarget;
    const alpha = 1 - Math.exp(-safeDelta / tau);
    return safeCurrent + (safeTarget - safeCurrent) * alpha;
}
// --- КОНЕЦ ФУНКЦИИ smoothAudioEnvelope ---

// ============================================================================
// РАЗДЕЛ. КЛАСС AudioSyncEngine
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
    private playbackPending = false;
    private playbackAttempt = 0;
    private unlockBound = false;
    private removeUnlockListenersFn: (() => void) | null = null;
    private isMobileWebKit = false;
    private currentPhase: PhaseId = '01_VOID';
    private currentAct = '';
    private sceneTransitionAccent = 0;

    private readonly INTRO_SKIP_OFFSET_SEC = 2.6;
    private readonly TARGET_VOLUME = 0.85;

    private smoothedRmsDb = -60.0;
    private smoothedSubBass = 0.2;
    private smoothedLow = 0.2;
    private smoothedMid = 0.16;
    private smoothedHigh = 0.12;
    private smoothedHeartbeat = 0.35;
    private shockwaveBoost = 0.0;

    private lastMasterUpdatePerfMs = -100;
    private lastEnvelopeUpdatePerfMs = -1;
    private cachedSnapshot: AudioModulationSnapshot = {
        rmsDb: -60.0,
        rmsLinear: 0.0,
        low: 0.2,
        mid: 0.16,
        high: 0.12,
        subBass: 0.2,
        brilliance: 0.12,
        pulse: 0.22,
        heartbeat: 0.35,
        isPlaying: false,
        status: 'AWAITING_GESTURE',
    };

    // --- НАЧАЛО ФУНКЦИИ constructor (AudioSyncEngine) ---
    constructor() {
        if (typeof window !== 'undefined') {
            const ua = navigator.userAgent || '';
            this.isMobileWebKit = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
            this.configureIosAudioSession();
            this.prepareAudioElement();
            this.bindAutoStartListeners();
        }
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ configureIosAudioSession (AudioSyncEngine) ---
    private configureIosAudioSession(): void {
        try {
            const nav = navigator as unknown as {
                audioSession?: { type: string };
            };
            if (nav.audioSession) {
                nav.audioSession.type = 'playback';
            }
        } catch {
            // Игнорируем в браузерах без navigator.audioSession
        }
    }
    // --- КОНЕЦ ФУНКЦИИ configureIosAudioSession (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ resolveAudioUrl (AudioSyncEngine) ---
    private resolveAudioUrl(): string {
        const rawBase =
            (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
        return `${normalizedBase}audio/cosmic_ambient.mp3`;
    }
    // --- КОНЕЦ ФУНКЦИИ resolveAudioUrl (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ prepareAudioElement (AudioSyncEngine) ---
    private prepareAudioElement(): void {
        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('web-audio', 'loading');

        try {
            // Источник назначается только в пользовательском жесте: даже заблокированный
            // autoplay с src способен начать загрузку до отклонения play().
            const el = new Audio();
            el.loop = true;
            el.preload = 'none';
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
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
                        // Ожидание буферизации
                    }
                }
            });

            el.addEventListener('playing', () => {
                if (!this.enabled) { el.pause(); return; }
                this.isPlayingMp3 = true;
                this.playbackPending = false;
                this.removeUnlockListenersFn?.();
                integrationRegistry.updateModuleStatus('web-audio', 'ready');
                universeStore.setAudioEnabled(true, 'PLAYING_MP3');
            });

            el.addEventListener('timeupdate', () => {
                if (el.duration > 12 && el.currentTime > el.duration - 0.28) {
                    try {
                        el.currentTime = this.INTRO_SKIP_OFFSET_SEC;
                    } catch {
                        // Штатный loop
                    }
                }
            });

            this.audioEl = el;
        } catch {
            this.audioEl = null;
            integrationRegistry.updateModuleStatus('web-audio', 'fallback', 0);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ prepareAudioElement (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ bindAutoStartListeners (AudioSyncEngine) ---
    private bindAutoStartListeners(): void {
        if (this.unlockBound || typeof window === 'undefined') return;
        this.unlockBound = true;

        const gestureEvents = [
            'touchend',
            'pointerup',
            'click',
            'keydown',
            'pointerdown',
            'touchstart',
        ] as const;

        // --- НАЧАЛО ФУНКЦИИ removeUnlockListeners (AudioSyncEngine) ---
        const removeUnlockListeners = (): void => {
            if (!this.removeUnlockListenersFn) return;
            this.removeUnlockListenersFn = null;
            for (let i = 0; i < gestureEvents.length; i++) {
                window.removeEventListener(gestureEvents[i], onFirstUserGesture, true);
            }
        };
        // --- КОНЕЦ ФУНКЦИИ removeUnlockListeners (AudioSyncEngine) ---

        // --- НАЧАЛО ФУНКЦИИ onFirstUserGesture (AudioSyncEngine) ---
        const onFirstUserGesture = (event: Event): void => {
            if (!this.enabled) return;
            // AUDIO/M обрабатываются одной явной командой, а не связкой unlock→mute.
            if (AudioSyncEngine.isExplicitAudioCommand(event)) return;
            if (!this.isPlayingMp3) {
                this.startPlayback(true);
            } else {
                removeUnlockListeners();
            }
        };
        // --- КОНЕЦ ФУНКЦИИ onFirstUserGesture (AudioSyncEngine) ---

        this.removeUnlockListenersFn = removeUnlockListeners;

        for (let i = 0; i < gestureEvents.length; i++) {
            window.addEventListener(gestureEvents[i], onFirstUserGesture, {
                capture: true,
                passive: true,
            });
        }

    }
    // --- КОНЕЦ ФУНКЦИИ bindAutoStartListeners (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ ensureAnalyserGraph (AudioSyncEngine) ---
    private ensureAnalyserGraph(): void {
        if (this.ctx || typeof window === 'undefined' || !this.audioEl || this.isMobileWebKit) {
            return;
        }
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

            this.audioEl.volume = 1.0;

            this.freqBuffer = new Uint8Array(
                new ArrayBuffer(this.analyser.frequencyBinCount)
            );
            this.timeBuffer = new Float32Array(
                new ArrayBuffer(this.analyser.fftSize * 4)
            );
            // Регистрируем 3 узла WebAudio как однократный ресурс уровня страницы
            resourceLedger.trackPageLifetimeAllocation('audioNodes', 3);
        } catch {
            // При ограничении браузера воспроизводим напрямую через HTMLAudioElement
        }
    }
    // --- КОНЕЦ ФУНКЦИИ ensureAnalyserGraph (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ startPlayback (AudioSyncEngine) ---
    public startPlayback(fromUserGesture = true): void {
        this.configureIosAudioSession();
        if (!this.audioEl) {
            this.prepareAudioElement();
        }
        if (!this.audioEl || !this.enabled || !fromUserGesture || this.playbackPending) return;

        if (!this.isMobileWebKit) {
            this.ensureAnalyserGraph();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
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

        if (!this.audioEl.getAttribute('src')) this.audioEl.src = this.resolveAudioUrl();
        this.audioEl.muted = false;
        this.audioEl.volume = this.ctx ? 1.0 : this.TARGET_VOLUME;

        if (this.gainNode && this.ctx) {
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(this.TARGET_VOLUME, now, 0.22);
        }

        if (this.audioEl.paused) {
            const attempt = ++this.playbackAttempt;
            this.playbackPending = true;
            let playPromise: Promise<void> | undefined;
            try { playPromise = this.audioEl.play(); }
            catch {
                this.playbackPending = false;
                this.isPlayingMp3 = false;
                integrationRegistry.updateModuleStatus('web-audio', 'fallback');
                universeStore.setAudioEnabled(true, 'AWAITING_GESTURE');
                return;
            }
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        if (attempt !== this.playbackAttempt || !this.enabled) return;
                        this.playbackPending = false;
                        this.isPlayingMp3 = true;
                        this.removeUnlockListenersFn?.();
                        integrationRegistry.updateModuleStatus('web-audio', 'ready');
                        universeStore.setAudioEnabled(true, 'PLAYING_MP3');
                    })
                    .catch(() => {
                        if (attempt !== this.playbackAttempt || !this.enabled) return;
                        this.playbackPending = false;
                        this.isPlayingMp3 = false;
                        integrationRegistry.updateModuleStatus('web-audio', 'fallback');
                        universeStore.setAudioEnabled(true, 'AWAITING_GESTURE');
                    });
            } else this.playbackPending = false;
        } else {
            this.playbackPending = false;
            this.isPlayingMp3 = true;
            this.removeUnlockListenersFn?.();
            integrationRegistry.updateModuleStatus('web-audio', 'ready');
            universeStore.setAudioEnabled(true, 'PLAYING_MP3');
        }
    }
    // --- КОНЕЦ ФУНКЦИИ startPlayback (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ setEnabled (AudioSyncEngine) ---
    public setEnabled(enabled: boolean): boolean {
        this.enabled = Boolean(enabled);
        if (this.enabled) {
            this.startPlayback(true);
        } else {
            this.playbackAttempt++;
            this.playbackPending = false;
            if (this.audioEl && !this.audioEl.paused) {
                this.audioEl.pause();
            }
            this.isPlayingMp3 = false;
            integrationRegistry.updateModuleStatus('web-audio', 'fallback');
            universeStore.setAudioEnabled(false, 'MUTED');
        }
        return this.enabled;
    }
    // --- КОНЕЦ ФУНКЦИИ setEnabled (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ isEnabled (AudioSyncEngine) ---
    public isEnabled(): boolean {
        return this.enabled;
    }
    // --- КОНЕЦ ФУНКЦИИ isEnabled (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ toggleMute (AudioSyncEngine) ---
    public toggleMute(forceMuted?: boolean): boolean {
        const nextEnabled = typeof forceMuted === 'boolean' ? !forceMuted : !this.enabled;
        return this.setEnabled(nextEnabled);
    }
    // --- КОНЕЦ ФУНКЦИИ toggleMute (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ isExplicitAudioCommand (AudioSyncEngine) ---
    /** Команда звука не должна одновременно запускать общий обработчик разблокировки. */
    public static isExplicitAudioCommand(event: Event): boolean {
        if (event.type === 'keydown') {
            const keyboard = event as KeyboardEvent;
            return keyboard.code === 'KeyM' || (!keyboard.code && keyboard.key?.toLowerCase() === 'm');
        }
        return Boolean((event.target as Element | null)?.closest?.('#btn-toggle-audio'));
    }
    // --- КОНЕЦ ФУНКЦИИ isExplicitAudioCommand (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ toggleFromUserCommand (AudioSyncEngine) ---
    /** Первая команда при ожидании жеста запускает трек; повторная команда выключает его. */
    public toggleFromUserCommand(): boolean {
        if (this.enabled && !this.isPlayingMp3 && !this.playbackPending) {
            this.startPlayback(true);
            return true;
        }
        return this.toggleMute();
    }
    // --- КОНЕЦ ФУНКЦИИ toggleFromUserCommand (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ triggerShockwavePulse (AudioSyncEngine) ---
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
    // --- КОНЕЦ ФУНКЦИИ triggerShockwavePulse (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ transitionToPhase (AudioSyncEngine) ---
    public transitionToPhase(
        phase: PhaseId | string | number | boolean,
        act?: string | number | boolean
    ): void {
        const nextPhase = typeof phase === 'string' ? (phase as PhaseId) : this.currentPhase;
        const nextAct = typeof act === 'string' ? act : this.currentAct;
        if (nextPhase !== this.currentPhase || nextAct !== this.currentAct) {
            this.sceneTransitionAccent = 1;
        }
        this.currentPhase = nextPhase;
        this.currentAct = nextAct;
        if (this.enabled && !this.isPlayingMp3 && this.ctx) {
            this.startPlayback(true);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ transitionToPhase (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ updateRealtimeModulation (AudioSyncEngine) ---
    public updateRealtimeModulation(
        arg1: number | PhaseId | boolean = 0,
        arg2?: number | PhaseId | boolean,
        _arg3?: boolean
    ): AudioModulationSnapshot {
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.lastMasterUpdatePerfMs = t0;
        const smoothingDeltaSec =
            this.lastEnvelopeUpdatePerfMs < 0
                ? 1 / 60
                : Math.max(
                      0,
                      Math.min(0.1, (t0 - this.lastEnvelopeUpdatePerfMs) / 1000)
                  );
        this.lastEnvelopeUpdatePerfMs = t0;

        const simTimeSec =
            typeof arg1 === 'number' ? arg1 : typeof arg2 === 'number' ? arg2 : 0;

        this.shockwaveBoost = smoothAudioEnvelope(
            this.shockwaveBoost,
            0,
            smoothingDeltaSec,
            0.02,
            0.16
        );
        this.sceneTransitionAccent = smoothAudioEnvelope(
            this.sceneTransitionAccent,
            0,
            smoothingDeltaSec,
            0.02,
            0.42
        );

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

        } else {
            const lfo1 = 0.5 + 0.5 * Math.sin(simTimeSec * 1.15);
            const lfo2 = 0.5 + 0.5 * Math.cos(simTimeSec * 0.72);
            rawSubBass = isActuallyPlaying ? 0.28 + lfo1 * 0.16 : 0.16 + lfo1 * 0.12;
            rawLow = isActuallyPlaying ? 0.26 + lfo1 * 0.16 : 0.15 + lfo1 * 0.12;
            rawMid = isActuallyPlaying ? 0.22 + lfo2 * 0.14 : 0.12 + lfo2 * 0.1;
            rawHigh = 0.08 + lfo1 * 0.06;
            measuredRmsDb = isActuallyPlaying ? -16.4 + lfo1 * 2.2 : -78.0;
        }

        this.smoothedSubBass = smoothAudioEnvelope(
            this.smoothedSubBass, rawSubBass, smoothingDeltaSec, 0.07, 0.26
        );
        this.smoothedLow = smoothAudioEnvelope(
            this.smoothedLow, rawLow, smoothingDeltaSec, 0.065, 0.24
        );
        this.smoothedMid = smoothAudioEnvelope(
            this.smoothedMid, rawMid, smoothingDeltaSec, 0.055, 0.2
        );
        this.smoothedHigh = smoothAudioEnvelope(
            this.smoothedHigh, rawHigh, smoothingDeltaSec, 0.035, 0.15
        );
        this.smoothedRmsDb = smoothAudioEnvelope(
            this.smoothedRmsDb, measuredRmsDb, smoothingDeltaSec, 0.08, 0.3
        );

        const targetBeat = Math.min(
            1.0,
            this.smoothedSubBass * 0.75 + this.smoothedMid * 0.35
        );
        this.smoothedHeartbeat = smoothAudioEnvelope(
            this.smoothedHeartbeat, targetBeat, smoothingDeltaSec, 0.1, 0.32
        );

        const pulse = Math.min(
            1.0,
            this.smoothedLow * 0.62 +
            this.smoothedHeartbeat * 0.28 +
            this.shockwaveBoost * 0.45 +
            this.sceneTransitionAccent * 0.12
        );

        const status: AudioPlaybackStatus = !this.enabled
            ? 'MUTED'
            : isActuallyPlaying
                ? 'PLAYING_MP3'
                : 'AWAITING_GESTURE';

        const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        integrationRegistry.recordModuleStep('web-audio', endMs - t0);

        this.cachedSnapshot = {
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

        return this.cachedSnapshot;
    }
    // --- КОНЕЦ ФУНКЦИИ updateRealtimeModulation (AudioSyncEngine) ---

    // --- НАЧАЛО ФУНКЦИИ getSnapshot (AudioSyncEngine) ---
    public getSnapshot(simTimeSec = 0): AudioModulationSnapshot {
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (nowMs - this.lastMasterUpdatePerfMs > 24) {
            return this.updateRealtimeModulation(simTimeSec, this.currentPhase, false);
        }
        return this.cachedSnapshot;
    }
    // --- КОНЕЦ ФУНКЦИИ getSnapshot (AudioSyncEngine) ---
}

export const audioSync = new AudioSyncEngine();
export default audioSync;
