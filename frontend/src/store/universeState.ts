// ============================================================================
// ФАЙЛ: frontend/src/store/universeState.ts
// НАЗНАЧЕНИЕ: Глобальное реактивное хранилище состояния Вселенной (State Store)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Определяет 5 эволюционных фаз Вселенной (от Пустоты до Сингулярности) и их паспорта.
// 2. Управляет видимостью 5 слоев погружения (Иллюзия, Метрики, Топология, Терминал, Ядро).
// 3. Хранит живую телеметрию симуляции (FPS, число частиц, гравитацию, скорость времени).
// 4. Реализует паттерн Наблюдатель (Pub/Sub) для мгновенной синхронизации движка и UI.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. ТИПЫ И ИДЕНТИФИКАТОРЫ 5 ФАЗ ЭВОЛЮЦИИ
// ----------------------------------------------------------------------------
export type PhaseId =
    | '01_VOID'
    | '02_GENESIS'
    | '03_EVOLUTION'
    | '04_COLLAPSE'
    | '05_SINGULARITY';

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
    colors: {
        illusionPrimary: string;
        illusionSecondary: string;
        truthWireframe: string;
        backgroundVoid: string;
    };
}

// ----------------------------------------------------------------------------
// 2. ПАСПОРТА ВСЕХ 5 ФАЗ ВСЕЛЕННОЙ (КОНСТАНТЫ МИРОЗДАНИЯ)
// ----------------------------------------------------------------------------
export const UNIVERSE_PHASES: Record<PhaseId, PhaseMetadata> = {
    '01_VOID': {
        id: '01_VOID',
        index: 1,
        codeName: 'PHASE_01 // PRIMORDIAL_VOID',
        titleRu: '01. ПУСТОТА (VOID)',
        subtitleRu: 'Квантовый вакуум и флуктуации нуля',
        philosophyRu:
            'Кажущаяся тишина до рождения времени. На уровне Иллюзии — бархатная бездна с редкими искрами. На уровне Истины — кипящая пена виртуальных векторов и вероятностных полей.',
        targetParticleCount: 450,
        baseGravity: 0.05,
        baseEntropy: 0.08,
        autoDurationSec: 35,
        colors: {
            illusionPrimary: '#38bdf8',
            illusionSecondary: '#818cf8',
            truthWireframe: '#00ffcc',
            backgroundVoid: '#03050a',
        },
    },
    '02_GENESIS': {
        id: '02_GENESIS',
        index: 2,
        codeName: 'PHASE_02 // IGNITION_GENESIS',
        titleRu: '02. ГЕНЕЗИС (GENESIS)',
        subtitleRu: 'Первичный импульс и пробуждение гравитации',
        philosophyRu:
            'Симметрия вакуума нарушена. Рождаются первые центры масс. Иллюзия рисует ослепительные туманности, а Истина фиксирует жесткие гравитационные колодцы и захват импульсов.',
        targetParticleCount: 1200,
        baseGravity: 0.45,
        baseEntropy: 0.22,
        autoDurationSec: 45,
        colors: {
            illusionPrimary: '#f472b6',
            illusionSecondary: '#60a5fa',
            truthWireframe: '#22d3ee',
            backgroundVoid: '#050714',
        },
    },
    '03_EVOLUTION': {
        id: '03_EVOLUTION',
        index: 3,
        codeName: 'PHASE_03 // HARMONIC_EVOLUTION',
        titleRu: '03. ЭВОЛЮЦИЯ (EVOLUTION)',
        subtitleRu: 'Сложные орбитальные резонансы и структура',
        philosophyRu:
            'Золотой век порядка. Материя сплетается в устойчивые созвездия и потоки. Иллюзия кажется вечной симфонией света, скрывая под собой предельное натяжение математического графа.',
        targetParticleCount: 2000,
        baseGravity: 0.85,
        baseEntropy: 0.38,
        autoDurationSec: 60,
        colors: {
            illusionPrimary: '#a78bfa',
            illusionSecondary: '#34d399',
            truthWireframe: '#10b981',
            backgroundVoid: '#040914',
        },
    },
    '04_COLLAPSE': {
        id: '04_COLLAPSE',
        index: 4,
        codeName: 'PHASE_04 // ENTROPIC_COLLAPSE',
        titleRu: '04. КОЛЛАПС (COLLAPSE)',
        subtitleRu: 'Критический стресс и разрыв ткани Иллюзии',
        philosophyRu:
            'Система превосходит предел устойчивости. Декорации Иллюзии трещат по швам: сквозь спонтанные разрывы пространства проступает голая геометрия Истины и перегруженные узлы графа.',
        targetParticleCount: 2400,
        baseGravity: 1.65,
        baseEntropy: 0.82,
        autoDurationSec: 45,
        colors: {
            illusionPrimary: '#fb7185',
            illusionSecondary: '#f59e0b',
            truthWireframe: '#f43f5e',
            backgroundVoid: '#0d040a',
        },
    },
    '05_SINGULARITY': {
        id: '05_SINGULARITY',
        index: 5,
        codeName: 'PHASE_05 // ABSOLUTE_SINGULARITY',
        titleRu: '05. СИНГУЛЯРНОСТЬ (SINGULARITY)',
        subtitleRu: 'Горизонт событий и слияние Иллюзии с Истиной',
        philosophyRu:
            'Все координаты стремятся к единому центру бесконечной плотности. Различие между внешней красотой и внутренней формулой исчезает перед новым циклом перерождения.',
        targetParticleCount: 3000,
        baseGravity: 3.2,
        baseEntropy: 1.0,
        autoDurationSec: 30,
        colors: {
            illusionPrimary: '#ffffff',
            illusionSecondary: '#c084fc',
            truthWireframe: '#e879f9',
            backgroundVoid: '#000000',
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
// 3. СТРУКТУРА 5 СЛОЕВ ПОГРУЖЕНИЯ И ТЕЛЕМЕТРИИ
// ----------------------------------------------------------------------------
export interface ImmersionLayersState {
    layer1_illusionCanvas: boolean; // Базовый визуальный холст космоса
    layer2_metricsHud: boolean;     // Слой телеметрии и датчиков
    layer3_topologyGraph: boolean;  // Слой топологической сетки и связей Истины
    layer4_architectTerminal: boolean; // Интерактивный терминал управления
    layer5_truthXRayMode: boolean;  // Полный рентген-режим (100% Истина без Иллюзии)
}

export interface UniverseTelemetry {
    fps: number;
    frameTimeMs: number;
    activeParticles: number;
    activeConnections: number;
    simulationTimeSec: number;
    phaseElapsedSec: number;
    engineBackend: 'WebGPU' | 'Canvas2D-HighDPI';
    wasmActive: boolean;
    pythonSocketConnected: boolean;
}

export interface UniverseState {
    currentPhase: PhaseId;
    phaseMeta: PhaseMetadata;
    isPaused: boolean;
    autoCyclePhases: boolean;
    timeScale: number;
    gravityMultiplier: number;
    audioEnabled: boolean;
    layers: ImmersionLayersState;
    telemetry: UniverseTelemetry;
    terminalLogs: string[];
}

// Тип функции-подписчика, которая вызывается при изменениях состояния
export type UniverseStateListener = (state: Readonly<UniverseState>) => void;

// ----------------------------------------------------------------------------
// 4. КЛАСС УПРАВЛЕНИЯ СОСТОЯНИЕМ ВСЕЛЕННОЙ (SINGLETON STORE)
// ----------------------------------------------------------------------------
class UniverseStoreManager {
    private state: UniverseState;
    private listeners: Set<UniverseStateListener> = new Set();

    constructor() {
        const initialPhase: PhaseId = '01_VOID';
        this.state = {
            currentPhase: initialPhase,
            phaseMeta: UNIVERSE_PHASES[initialPhase],
            isPaused: false,
            autoCyclePhases: false,
            timeScale: 1.0,
            gravityMultiplier: 1.0,
            audioEnabled: false,
            layers: {
                layer1_illusionCanvas: true,
                layer2_metricsHud: true,
                layer3_topologyGraph: true,
                layer4_architectTerminal: true,
                layer5_truthXRayMode: false,
            },
            telemetry: {
                fps: 60,
                frameTimeMs: 16.6,
                activeParticles: UNIVERSE_PHASES[initialPhase].targetParticleCount,
                activeConnections: 0,
                simulationTimeSec: 0,
                phaseElapsedSec: 0,
                engineBackend: 'Canvas2D-HighDPI',
                wasmActive: false,
                pythonSocketConnected: false,
            },
            terminalLogs: [
                '[SYS_INIT] Ядро мониторинга Вселенной инициализировано.',
                '[PHASE_01] Квантовый вакуум активен. Ожидание возмущений поля...',
            ],
        };
    }

    // Получение текущего снимка состояния (только для чтения)
    public getState(): Readonly<UniverseState> {
        return this.state;
    }

    // Подписка компонентов и рендера на изменения
    public subscribe(listener: UniverseStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Внутреннее оповещение всех подписчиков
    private notify(): void {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    // Переключение на конкретную эволюционную фазу
    public setPhase(phaseId: PhaseId): void {
        if (this.state.currentPhase === phaseId) return;
        const meta = UNIVERSE_PHASES[phaseId];
        this.state = {
            ...this.state,
            currentPhase: phaseId,
            phaseMeta: meta,
            telemetry: {
                ...this.state.telemetry,
                phaseElapsedSec: 0,
                activeParticles: meta.targetParticleCount,
            },
        };
        this.addTerminalLog(`[PHASE_SHIFT] Переход в фазу: ${meta.titleRu}`);
        this.notify();
    }

    // Переход к следующей фазе по кругу (01 -> 02 -> ... -> 05 -> 01)
    public nextPhase(): void {
        const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);
        const nextIndex = (currentIndex + 1) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[nextIndex]);
    }

    // Переход к предыдущей фазе
    public prevPhase(): void {
        const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);
        const prevIndex = (currentIndex - 1 + PHASE_ORDER.length) % PHASE_ORDER.length;
        this.setPhase(PHASE_ORDER[prevIndex]);
    }

    // Включение / выключение конкретного слоя погружения
    public toggleLayer(layerKey: keyof ImmersionLayersState): void {
        const currentVal = this.state.layers[layerKey];
        this.state = {
            ...this.state,
            layers: {
                ...this.state.layers,
                [layerKey]: !currentVal,
            },
        };
        this.addTerminalLog(
            `[LAYER_CTRL] Слой ${String(layerKey)} -> ${!currentVal ? 'ONLINE' : 'OFFLINE'}`
        );
        this.notify();
    }

    // Пауза / возобновление симуляции времени
    public togglePause(): void {
        this.state = {
            ...this.state,
            isPaused: !this.state.isPaused,
        };
        this.addTerminalLog(
            this.state.isPaused
                ? '[TIME_LOCK] Поток времени заморожен Архитектором.'
                : '[TIME_FLOW] Поток времени восстановлен.'
        );
        this.notify();
    }

    // Включение / отключение автоматической смены фаз по таймеру
    public toggleAutoCycle(): void {
        this.state = {
            ...this.state,
            autoCyclePhases: !this.state.autoCyclePhases,
        };
        this.addTerminalLog(
            `[AUTO_CYCLE] Автоэволюция фаз: ${this.state.autoCyclePhases ? 'ВКЛ' : 'ВЫКЛ'}`
        );
        this.notify();
    }

    // Изменение скорости течения времени (от 0.1x до 3.0x)
    public setTimeScale(scale: number): void {
        const clamped = Math.max(0.1, Math.min(3.0, Number(scale.toFixed(2))));
        this.state = {
            ...this.state,
            timeScale: clamped,
        };
        this.notify();
    }

    // Изменение множителя гравитации
    public setGravityMultiplier(multiplier: number): void {
        const clamped = Math.max(0.0, Math.min(5.0, Number(multiplier.toFixed(2))));
        this.state = {
            ...this.state,
            gravityMultiplier: clamped,
        };
        this.notify();
    }

    // Управление звуковым синтезатором
    public setAudioEnabled(enabled: boolean): void {
        this.state = {
            ...this.state,
            audioEnabled: enabled,
        };
        this.addTerminalLog(
            `[AUDIO_SYNC] Акустический резонанс вакуума: ${enabled ? 'АКТИВЕН' : 'ОТКЛЮЧЕН'}`
        );
        this.notify();
    }

    // Высокочастотное обновление телеметрии из рендер-цикла
    public updateTelemetry(partial: Partial<UniverseTelemetry>): void {
        this.state.telemetry = {
            ...this.state.telemetry,
            ...partial,
        };
        // Проверяем, не пора ли переключить фазу при включенном автоцикле
        if (
            this.state.autoCyclePhases &&
            !this.state.isPaused &&
            this.state.telemetry.phaseElapsedSec >= this.state.phaseMeta.autoDurationSec
        ) {
            this.nextPhase();
        }
    }

    // Запись строки в бортовой журнал Терминала (храним последние 40 записей)
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

// Экспортируем единый экземпляр хранилища для всего фронтенда
export const universeStore = new UniverseStoreManager();