// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Единый источник истины (State Store), Таймлайн 90-120с и Шина Событий
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Хранит паспорта 5 временных фаз: VOID, GENESIS, EVOLUTION, TENSION/BREACH, SINGULARITY.
// 2. Управляет 4 подактами Фазы 05: ACCRETION -> LOGIC -> ZERO_SILENCE (2.5s) -> GITHUB_CARD.
// 3. Разделяет 3 концептуальных мира (ILLUSION, X-RAY, NEXUS) и 5 уровней инспекции UI.
// 4. Реализует типизированную шину однократных событий (Single-Edge Event Bus) без дублей.
// 5. Вычисляет честную телеметрию со скользящим средним (rolling average) и статусы модулей.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. ИДЕНТИФИКАТОРЫ 5 ФАЗ, ПОДАКТОВ СИНГУЛЯРНОСТИ И 5 УРОВНЕЙ ИНСПЕКЦИИ
// ----------------------------------------------------------------------------
export type PhaseId =
    | '01_VOID'
    | '02_GENESIS'
    | '03_EVOLUTION'
    | '04_COLLAPSE' // Имя ID сохранено для совместимости с 04_collapse.ts, в UI: TENSION / BREACH
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

// ----------------------------------------------------------------------------
// 2. ТИПИЗИРОВАННАЯ СИСТЕМА СОБЫТИЙ (SINGLE EVENT SOURCE ПО ТЗ v1.2)
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
// 3. ПАСПОРТА 5 ФАЗ (СТРОГАЯ ЦВЕТОВАЯ ДИСЦИПЛИНА И ТАЙМЛАЙН 105 СЕКУНД)
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
    autoDurationSec: number;
    cameraTargetZoom: number;
    colors: {
        illusionPrimary: string;   // Холодный циан / серебристо-голубой
        illusionSecondary: string; // Сдержанный индиго / фиолетовый газовых зон
        truthWireframe: string;    // Точный оптический тон X-RAY
        backgroundVoid: string;    // Графитово-синий вакуум
        coreAccent: string;        // Жемчужно-белый / редкий янтарный для пиков
    };
}

export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        index: 1,
        codeName: 'PHASE_01 // PRIMORDIAL_VOID',
        titleRu: '01. ПУСТОТА (VOID)',
        subtitleRu: 'Предчувствие, безмолвие и первичная Точка Нуля',
        philosophyRu:
            'Почти абсолютная тишина глубокого вакуума. В центре живет микроскопическая Точка Нуля с тонким серебристо-голубым ореолом, вокруг которой зарождается предчувствие первого импульса.',
        targetParticleCount: 420,
        baseGravity: 0.06,
        baseEntropy: 0.05,
        autoDurationSec: 16,
        cameraTargetZoom: 1.04,
        colors: {
            illusionPrimary: '#7dd3fc',
            illusionSecondary: '#38bdf8',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#03050a',
            coreAccent: '#f8fafc',
        },
    },
    '02_GENESIS': {
        id: '02_GENESIS',
        index: 2,
        codeName: 'PHASE_02 // IGNITION_GENESIS',
        titleRu: '02. ГЕНЕЗИС (GENESIS)',
        subtitleRu: 'Многоступенчатое развёртывание и бинарный танец масс',
        philosophyRu:
            'Точка Нуля высвобождает концентрические фронты света. Два вращающихся центра масс закручивают вещество в асимметричные спиральные рукава, связанные тонким световым мостом.',
        targetParticleCount: 680,
        baseGravity: 0.48,
        baseEntropy: 0.2,
        autoDurationSec: 22,
        cameraTargetZoom: 0.94,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#6366f1',
            truthWireframe: '#7dd3fc',
            backgroundVoid: '#040711',
            coreAccent: '#f59e0b',
        },
    },
    '03_EVOLUTION': {
        id: '03_EVOLUTION',
        index: 3,
        codeName: 'PHASE_03 // NEXUS_EVOLUTION',
        titleRu: '03. ЭВОЛЮЦИЯ (EVOLUTION)',
        subtitleRu: 'Пять кеплеровских колец и рождение топологии NEXUS',
        philosophyRu:
            'Потоки выстраиваются в пять встречных колец. Из космических филаментов прорастает трехмерная нейронная сеть NEXUS: аксонные магистрали, мосты и каскадные импульсы с послесвечением.',
        targetParticleCount: 840,
        baseGravity: 0.85,
        baseEntropy: 0.36,
        autoDurationSec: 26,
        cameraTargetZoom: 1.0,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#8b5cf6',
            truthWireframe: '#38bdf8',
            backgroundVoid: '#050915',
            coreAccent: '#f8fafc',
        },
    },
    '04_COLLAPSE': {
        id: '04_COLLAPSE',
        index: 4,
        codeName: 'PHASE_04 // TENSION_AND_BREACH',
        titleRu: '04. НАПРЯЖЕНИЕ И РАЗРЫВ (TENSION / BREACH)',
        subtitleRu: 'Три волны возмущений и оптическое вскрытие X-RAY',
        philosophyRu:
            'Три гравитационные аномалии последовательно деформируют орбиты и натягивают нити. Мембрана космоса преломляет свет, открывая через разрывы вычислительную структуру в тех же координатах.',
        targetParticleCount: 900,
        baseGravity: 1.55,
        baseEntropy: 0.82,
        autoDurationSec: 22,
        cameraTargetZoom: 1.03,
        colors: {
            illusionPrimary: '#7dd3fc',
            illusionSecondary: '#6366f1',
            truthWireframe: '#f8fafc',
            backgroundVoid: '#060b19',
            coreAccent: '#f59e0b',
        },
    },
    '05_SINGULARITY': {
        id: '05_SINGULARITY',
        index: 5,
        codeName: 'PHASE_05 // LOGIC_TO_SINGULARITY',
        titleRu: '05. СИНГУЛЯРНОСТЬ И ЯСНОСТЬ (LOGIC → ZERO)',
        subtitleRu: 'Аккреция, состояние LOGIC, 2.5с тишины и голограмма GitHub',
        philosophyRu:
            'Материя стягивается в аккреционный диск. В кульминации LOGIC космос, граф NEXUS и векторы X-RAY сливаются воедино, после чего схлопываются в 2.5 секунды абсолютной тишины и карточку создателя.',
        targetParticleCount: 950,
        baseGravity: 2.8,
        baseEntropy: 0.96,
        autoDurationSec: 24,
        cameraTargetZoom: 1.12,
        colors: {
            illusionPrimary: '#f8fafc',
            illusionSecondary: '#38bdf8',
            truthWireframe: '#7dd3fc',
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

// ----------------------------------------------------------------------------
// 4. ИНТЕРФЕЙСЫ СЛОЕВ ИНСПЕКЦИИ, КАМЕРЫ, ВЕСОВ 3 МИРОВ И ЧЕСТНОЙ ТЕЛЕМЕТРИИ
// ----------------------------------------------------------------------------
export interface ImmersionLayersState {
    layer1_illusionCanvas: boolean;
    layer2_metricsHud: boolean;
    layer3_topologyGraph: boolean;
    layer4_architectTerminal: boolean;
    layer5_truthXRayMode: boolean;
}

export interface WorldOpticalWeights {
    illusionWeight: number; // Прозрачность внешнего космоса (0..1)
    xrayWeight: number;     // Глобальная прозрачность чертежа X-RAY (0..1)
    nexusWeight: number;    // Проявленность нейронной топологии NEXUS (0..1)
    logicConvergence: number; // Степень синхронного слияния трех миров в LOGIC (0..1)
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
    phaseProgress: number; // Нормализованный прогресс текущей фазы (0.0 .. 1.0)
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
    singularityActProgress: number; // 0.0 .. 1.0 внутри текущего акта Фазы 5
    zeroSilenceRemainingSec: number; // Таймер строгих 2.5 секунд тишины
    githubCardAssemblyProgress: number; // Прогресс геодезической сборки карточки (0.0 .. 1.0)
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
// 5. ГЛАВНЫЙ МЕНЕДЖЕР СОСТОЯНИЯ И ТАЙМЛАЙНА ВСЕЛЕННОЙ
// ----------------------------------------------------------------------------
class UniverseStoreManager {
    private state: UniverseState;
    private listeners: Set<UniverseStateListener> = new Set();
    private eventListeners: Set<UniverseEventListener> = new Set();
    private emittedEdges: Set<string> = new Set();

    // Кольцевой буфер для честного сглаживания FPS и frameTimeMs (rolling average)
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
            autoCyclePhases: true, // По Библии v1.1 история развивается автоматически со старта
            timeScale: 1.0,
            gravityMultiplier: 1.0,
            audioEnabled: false,
            audioVolume: 0.75,
            layers: {
                layer1_illusionCanvas: true,
                layer2_metricsHud: false, // На старте чистый экран COSMOS без рамок
                layer3_topologyGraph: true,
                layer4_architectTerminal: false,
                layer5_truthXRayMode: false,
            },
            opticalWeights: {
                illusionWeight: 1.0,
                xrayWeight: 0.0,
                nexusWeight: 0.12,
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
                '[SYS_INIT] Единая модель состояния инициализирована (Client-Only Autonomous Mode).',
                '[PHASE_01] Точка Нуля активна. Ожидание первичного импульса GENESIS...',
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

    // Генерация однократного события (защита от дублирования в каждом кадре)
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
    // 6. УПРАВЛЕНИЕ 5 ФАЗАМИ И АВТОМАТИЧЕСКОЙ ДРАМАТУРГИЕЙ ЦИКЛА
    // --------------------------------------------------------------------------
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
        // В конце 05_SINGULARITY цикл останавливается на карточке GitHub до нажатия Restart
        if (this.state.currentPhase === '05_SINGULARITY') return;
        const nextIndex = (currentIndex + 1) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[nextIndex]);
    }

    public prevPhase(): void {
        const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);
        const prevIndex = (currentIndex - 1 + PHASE_ORDER.length) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[prevIndex]);
    }

    // --------------------------------------------------------------------------
    // 7. ПЕРЕКЛЮЧЕНИЕ 5 УРОВНЕЙ ИНСПЕКЦИИ ИНТЕРФЕЙСА (COSMOS..XRAY)
    // --------------------------------------------------------------------------
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
    // 8. РАСЧЕТ ВЕСОВ ТРЕХ МИРОВ И 4 АКТОВ ФАЗЫ 05 (LOGIC -> ZERO -> GITHUB)
    // --------------------------------------------------------------------------
    private updateOpticalWeightsForPhase(phase: PhaseId, progress: number): void {
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const p = Math.max(0, Math.min(1, progress));

        if (phase === '01_VOID') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: p > 0.82 ? (p - 0.82) * 0.45 : 0.0, // Тонкое предчувствие вектора перед GENESIS
                nexusWeight: 0.08 + p * 0.1,
                logicConvergence: 0.0,
            };
        } else if (phase === '02_GENESIS') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.08,
                nexusWeight: 0.22 + smooth(p) * 0.28,
                logicConvergence: 0.0,
            };
        } else if (phase === '03_EVOLUTION') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.12,
                nexusWeight: 0.55 + smooth(p) * 0.4,
                logicConvergence: 0.0,
            };
        } else if (phase === '04_COLLAPSE') {
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.22 + smooth(p) * 0.25,
                nexusWeight: 0.92,
                logicConvergence: p > 0.85 ? (p - 0.85) * 2.0 : 0.0,
            };
        } else if (phase === '05_SINGULARITY') {
            this.advanceSingularityActs(p);
        }
    }

    // Детерминированная машина состояний для 4 актов финала
    private advanceSingularityActs(phaseProgress: number): void {
        const elapsed = this.state.telemetry.phaseElapsedSec;

        if (this.state.singularityAct === 'RESTART_COLLAPSE') {
            return;
        }

        // Акт A (0..7 сек): Гравитационный захват и аккреционный диск с джетами
        if (elapsed < 7.0) {
            const actP = elapsed / 7.0;
            this.state.singularityAct = 'ACT_A_ACCRETION';
            this.state.singularityActProgress = actP;
            this.state.opticalWeights = {
                illusionWeight: 1.0,
                xrayWeight: 0.3 + actP * 0.25,
                nexusWeight: 0.95,
                logicConvergence: actP * 0.45,
            };
            this.emitEventOnce('act_a', 'collapse:started', 'Акт A: Гравитационный захват и аккреция.');
        }
        // Акт B (7..14.5 сек): Состояние LOGIC (синхронная прозрачность трех миров + финальное сжатие)
        else if (elapsed < 14.5) {
            const actP = (elapsed - 7.0) / 7.5;
            this.state.singularityAct = 'ACT_B_LOGIC';
            this.state.singularityActProgress = actP;

            const logicBell = actP < 0.65 ? 1.0 : Math.max(0, 1.0 - (actP - 0.65) / 0.35);
            this.state.opticalWeights = {
                illusionWeight: 0.88 * logicBell,
                xrayWeight: 0.85 * logicBell,
                nexusWeight: 1.0 * logicBell,
                logicConvergence: logicBell,
            };

            this.emitEventOnce(
                'logic_start',
                'logic:convergence-started',
                'Акт B (LOGIC): Синхронное совпадение ILLUSION, X-RAY и NEXUS.'
            );
            if (actP > 0.25) {
                this.emitEventOnce('logic_lock', 'logic:convergence-locked');
            }
        }
        // Акт C (14.5..17.0 сек): Строгие 2.5 секунды абсолютной неподвижной тишины ZERO_SILENCE
        else if (elapsed < 17.0) {
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
                'Акт C (ZERO SILENCE): 2.5 секунды абсолютной тишины в Точке Нуля.'
            );
            if (!wasSilence) this.notify();
        }
        // Акт D (17.0+ сек): Геодезическая сборка голографической карточки GitHub
        else {
            const cardElapsed = elapsed - 17.0;
            const assemblyP = Math.min(1.0, cardElapsed / 3.8);
            const prevAct = this.state.singularityAct;

            this.state.singularityAct = 'ACT_D_GITHUB_CARD';
            this.state.singularityActProgress = assemblyP;
            this.state.zeroSilenceRemainingSec = 0;
            this.state.githubCardAssemblyProgress = assemblyP;

            this.emitEventOnce('zero_silence_end', 'zero-silence:ended');
            this.emitEventOnce(
                'github_assembly',
                'github-card:assembly-started',
                'Акт D: Геодезическая сборка карточки DubnovAlexey/universe из Точки Нуля.'
            );

            if (assemblyP >= 1.0) {
                this.emitEventOnce('github_stable', 'github-card:stable');
            }
            if (prevAct !== 'ACT_D_GITHUB_CARD') this.notify();
        }
    }

    // --------------------------------------------------------------------------
    // 9. ОБРАТНАЯ ХОРЕОГРАФИЯ RESTART UNIVERSE (СВОРАЧИВАНИЕ КАРТОЧКИ В ТОЧКУ НУЛЯ)
    // --------------------------------------------------------------------------
    public triggerUniverseRestart(): void {
        if (this.state.singularityAct === 'RESTART_COLLAPSE') return;
        this.state.singularityAct = 'RESTART_COLLAPSE';
        this.state.singularityActProgress = 0;
        this.emitEvent(
            'universe:restart-started',
            'Сворачивание голографической карточки обратно в Точку Нуля...'
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
        this.emitEvent('universe:restarted', `Новый цикл #${this.state.cycleCount} запущен (seed: ${nextSeed}).`);
    }

    // --------------------------------------------------------------------------
    // 10. ОБНОВЛЕНИЕ ТАЙМЛАЙНА, КАМЕРЫ И ЧЕСТНОЙ ТЕЛЕМЕТРИИ В КАЖДОМ КАДРЕ
    // --------------------------------------------------------------------------
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

        // Предчувствие смены фазы за 2.5 секунды до перехода
        if (duration - elapsed <= 2.5 && duration - elapsed > 0 && this.state.currentPhase !== '05_SINGULARITY') {
            this.emitEventOnce(
                `will_change_${this.state.currentPhase}`,
                'phase:will-change',
                `Предчувствие фазового перехода из ${this.state.currentPhase}...`
            );
        }

        // Обновляем веса трех миров и акты сингулярности
        this.updateOpticalWeightsForPhase(this.state.currentPhase, progress);

        // Плавный кинематографический дрейф камеры
        const simT = this.state.telemetry.simulationTimeSec;
        const motionScale = this.state.reducedMotion ? 0.25 : 1.0;
        if (this.state.singularityAct === 'ACT_C_ZERO_SILENCE') {
            // В паузе тишины камера абсолютно неподвижна
            this.state.camera.driftX = 0;
            this.state.camera.driftY = 0;
        } else {
            this.state.camera.driftX = Math.sin(simT * 0.18) * 18 * motionScale;
            this.state.camera.driftY = Math.cos(simT * 0.14) * 12 * motionScale;
            const targetZoom = this.state.phaseMeta.cameraTargetZoom;
            this.state.camera.zoom += (targetZoom - this.state.camera.zoom) * 0.02;
        }

        // Автоматический переход между фазами 01 -> 02 -> 03 -> 04 -> 05
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

    public setAudioEnabled(enabled: boolean, status: UniverseTelemetry['audioStatus'] = enabled ? 'PLAYING_SYNTH' : 'MUTED'): void {
        this.state = {
            ...this.state,
            audioEnabled: enabled,
            telemetry: {
                ...this.state.telemetry,
                audioStatus: status,
            },
        };
        this.addTerminalLog(`[AUDIO_ENGINE] Статус аудио: ${status}`);
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
        const updatedLogs = [...this.state.terminalLogs, entry].slice(-40);
        this.state = {
            ...this.state,
            terminalLogs: updatedLogs,
        };
    }
}

export const universeStore = new UniverseStoreManager();