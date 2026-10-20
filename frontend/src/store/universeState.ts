// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Единое хранилище состояния Вселенной UNIVERSE v2.3 (0 ошибок TS)
// ЗАДАЧИ ФАЙЛА:
// 1. Управлять 5 фазами 108-секундного цикла с гарантированным автопереключением
//    с самого первого запуска страницы (включая самовосстанавливающийся таймер).
// 2. Обеспечить гладкую C2-интерполяцию камеры Перлина (smootherstep) без рывков.
// 3. Согласовать тип EngineBackendKind ('WebGPU' | 'Canvas2D-HighDPI') с pipeline.ts.
// 4. Передавать оба аргумента (ft, nowMs) в qualityGovernor.feedFrameTime(ft, nowMs).
// ============================================================================

import { type InspectionLevel, type PhaseId } from '../core/contracts';
import { GOLDEN_SEED } from '../core/prng';
import { SceneBufferSoA } from '../core/sceneBuffer';
import { QualityGovernor } from '../core/qualityGovernor';

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
 * нулевая первая и вторая производные на границах исключают скачки камеры и линий.
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
    const u = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return u * u * u * (u * (u * 6 - 15) + 10);
}

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
        this.qualityGovernor = new QualityGovernor();
        this.sceneBuffer = new SceneBufferSoA(1024, urlParams.seed);

        const initialMeta = UNIVERSE_PHASES['01_VOID'];
        const bootTime = this.formatTimestamp();
        const bootLine = `[${bootTime}] [SYSTEM:BOOT] Инициализация UNIVERSE v2.3 (seed=${urlParams.seed}) [ts/universeState.ts]`;

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
                layer2_metricsHud: urlParams.debugMode,
                layer3_topologyGraph: true,
                layer4_architectTerminal: urlParams.debugMode,
                layer5_truthXRayMode: false,
            },
            telemetry: {
                tick: 0,
                fps: 60,
                frameTimeMs: 16.6,
                frameTimeP95Ms: 18.2,
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
                audioStatus: 'PLAYING_MP3',
                silenceRmsDb: -21.5,
            },
            terminalLogs: [bootLine],
            architectEvents: [
                {
                    id: 'boot_0',
                    timestamp: bootTime,
                    type: 'system:boot',
                    message: `Инициализация UNIVERSE v2.3 (seed=${urlParams.seed}) [ts/universeState.ts]`,
                },
            ],
        };

        if (typeof window !== 'undefined') {
            this.lastTelemetryUpdateMs = performance.now();
            this.startPhaseWatchdog();
        }
    }

    /**
     * Страховочный таймер автоцикла: если на старте страницы кадры RAF задержались,
     * часы фаз все равно плавно идут вперёд и гарантируют переход 01 -> 02 -> 03 -> 04 -> 05.
     */
    private startPhaseWatchdog(): void {
        setInterval(() => {
            if (this.state.isPaused || this.state.isTabHidden) return;
            const now = performance.now();
            const gapMs = now - this.lastTelemetryUpdateMs;
            if (gapMs > 260) {
                const dtSec = Math.min(0.25, gapMs / 1000);
                this.lastTelemetryUpdateMs = now;
                this.updateTelemetry({
                    phaseElapsedSec: this.state.telemetry.phaseElapsedSec + dtSec,
                    simulationTimeSec: this.state.telemetry.simulationTimeSec + dtSec,
                });
            }
        }, 200);
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
        this.state.layers.layer3_topologyGraph = true;
        this.notifyListeners(true);
    }

    public toggleLayer(layerKey: keyof UniverseLayersVisibility): void {
        this.state.layers[layerKey] = !this.state.layers[layerKey];
        this.state.opticalWeights.xrayTruth = this.state.layers.layer5_truthXRayMode ? 1.0 : 0.0;
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
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: ts,
            type,
            message,
        };
        const formattedLine = `[${ts}] [${type.toUpperCase()}] ${message}`;
        this.state.architectEvents = [nextEvent, ...this.state.architectEvents.slice(0, 18)];
        this.state.terminalLogs = [formattedLine, ...this.state.terminalLogs.slice(0, 24)];
    }

    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.singularityAct = 'RESTART_COLLAPSE';
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
        this.state.opticalWeights.logicConvergence = 0;
        this.state.telemetry.phaseElapsedSec = 0;
        this.state.telemetry.phaseProgress = 0;
        this.state.telemetry.simulationTimeSec = 0;
        this.notifyListeners(true);
    }

    public updateTelemetry(partial: Partial<UniverseTelemetryState>): void {
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.lastTelemetryUpdateMs = nowMs;

        Object.assign(this.state.telemetry, partial);
        this.state.telemetry.stateDigestHex = this.sceneBuffer.getDigestHex();

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

        // Плавная C2-интерполяция зума и дрейфа камеры Перлина без резких ступенек между фазами
        const simSec = this.state.telemetry.simulationTimeSec;
        const smoothPhaseAlpha = smootherstep(0.0, 0.35, rawProgress);
        const targetZoom =
            this.state.phaseMeta.targetZoom + Math.sin(simSec * 0.42) * 0.008 * smoothPhaseAlpha;
        this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.014;
        this.state.camera.driftX = Math.sin(simSec * 0.14) * 11.5;
        this.state.camera.driftY = Math.cos(simSec * 0.11) * 8.5;

        if (
            this.state.currentPhase === '05_SINGULARITY' &&
            this.state.singularityAct !== 'RESTART_COLLAPSE'
        ) {
            const el = this.state.telemetry.phaseElapsedSec;
            if (el < 8.5) {
                this.state.singularityAct = 'ACT_A_ACCRETION';
                this.state.singularityActProgress = smootherstep(0, 8.5, el);
                this.state.opticalWeights.logicConvergence = 0;
            } else if (el < 14.0) {
                this.state.singularityAct = 'ACT_B_LOGIC';
                this.state.singularityActProgress = smootherstep(8.5, 14.0, el);
                this.state.opticalWeights.logicConvergence = this.state.singularityActProgress;
                this.emitEventOnce(
                    'logic_conv_act_b',
                    'logic:convergence-started',
                    `Акт B (LOGIC): Три оптики синхронны. StateDigest=0x${this.state.telemetry.stateDigestHex}`
                );
            } else if (el < 15.1) {
                this.state.singularityAct = 'ACT_C_ZERO_SILENCE';
                this.state.zeroSilenceElapsedMs = (el - 14.0) * 1000;
                this.state.singularityActProgress = (el - 14.0) / 1.1;
            } else {
                this.state.singularityAct = 'ACT_D_GITHUB_CARD';
                const cardElapsed = el - 15.1;
                this.state.githubCardAssemblyProgress = Math.max(0, Math.min(1, cardElapsed / 6.5));
                this.state.singularityActProgress = this.state.githubCardAssemblyProgress;
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