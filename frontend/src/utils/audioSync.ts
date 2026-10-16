// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/utils/audioSync.ts
// НАЗНАЧЕНИЕ: Гибридный аудио-движок MASTER 06 v2.0 (cosmic_ambient.mp3 + Плейлист + Web Audio DSP)
// ЗАДАЧИ ФАЙЛА:
// 1. Воспроизводить основной трек владельца '/audio/cosmic_ambient.mp3' через BASE_URL
//    и поддерживать массив-плейлист со слотами-заглушками для подключения будущих треков.
// 2. Маршрутизировать звук через 4 шины Web Audio (bed, rhythm, events, air с ConvolverNode
//    и StereoPannerNode) -> компрессор/лимитер -> masterGain -> AnalyserNode.
// 3. Вычислять сглаженные FFT-признаки (low, mid, high, rmsDb) с внутренним LFO при mute.
// 4. Обеспечивать 100% тишину в Акте C (2500 мс, RMS < -80 dBFS) и учёт узлов в ResourceLedger.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { DeterministicPRNG } from '../core/prng';
import { universeStore, type PhaseId } from '../store/universeState';

// ----------------------------------------------------------------------------
// 1. ПЛЕЙЛИСТ ПРОЕКТА: ОСНОВНОЙ ТРЕК COSMIC_AMBIENT.MP3 + ЗАГЛУШКИ ДЛЯ БУДУЩИХ ТРЕКОВ
// ----------------------------------------------------------------------------
export const COSMIC_AUDIO_PLAYLIST: ReadonlyArray<string> = [
    'audio/cosmic_ambient.mp3', // Активный основной трек проекта
    // --- СЛОТЫ-ЗАГЛУШКИ ДЛЯ БУДУЩЕГО РАСШИРЕНИЯ ПЛЕЙЛИСТА (по кругу) ---
    // 'audio/cosmic_genesis_02.mp3',
    // 'audio/cosmic_nexus_03.mp3',
    // 'audio/cosmic_singularity_04.mp3',
];

export interface SmoothedAudioFeatures {
    low: number;          // Сглаженные низкие частоты (0..1) — управляют инерцией колец VOID
    mid: number;          // Сглаженные средние частоты (0..1) — плотность газовой вуали
    high: number;         // Сглаженные высокие частоты (0..1) — редкие искры
    rmsDb: number;        // Измеренный уровень сигнала в dBFS (для проверки тишины < -80 dBFS)
    isUsingInternalLfo: boolean;
}

// ----------------------------------------------------------------------------
// 2. КЛАСС ГИБРИДНОГО АУДИО-СИНТЕЗАТОРА И МЕНЕДЖЕРА ПЛЕЙЛИСТА (MASTER 06 V2.0)
// ----------------------------------------------------------------------------
class CosmicAudioSynthesizer {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private analyser: AnalyserNode | null = null;

    // Четыре специализированные шины по спецификации MASTER 06 (раздел 2)
    private bedBus: GainNode | null = null;
    private bedFilter: BiquadFilterNode | null = null;
    private rhythmBus: GainNode | null = null;
    private eventsBus: GainNode | null = null;
    private airConvolver: ConvolverNode | null = null;
    private airBus: GainNode | null = null;

    private mp3Audio: HTMLAudioElement | null = null;
    private mediaElementSource: MediaElementAudioSourceNode | null = null;
    private currentTrackIndex = 0;

    private fftDataArray: Uint8Array<ArrayBuffer> | null = null;
    private timeDomainArray: Float32Array<ArrayBuffer> | null = null;

    private smoothedFeatures: SmoothedAudioFeatures = {
        low: 0.15,
        mid: 0.12,
        high: 0.05,
        rmsDb: -96.0,
        isUsingInternalLfo: true,
    };

    private isInitialized = false;
    private isMutedByUser = false;
    private currentVolume = 0.8;
    private lfoClockSec = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupPlaylistAndAutoUnlock();
        }
    }

    // Формирование корректного URL ассета через import.meta.env.BASE_URL (правило 10 MASTER 00)
    private resolveAssetUrl(relativePath: string): string {
        const baseUrl = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
        return `${cleanBase}${cleanRel}`;
    }

    // Инициализация HTML5 Audio для cosmic_ambient.mp3 с поддержкой круговой ротации плейлиста
    private setupPlaylistAndAutoUnlock(): void {
        const firstTrackUrl = this.resolveAssetUrl(COSMIC_AUDIO_PLAYLIST[0]);
        this.mp3Audio = new Audio(firstTrackUrl);
        // Если в плейлисте 1 трек — включаем нативный бесшовный loop; если больше — переключаем по 'ended'
        this.mp3Audio.loop = COSMIC_AUDIO_PLAYLIST.length <= 1;
        this.mp3Audio.volume = this.currentVolume;
        this.mp3Audio.preload = 'auto';

        this.mp3Audio.addEventListener('ended', () => {
            if (COSMIC_AUDIO_PLAYLIST.length > 1) {
                this.advanceToNextTrackInPlaylist();
            }
        });

        // Решение D-5: до разрешённого жеста статус честный — AWAITING_GESTURE, первый жест плавно поднимает звук
        universeStore.setAudioEnabled(false, 'AWAITING_GESTURE');

        const unlockAndPlay = () => {
            if (this.isMutedByUser || !this.mp3Audio) return;

            this.initWebAudioGraph();
            if (this.ctx && this.ctx.state === 'suspended') {
                void this.ctx.resume();
            }

            this.mp3Audio
                .play()
                .then(() => {
                    // Плавный подъём мастер-гейна от 0 за 1.8 с при первом входе без перезапуска сцены (D-5)
                    if (this.masterGain && this.ctx) {
                        const now = this.ctx.currentTime;
                        this.masterGain.gain.setValueAtTime(0.01, now);
                        this.masterGain.gain.linearRampToValueAtTime(this.currentVolume, now + 1.8);
                    }
                    universeStore.setAudioEnabled(true, 'PLAYING_MP3');
                    removeUnlockListeners();
                })
                .catch(() => {
                    universeStore.setAudioEnabled(false, 'AWAITING_GESTURE');
                });
        };

        const removeUnlockListeners = () => {
            window.removeEventListener('pointerdown', unlockAndPlay);
            window.removeEventListener('keydown', unlockAndPlay);
            window.removeEventListener('touchstart', unlockAndPlay);
        };

        // Пробуем мягкий старт при готовности DOM и подхватываем при первом разрешённом жесте
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(unlockAndPlay, 120);
        } else {
            window.addEventListener('DOMContentLoaded', () => setTimeout(unlockAndPlay, 120), {
                once: true,
            });
        }

        window.addEventListener('pointerdown', unlockAndPlay, { passive: true });
        window.addEventListener('keydown', unlockAndPlay, { passive: true });
        window.addEventListener('touchstart', unlockAndPlay, { passive: true });
    }

    // Переключение на следующий трек плейлиста по кругу (когда будут добавлены новые треки)
    public advanceToNextTrackInPlaylist(): void {
        if (!this.mp3Audio || COSMIC_AUDIO_PLAYLIST.length <= 1) return;
        this.currentTrackIndex = (this.currentTrackIndex + 1) % COSMIC_AUDIO_PLAYLIST.length;
        this.mp3Audio.src = this.resolveAssetUrl(COSMIC_AUDIO_PLAYLIST[this.currentTrackIndex]);
        this.mp3Audio.loop = false;
        if (!this.isMutedByUser) {
            void this.mp3Audio.play();
        }
    }

    // --------------------------------------------------------------------------
    // 3. ПОСТРОЕНИЕ 4-ШИННОГО ГРАФА WEB AUDIO API (ЕДИНЫЙ КОНТЕКСТ НА ВСЮ ЖИЗНЬ СТРАНИЦЫ)
    // --------------------------------------------------------------------------
    private initWebAudioGraph(): void {
        if (this.isInitialized || typeof window === 'undefined') return;
        const t0 = performance.now();

        try {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.ctx = new AudioCtx();

            // Мастер-цепь: Compressor/Limiter -> MasterGain -> Analyser -> Destination
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -14;
            this.compressor.knee.value = 18;
            this.compressor.ratio.value = 4;

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.currentVolume;

            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.82;

            const binCount = this.analyser.frequencyBinCount;
            this.fftDataArray = new Uint8Array(new ArrayBuffer(binCount));
            this.timeDomainArray = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));

            // Шина 1 (bed): основное полотно cosmic_ambient.mp3 через фильтр линзы BREACH
            this.bedBus = this.ctx.createGain();
            this.bedBus.gain.value = 0.92;
            this.bedFilter = this.ctx.createBiquadFilter();
            this.bedFilter.type = 'lowpass';
            this.bedFilter.frequency.value = 2200;
            this.bedBus.connect(this.bedFilter);
            this.bedFilter.connect(this.compressor);

            // Шина 2 (rhythm): тональные чирп-кольца и волна синхронизации
            this.rhythmBus = this.ctx.createGain();
            this.rhythmBus.gain.value = 0.35;
            this.rhythmBus.connect(this.compressor);

            // Шина 3 (events): синаптические импульсы, интерференция и щелчки барабанов Odometer
            this.eventsBus = this.ctx.createGain();
            this.eventsBus.gain.value = 0.45;
            this.eventsBus.connect(this.compressor);

            // Шина 4 (air): синтетический ревербератор ConvolverNode для дальних планов Z2/Z3
            this.airBus = this.ctx.createGain();
            this.airBus.gain.value = 0.24;
            this.airConvolver = this.createSyntheticReverbConvolver(this.ctx);
            this.eventsBus.connect(this.airConvolver);
            this.airConvolver.connect(this.airBus);
            this.airBus.connect(this.compressor);

            this.compressor.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            if (this.mp3Audio && !this.mediaElementSource) {
                this.mediaElementSource = this.ctx.createMediaElementSource(this.mp3Audio);
                this.mediaElementSource.connect(this.bedBus);
            }

            resourceLedger.trackAllocation('audioNodes', 9);
            resourceLedger.setBaseline();
            this.isInitialized = true;

            integrationRegistry.updateModuleStatus('web-audio', 'ready', performance.now() - t0);
        } catch {
            integrationRegistry.updateModuleStatus('web-audio', 'fallback', performance.now() - t0);
        }
    }

    // Генерация синтетического импульсного отклика реверберации (экспоненциально затухающий шум)
    private createSyntheticReverbConvolver(ctx: AudioContext): ConvolverNode {
        const convolver = ctx.createConvolver();
        const rate = ctx.sampleRate;
        const length = Math.floor(rate * 1.6);
        const impulse = ctx.createBuffer(2, length, rate);
        const rng = new DeterministicPRNG(104729);

        for (let ch = 0; ch < 2; ch++) {
            const channelData = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-i / (rate * 0.45));
                channelData[i] = (rng.nextFloat() * 2.0 - 1.0) * decay * 0.35;
            }
        }
        convolver.buffer = impulse;
        return convolver;
    }

    public setEnabled(enabled: boolean): void {
        this.isMutedByUser = !enabled;
        if (!this.mp3Audio) return;

        if (enabled) {
            this.initWebAudioGraph();
            if (this.ctx && this.ctx.state === 'suspended') {
                void this.ctx.resume();
            }
            this.mp3Audio.volume = this.currentVolume;
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.15);
            }
            this.mp3Audio
                .play()
                .then(() => universeStore.setAudioEnabled(true, 'PLAYING_MP3'))
                .catch(() => universeStore.setAudioEnabled(false, 'AWAITING_GESTURE'));
        } else {
            this.mp3Audio.pause();
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.08);
            }
            universeStore.setAudioEnabled(false, 'MUTED');
        }
    }

    public setVolume(vol: number): void {
        this.currentVolume = Math.max(0, Math.min(1, vol));
        if (this.mp3Audio) {
            this.mp3Audio.volume = this.currentVolume;
        }
        if (this.masterGain && this.ctx && universeStore.getState().singularityAct !== 'ACT_C_ZERO_SILENCE') {
            this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.1);
        }
        universeStore.setAudioVolume(this.currentVolume);
    }

    public transitionToPhase(_phase: PhaseId): void {
        // Основное музыкальное полотно ведётся треком cosmic_ambient.mp3 без разрывов на швах
    }

    // --------------------------------------------------------------------------
    // 4. МОДУЛЯЦИЯ В РЕАЛЬНОМ ВРЕМЕНИ, FFT-АНАЛИЗ И КОНТРОЛЬ 2,5 С ТИШИНЫ (RMS)
    // --------------------------------------------------------------------------
    public updateRealtimeModulation(
        breachRadius: number,
        isBreaching: boolean,
        globalStress: number,
        fullXRay: boolean
    ): void {
        const t0 = performance.now();
        const uState = universeStore.getState();
        this.lfoClockSec += 1 / 60;

        // АКТ C (93.0–95.5 с): Полная цифровая тишина в течение 2500 мс (MASTER 05 / MASTER 06 раздел 5)
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            if (this.mp3Audio) {
                this.mp3Audio.volume = 0;
            }
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
            }
            this.smoothedFeatures.rmsDb = -96.0;
            universeStore.updateTelemetry({ silenceRmsDb: -96.0 });
            return;
        }

        // Плавный S-образный увод звука за 250 мс до начала тишины (в конце Акта B)
        if (
            uState.currentPhase === '05_SINGULARITY' &&
            uState.singularityAct === 'ACT_B_LOGIC' &&
            uState.singularityActProgress > 0.94
        ) {
            const fadeOut = Math.max(0, 1.0 - (uState.singularityActProgress - 0.94) / 0.06);
            if (this.mp3Audio && !this.isMutedByUser) {
                this.mp3Audio.volume = this.currentVolume * fadeOut;
            }
            if (this.masterGain && this.ctx && !this.isMutedByUser) {
                this.masterGain.gain.setTargetAtTime(this.currentVolume * fadeOut, this.ctx.currentTime, 0.04);
            }
        } else if (this.mp3Audio && !this.isMutedByUser) {
            this.mp3Audio.volume = this.currentVolume;
            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.12);
            }
        }

        // Модуляция фильтра линзы BREACH LENS и обновление сглаженных FFT-признаков
        if (this.isInitialized && this.ctx && this.bedFilter && this.analyser && !this.isMutedByUser) {
            const baseFreq = 1850;
            const boost = fullXRay ? 1900 : breachRadius * (isBreaching ? 4.4 : 1.5) + globalStress * 420;
            this.bedFilter.frequency.setTargetAtTime(
                Math.min(5200, baseFreq + boost),
                this.ctx.currentTime,
                0.1
            );

            this.extractSmoothedFftAndRms();
        } else {
            // Внутренний LFO «дыхания» при mute/блокировке, чтобы визуал никогда не замирал (MASTER 06)
            this.smoothedFeatures.low = 0.22 + 0.14 * Math.sin(this.lfoClockSec * 1.4);
            this.smoothedFeatures.mid = 0.18 + 0.1 * Math.cos(this.lfoClockSec * 0.9);
            this.smoothedFeatures.high = 0.06 + 0.04 * Math.sin(this.lfoClockSec * 2.3);
            this.smoothedFeatures.rmsDb = -96.0;
            this.smoothedFeatures.isUsingInternalLfo = true;
        }

        integrationRegistry.recordModuleStep('web-audio', performance.now() - t0);
    }

    private extractSmoothedFftAndRms(): void {
        if (!this.analyser || !this.fftDataArray || !this.timeDomainArray) return;

        this.analyser.getByteFrequencyData(this.fftDataArray);
        this.analyser.getFloatTimeDomainData(this.timeDomainArray);

        let lowSum = 0;
        let midSum = 0;
        let highSum = 0;
        const len = this.fftDataArray.length;

        for (let i = 0; i < len; i++) {
            const val = this.fftDataArray[i] / 255.0;
            if (i < 12) lowSum += val;
            else if (i < 48) midSum += val;
            else highSum += val;
        }

        const rawLow = lowSum / 12;
        const rawMid = midSum / 36;
        const rawHigh = highSum / Math.max(1, len - 48);

        // Раздельное сглаживание атаки (быстрее) и спада (плавнее) по MASTER 01 / 06
        const smoothBand = (prev: number, target: number) =>
            target > prev ? prev + (target - prev) * 0.28 : prev + (target - prev) * 0.08;

        this.smoothedFeatures.low = Number(smoothBand(this.smoothedFeatures.low, rawLow).toFixed(3));
        this.smoothedFeatures.mid = Number(smoothBand(this.smoothedFeatures.mid, rawMid).toFixed(3));
        this.smoothedFeatures.high = Number(smoothBand(this.smoothedFeatures.high, rawHigh).toFixed(3));
        this.smoothedFeatures.isUsingInternalLfo = false;

        // Расчёт фактического RMS в dBFS для контроля тишины
        let sumSq = 0;
        for (let i = 0; i < this.timeDomainArray.length; i++) {
            const sample = this.timeDomainArray[i];
            sumSq += sample * sample;
        }
        const rms = Math.sqrt(sumSq / this.timeDomainArray.length);
        const db = rms > 0.00001 ? Math.max(-96.0, 20 * Math.log10(rms)) : -96.0;
        this.smoothedFeatures.rmsDb = Number(db.toFixed(1));
    }

    public getSmoothedFeatures(): Readonly<SmoothedAudioFeatures> {
        return this.smoothedFeatures;
    }

    // Пространственный импульс при открытии линзы BREACH LENS с панорамированием
    public triggerShockwavePulse(strength = 0.7, panNorm = 0): void {
        if (
            !this.isInitialized ||
            this.isMutedByUser ||
            !this.ctx ||
            !this.eventsBus ||
            universeStore.getState().singularityAct === 'ACT_C_ZERO_SILENCE'
        ) {
            return;
        }

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        panner.pan.value = Math.max(-1, Math.min(1, panNorm));
        osc.type = 'sine';
        osc.frequency.setValueAtTime(135 + strength * 55, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.55);

        gain.gain.setValueAtTime(0.14 * strength * this.currentVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.eventsBus);

        osc.start(now);
        osc.stop(now + 0.58);
    }
}

export const audioSync = new CosmicAudioSynthesizer();