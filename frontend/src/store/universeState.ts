// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Единое состояние, многоцветная драматургия палитр и Таймлайн цикла
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Задает уникальную многослойную цветовую и световую палитру для каждой из 5 фаз.
// 2. Управляет непрерывным автоматическим перетеканием состояний (90-120 секунд).
// 3. Координирует 4 акта финала: ACCRETION -> LOGIC -> ZERO_SILENCE (2.5с) -> GITHUB_CARD.
// 4. Хранит честную телеметрию и однократные события шины EventBus.
// ============================================================================

export type PhaseId =
    | '01_VOID'
    | '02_GENESIS'
    | '03_EVOLUTION'
    | '04_COLLAPSE'
    | '05_SINGULARITY';

export type SingularityAct =
    | 'NONE'
    | 'ACT_A_ACCRETION'
    | 'ACT_B_LOGIC'
    | 'ACT_C_ZERO_SILENCE'
    | 'ACT_D_GITHUB_CARD'
    | 'RESTART_COLLAPSE';

export type InspectionLevel =
    | 'COSMOS'
    | 'METRICS'
    | 'TOPOLOGY'
    | 'TERMINAL'
    | 'XRAY';

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
    autoDurationSec: number;
    cameraTargetZoom: number;
    colors: {
        illusionPrimary: string;   // Главный свет сомы и волокон
        illusionSecondary: string; // Глубокий полутон туманностей и дендритов
        truthWireframe: string;    // Оптический цвет X-RAY и аксонных ядер
        backgroundVoid: string;    // Глубокий тон космоса
        coreAccent: string;        // Янтарно-золотой / жемчужный акцент ядер и синапсов
    };
}

export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        index: 1,
        codeName: 'PHASE_01 // PRIMORDIAL_VOID',
        titleRu: '01. ПУСТОТА (ТОЧКА НУЛЯ)',
        subtitleRu: 'Безмолвие до рождения Времени и первая искра Сознания',
        philosophyRu:
            'В бархатной сапфирово-чёрной бездне дремлет микроскопическая Точка Нуля с тёплым янтарным ядром. Вокруг неё в полутенях зарождаются первые прото-синапсы будущей Вселенной.',
        targetParticleCount: 460,
        baseGravity: 0.12,
        baseEntropy: 0.06,
        autoDurationSec: 15,
        cameraTargetZoom: 1.0,
        colors: {
            illusionPrimary: '#7dd3fc',
            illusionSecondary: '#3b82f6',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#03050a',
            coreAccent: '#f59e0b',
        },
    },
    '02_GENESIS': {
        id: '02_GENESIS',
        index: 2,
        codeName: 'PHASE_02 // IGNITION_GENESIS',
        titleRu: '02. ГЕНЕЗИС (РОЖДЕНИЕ ОБРАЗОВ)',
        subtitleRu: 'Двойное золотое ядро, пурпурные туманности и спиральные рукава',
        philosophyRu:
            'Первичный взрыв разворачивает два золотисто-жемчужных центра масс. Из пурпурно-индиговых газовых облаков с тёмными пылевыми каньонами вырастают первые магистральные тракты.',
        targetParticleCount: 700,
        baseGravity: 0.55,
        baseEntropy: 0.22,
        autoDurationSec: 20,
        cameraTargetZoom: 0.98,
        colors: {
            illusionPrimary: '#f59e0b',
            illusionSecondary: '#6366f1',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#050814',
            coreAccent: '#f8fafc',
        },
    },
    '03_EVOLUTION': {
        id: '03_EVOLUTION',
        index: 3,
        codeName: 'PHASE_03 // CORTEX_NEXUS',
        titleRu: '03. НЕЙРОСЕТЬ МОЗГА (NEXUS)',
        subtitleRu: 'Два полушария Космического Разума, ганглии и каскады мыслей',
        philosophyRu:
            'Вселенная обретает архитектуру гигантского Головного Мозга. По S-образным аксонным магистралям между крупными нейронными ядрами-сомами бегут золотисто-бирюзовые разряды живой Мысли.',
        targetParticleCount: 840,
        baseGravity: 0.85,
        baseEntropy: 0.38,
        autoDurationSec: 25,
        cameraTargetZoom: 1.0,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#8b5cf6',
            truthWireframe: '#7dd3fc',
            backgroundVoid: '#060919',
            coreAccent: '#f59e0b',
        },
    },
    '04_COLLAPSE': {
        id: '04_COLLAPSE',
        index: 4,
        codeName: 'PHASE_04 // TENSION_AND_BREACH',
        titleRu: '04. РАЗРЫВ РЕАЛЬНОСТИ (BREACH)',
        subtitleRu: 'Гравитационные воронки, шторм синапсов и вскрытие Кода Истины',
        philosophyRu:
            'Три тёмные гравитационные воронки с янтарными кольцами преломления искривляют нейронные пути. Сквозь трещины оптической мембраны проступает математическая матрица X-RAY.',
        targetParticleCount: 880,
        baseGravity: 1.35,
        baseEntropy: 0.82,
        autoDurationSec: 22,
        cameraTargetZoom: 1.0,
        colors: {
            illusionPrimary: '#f59e0b',
            illusionSecondary: '#8b5cf6',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#050713',
            coreAccent: '#f8fafc',
        },
    },
    '05_SINGULARITY': {
        id: '05_SINGULARITY',
        index: 5,
        codeName: 'PHASE_05 // LOGIC_TO_SINGULARITY',
        titleRu: '05. СИНГУЛЯРНОСТЬ И LOGIC',
        subtitleRu: 'Золотой диск аккреции, слияние 3 миров, 2.5с тишины и GitHub',
        philosophyRu:
            'В кульминации LOGIC Космос, Нейро-Мозг и Код сливаются в абсолютной ясности, затем втягиваются в чёрную дыру горизонта событий, оставляя 2.5 секунды тишины и голограмму создателя.',
        targetParticleCount: 900,
        baseGravity: 2.4,
        baseEntropy: 0.95,
        autoDurationSec: 24,
        cameraTargetZoom: 1.02,
        colors: {
            illusionPrimary: '#f59e0b',
            illusionSecondary: '#38bdf8',
            truthWireframe: '#f8fafc',
            backgroundVoid: '#03050a',
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
    activeParticles: number;
    activeConnections: number;
    activePulses: number;
    simulationTimeSec: number;
    phaseElapsedSec: number;
    phaseProgress: number;
    engineBackend: 'WebGPU' | 'Canvas2D-HighDPI';
    wasmStatus: 'STANDBY (Client TS)' | 'ACTIVE';
    pythonBackendStatus: 'CLIENT-ONLY FALLBACK' | 'CONNECTED';
    audioStatus: 'MUTED' | 'AWAITING_GESTURE' | 'PLAYING_MP3' | 'PLAYING_SYNTH' | 'ZERO_SILENCE';
}

export interface UniverseState {
    seed: number;
    cycleCount: number;
    currentPhase: PhaseId;
    phaseMeta: PhaseMetadata;
    singularityAct: SingularityAct;
    singularityActProgress: number;
    zeroSilenceRemainingSec: number;
    githubCardAssemblyProgress: number;
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

class UniverseStoreManager {
    private state: UniverseState;
    private listeners: Set<UniverseStateListener> = new Set();
    private eventListeners: Set<UniverseEventListener> = new Set();
    private emittedEdges: Set<string> = new Set();
    private frameTimeSamples: number[] = [];
    private readonly maxSamples = 24;

    constructor() {
        const initialPhase: PhaseId = '01_VOID';
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        this.state = {
            seed: 104729,
            cycleCount: 1,
            currentPhase: initialPhase,
            phaseMeta: UNIVERSE_PHASES[initialPhase],
            singularityAct: 'NONE',
            singularityActProgress: 0,
            zeroSilenceRemainingSec: 2.5,
            githubCardAssemblyProgress: 0,
            inspectionLevel: 'COSMOS',
            isPaused: false,
            isTabHidden: false,
            reducedMotion: Boolean(prefersReduced),
            autoCyclePhases: true,
            timeScale: 1.0,
            gravityMultiplier: 1.0,
            audioEnabled: false,
            audioVolume: 0.75,
            layers: {
                layer1_illusionCanvas: true,
                layer2_metricsHud: false,
                layer3_topologyGraph: true,
                layer4_architectTerminal: false,
                layer5_truthXRayMode: false,
            },
            opticalWeights: {
                illusionWeight: 1.0,
                xrayWeight: 0.0,
                nexusWeight: 0.25,
                logicConvergence: 0.0,
            },
            camera: {
                driftX: 0,
                driftY: 0,
                zoom: 1.0,
            },
            telemetry: {
                fps: 60,
                frameTimeMs: 16.7,
                activeParticles: 0,
                activeConnections: 0,
                activePulses: 0,
                simulationTimeSec: 0,
                phaseElapsedSec: 0,
                phaseProgress: 0,
                engineBackend: 'Canvas2D-HighDPI',
                wasmStatus: 'STANDBY (Client TS)',
                pythonBackendStatus: 'CLIENT-ONLY FALLBACK',
                audioStatus: 'MUTED',
            },
            terminalLogs: [
                '[SYS_INIT] Ядро Нейроверса инициализировано (Autonomous Client Mode).',
                '[PHASE_01] Точка Нуля активна. Зарождение первичных синаптических узлов...',
            ],
        };
    }

    public getState(): Readonly<UniverseState> {
        return this.state;
    }

    public subscribe(listener: UniverseStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
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

    public setPhase(phaseId: PhaseId): void {
        if (this.state.currentPhase === phaseId && phaseId !== '01_VOID') return;
        const meta = UNIVERSE_PHASES[phaseId];

        this.state = {
            ...this.state,
            currentPhase: phaseId,
            phaseMeta: meta,
            singularityAct: phaseId === '05_SINGULARITY' ? 'ACT_A_ACCRETION' : 'NONE',
            singularityActProgress: 0,
            zeroSilenceRemainingSec: 2.5,
            githubCardAssemblyProgress: 0,
            telemetry: {
                ...this.state.telemetry,
                phaseElapsedSec: 0,
                phaseProgress: 0,
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

    public setInspectionLevel(level: InspectionLevel): void {
        const layers: ImmersionLayersState = {
            layer1_illusionCanvas: level !== 'XRAY',
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
        this.addTerminalLog(`[OPTICS_MODE] Режим наблюдения: ${level}`);
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
        this.notify();
    }

    private updateOpticalWeightsForPhase(phase: PhaseId, progress: number): void {
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const p = Math.max(0, Math.min(1, progress));

        if (phase === '01_VOID') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: p > 0.8 ? (p - 0.8) * 0.4 : 0.0,
                nexusWeight: 0.2 + p * 0.25,
                logicConvergence: 0.0,
            };
        } else if (phase === '02_GENESIS') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.08,
                nexusWeight: 0.45 + smooth(p) * 0.35,
                logicConvergence: 0.0,
            };
        } else if (phase === '03_EVOLUTION') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.14,
                nexusWeight: 0.85 + smooth(p) * 0.15,
                logicConvergence: 0.0,
            };
        } else if (phase === '04_COLLAPSE') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.28 + smooth(p) * 0.25,
                nexusWeight: 1.0,
                logicConvergence: p > 0.82 ? (p - 0.82) * 2.2 : 0.0,
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
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.35 + actP * 0.25,
                nexusWeight: 1.0,
                logicConvergence: actP * 0.5,
            };
            this.emitEventOnce('act_a', 'collapse:started', 'Акт A: Золотой аккреционный вихрь и джеты.');
        } else if (elapsed < 14.5) {
            const actP = (elapsed - 7.0) / 7.5;
            this.state.singularityAct = 'ACT_B_LOGIC';
            this.state.singularityActProgress = actP;

            const logicBell = actP < 0.65 ? 1.0 : Math.max(0, 1.0 - (actP - 0.65) / 0.35);
            this.state.opticalWeights = {
                illusionWeight: 0.92 * logicBell,
                xrayWeight: 0.88 * logicBell,
                nexusWeight: 1.0 * logicBell,
                logicConvergence: logicBell,
            };

            this.emitEventOnce(
                'logic_start',
                'logic:convergence-started',
                'Акт B (LOGIC): Полное слияние Космоса, Нейро-Мозга NEXUS и Кода X-RAY.'
            );
            if (actP > 0.25) {
                this.emitEventOnce('logic_lock', 'logic:convergence-locked');
            }
        } else if (elapsed < 17.0) {
            const silenceElapsed = elapsed - 14.5;
            const remaining = Math.max(0, 2.5 - silenceElapsed);
            const wasSilence = this.state.singularityAct === 'ACT_C_ZERO_SILENCE';

            this.state.singularityAct = 'ACT_C_ZERO_SILENCE';
            this.state.singularityActProgress = silenceElapsed / 2.5;
            this.state.zeroSilenceRemainingSec = Number(remaining.toFixed(2));
            this.state.opticalWeights = {
                illusionWeight: 0,
                xrayWeight: 0,
                nexusWeight: 0,
                logicConvergence: 0,
            };

            this.emitEventOnce(
                'zero_silence_start',
                'zero-silence:started',
                'Акт C (ZERO SILENCE): 2.5 секунды абсолютной тишины.'
            );
            if (!wasSilence) this.notify();
        } else {
            const cardElapsed = elapsed - 17.0;
            const assemblyP = Math.min(1.0, cardElapsed / 3.5);
            const prevAct = this.state.singularityAct;

            this.state.singularityAct = 'ACT_D_GITHUB_CARD';
            this.state.singularityActProgress = assemblyP;
            this.state.zeroSilenceRemainingSec = 0;
            this.state.githubCardAssemblyProgress = assemblyP;

            this.emitEventOnce('zero_silence_end', 'zero-silence:ended');
            this.emitEventOnce(
                'github_assembly',
                'github-card:assembly-started',
                'Акт D: Проявление голограммы DubnovAlexey/universe.'
            );

            if (assemblyP >= 1.0) {
                this.emitEventOnce('github_stable', 'github-card:stable');
            }
            if (prevAct !== 'ACT_D_GITHUB_CARD') this.notify();
        }
    }

    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.singularityAct = 'RESTART_COLLAPSE';
        this.state.singularityActProgress = 0;
        this.emitEvent(
            'universe:restart-started',
            'Сворачивание голограммы обратно в Точку Нуля...'
        );
        this.notify();
    }

    public completeRestartToVoid(): void {
        this.emittedEdges.clear();
        const nextSeed = (this.state.seed * 1664525 + 1013904223) >>> 0;
        this.state.seed = nextSeed;
        this.state.cycleCount += 1;
        this.state.githubCardAssemblyProgress = 0;
        this.state.singularityAct = 'NONE';
        this.state.singularityActProgress = 0;
        this.state.zeroSilenceRemainingSec = 2.5;
        this.state.telemetry.simulationTimeSec = 0;
        this.setPhase('01_VOID');
        this.emitEvent('universe:restarted', `Цикл #${this.state.cycleCount} запущен.`);
    }

    public updateTelemetry(partial: Partial<UniverseTelemetry>): void {
        if (partial.frameTimeMs !== undefined && partial.frameTimeMs > 0) {
            this.frameTimeSamples.push(partial.frameTimeMs);
            if (this.frameTimeSamples.length > this.maxSamples) {
                this.frameTimeSamples.shift();
            }
            const avgFrameMs =
                this.frameTimeSamples.reduce((acc, v) => acc + v, 0) / this.frameTimeSamples.length;
            partial.frameTimeMs = Number(avgFrameMs.toFixed(1));
            partial.fps = Math.max(1, Math.min(240, Math.round(1000 / avgFrameMs)));
        }

        const duration = Math.max(1, this.state.phaseMeta.autoDurationSec);
        const elapsed = partial.phaseElapsedSec ?? this.state.telemetry.phaseElapsedSec;
        const progress = Math.min(1.0, elapsed / duration);

        this.state.telemetry = {
            ...this.state.telemetry,
            ...partial,
            phaseProgress: Number(progress.toFixed(3)),
        };

        if (
            duration - elapsed <= 2.5 &&
            duration - elapsed > 0 &&
            this.state.currentPhase !== '05_SINGULARITY'
        ) {
            this.emitEventOnce(
                `will_change_${this.state.currentPhase}`,
                'phase:will-change',
                `Предчувствие перехода из ${this.state.currentPhase}...`
            );
        }

        this.updateOpticalWeightsForPhase(this.state.currentPhase, progress);

        const simT = this.state.telemetry.simulationTimeSec;
        const motionScale = this.state.reducedMotion ? 0.25 : 1.0;
        if (this.state.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.state.camera.driftX = 0;
            this.state.camera.driftY = 0;
        } else {
            this.state.camera.driftX = Math.sin(simT * 0.16) * 10 * motionScale;
            this.state.camera.driftY = Math.cos(simT * 0.12) * 7 * motionScale;
            const targetZoom = this.state.phaseMeta.cameraTargetZoom;
            this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.025;
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
    }

    public togglePause(): void {
        this.state = { ...this.state, isPaused: !this.state.isPaused };
        this.notify();
    }

    public setTabHidden(hidden: boolean): void {
        this.state.isTabHidden = hidden;
    }

    public toggleAutoCycle(): void {
        this.state = { ...this.state, autoCyclePhases: !this.state.autoCyclePhases };
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
        this.notify();
    }

    public setAudioVolume(volume: number): void {
        const clamped = Math.max(0.0, Math.min(1.0, Number(volume.toFixed(2))));
        this.state = { ...this.state, audioVolume: clamped };
        this.notify();
    }

    public addTerminalLog(message: string): void {
        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
        const entry = `[${timestamp}] ${message}`;
        this.state = {
            ...this.state,
            terminalLogs: [...this.state.terminalLogs, entry].slice(-40),
        };
    }
}

export const universeStore = new UniverseStoreManager();