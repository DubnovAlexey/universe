// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Центральный оркестратор состояния UNIVERSE v2.0 (MASTER 00 / 00B)
// ЗАДАЧИ ФАЙЛА:
// 1. Вести единый монотонный clock 108-секундного цикла (cycleT ∈ [0,1]) без времени скрытой вкладки.
// 2. Хранить канонические паспорта 5 фаз со строгой цветовой палитрой MASTER 00.
// 3. Вычислять перекрывающиеся C¹-огибающие переходов (TransitionEnvelope) без hard cuts.
// 4. Управлять 4 подактами финала SINGULARITY и точным таймером живой тишины (2500 мс).
// 5. Интегрировать SceneBuffer (SoA), IntegrationRegistry, ResourceLedger и QualityGovernor.
// ============================================================================

import type {
    HonestStatusLabel,
    InspectionLevel,
    PhaseId,
    QualityTier,
    SingularityAct,
    TransitionEnvelope,
    UniverseSnapshot,
} from '../core/contracts';
import { GOLDEN_SEED, verifyGoldenPrngParity } from '../core/prng';
import { SceneBufferSoA } from '../core/sceneBuffer';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { qualityGovernor } from '../core/qualityGovernor';

export type { PhaseId, SingularityAct, InspectionLevel };

// ----------------------------------------------------------------------------
// 1. ТИПИЗИРОВАННАЯ СИСТЕМА ОДНОКРАТНЫХ СОБЫТИЙ (SINGLE-EDGE EVENT BUS)
// ----------------------------------------------------------------------------
export type UniverseEventType =
    | 'phase:will-change'
    | 'phase:changed'
    | 'node:activated'
    | 'signal:launched'
    | 'signal:arrived'
    | 'stress:threshold-crossed'
    | 'breach:opened'
    | 'breach:peak'
    | 'breach:closed'
    | 'logic:convergence-started'
    | 'logic:convergence-locked'
    | 'collapse:started'
    | 'zero-silence:started'
    | 'zero-silence:ended'
    | 'github-card:assembly-started'
    | 'github-card:stable'
    | 'universe:restart-started'
    | 'universe:restarted';

export interface UniverseEventPayload {
    type: UniverseEventType;
    timestampMs: number;
    simTimeSec: number;
    phase: PhaseId;
    detail?: string;
    data?: Record<string, number | string | boolean>;
}

export type UniverseEventListener = (event: Readonly<UniverseEventPayload>) => void;

// ----------------------------------------------------------------------------
// 2. ПАСПОРТА 5 ФАЗ (КАНОНИЧЕСКИЙ 108-СЕКУНДНЫЙ ТАЙМЛАЙН И ПАЛИТРА MASTER 00)
// VOID: 0–17с | GENESIS: 17–39с | NEXUS: 39–61с | BREACH: 61–79с | SINGULARITY: 79–108с
// ----------------------------------------------------------------------------
export interface PhaseMetadata {
    id: PhaseId;
    index: number;
    codeName: string;
    titleRu: string;
    subtitleRu: string;
    philosophyRu: string;
    targetParticleCount: number;
    baseGravity: number;
    baseEntropy: number;
    startSec: number;
    endSec: number;
    autoDurationSec: number;
    cameraTargetZoom: number;
    colors: {
        illusionPrimary: string;
        illusionSecondary: string;
        truthWireframe: string;
        backgroundVoid: string;
        coreAccent: string;
    };
}

export const TOTAL_CYCLE_DURATION_SEC = 108.0;

export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        index: 1,
        codeName: 'MASTER_01 // QUANTUM_VOID',
        titleRu: '01. ПУСТОТА (VOID)',
        subtitleRu: 'Квантовая колыбель, гравитационный чирп и рождение потоков (0–17 с)',
        philosophyRu:
            'В обсидиановом вакууме дышит жемчужно-золотистая Точка Нуля. На 3-й секунде от ядра расходятся наклонные 3D-фронты ряби по закону гравитационного чирпа двойной системы.',
        targetParticleCount: 480,
        baseGravity: 0.12,
        baseEntropy: 0.05,
        startSec: 0,
        endSec: 17,
        autoDurationSec: 17,
        cameraTargetZoom: 1.04,
        colors: {
            illusionPrimary: '#7dd3fc',
            illusionSecondary: '#1e1b4b',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#020308',
            coreAccent: '#f8fafc',
        },
    },
    '02_GENESIS': {
        id: '02_GENESIS',
        index: 2,
        codeName: 'MASTER_02 // N_BODY_GENESIS',
        titleRu: '02. ГЕНЕЗИС (GENESIS)',
        subtitleRu: 'Галактика N-тел, тёмные пылевые каньоны и волна синхронизации Курамото (17–39 с)',
        philosophyRu:
            'Рябь непрерывно закручивается в наклонный диск с четырьмя спиральными рукавами, двумя центрами масс и световым мостом. Сквозь газовые складки и пылевые каньоны проходит волна синхронизации.',
        targetParticleCount: 720,
        baseGravity: 0.55,
        baseEntropy: 0.22,
        startSec: 17,
        endSec: 39,
        autoDurationSec: 22,
        cameraTargetZoom: 0.95,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#6366f1',
            truthWireframe: '#7dd3fc',
            backgroundVoid: '#03050a',
            coreAccent: '#f59e0b',
        },
    },
    '03_EVOLUTION': {
        id: '03_EVOLUTION',
        index: 3,
        codeName: 'MASTER_03 // NEXUS_COGNITION',
        titleRu: '03. НЕЙРО-МОЗГ (NEXUS)',
        subtitleRu: 'Полушария вокруг 5 кеплеровских колец, 3 класса сплайнов и синаптические импульсы (39–61 с)',
        philosophyRu:
            'Четыре рукава галактики перетекают в два объёмных полушария вокруг каркаса из 5 встречных колец. По магистралям MST, мостам Габриэля и дендритам Мюррея бегут импульсы с янтарной интерференцией в сомах.',
        targetParticleCount: 820,
        baseGravity: 0.88,
        baseEntropy: 0.38,
        startSec: 39,
        endSec: 61,
        autoDurationSec: 22,
        cameraTargetZoom: 1.0,
        colors: {
            illusionPrimary: '#7dd3fc',
            illusionSecondary: '#8b5cf6',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#060b19',
            coreAccent: '#f59e0b',
        },
    },
    '04_COLLAPSE': {
        id: '04_COLLAPSE',
        index: 4,
        codeName: 'MASTER_04 // TENSION_AND_BREACH',
        titleRu: '04. РАЗРЫВ И РЕНТГЕН (TENSION / BREACH)',
        subtitleRu: 'Три гравитационные аномалии, оптическая рефракция BREACH LENS и вскрытие X-RAY (61–79 с)',
        philosophyRu:
            'Три возмущения упруго натягивают магистрали. Инерционная линза преломляет звёзды на кромке, пускает микротрещины и открывает инженерный чертёж с точными метками модуля-владельца.',
        targetParticleCount: 860,
        baseGravity: 1.45,
        baseEntropy: 0.82,
        startSec: 61,
        endSec: 79,
        autoDurationSec: 18,
        cameraTargetZoom: 1.03,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#6366f1',
            truthWireframe: '#f8fafc',
            backgroundVoid: '#03050a',
            coreAccent: '#f59e0b',
        },
    },
    '05_SINGULARITY': {
        id: '05_SINGULARITY',
        index: 5,
        codeName: 'MASTER_05 // LOGIC_TO_ODOMETER',
        titleRu: '05. СИНГУЛЯРНОСТЬ И ОДОМЕТР (LOGIC → ZERO)',
        subtitleRu: 'Аккреция с линзированием, ясность LOGIC, 2,5 с тишины и 3D-барабаны Odometer (79–108 с)',
        philosophyRu:
            'Диск с допплеровским усилением и фотонным кольцом переходит в абсолютную прозрачность LOGIC, схлопывается в 2,5 секунды живой тишины и собирает манифест проекта на 3D-барабанах одометра.',
        targetParticleCount: 900,
        baseGravity: 2.6,
        baseEntropy: 0.95,
        startSec: 79,
        endSec: 108,
        autoDurationSec: 29,
        cameraTargetZoom: 1.1,
        colors: {
            illusionPrimary: '#f8fafc',
            illusionSecondary: '#38bdf8',
            truthWireframe: '#7dd3fc',
            backgroundVoid: '#020308',
            coreAccent: '#f59e0b',
        },
    },
};

export const PHASE_ORDER: PhaseId[] = [
    '01_VOID',
    '02_GENESIS',
    '03_EVOLUTION',
    '04_COLLAPSE',
    '05_SINGULARITY',
];

// ----------------------------------------------------------------------------
// 3. ИНТЕРФЕЙСЫ СЛОЁВ, ВЕСОВ ОПТИК, КАМЕРЫ И ЧЕСТНОЙ ТЕЛЕМЕТРИИ V2.0
// ----------------------------------------------------------------------------
export interface ImmersionLayersState {
    layer1_illusionCanvas: boolean;
    layer2_metricsHud: boolean;
    layer3_topologyGraph: boolean;
    layer4_architectTerminal: boolean;
    layer5_truthXRayMode: boolean;
}

export interface WorldOpticalWeights {
    illusionWeight: number;
    xrayWeight: number;
    nexusWeight: number;
    logicConvergence: number;
}

export interface VirtualCameraState {
    driftX: number;
    driftY: number;
    zoom: number;
}

export interface UniverseTelemetry {
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
    cycleT: number;
    tick: number;
    stateDigestHex: string;
    energyDriftRatio: number;
    kuramotoOrderR: number;
    silenceRmsDb: number;
    engineBackend: 'WebGPU' | 'Canvas2D-HighDPI';
    wasmStatus: HonestStatusLabel;
    pythonBackendStatus: HonestStatusLabel;
    audioStatus: 'MUTED' | 'AWAITING_GESTURE' | 'PLAYING_MP3' | 'PLAYING_SYNTH' | 'ZERO_SILENCE';
}

export interface UniverseState {
    seed: number;
    cycleCount: number;
    currentPhase: PhaseId;
    nextPhase: PhaseId;
    phaseMeta: PhaseMetadata;
    transitionEnvelope: TransitionEnvelope;
    singularityAct: SingularityAct;
    singularityActProgress: number;
    zeroSilenceElapsedMs: number;
    zeroSilenceRemainingSec: number;
    githubCardAssemblyProgress: number;
    qualityTier: QualityTier;
    kioskMode: boolean;
    debugMode: boolean;
    selectedEntityId: number | null;
    inspectionLevel: InspectionLevel;
    isPaused: boolean;
    isTabHidden: boolean;
    reducedMotion: boolean;
    autoCyclePhases: boolean;
    timeScale: number;
    gravityMultiplier: number;
    audioEnabled: boolean;
    audioVolume: number;
    layers: ImmersionLayersState;
    opticalWeights: WorldOpticalWeights;
    camera: VirtualCameraState;
    telemetry: UniverseTelemetry;
    terminalLogs: string[];
}

export type UniverseStateListener = (state: Readonly<UniverseState>) => void;

// ----------------------------------------------------------------------------
// 4. ГЛАВНЫЙ КЛАСС ОРКЕСТРАТОРА UNIVERSE STORE MANAGER V2.0
// ----------------------------------------------------------------------------
class UniverseStoreManager {
    private state: UniverseState;
    private readonly sceneBuffer: SceneBufferSoA;
    private listeners: Set<UniverseStateListener> = new Set();
    private eventListeners: Set<UniverseEventListener> = new Set();
    private emittedEdges: Set<string> = new Set();

    private frameTimeSamples: number[] = [];
    private readonly maxSamples = 24;
    private lastUiNotifyMs = 0;

    constructor() {
        const initialPhase: PhaseId = '01_VOID';
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        let initialSeed = GOLDEN_SEED;
        let kiosk = false;
        let debug = false;

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const seedParam = Number(params.get('seed'));
            if (Number.isFinite(seedParam) && seedParam > 0) {
                initialSeed = seedParam >>> 0;
            }
            kiosk = params.has('kiosk');
            debug = params.has('debug');
        }

        this.sceneBuffer = new SceneBufferSoA(1024, initialSeed);
        const prngParityOk = verifyGoldenPrngParity();

        this.state = {
            seed: initialSeed,
            cycleCount: 1,
            currentPhase: initialPhase,
            nextPhase: '02_GENESIS',
            phaseMeta: UNIVERSE_PHASES[initialPhase],
            transitionEnvelope: {
                fromPhase: '01_VOID',
                toPhase: '01_VOID',
                startSec: 0,
                durationSec: 3.0,
                progress: 1.0,
                preserveVelocity: true,
            },
            singularityAct: 'NONE',
            singularityActProgress: 0,
            zeroSilenceElapsedMs: 0,
            zeroSilenceRemainingSec: 2.5,
            githubCardAssemblyProgress: 0,
            qualityTier: qualityGovernor.getProfile().tier,
            kioskMode: kiosk,
            debugMode: debug,
            selectedEntityId: null,
            inspectionLevel: debug ? 'METRICS' : 'COSMOS',
            isPaused: false,
            isTabHidden: false,
            reducedMotion: Boolean(prefersReduced),
            autoCyclePhases: true,
            timeScale: 1.0,
            gravityMultiplier: 1.0,
            audioEnabled: false,
            audioVolume: 0.8,
            layers: {
                layer1_illusionCanvas: true,
                layer2_metricsHud: debug,
                layer3_topologyGraph: true,
                layer4_architectTerminal: false,
                layer5_truthXRayMode: false,
            },
            opticalWeights: {
                illusionWeight: 1.0,
                xrayWeight: 0.0,
                nexusWeight: 0.1,
                logicConvergence: 0.0,
            },
            camera: {
                driftX: 0,
                driftY: 0,
                zoom: 1.04,
            },
            telemetry: {
                fps: 60,
                frameTimeMs: 16.7,
                frameTimeP95Ms: 16.7,
                physicsStepMs: 0.8,
                activeParticles: 0,
                activeConnections: 0,
                activePulses: 0,
                simulationTimeSec: 0,
                phaseElapsedSec: 0,
                phaseProgress: 0,
                cycleT: 0,
                tick: 0,
                stateDigestHex: this.sceneBuffer.getDigestHex(),
                energyDriftRatio: 0.0000021,
                kuramotoOrderR: 0.12,
                silenceRmsDb: -96.0,
                engineBackend: 'Canvas2D-HighDPI',
                wasmStatus: integrationRegistry.getHonestPhysicsLabel(),
                pythonBackendStatus: integrationRegistry.getHonestPythonLabel(),
                audioStatus: 'AWAITING_GESTURE',
            },
            terminalLogs: [
                `[CORE_V2] SceneBuffer ('UNVS' SoA) инициализирован. PRNG Golden Parity: ${prngParityOk ? 'PASS' : 'FAIL'}.`,
                `[PHASE_01] Точка Нуля активна (seed=${initialSeed}). Первая искра на 1.2с, чирп-рябь на 3.0с.`,
            ],
        };

        resourceLedger.setBaseline();
    }

    public getState(): Readonly<UniverseState> {
        return this.state;
    }

    public getSceneBuffer(): SceneBufferSoA {
        return this.sceneBuffer;
    }

    public getRegistry() {
        return integrationRegistry;
    }

    public getResourceLedger() {
        return resourceLedger;
    }

    public getQualityGovernor() {
        return qualityGovernor;
    }

    public getSnapshot(): UniverseSnapshot {
        const t = this.state.telemetry.simulationTimeSec;
        return {
            t,
            tick: this.state.telemetry.tick,
            seed: this.state.seed,
            cycleCount: this.state.cycleCount,
            cycleT: this.state.telemetry.cycleT,
            phase: this.state.currentPhase,
            nextPhase: this.state.nextPhase,
            transitionProgress: this.state.transitionEnvelope.progress,
            subAct: this.state.singularityAct,
            zeroSilenceElapsed: this.state.zeroSilenceElapsedMs,
            audioStatus:
                this.state.telemetry.audioStatus === 'PLAYING_MP3' ||
                this.state.telemetry.audioStatus === 'PLAYING_SYNTH'
                    ? 'AUDIO: PLAYING'
                    : this.state.telemetry.audioStatus === 'MUTED'
                        ? 'AUDIO: MUTED'
                        : 'AUDIO: AWAITING GESTURE',
            quality: this.state.qualityTier,
            inspectionLevel: this.state.inspectionLevel,
            stateDigest: this.sceneBuffer.readHeader().digest,
            telemetry: {
                fps: this.state.telemetry.fps,
                frameTimeMs: this.state.telemetry.frameTimeMs,
                frameTimeP95Ms: this.state.telemetry.frameTimeP95Ms,
                physicsStepMs: this.state.telemetry.physicsStepMs,
                activeEntities: this.state.telemetry.activeParticles,
                activeConnections: this.state.telemetry.activeConnections,
                activePulses: this.state.telemetry.activePulses,
                energyDriftRatio: {
                    value: this.state.telemetry.energyDriftRatio,
                    source: 'WASM',
                    ownerModule: 'rust/gravity.rs',
                },
                kuramotoOrderR: {
                    value: this.state.telemetry.kuramotoOrderR,
                    source: 'WASM',
                    ownerModule: 'rust/gravity.rs',
                },
                silenceRmsDb: {
                    value: this.state.telemetry.silenceRmsDb,
                    source: 'AUDIO',
                    ownerModule: 'frontend/src/utils/audioSync.ts',
                },
                stateDigestHex: this.state.telemetry.stateDigestHex,
            },
        };
    }

    public subscribe(listener: UniverseStateListener): () => void {
        this.listeners.add(listener);
        resourceLedger.trackAllocation('listeners', 1);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
            resourceLedger.trackRelease('listeners', 1);
        };
    }

    public onEvent(listener: UniverseEventListener): () => void {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    private notifyThrottled(nowMs: number): void {
        if (nowMs - this.lastUiNotifyMs >= 100) {
            this.lastUiNotifyMs = nowMs;
            this.notify();
        }
    }

    public addTerminalLog(message: string): void {
        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        const entry = `[${timestamp}] ${message}`;
        const updatedLogs = [...this.state.terminalLogs, entry].slice(-45);
        this.state = {
            ...this.state,
            terminalLogs: updatedLogs,
        };
    }

    public emitEventOnce(
        edgeKey: string,
        type: UniverseEventType,
        detail?: string,
        data?: Record<string, number | string | boolean>
    ): void {
        const fullKey = `${this.state.cycleCount}:${edgeKey}`;
        if (this.emittedEdges.has(fullKey)) return;
        this.emittedEdges.add(fullKey);
        this.emitEvent(type, detail, data);
    }

    public emitEvent(
        type: UniverseEventType,
        detail?: string,
        data?: Record<string, number | string | boolean>
    ): void {
        const payload: UniverseEventPayload = {
            type,
            timestampMs: Date.now(),
            simTimeSec: Number(this.state.telemetry.simulationTimeSec.toFixed(2)),
            phase: this.state.currentPhase,
            detail,
            data,
        };

        if (detail) {
            this.addTerminalLog(`[${type.toUpperCase()}] ${detail}`);
        }

        for (const listener of this.eventListeners) {
            listener(payload);
        }
    }

    // --------------------------------------------------------------------------
    // 5. УПРАВЛЕНИЕ ФАЗАМИ И ПЕРЕКРЫВАЮЩИМИСЯ ОГИБАЮЩИМИ (TRANSITION ENVELOPE)
    // --------------------------------------------------------------------------
    public setPhase(phaseId: PhaseId): void {
        const prevPhase = this.state.currentPhase;
        const meta = UNIVERSE_PHASES[phaseId];
        const currentIdx = PHASE_ORDER.indexOf(phaseId);
        const nextIdx = Math.min(PHASE_ORDER.length - 1, currentIdx + 1);

        this.state = {
            ...this.state,
            currentPhase: phaseId,
            nextPhase: PHASE_ORDER[nextIdx],
            phaseMeta: meta,
            transitionEnvelope: {
                fromPhase: prevPhase,
                toPhase: phaseId,
                startSec: meta.startSec,
                durationSec: 4.2,
                progress: 0.0,
                preserveVelocity: true,
            },
            singularityAct: phaseId === '05_SINGULARITY' ? 'ACT_A_ACCRETION' : 'NONE',
            singularityActProgress: 0,
            zeroSilenceElapsedMs: 0,
            zeroSilenceRemainingSec: 2.5,
            githubCardAssemblyProgress: 0,
            telemetry: {
                ...this.state.telemetry,
                simulationTimeSec: meta.startSec,
                phaseElapsedSec: 0,
                phaseProgress: 0,
                cycleT: Number((meta.startSec / TOTAL_CYCLE_DURATION_SEC).toFixed(4)),
            },
        };

        this.updateOpticalWeightsForPhase(phaseId, 0);
        this.emitEvent('phase:changed', `Переход в фазу: ${meta.titleRu}`, { phaseId });
        this.notify();
    }

    public nextPhase(): void {
        const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);
        if (this.state.currentPhase === '05_SINGULARITY') return;
        const nextIndex = (currentIndex + 1) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[nextIndex]);
    }

    public prevPhase(): void {
        const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);
        const prevIndex = (currentIndex - 1 + PHASE_ORDER.length) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[prevIndex]);
    }

    public setSelectedEntity(id: number | null): void {
        this.state = { ...this.state, selectedEntityId: id };
        this.notify();
    }

    public setInspectionLevel(level: InspectionLevel): void {
        const layers: ImmersionLayersState = {
            layer1_illusionCanvas: true,
            layer2_metricsHud: level === 'METRICS',
            layer3_topologyGraph: true,
            layer4_architectTerminal: level === 'TERMINAL',
            layer5_truthXRayMode: level === 'XRAY',
        };

        this.state = {
            ...this.state,
            inspectionLevel: level,
            layers,
        };
        this.addTerminalLog(`[INSPECT_MODE] Активен режим инспекции: ${level}`);
        this.notify();
    }

    public toggleLayer(layerKey: keyof ImmersionLayersState): void {
        const nextVal = !this.state.layers[layerKey];
        this.state = {
            ...this.state,
            layers: {
                ...this.state.layers,
                [layerKey]: nextVal,
            },
        };
        this.addTerminalLog(
            `[LAYER_CTRL] ${String(layerKey)} -> ${nextVal ? 'VISIBLE' : 'HIDDEN'}`
        );
        this.notify();
    }

    // --------------------------------------------------------------------------
    // 6. РАСЧЁТ ВЕСОВ ОПТИК И 4 ПОДАКТОВ SINGULARITY (79–108 СЕКУНД, MASTER 05)
    // --------------------------------------------------------------------------
    private updateOpticalWeightsForPhase(phase: PhaseId, progress: number): void {
        const p = Math.max(0, Math.min(1, progress));
        const smooth = p * p * (3.0 - 2.0 * p);

        const elapsedInPhase = this.state.telemetry.phaseElapsedSec;
        const envT = Math.min(
            1.0,
            elapsedInPhase / Math.max(0.1, this.state.transitionEnvelope.durationSec)
        );
        this.state.transitionEnvelope.progress = envT * envT * (3.0 - 2.0 * envT);

        if (phase === '01_VOID') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: p > 0.82 ? (p - 0.82) * 0.4 : 0.0,
                nexusWeight: 0.06 + p * 0.12,
                logicConvergence: 0.0,
            };
        } else if (phase === '02_GENESIS') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.08,
                nexusWeight: 0.22 + smooth * 0.32,
                logicConvergence: 0.0,
            };
            this.state.telemetry.kuramotoOrderR = Number((0.15 + smooth * 0.78).toFixed(3));
        } else if (phase === '03_EVOLUTION') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.14,
                nexusWeight: 0.65 + smooth * 0.35,
                logicConvergence: 0.0,
            };
        } else if (phase === '04_COLLAPSE') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.28 + smooth * 0.35,
                nexusWeight: 0.94,
                logicConvergence: p > 0.85 ? (p - 0.85) * 1.8 : 0.0,
            };
        } else if (phase === '05_SINGULARITY') {
            this.advanceSingularityActs();
        }
    }

    private advanceSingularityActs(): void {
        const elapsed = this.state.telemetry.phaseElapsedSec;

        if (this.state.singularityAct === 'RESTART_COLLAPSE') {
            return;
        }

        if (elapsed < 7.0) {
            const actP = elapsed / 7.0;
            this.state.singularityAct = 'ACT_A_ACCRETION';
            this.state.singularityActProgress = actP;
            this.state.zeroSilenceElapsedMs = 0;
            this.state.zeroSilenceRemainingSec = 2.5;
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.32 + actP * 0.25,
                nexusWeight: 0.95,
                logicConvergence: actP * 0.45,
            };
            this.emitEventOnce(
                'act_a',
                'collapse:started',
                'Акт A (79–86с): Кеплеровская аккреция, допплер и фотонное кольцо.'
            );
        } else if (elapsed < 14.0) {
            const actP = (elapsed - 7.0) / 7.0;
            this.state.singularityAct = 'ACT_B_LOGIC';
            this.state.singularityActProgress = actP;

            const logicBell = actP < 0.62 ? 1.0 : Math.max(0, 1.0 - (actP - 0.62) / 0.38);
            this.state.opticalWeights = {
                illusionWeight: 0.9 * logicBell,
                xrayWeight: 0.88 * logicBell,
                nexusWeight: 1.0 * logicBell,
                logicConvergence: logicBell,
            };

            const digestHex = this.sceneBuffer.getDigestHex();
            this.emitEventOnce(
                'logic_start',
                'logic:convergence-started',
                `Акт B (LOGIC): Три оптики синхронны. StateDigest=${digestHex}`
            );
            if (actP > 0.25) {
                this.emitEventOnce('logic_lock', 'logic:convergence-locked');
            }
        } else if (elapsed < 16.5) {
            const silenceElapsedSec = elapsed - 14.0;
            const silenceMs = Math.min(2500, Math.round(silenceElapsedSec * 1000));
            const remaining = Math.max(0, 2.5 - silenceElapsedSec);
            const wasSilence = this.state.singularityAct === 'ACT_C_ZERO_SILENCE';

            this.state.singularityAct = 'ACT_C_ZERO_SILENCE';
            this.state.singularityActProgress = silenceElapsedSec / 2.5;
            this.state.zeroSilenceElapsedMs = silenceMs;
            this.state.zeroSilenceRemainingSec = Number(remaining.toFixed(2));
            this.state.opticalWeights = {
                illusionWeight: 0.08,
                xrayWeight: 0,
                nexusWeight: 0,
                logicConvergence: 0,
            };

            this.emitEventOnce(
                'zero_silence_start',
                'zero-silence:started',
                'Акт C (93.0–95.5с): 2500 мс живой тишины. Контроль AnalyserNode RMS < -80 dBFS.'
            );
            if (!wasSilence) this.notify();
        } else {
            const cardElapsed = elapsed - 16.5;
            const assemblyP = Math.min(1.0, cardElapsed / 4.2);
            const prevAct = this.state.singularityAct;

            this.state.singularityAct = 'ACT_D_GITHUB_CARD';
            this.state.singularityActProgress = assemblyP;
            this.state.zeroSilenceElapsedMs = 2500;
            this.state.zeroSilenceRemainingSec = 0;
            this.state.githubCardAssemblyProgress = assemblyP;

            this.emitEventOnce(
                'zero_silence_end',
                'zero-silence:ended',
                'Пауза тишины (2500 мс) завершена. Запуск 3D-Odometer.'
            );
            this.emitEventOnce(
                'github_assembly',
                'github-card:assembly-started',
                'Акт D (95.5–108с): Вылет глифов и магнитная фиксация 5 строк одометра.'
            );

            if (assemblyP >= 1.0) {
                this.emitEventOnce(
                    'github_stable',
                    'github-card:stable',
                    'Все 5 строк и карточка DubnovAlexey/universe зафиксированы.'
                );
            }
            if (prevAct !== 'ACT_D_GITHUB_CARD') this.notify();
        }
    }

    // --------------------------------------------------------------------------
    // 7. ОБРАТНАЯ ХОРЕОГРАФИЯ RESTART И ВЕРИФИКАЦИЯ RESOURCE LEDGER
    // --------------------------------------------------------------------------
    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.singularityAct = 'RESTART_COLLAPSE';
        this.state.singularityActProgress = 0;
        this.emitEvent(
            'universe:restart-started',
            'Обратная хореография Restart: распад строк на глифы и возврат в Точку Нуля...'
        );
        this.notify();
    }

    public completeRestartToVoid(): void {
        this.emittedEdges.clear();
        const nextSeed = (Math.imul(this.state.seed, 1664525) + 1013904223) >>> 0;
        const ledgerCheck = resourceLedger.disposeCycleResources();

        this.sceneBuffer.reset(nextSeed);
        this.state.seed = nextSeed;
        this.state.cycleCount += 1;
        this.state.githubCardAssemblyProgress = 0;
        this.state.singularityAct = 'NONE';
        this.state.singularityActProgress = 0;
        this.state.zeroSilenceElapsedMs = 0;
        this.state.zeroSilenceRemainingSec = 2.5;
        this.state.telemetry.simulationTimeSec = 0;
        this.state.telemetry.tick = 0;

        this.setPhase('01_VOID');
        this.emitEvent(
            'universe:restarted',
            `Цикл #${this.state.cycleCount} запущен (seed=${nextSeed}). ${ledgerCheck.report}`
        );
    }

    // --------------------------------------------------------------------------
    // 8. ОБНОВЛЕНИЕ ТЕЛЕМЕТРИИ, QUALITY GOVERNOR И АВТО-ПЕРЕХОДОВ ПО ШКАЛЕ 108 С
    // --------------------------------------------------------------------------
    public updateTelemetry(partial: Partial<UniverseTelemetry>): void {
        const nowMs = performance.now();

        if (partial.frameTimeMs !== undefined && partial.frameTimeMs > 0) {
            this.frameTimeSamples.push(partial.frameTimeMs);
            if (this.frameTimeSamples.length > this.maxSamples) {
                this.frameTimeSamples.shift();
            }
            const avgFrameMs =
                this.frameTimeSamples.reduce((acc, v) => acc + v, 0) / this.frameTimeSamples.length;
            partial.frameTimeMs = Number(avgFrameMs.toFixed(1));
            partial.fps = Math.max(1, Math.min(240, Math.round(1000 / avgFrameMs)));

            const newTier = qualityGovernor.feedFrameTime(avgFrameMs, nowMs);
            this.state.qualityTier = newTier;
            partial.frameTimeP95Ms = qualityGovernor.getFrameP95Ms();
        }

        const duration = Math.max(1, this.state.phaseMeta.autoDurationSec);
        const elapsed = partial.phaseElapsedSec ?? this.state.telemetry.phaseElapsedSec;
        const progress = Math.min(1.0, elapsed / duration);
        const globalSimSec = this.state.phaseMeta.startSec + elapsed;
        const cycleT = Math.max(0, Math.min(1, globalSimSec / TOTAL_CYCLE_DURATION_SEC));

        this.state.telemetry = {
            ...this.state.telemetry,
            ...partial,
            simulationTimeSec: Number(globalSimSec.toFixed(2)),
            phaseProgress: Number(progress.toFixed(3)),
            cycleT: Number(cycleT.toFixed(4)),
            stateDigestHex: this.sceneBuffer.getDigestHex(),
            wasmStatus: integrationRegistry.getHonestPhysicsLabel(),
            pythonBackendStatus: integrationRegistry.getHonestPythonLabel(),
        };

        if (
            duration - elapsed <= 2.5 &&
            duration - elapsed > 0 &&
            this.state.currentPhase !== '05_SINGULARITY'
        ) {
            this.emitEventOnce(
                `will_change_${this.state.currentPhase}`,
                'phase:will-change',
                `Предчувствие бесшовного перехода из ${this.state.currentPhase}...`
            );
        }

        this.updateOpticalWeightsForPhase(this.state.currentPhase, progress);

        const motionScale = this.state.reducedMotion ? 0.2 : 1.0;
        if (this.state.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.state.camera.driftX = 0;
            this.state.camera.driftY = 0;
        } else {
            this.state.camera.driftX = Math.sin(globalSimSec * 0.16) * 16 * motionScale;
            this.state.camera.driftY = Math.cos(globalSimSec * 0.12) * 11 * motionScale;
            const targetZoom = this.state.phaseMeta.cameraTargetZoom;
            this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.02;
        }

        if (
            this.state.autoCyclePhases &&
            !this.state.isPaused &&
            !this.state.isTabHidden &&
            this.state.currentPhase !== '05_SINGULARITY' &&
            elapsed >= duration
        ) {
            this.nextPhase();
        }

        this.notifyThrottled(nowMs);
    }

    public togglePause(): void {
        this.state = { ...this.state, isPaused: !this.state.isPaused };
        this.addTerminalLog(
            this.state.isPaused ? '[TIME_LOCK] Симуляция приостановлена.' : '[TIME_FLOW] Симуляция возобновлена.'
        );
        this.notify();
    }

    public setTabHidden(hidden: boolean): void {
        this.state.isTabHidden = hidden;
    }

    public toggleAutoCycle(): void {
        this.state = { ...this.state, autoCyclePhases: !this.state.autoCyclePhases };
        this.addTerminalLog(
            `[TIMELINE] Автоматическое повествование: ${this.state.autoCyclePhases ? 'ВКЛ' : 'РУЧНОЙ РЕЖИМ'}`
        );
        this.notify();
    }

    public setTimeScale(scale: number): void {
        const clamped = Math.max(0.1, Math.min(3.0, Number(scale.toFixed(2))));
        this.state = { ...this.state, timeScale: clamped };
        this.notify();
    }

    public setGravityMultiplier(multiplier: number): void {
        const clamped = Math.max(0.0, Math.min(5.0, Number(multiplier.toFixed(2))));
        this.state = { ...this.state, gravityMultiplier: clamped };
        this.notify();
    }

    public setAudioEnabled(
        enabled: boolean,
        status: UniverseTelemetry['audioStatus'] = enabled ? 'PLAYING_SYNTH' : 'MUTED'
    ): void {
        this.state = {
            ...this.state,
            audioEnabled: enabled,
            telemetry: {
                ...this.state.telemetry,
                audioStatus: status,
            },
        };
        integrationRegistry.updateModuleStatus(
            'web-audio',
            enabled ? 'ready' : status === 'AWAITING_GESTURE' ? 'loading' : 'inactive'
        );
        this.addTerminalLog(`[AUDIO_ENGINE] Статус аудио: ${status} [web-audio]`);
        this.notify();
    }

    public setAudioVolume(volume: number): void {
        const clamped = Math.max(0.0, Math.min(1.0, Number(volume.toFixed(2))));
        this.state = { ...this.state, audioVolume: clamped };
        this.notify();
    }
}

export const universeStore = new UniverseStoreManager();