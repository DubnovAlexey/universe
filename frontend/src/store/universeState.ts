// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Единое хранилище состояния Вселенной и часов цикла UNIVERSE v2.4
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Метаданные и партитура 5 фаз 108-секундного цикла (UNIVERSE_PHASES):
//    01_VOID (0–17 с), 02_GENESIS (17–39 с), 03_EVOLUTION (39–64 с),
//    04_COLLAPSE (64–79 с), 05_SINGULARITY (79–108 с).
// 2. Подакты фазы сингулярности:
//    - ACT_A_ACCRETION (79.0–87.5 с): рождение Чёрной дыры из Точки Нуля и корона NGC 6543;
//    - ACT_B_LOGIC (87.5–93.0 с): сведение 3 оптик и плавное спиральное схлопывание;
//    - ACT_C_ZERO_SILENCE (93.0–95.5 с): ровно 2500 мс (2.5 с) живой тишины;
//    - ACT_D_GITHUB_CARD (95.5–108.0 с): сборка квантового одометра и визитки;
//    - RESTART_COLLAPSE: изолированный таймер restartElapsedSec (1.65 с от момента клика).
// 3. Независимое управление слоями телеметрии и графики (toggleLayer):
//    каждая кнопка нижней панели (METRICS, TOPOLOGY, TERMINAL, X-RAY) имеет
//    собственный флаг видимости без взаимной блокировки.
// ============================================================================

import { type InspectionLevel, type PhaseId } from '../core/contracts';
import { GOLDEN_SEED } from '../core/prng';
import { SceneBufferSoA } from '../core/sceneBuffer';
import { qualityGovernor, QualityGovernor } from '../core/qualityGovernor';

export type { PhaseId, InspectionLevel };

export type SingularityAct =
    | 'NONE'
    | 'INACTIVE'
    | 'ACT_A_ACCRETION'
    | 'ACT_B_LOGIC'
    | 'ACT_C_ZERO_SILENCE'
    | 'ACT_D_GITHUB_CARD'
    | 'RESTART_COLLAPSE';

export type EngineBackendKind =
    | 'WEBGPU'
    | 'WEBGL2'
    | 'CANVAS_2D'
    | 'WebGPU'
    | 'Canvas2D-HighDPI';

export type AudioPlaybackStatus =
    | 'AWAITING_GESTURE'
    | 'PLAYING_MP3'
    | 'PLAYING_SYNTH'
    | 'MUTED';

export type WasmExecutionStatus = 'WASM_SIMD_ACTIVE' | 'TS_FALLBACK';

export type PythonBackendExecutionStatus =
    | 'WS_CONNECTED'
    | 'PYODIDE_LOCAL'
    | 'CLIENT_ONLY';

export interface OpticalWeights {
    illusion: number;
    nexusTopology: number;
    xrayTruth: number;
    logicConvergence: number;
}

export interface PhaseMetadata {
    id: PhaseId;
    codeName: string;
    titleRu: string;
    subtitleRu: string;
    philosophyRu: string;
    startSec: number;
    durationSec: number;
    baseEntropy: number;
    targetParticleCount: number;
    targetZoom: number;
}

// ============================================================================
// РАЗДЕЛ 1. КАНОНИЧЕСКАЯ ШКАЛА 5 ФАЗ (0..108 СЕКУНД)
// ============================================================================

export const PHASE_ORDER: readonly PhaseId[] = [
    '01_VOID',
    '02_GENESIS',
    '03_EVOLUTION',
    '04_COLLAPSE',
    '05_SINGULARITY',
];

export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        codeName: 'MASTER_01 // RS_PUPPIS_ECHO',
        titleRu: '01. ПУСТОТА И СВЕТОВОЕ ЭХО (VOID)',
        subtitleRu: 'Квантовая флуктуация, световое эхо цефеиды RS Кормы и гравитационный чирп (0–17 с)',
        philosophyRu:
            'В начале нет пустоты — есть натянутая мембрана вакуума, сквозь которую проходит первое световое эхо.',
        startSec: 0,
        durationSec: 17,
        baseEntropy: 0.14,
        targetParticleCount: 680,
        targetZoom: 1.0,
    },
    '02_GENESIS': {
        id: '02_GENESIS',
        codeName: 'MASTER_02 // ANDROMEDA_SPIRAL',
        titleRu: '02. ГЕНЕЗИС (GENESIS)',
        subtitleRu: 'Пылевые рукава M31 / NGC 3169, гравитация N-тел и синхронизация Курамото (17–39 с)',
        philosophyRu:
            'Из первичного тумана гравитация плетёт спиральные рукава и зажигает первые очаги когерентности.',
        startSec: 17,
        durationSec: 22,
        baseEntropy: 0.28,
        targetParticleCount: 760,
        targetZoom: 1.02,
    },
    '03_EVOLUTION': {
        id: '03_EVOLUTION',
        codeName: 'MASTER_03 // COGNITIVE_NEXUS',
        titleRu: '03. ЭВОЛЮЦИЯ И НЕЙРОВЕРС (EVOLUTION)',
        subtitleRu: 'Когнитивные полушария, граф Габриэля — Мюррея и каскады импульсов (39–64 с)',
        philosophyRu:
            'Галактическая сеть осознаёт себя: звёздные скопления становятся сомами нейронов, а гравитационные мосты — аксонами мысли.',
        startSec: 39,
        durationSec: 25,
        baseEntropy: 0.42,
        targetParticleCount: 820,
        targetZoom: 1.0,
    },
    '04_COLLAPSE': {
        id: '04_COLLAPSE',
        codeName: 'MASTER_04 // BREACH_LENS_STORM',
        titleRu: '04. ПРЕЛОМЛЕНИЕ И ШТОРМ (COLLAPSE)',
        subtitleRu: 'Гравитационные аномалии, фазовый срыв и рентген-оптика BREACH LENS (64–79 с)',
        philosophyRu:
            'Напряжение ткани достигает предела: сквозь оптический разрыв проступает чистая математика симуляции.',
        startSec: 64,
        durationSec: 15,
        baseEntropy: 0.76,
        targetParticleCount: 820,
        targetZoom: 0.99,
    },
    '05_SINGULARITY': {
        id: '05_SINGULARITY',
        codeName: 'MASTER_05 // CATS_EYE_TO_ODOMETER',
        titleRu: '05. СИНГУЛЯРНОСТЬ И ОДОМЕТР (LOGIC → ∞)',
        subtitleRu: 'Корона «Кошачьего глаза» NGC 6543, Чёрная дыра и квантовый одометр (79–108 с)',
        philosophyRu:
            'Вселенная сжимается в горизонт событий Чёрной дыры, раскрывая живой поток символов и код своего создателя.',
        startSec: 79,
        durationSec: 29,
        baseEntropy: 0.92,
        targetParticleCount: 820,
        targetZoom: 1.0,
    },
};

export interface ArchitectLogEvent {
    id: string;
    timestamp: string;
    type: string;
    message: string;
}

export interface UniverseTelemetryState {
    tick: number;
    fps: number;
    frameTimeMs: number;
    frameTimeP95Ms: number;
    physicsStepMs: number;
    activeParticles: number;
    activeConnections: number;
    activePulses: number;
    simulationTimeSec: number;
    phaseElapsedSec: number;
    phaseProgress: number;
    energyDriftRatio: number;
    kuramotoOrderR: number;
    stateDigestHex: string;
    engineBackend: EngineBackendKind;
    wasmStatus: WasmExecutionStatus;
    pythonBackendStatus: PythonBackendExecutionStatus;
    audioStatus: AudioPlaybackStatus;
    silenceRmsDb: number;
}

export interface UniverseLayersVisibility {
    layer1_cosmosIllusion: boolean;
    layer2_metricsHud: boolean;
    layer3_topologyGraph: boolean;
    layer4_architectTerminal: boolean;
    layer5_truthXRayMode: boolean;
}

export interface UniverseState {
    seed: number;
    cycleCount: number;
    currentPhase: PhaseId;
    phaseMeta: PhaseMetadata;
    isPaused: boolean;
    isTabHidden: boolean;
    autoCyclePhases: boolean;
    timeScale: number;
    gravityMultiplier: number;
    audioEnabled: boolean;
    audioVolume: number;
    reducedMotion: boolean;
    debugMode: boolean;
    kioskMode: boolean;
    inspectionLevel: InspectionLevel;
    singularityAct: SingularityAct;
    singularityActProgress: number;
    zeroSilenceElapsedMs: number;
    githubCardAssemblyProgress: number;
    restartElapsedSec: number;
    opticalWeights: OpticalWeights;
    camera: {
        zoom: number;
        driftX: number;
        driftY: number;
    };
    layers: UniverseLayersVisibility;
    telemetry: UniverseTelemetryState;
    terminalLogs: ReadonlyArray<string>;
    architectEvents: ReadonlyArray<ArchitectLogEvent>;
}

type StateListener = (state: Readonly<UniverseState>) => void;

/**
 * Полином Перлина 5-го порядка (C2-непрерывный smootherstep):
 * нулевая первая и вторая производные на границах исключают скачки камеры и морфинга.
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
    const u = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return u * u * u * (u * (u * 6 - 15) + 10);
}

// ============================================================================
// РАЗДЕЛ 2. КЛАСС ХРАНИЛИЩА СОСТОЯНИЯ И ЕДИНЫХ ЧАСОВ ЦИКЛА (UniverseStore)
// ============================================================================

class UniverseStore {
    private readonly state: UniverseState;
    private readonly listeners: Set<StateListener> = new Set();
    private readonly sceneBuffer: SceneBufferSoA;
    private readonly qualityGovernor: QualityGovernor;
    private readonly emittedEventKeys: Set<string> = new Set();
    private readonly frameTimeWindow: number[] = [];
    private lastUiNotifyMs = 0;
    private lastTelemetryUpdateMs = 0;

    constructor() {
        const urlParams = this.parseUrlParameters();
        // Используем единый синглтон qualityGovernor, чтобы pipeline.ts и store читали один объект
        this.qualityGovernor = qualityGovernor;
        this.sceneBuffer = new SceneBufferSoA(1024, urlParams.seed);

        const initialMeta = UNIVERSE_PHASES['01_VOID'];
        const bootTime = this.formatTimestamp();
        const bootLine = `[${bootTime}] [SYSTEM:BOOT] Инициализация UNIVERSE v2.4 (seed=${urlParams.seed}) [ts/universeState.ts]`;

        this.state = {
            seed: urlParams.seed,
            cycleCount: 1,
            currentPhase: '01_VOID',
            phaseMeta: initialMeta,
            isPaused: false,
            isTabHidden: false,
            autoCyclePhases: true,
            timeScale: 1.0,
            gravityMultiplier: 1.0,
            audioEnabled: true,
            audioVolume: 0.85,
            reducedMotion: urlParams.reducedMotion,
            debugMode: urlParams.debugMode,
            kioskMode: urlParams.kioskMode,
            inspectionLevel: urlParams.debugMode ? 'TOPOLOGY' : 'COSMOS',
            singularityAct: 'INACTIVE',
            singularityActProgress: 0,
            zeroSilenceElapsedMs: 0,
            githubCardAssemblyProgress: 0,
            restartElapsedSec: 0,
            opticalWeights: {
                illusion: 1.0,
                nexusTopology: 0.65,
                xrayTruth: 0.0,
                logicConvergence: 0.0,
            },
            camera: {
                zoom: 1.0,
                driftX: 0,
                driftY: 0,
            },
            layers: {
                layer1_cosmosIllusion: true,
                layer2_metricsHud: true,
                layer3_topologyGraph: true,
                layer4_architectTerminal: true,
                layer5_truthXRayMode: false,
            },
            telemetry: {
                tick: 0,
                fps: 60,
                frameTimeMs: 16.6,
                frameTimeP95Ms: 16.7,
                physicsStepMs: 0.8,
                activeParticles: initialMeta.targetParticleCount,
                activeConnections: 0,
                activePulses: 0,
                simulationTimeSec: 0,
                phaseElapsedSec: 0,
                phaseProgress: 0,
                energyDriftRatio: 0,
                kuramotoOrderR: 0.18,
                stateDigestHex: this.sceneBuffer.getDigestHex(),
                engineBackend: 'Canvas2D-HighDPI',
                wasmStatus: 'TS_FALLBACK',
                pythonBackendStatus: 'CLIENT_ONLY',
                audioStatus: 'AWAITING_GESTURE',
                silenceRmsDb: -60.0,
            },
            terminalLogs: [bootLine],
            architectEvents: [
                {
                    id: 'boot_0',
                    timestamp: bootTime,
                    type: 'system:boot',
                    message: `Инициализация UNIVERSE v2.4 (seed=${urlParams.seed}) [ts/universeState.ts]`,
                },
            ],
        };

        if (typeof window !== 'undefined') {
            this.lastTelemetryUpdateMs = performance.now();
            this.startPhaseWatchdog();
        }
    }

    /**
     * Резервный сторожевой таймер: срабатывает только в том случае, если главный цикл
     * requestAnimationFrame был приостановлен браузером более чем на 1.2 секунды.
     * В штатном режиме 60 FPS не конкурирует с часами рендерера.
     */
    private startPhaseWatchdog(): void {
        setInterval(() => {
            if (this.state.isPaused || this.state.isTabHidden) return;
            const now = performance.now();
            const gapMs = now - this.lastTelemetryUpdateMs;
            if (gapMs > 1200) {
                const dtSec = Math.min(0.2, gapMs / 1000);
                this.lastTelemetryUpdateMs = now;
                this.updateTelemetry({
                    phaseElapsedSec: this.state.telemetry.phaseElapsedSec + dtSec,
                    simulationTimeSec: this.state.telemetry.simulationTimeSec + dtSec,
                });
            }
        }, 500);
    }

    private parseUrlParameters(): {
        seed: number;
        debugMode: boolean;
        kioskMode: boolean;
        reducedMotion: boolean;
    } {
        if (typeof window === 'undefined') {
            return {
                seed: GOLDEN_SEED,
                debugMode: false,
                kioskMode: false,
                reducedMotion: false,
            };
        }

        const params = new URLSearchParams(window.location.search);
        const rawSeed = Number(params.get('seed'));
        const seed = Number.isFinite(rawSeed) && rawSeed > 0 ? Math.floor(rawSeed) : GOLDEN_SEED;

        const debugMode = params.get('debug') === '1' || params.get('debug') === 'true';
        const kioskMode = params.get('kiosk') === '1' || params.get('kiosk') === 'true';
        const reducedMotion =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        return { seed, debugMode, kioskMode, reducedMotion };
    }

    private formatTimestamp(): string {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    public getState(): Readonly<UniverseState> {
        return this.state;
    }

    public getSceneBuffer(): SceneBufferSoA {
        return this.sceneBuffer;
    }

    public getQualityGovernor(): QualityGovernor {
        return this.qualityGovernor;
    }

    public subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(forceImmediate = false): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!forceImmediate && now - this.lastUiNotifyMs < 95) {
            return;
        }
        this.lastUiNotifyMs = now;
        this.listeners.forEach((fn) => fn(this.state));
    }

    public setPhase(phase: PhaseId): void {
        if (this.state.currentPhase === phase && this.state.singularityAct === 'INACTIVE') {
            return;
        }

        const meta = UNIVERSE_PHASES[phase];
        this.state.currentPhase = phase;
        this.state.phaseMeta = meta;
        this.state.telemetry.phaseElapsedSec = 0;
        this.state.telemetry.phaseProgress = 0;
        this.state.telemetry.simulationTimeSec = meta.startSec;
        this.state.restartElapsedSec = 0;

        if (phase === '05_SINGULARITY') {
            this.state.singularityAct = 'ACT_A_ACCRETION';
            this.state.singularityActProgress = 0;
            this.state.zeroSilenceElapsedMs = 0;
            this.state.githubCardAssemblyProgress = 0;
        } else {
            this.state.singularityAct = 'INACTIVE';
            this.state.singularityActProgress = 0;
            this.state.zeroSilenceElapsedMs = 0;
            this.state.githubCardAssemblyProgress = 0;
            this.state.opticalWeights.logicConvergence = 0;
        }

        this.appendLogEvent('phase:change', `Переход к фазе ${meta.titleRu} [ts/universeState.ts]`);
        this.notifyListeners(true);
    }

    public togglePause(): void {
        this.state.isPaused = !this.state.isPaused;
        this.appendLogEvent(
            'time:tick',
            this.state.isPaused ? 'Симуляция приостановлена.' : 'Симуляция возобновлена.'
        );
        this.notifyListeners(true);
    }

    public setTabHidden(hidden: boolean): void {
        this.state.isTabHidden = hidden;
        this.notifyListeners(true);
    }

    public toggleAutoCycle(): void {
        this.state.autoCyclePhases = !this.state.autoCyclePhases;
        this.appendLogEvent(
            'cycle:mode',
            this.state.autoCyclePhases
                ? 'Автоматический 108-секундный цикл включён.'
                : 'Ручной режим исследования фазы включён.'
        );
        this.notifyListeners(true);
    }

    public setAudioEnabled(enabled: boolean, status?: AudioPlaybackStatus): void {
        this.state.audioEnabled = enabled;
        if (status) {
            this.state.telemetry.audioStatus = status;
        } else {
            this.state.telemetry.audioStatus = enabled ? 'PLAYING_MP3' : 'MUTED';
        }
        this.notifyListeners(true);
    }

    public setAudioVolume(volume: number): void {
        this.state.audioVolume = Math.max(0, Math.min(1, volume));
        this.notifyListeners(false);
    }

    public setInspectionLevel(level: InspectionLevel): void {
        this.state.inspectionLevel = level;
        this.notifyListeners(true);
    }

    /**
     * Независимое переключение видимости каждого слоя телеметрии и рентгена X-RAY
     * с записью события в терминал для чёткого визуального отклика кнопок.
     */
    public toggleLayer(layerKey: keyof UniverseLayersVisibility): void {
        this.state.layers[layerKey] = !this.state.layers[layerKey];
        const isOn = this.state.layers[layerKey];
        this.state.opticalWeights.xrayTruth = this.state.layers.layer5_truthXRayMode ? 1.0 : 0.0;

        const labelMap: Record<keyof UniverseLayersVisibility, string> = {
            layer1_cosmosIllusion: 'COSMOS ILLUSION',
            layer2_metricsHud: 'LAYER_02 METRICS',
            layer3_topologyGraph: 'LAYER_03 TOPOLOGY',
            layer4_architectTerminal: 'LAYER_04 TERMINAL',
            layer5_truthXRayMode: 'GLOBAL X-RAY OPTICS',
        };
        this.appendLogEvent(
            'ui:layer',
            `${labelMap[layerKey]}: ${isOn ? 'АКТИВИРОВАН' : 'СКРЫТ'}`
        );
        this.notifyListeners(true);
    }

    public addTerminalLog(message: string, sourceTag = 'system:log'): void {
        this.appendLogEvent(sourceTag, message);
        this.notifyListeners(false);
    }

    public emitEvent(typeOrMessage: string, message?: string, sourceTag?: string): void {
        const resolvedType = message ? typeOrMessage : sourceTag ?? 'stress:event';
        const resolvedMsg = message ?? typeOrMessage;
        this.appendLogEvent(resolvedType, resolvedMsg);
        this.notifyListeners(false);
    }

    public emitEventOnce(
        uniqueKey: string,
        typeOrMessage: string,
        optionalMessage?: string
    ): void {
        if (this.emittedEventKeys.has(uniqueKey)) return;
        this.emittedEventKeys.add(uniqueKey);

        const resolvedType = optionalMessage !== undefined ? typeOrMessage : 'universe:event';
        const resolvedMessage = optionalMessage !== undefined ? optionalMessage : typeOrMessage;
        this.appendLogEvent(resolvedType, resolvedMessage);
    }

    private appendLogEvent(type: string, message: string): void {
        const ts = this.formatTimestamp();
        const nextEvent: ArchitectLogEvent = {
            id: `evt_${Date.now()}_${this.state?.telemetry?.tick ?? 0}`,
            timestamp: ts,
            type,
            message,
        };
        const formattedLine = `[${ts}] [${type.toUpperCase()}] ${message}`;
        this.state.architectEvents = [nextEvent, ...this.state.architectEvents.slice(0, 18)];
        this.state.terminalLogs = [formattedLine, ...this.state.terminalLogs.slice(0, 24)];
    }

    /**
     * Запускает обратную хореографию схлопывания Вселенной с собственным счётчиком
     * времени restartElapsedSec = 0 (длительность 1.65 с независимо от времени фазы).
     */
    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.singularityAct = 'RESTART_COLLAPSE';
        this.state.restartElapsedSec = 0;
        this.state.singularityActProgress = 0;
        this.appendLogEvent(
            'cycle:restart',
            `Запущено гравитационное схлопывание цикла #${this.state.cycleCount} -> #${this.state.cycleCount + 1}`
        );
        this.notifyListeners(true);
    }

    public completeRestartToVoid(): void {
        this.state.cycleCount += 1;
        this.emittedEventKeys.clear();
        const voidMeta = UNIVERSE_PHASES['01_VOID'];
        this.state.currentPhase = '01_VOID';
        this.state.phaseMeta = voidMeta;
        this.state.singularityAct = 'INACTIVE';
        this.state.singularityActProgress = 0;
        this.state.zeroSilenceElapsedMs = 0;
        this.state.githubCardAssemblyProgress = 0;
        this.state.restartElapsedSec = 0;
        this.state.opticalWeights.logicConvergence = 0;
        this.state.telemetry.phaseElapsedSec = 0;
        this.state.telemetry.phaseProgress = 0;
        this.state.telemetry.simulationTimeSec = 0;
        this.sceneBuffer.reset(this.state.seed);
        this.notifyListeners(true);
    }

    public updateTelemetry(partial: Partial<UniverseTelemetryState>): void {
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const prevPhaseElapsed = this.state.telemetry.phaseElapsedSec;
        this.lastTelemetryUpdateMs = nowMs;

        Object.assign(this.state.telemetry, partial);
        this.state.telemetry.stateDigestHex = this.sceneBuffer.getDigestHex();

        const dtSec = Math.max(0, this.state.telemetry.phaseElapsedSec - prevPhaseElapsed);

        const ft = Math.max(1.0, this.state.telemetry.frameTimeMs);
        this.state.telemetry.fps = Math.min(240, Math.round(1000 / ft));

        this.frameTimeWindow.push(ft);
        if (this.frameTimeWindow.length > 60) {
            this.frameTimeWindow.shift();
        }
        const sortedFt = [...this.frameTimeWindow].sort((a, b) => a - b);
        const p95Idx = Math.min(sortedFt.length - 1, Math.floor(sortedFt.length * 0.95));
        this.state.telemetry.frameTimeP95Ms = Number((sortedFt[p95Idx] ?? ft).toFixed(1));

        this.qualityGovernor.feedFrameTime(ft, nowMs);

        const dur = Math.max(1, this.state.phaseMeta.durationSec);
        const rawProgress = Math.max(0, Math.min(1, this.state.telemetry.phaseElapsedSec / dur));
        this.state.telemetry.phaseProgress = Number(rawProgress.toFixed(4));

        // Плавная C2-интерполяция зума и дрейфа камеры Перлина (замирает в Акте C живой тишины)
        const simSec = this.state.telemetry.simulationTimeSec;
        if (this.state.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.state.camera.driftX *= 0.9;
            this.state.camera.driftY *= 0.9;
        } else {
            const smoothPhaseAlpha = smootherstep(0.0, 0.35, rawProgress);
            const targetZoom =
                this.state.phaseMeta.targetZoom + Math.sin(simSec * 0.42) * 0.008 * smoothPhaseAlpha;
            this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.014;
            this.state.camera.driftX = Math.sin(simSec * 0.14) * 10.5;
            this.state.camera.driftY = Math.cos(simSec * 0.11) * 7.8;
        }

        // Обработка обратной хореографии Restart Universe (ровно 1.65 с от момента нажатия)
        if (this.state.singularityAct === 'RESTART_COLLAPSE') {
            this.state.restartElapsedSec += dtSec > 0 ? dtSec : 0.016;
            const collapseProg = Math.min(1.0, this.state.restartElapsedSec / 1.65);
            this.state.singularityActProgress = smootherstep(0.0, 1.0, collapseProg);
            this.state.githubCardAssemblyProgress = Math.max(
                0.0,
                1.0 - this.state.singularityActProgress
            );
            this.notifyListeners(false);
            return;
        }

        // Партитура 5-й фазы (79–108 с, длительность 29 с) с точным окном 2.5 с тишины
        if (this.state.currentPhase === '05_SINGULARITY') {
            const el = this.state.telemetry.phaseElapsedSec;
            if (el < 8.5) {
                // 79.0 – 87.5 с: Акт A (Рождение из Точки Нуля, аккреция и корона NGC 6543)
                this.state.singularityAct = 'ACT_A_ACCRETION';
                this.state.singularityActProgress = smootherstep(0, 8.5, el);
                this.state.zeroSilenceElapsedMs = 0;
                this.state.githubCardAssemblyProgress = 0;
                this.state.opticalWeights.logicConvergence = 0;
            } else if (el < 14.0) {
                // 87.5 – 93.0 с: Акт B (Сведение оптик LOGIC и плавное сжатие в Точку Нуля)
                this.state.singularityAct = 'ACT_B_LOGIC';
                this.state.singularityActProgress = smootherstep(8.5, 14.0, el);
                this.state.zeroSilenceElapsedMs = 0;
                this.state.githubCardAssemblyProgress = 0;
                this.state.opticalWeights.logicConvergence = this.state.singularityActProgress;
                this.emitEventOnce(
                    'logic_conv_act_b',
                    'logic:convergence-started',
                    `Акт B (LOGIC): Три оптики синхронны. StateDigest=${this.state.telemetry.stateDigestHex}`
                );
            } else if (el < 16.5) {
                // 93.0 – 95.5 с: Акт C (Ровно 2500 мс = 2.5 секунды Живой Тишины)
                this.state.singularityAct = 'ACT_C_ZERO_SILENCE';
                this.state.zeroSilenceElapsedMs = Math.min(2500, Math.round((el - 14.0) * 1000));
                this.state.singularityActProgress = (el - 14.0) / 2.5;
                this.state.githubCardAssemblyProgress = 0;
                this.emitEventOnce(
                    'zero_silence_start',
                    'zero-silence:started',
                    'Акт C: Начало 2500 мс живой тишины (93.0–95.5 с) [web-audio]'
                );
            } else {
                // 95.5 – 108.0 с: Акт D (Квантовый одометр и финальная визитка DUBNOV ALEXEY)
                this.state.singularityAct = 'ACT_D_GITHUB_CARD';
                this.state.zeroSilenceElapsedMs = 2500;
                const cardElapsed = el - 16.5;
                this.state.githubCardAssemblyProgress = Math.max(
                    0,
                    Math.min(1, cardElapsed / 6.5)
                );
                this.state.singularityActProgress = this.state.githubCardAssemblyProgress;
                this.emitEventOnce(
                    'zero_silence_end',
                    'zero-silence:ended',
                    'Акт D: Завершение тишины (2500 мс). Запуск барабанов одометра.'
                );
            }
        }

        if (
            this.state.autoCyclePhases &&
            !this.state.isPaused &&
            this.state.currentPhase !== '05_SINGULARITY' &&
            rawProgress >= 0.998
        ) {
            const idx = PHASE_ORDER.indexOf(this.state.currentPhase);
            if (idx >= 0 && idx + 1 < PHASE_ORDER.length) {
                this.setPhase(PHASE_ORDER[idx + 1]);
                return;
            }
        }

        this.notifyListeners(false);
    }
}

export const universeStore = new UniverseStore();