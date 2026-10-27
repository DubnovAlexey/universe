// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Единое хранилище состояния Вселенной и часов цикла UNIVERSE v2.5
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Функции модуля: smootherstep.
//   3. UniverseStore: constructor, syncViewportLayoutMode, parseUrlParameters, formatTimestamp,
//      startPhaseWatchdog, reportRendererError, getState, getSceneBuffer, getQualityGovernor, subscribe,
//      notifyListeners, setFinaleCardHovered, captureOuroborosRelease, setPhase, togglePause, setTabHidden, toggleAutoCycle,
//      setAudioEnabled, setAudioVolume, setInspectionLevel, toggleLayer, addTerminalLog, emitEvent,
//      emitEventOnce, appendLogEvent, triggerUniverseRestart, completeRestartToVoid, updateTelemetry.
// ============================================================================


import { type InspectionLevel, type PhaseId, type SingularityAct } from '../core/contracts';
import { GOLDEN_SEED } from '../core/prng';
import { SceneBufferSoA } from '../core/sceneBuffer';
import { qualityGovernor, QualityGovernor } from '../core/qualityGovernor';

export type { PhaseId, InspectionLevel, SingularityAct };

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

export type WasmExecutionStatus = 'WASM_ACTIVE' | 'TS_FALLBACK';

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
    isFinaleCardHovered: boolean;
    finaleReachedOnce: boolean;
    /** null до начала подъёма; активные секунды [0..12], сохраняемые между фазами и циклами. */
    finaleRiseElapsedSec: number | null;
    /** Снимок видимого эпизода при входе в VOID; null исключает появление формы из ничего. */
    ouroborosRelease: { readonly ageSec: number; readonly timeSec: number } | null;
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
    lastRendererError: string | null;
}

type StateListener = (state: Readonly<UniverseState>) => void;

export const PHASE_ORDER: readonly PhaseId[] = [
    '01_VOID',
    '02_GENESIS',
    '03_EVOLUTION',
    '04_COLLAPSE',
    '05_SINGULARITY',
];

// Проекционные огибающие камеры используются и для безопасной композиции DOM.
export const CAMERA_ZOOM_SWAY = 0.008;
export const CAMERA_DRIFT_Y_AMPLITUDE = 7.8;

export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        codeName: 'MASTER_01 // RS_PUPPIS_ECHO',
        titleRu: '01. ПУСТОТА И СВЕТОВОЕ ЭХО (VOID)',
        subtitleRu:
            'Квантовая флуктуация, световое эхо цефеиды RS Кормы и гравитационный чирп (0–17 с)',
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
        subtitleRu:
            'Пылевые рукава M31 / NGC 3169, гравитация N-тел и синхронизация Курамото (17–39 с)',
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
        subtitleRu:
            'Когнитивные полушария, граф Габриэля — Мюррея и каскады импульсов (39–64 с)',
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
        subtitleRu:
            'Гравитационные аномалии, фазовый срыв и рентген-оптика BREACH LENS (64–79 с)',
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
        subtitleRu:
            'Корона «Кошачьего глаза» NGC 6543, Чёрная дыра и квантовый одометр (79–108 с)',
        philosophyRu:
            'Вселенная сжимается в горизонт событий Чёрной дыры и без паузы возрождается из Точки Нуля в визитку создателя.',
        startSec: 79,
        durationSec: 29,
        baseEntropy: 0.92,
        targetParticleCount: 820,
        targetZoom: 1.0,
    },
};

// ============================================================================
// РАЗДЕЛ. ФУНКЦИЯ smootherstep
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ smootherstep ---
export function smootherstep(edge0: number, edge1: number, x: number): number {
    const u = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return u * u * u * (u * (u * 6 - 15) + 10);
}
// --- КОНЕЦ ФУНКЦИИ smootherstep ---

// ============================================================================
// РАЗДЕЛ. КЛАСС UniverseStore
// ============================================================================

class UniverseStore {
    private readonly state: UniverseState;
    private readonly listeners: Set<StateListener> = new Set();
    private readonly sceneBuffer: SceneBufferSoA;
    private readonly qualityGovernor: QualityGovernor;
    private readonly emittedEventKeys: Set<string> = new Set();
    private lastUiNotifyMs = 0;
    private lastTelemetryUpdateMs = 0;
    private watchdogWarned = false;
    private isCompactMobileLayout = false;

    // --- НАЧАЛО ФУНКЦИИ constructor (UniverseStore) ---
    constructor() {
        const urlParams = this.parseUrlParameters();
        this.qualityGovernor = qualityGovernor;
        this.sceneBuffer = new SceneBufferSoA(1024, urlParams.seed);

        const initialMeta = UNIVERSE_PHASES['01_VOID'];
        const bootTime = this.formatTimestamp();
        const bootLine = `[${bootTime}] [SYSTEM:BOOT] Инициализация UNIVERSE v2.5 (seed=${urlParams.seed}) [ts/universeState.ts]`;

        const isCompactMobile =
            typeof window !== 'undefined' &&
            window.innerWidth <= 920 &&
            !urlParams.debugMode;
        this.isCompactMobileLayout = isCompactMobile;

        this.state = {
            seed: urlParams.seed,
            cycleCount: 1,
            currentPhase: '01_VOID',
            phaseMeta: initialMeta,
            isPaused: false,
            isTabHidden: false,
            autoCyclePhases: true,
            isFinaleCardHovered: false,
            finaleReachedOnce: false,
            finaleRiseElapsedSec: null,
            ouroborosRelease: null,
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
                layer2_metricsHud: !isCompactMobile,
                layer3_topologyGraph: !isCompactMobile,
                layer4_architectTerminal: !isCompactMobile,
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
            lastRendererError: null,
        };

        if (typeof window !== 'undefined') {
            this.lastTelemetryUpdateMs = performance.now();
            this.startPhaseWatchdog();
            window.addEventListener(
                'resize',
                () => {
                    this.syncViewportLayoutMode(window.innerWidth);
                },
                { passive: true }
            );
        }
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (UniverseStore) ---

    /**
     * При пересечении границы мобильного вьюпорта (<= 920px) во время ресайза окна
     * или поворота устройства автоматически сворачивает перекрывающиеся панели телеметрии,
     * а при возврате на широкий десктопный экран (> 920px) раскрывает правую колонку.
     */
    // --- НАЧАЛО ФУНКЦИИ syncViewportLayoutMode (UniverseStore) ---
    public syncViewportLayoutMode(viewportWidth: number): void {
        if (this.state.debugMode) return;
        const shouldBeCompact = viewportWidth <= 920;
        if (shouldBeCompact === this.isCompactMobileLayout) return;

        this.isCompactMobileLayout = shouldBeCompact;
        if (shouldBeCompact) {
            this.state.layers.layer2_metricsHud = false;
            this.state.layers.layer3_topologyGraph = false;
            this.state.layers.layer4_architectTerminal = false;
        } else {
            this.state.layers.layer2_metricsHud = true;
            this.state.layers.layer3_topologyGraph = true;
            this.state.layers.layer4_architectTerminal = true;
        }
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ syncViewportLayoutMode (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ parseUrlParameters (UniverseStore) ---
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
        const seed =
            Number.isFinite(rawSeed) && rawSeed > 0 ? Math.floor(rawSeed) : GOLDEN_SEED;

        const debugMode =
            params.get('debug') === '1' || params.get('debug') === 'true';
        const kioskMode =
            params.get('kiosk') === '1' || params.get('kiosk') === 'true';
        const reducedMotion =
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        return { seed, debugMode, kioskMode, reducedMotion };
    }
    // --- КОНЕЦ ФУНКЦИИ parseUrlParameters (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ formatTimestamp (UniverseStore) ---
    private formatTimestamp(): string {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    // --- КОНЕЦ ФУНКЦИИ formatTimestamp (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ startPhaseWatchdog (UniverseStore) ---
    private startPhaseWatchdog(): void {
        setInterval(() => {
            if (this.state.isPaused || this.state.isTabHidden) return;
            const now = performance.now();
            const gapMs = now - this.lastTelemetryUpdateMs;
            if (gapMs > 2200 && !this.watchdogWarned) {
                this.watchdogWarned = true;
                this.appendLogEvent(
                    'watchdog:stall',
                    `Обнаружена пауза цикла RAF (${Math.round(gapMs)} мс). Ожидание восстановления кадра.`
                );
                this.notifyListeners(true);
            }
        }, 750);
    }
    // --- КОНЕЦ ФУНКЦИИ startPhaseWatchdog (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ reportRendererError (UniverseStore) ---
    public reportRendererError(errorMsg: string): void {
        if (this.state.lastRendererError === errorMsg) return;
        this.state.lastRendererError = errorMsg;
        this.appendLogEvent('renderer:error', errorMsg);
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ reportRendererError (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ getState (UniverseStore) ---
    public getState(): Readonly<UniverseState> {
        return this.state;
    }
    // --- КОНЕЦ ФУНКЦИИ getState (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ getSceneBuffer (UniverseStore) ---
    public getSceneBuffer(): SceneBufferSoA {
        return this.sceneBuffer;
    }
    // --- КОНЕЦ ФУНКЦИИ getSceneBuffer (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ getQualityGovernor (UniverseStore) ---
    public getQualityGovernor(): QualityGovernor {
        return this.qualityGovernor;
    }
    // --- КОНЕЦ ФУНКЦИИ getQualityGovernor (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ subscribe (UniverseStore) ---
    public subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }
    // --- КОНЕЦ ФУНКЦИИ subscribe (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ notifyListeners (UniverseStore) ---
    private notifyListeners(forceImmediate = false): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!forceImmediate && now - this.lastUiNotifyMs < 90) {
            return;
        }
        this.lastUiNotifyMs = now;
        this.listeners.forEach((fn) => fn(this.state));
    }
    // --- КОНЕЦ ФУНКЦИИ notifyListeners (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setFinaleCardHovered (UniverseStore) ---
    public setFinaleCardHovered(hovered: boolean): void {
        if (this.state.isFinaleCardHovered === hovered) return;
        this.state.isFinaleCardHovered = hovered;
    }
    // --- КОНЕЦ ФУНКЦИИ setFinaleCardHovered (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ captureOuroborosRelease (UniverseStore) ---
    private captureOuroborosRelease(): UniverseState['ouroborosRelease'] {
        const state = this.state;
        if (state.currentPhase !== '05_SINGULARITY' || state.finaleRiseElapsedSec === null ||
            (state.singularityAct !== 'ACT_D_GITHUB_CARD' && state.singularityAct !== 'RESTART_COLLAPSE')) return null;
        const ageSec = Math.max(0, Math.min(state.finaleRiseElapsedSec, state.telemetry.phaseElapsedSec - 18.55));
        const cycleTime = state.singularityAct === 'RESTART_COLLAPSE'
            ? Math.min(108, state.telemetry.simulationTimeSec) : state.telemetry.simulationTimeSec;
        return { ageSec, timeSec: cycleTime + Math.max(0, state.cycleCount - 1) * 108 };
    }
    // --- КОНЕЦ ФУНКЦИИ captureOuroborosRelease (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setPhase (UniverseStore) ---
    public setPhase(phase: PhaseId): void {
        if (
            this.state.currentPhase === phase &&
            this.state.singularityAct !== 'RESTART_COLLAPSE' &&
            this.state.telemetry.phaseElapsedSec < 0.25
        ) {
            return;
        }

        // Ручной выход сохраняет показанную карточку и начинает общий подъём.
        if (this.state.finaleReachedOnce && this.state.finaleRiseElapsedSec === null) {
            this.state.finaleRiseElapsedSec = 0;
        }
        this.state.ouroborosRelease = phase === '01_VOID' ? this.captureOuroborosRelease() : null;
        const meta = UNIVERSE_PHASES[phase];
        this.state.currentPhase = phase;
        this.state.phaseMeta = meta;
        this.state.telemetry.phaseElapsedSec = 0;
        this.state.telemetry.phaseProgress = 0;
        this.state.telemetry.simulationTimeSec = meta.startSec;
        this.state.restartElapsedSec = 0;
        this.state.isFinaleCardHovered = false;
        this.state.opticalWeights.logicConvergence = 0;

        if (phase === '05_SINGULARITY') {
            this.state.singularityAct = 'ACT_A_ACCRETION';
            this.state.singularityActProgress = 0;
            this.state.zeroSilenceElapsedMs = 0;
            this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce ? 1.0 : 0;
        } else {
            this.state.singularityAct = 'INACTIVE';
            this.state.singularityActProgress = 0;
            this.state.zeroSilenceElapsedMs = 0;
            this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce ? 1.0 : 0;
        }

        this.appendLogEvent(
            'phase:change',
            `Переход к фазе ${meta.titleRu} [ts/universeState.ts]`
        );
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ setPhase (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ togglePause (UniverseStore) ---
    public togglePause(): void {
        this.state.isPaused = !this.state.isPaused;
        this.lastTelemetryUpdateMs =
            typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.appendLogEvent(
            'time:tick',
            this.state.isPaused
                ? 'Симуляция приостановлена пользователем.'
                : 'Симуляция возобновлена.'
        );
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ togglePause (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setTabHidden (UniverseStore) ---
    public setTabHidden(hidden: boolean): void {
        this.state.isTabHidden = hidden;
        if (!hidden) {
            this.lastTelemetryUpdateMs =
                typeof performance !== 'undefined' ? performance.now() : Date.now();
        }
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ setTabHidden (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ toggleAutoCycle (UniverseStore) ---
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
    // --- КОНЕЦ ФУНКЦИИ toggleAutoCycle (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setAudioEnabled (UniverseStore) ---
    public setAudioEnabled(enabled: boolean, status?: AudioPlaybackStatus): void {
        this.state.audioEnabled = enabled;
        if (status) {
            this.state.telemetry.audioStatus = status;
        } else {
            this.state.telemetry.audioStatus = enabled ? 'PLAYING_MP3' : 'MUTED';
        }
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ setAudioEnabled (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setAudioVolume (UniverseStore) ---
    public setAudioVolume(volume: number): void {
        this.state.audioVolume = Math.max(0, Math.min(1, volume));
        this.notifyListeners(false);
    }
    // --- КОНЕЦ ФУНКЦИИ setAudioVolume (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ setInspectionLevel (UniverseStore) ---
    public setInspectionLevel(level: InspectionLevel): void {
        this.state.inspectionLevel = level;
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ setInspectionLevel (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ toggleLayer (UniverseStore) ---
    public toggleLayer(layerKey: keyof UniverseLayersVisibility): void {
        const nextVal = !this.state.layers[layerKey];
        const isMobileViewport =
            typeof window !== 'undefined' && window.innerWidth <= 920;

        if (
            isMobileViewport &&
            nextVal &&
            (layerKey === 'layer2_metricsHud' ||
                layerKey === 'layer3_topologyGraph' ||
                layerKey === 'layer4_architectTerminal')
        ) {
            this.state.layers.layer2_metricsHud = false;
            this.state.layers.layer3_topologyGraph = false;
            this.state.layers.layer4_architectTerminal = false;
        }

        this.state.layers[layerKey] = nextVal;
        const isOn = this.state.layers[layerKey];
        this.state.opticalWeights.xrayTruth = this.state.layers.layer5_truthXRayMode
            ? 1.0
            : 0.0;

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
    // --- КОНЕЦ ФУНКЦИИ toggleLayer (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ addTerminalLog (UniverseStore) ---
    public addTerminalLog(message: string, sourceTag = 'system:log'): void {
        this.appendLogEvent(sourceTag, message);
        this.notifyListeners(false);
    }
    // --- КОНЕЦ ФУНКЦИИ addTerminalLog (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ emitEvent (UniverseStore) ---
    public emitEvent(
        typeOrMessage: string,
        message?: string,
        sourceTag?: string
    ): void {
        const resolvedType = message ? typeOrMessage : sourceTag ?? 'stress:event';
        const resolvedMsg = message ?? typeOrMessage;
        this.appendLogEvent(resolvedType, resolvedMsg);
        this.notifyListeners(false);
    }
    // --- КОНЕЦ ФУНКЦИИ emitEvent (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ emitEventOnce (UniverseStore) ---
    public emitEventOnce(
        uniqueKey: string,
        typeOrMessage: string,
        optionalMessage?: string
    ): void {
        if (this.emittedEventKeys.has(uniqueKey)) return;
        this.emittedEventKeys.add(uniqueKey);

        const resolvedType =
            optionalMessage !== undefined ? typeOrMessage : 'universe:event';
        const resolvedMessage =
            optionalMessage !== undefined ? optionalMessage : typeOrMessage;
        this.appendLogEvent(resolvedType, resolvedMessage);
    }
    // --- КОНЕЦ ФУНКЦИИ emitEventOnce (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ appendLogEvent (UniverseStore) ---
    private appendLogEvent(type: string, message: string): void {
        const ts = this.formatTimestamp();
        const formattedLine = `[${ts}] [${type.toUpperCase()}] ${message}`;
        this.state.terminalLogs = [
            formattedLine,
            ...this.state.terminalLogs.slice(0, 24),
        ];
    }
    // --- КОНЕЦ ФУНКЦИИ appendLogEvent (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ triggerUniverseRestart (UniverseStore) ---
    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.isFinaleCardHovered = false;
        this.state.finaleReachedOnce = true;
        this.state.finaleRiseElapsedSec ??= 0;
        this.state.singularityAct = 'RESTART_COLLAPSE';
        this.state.restartElapsedSec = 0;
        this.state.singularityActProgress = 0;
        this.state.opticalWeights.logicConvergence = 0;
        this.appendLogEvent(
            'cycle:restart',
            `Запущено гравитационное схлопывание цикла #${this.state.cycleCount} -> #${this.state.cycleCount + 1}`
        );
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ triggerUniverseRestart (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ completeRestartToVoid (UniverseStore) ---
    public completeRestartToVoid(): void {
        this.state.ouroborosRelease = this.captureOuroborosRelease();
        this.state.cycleCount += 1;
        this.emittedEventKeys.clear();
        const voidMeta = UNIVERSE_PHASES['01_VOID'];
        this.state.currentPhase = '01_VOID';
        this.state.phaseMeta = voidMeta;
        this.state.singularityAct = 'INACTIVE';
        this.state.singularityActProgress = 0;
        this.state.zeroSilenceElapsedMs = 0;
        this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce ? 1.0 : 0;
        this.state.restartElapsedSec = 0;
        this.state.isFinaleCardHovered = false;
        this.state.opticalWeights.logicConvergence = 0;
        this.state.telemetry.phaseElapsedSec = 0;
        this.state.telemetry.phaseProgress = 0;
        this.state.telemetry.simulationTimeSec = 0;
        this.sceneBuffer.reset(this.state.seed);
        this.appendLogEvent(
            'cycle:new',
            `Цикл #${this.state.cycleCount} открыт в фазе 01_VOID (визитка активна на фоне).`
        );
        this.notifyListeners(true);
    }
    // --- КОНЕЦ ФУНКЦИИ completeRestartToVoid (UniverseStore) ---

    // --- НАЧАЛО ФУНКЦИИ updateTelemetry (UniverseStore) ---
    public updateTelemetry(partial: Partial<UniverseTelemetryState>): void {
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.lastTelemetryUpdateMs = nowMs;
        this.watchdogWarned = false;

        const isClockAdvancingCall = partial.phaseElapsedSec !== undefined;
        const prevPhaseElapsed = this.state.telemetry.phaseElapsedSec;

        Object.assign(this.state.telemetry, partial);
        this.state.telemetry.stateDigestHex = this.sceneBuffer.getDigestHex();

        if (!isClockAdvancingCall) {
            return;
        }

        const dtSec = Math.max(
            0,
            this.state.telemetry.phaseElapsedSec - prevPhaseElapsed
        );
        // Часы подъёма сохраняются при смене фазы и сбросе часов основного цикла.
        if (this.state.finaleRiseElapsedSec !== null && !this.state.isPaused && !this.state.isTabHidden) {
            this.state.finaleRiseElapsedSec = Math.min(12, this.state.finaleRiseElapsedSec + dtSec);
        }

        const ft = Math.max(1.0, this.state.telemetry.frameTimeMs);
        this.state.telemetry.fps = Math.min(240, Math.round(1000 / ft));

        this.qualityGovernor.feedFrameTime(ft, nowMs);
        this.state.telemetry.frameTimeP95Ms = this.qualityGovernor.getFrameP95Ms();

        const dur = Math.max(1, this.state.phaseMeta.durationSec);
        const rawProgress = Math.max(
            0,
            Math.min(1, this.state.telemetry.phaseElapsedSec / dur)
        );
        this.state.telemetry.phaseProgress = Number(rawProgress.toFixed(4));

        const simSec = this.state.telemetry.simulationTimeSec;
        const smoothPhaseAlpha = smootherstep(0.0, 0.35, rawProgress);
        const targetZoom =
            this.state.phaseMeta.targetZoom +
            Math.sin(simSec * 0.42) * CAMERA_ZOOM_SWAY * smoothPhaseAlpha;
        this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.014;
        this.state.camera.driftX = Math.sin(simSec * 0.14) * 10.5;
        this.state.camera.driftY = Math.cos(simSec * 0.11) * CAMERA_DRIFT_Y_AMPLITUDE;

        if (this.state.singularityAct === 'RESTART_COLLAPSE') {
            this.state.restartElapsedSec += dtSec;
            const collapseProg = Math.min(1.0, this.state.restartElapsedSec / 1.45);
            this.state.singularityActProgress = smootherstep(0.0, 1.0, collapseProg);
            this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce
                ? 1.0
                : Math.max(0.0, 1.0 - this.state.singularityActProgress);
            this.state.opticalWeights.logicConvergence = 0;
            if (collapseProg >= 0.999) {
                this.completeRestartToVoid();
                return;
            }
            this.notifyListeners(true);
            return;
        }

        if (this.state.currentPhase === '05_SINGULARITY') {
            const el = this.state.telemetry.phaseElapsedSec;
            const prevAct = this.state.singularityAct;

            if (el < 8.5) {
                this.state.singularityAct = 'ACT_A_ACCRETION';
                this.state.singularityActProgress = smootherstep(0, 8.5, el);
                this.state.zeroSilenceElapsedMs = 0;
                this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce
                    ? 1.0
                    : 0;
                this.state.opticalWeights.logicConvergence = 0;
            } else if (el < 13.6) {
                this.state.singularityAct = 'ACT_B_LOGIC';
                const actBProg = smootherstep(8.5, 13.6, el);
                this.state.singularityActProgress = actBProg;
                this.state.zeroSilenceElapsedMs = 0;
                this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce
                    ? 1.0
                    : 0;
                this.state.opticalWeights.logicConvergence =
                    Math.sin(actBProg * Math.PI) * 0.65;
                this.emitEventOnce(
                    'logic_conv_act_b',
                    'logic:convergence-started',
                    `Акт B (LOGIC): Спиральное сжатие в Точку Нуля. StateDigest=${this.state.telemetry.stateDigestHex}`
                );
            } else if (el < 14.05) {
                this.state.singularityAct = 'ACT_C_ZERO_SILENCE';
                const actCProg = (el - 13.6) / 0.45;
                this.state.singularityActProgress = Math.max(0, Math.min(1, actCProg));
                this.state.zeroSilenceElapsedMs = Math.min(
                    450,
                    Math.round((el - 13.6) * 1000)
                );
                this.state.githubCardAssemblyProgress = this.state.finaleReachedOnce
                    ? 1.0
                    : 0;
                this.state.opticalWeights.logicConvergence = 0;
                this.emitEventOnce(
                    'zero_silence_start',
                    'zero-silence:started',
                    'Точка Нуля достигнута: мгновенное перерождение в визитку DUBNOV ALEXEY'
                );
            } else {
                // Повторный вход сохраняет собранную карточку; первый показ проходит всю сборку.
                const keepCardAssembled = this.state.cycleCount > 1 ||
                    (this.state.finaleReachedOnce &&
                        (prevAct !== 'ACT_D_GITHUB_CARD' || this.state.githubCardAssemblyProgress >= 1));
                this.state.singularityAct = 'ACT_D_GITHUB_CARD';
                this.state.finaleReachedOnce = true;
                this.state.zeroSilenceElapsedMs = 450;
                this.state.opticalWeights.logicConvergence = 0;
                const cardElapsed = el - 14.05;
                this.state.githubCardAssemblyProgress =
                    keepCardAssembled
                        ? 1.0
                        : Math.max(0, Math.min(1, cardElapsed / 4.5));
                this.state.singularityActProgress =
                    this.state.githubCardAssemblyProgress;
                if (this.state.githubCardAssemblyProgress === 1 && this.state.finaleRiseElapsedSec === null) {
                    this.state.finaleRiseElapsedSec = 0;
                }
                this.emitEventOnce(
                    'zero_silence_end',
                    'zero-silence:ended',
                    'Акт D: Развёртывание визитки DUBNOV ALEXEY из Точки Нуля.'
                );
            }

            if (
                this.state.autoCyclePhases &&
                !this.state.isPaused &&
                !this.state.isFinaleCardHovered &&
                el >= this.state.phaseMeta.durationSec
            ) {
                this.triggerUniverseRestart();
                return;
            }

            this.notifyListeners(prevAct !== this.state.singularityAct);
            return;
        }

        if (
            this.state.autoCyclePhases &&
            !this.state.isPaused &&
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
    // --- КОНЕЦ ФУНКЦИИ updateTelemetry (UniverseStore) ---
}

export const universeStore = new UniverseStore();
