// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/contracts.ts
// НАЗНАЧЕНИЕ: Единые канонические контракты данных UNIVERSE v2.0 (MASTER 00 / 00B)
// ЗАДАЧИ ФАЙЛА:
// 1. Определить типы фаз, подактов сингулярности, эшелонов глубины Z0..Z3 и качества.
// 2. Зафиксировать структуру сущности мира WorldEntity и срез состояния UniverseSnapshot.
// 3. Описать огибающую бесшовного перехода TransitionEnvelope и события SignalEvent.
// 4. Определить межфазные контракты BirthRecord, GenesisToNexus, NexusToBreach, BreachToSingularity.
// 5. Задать формат честной телеметрии TelemetrySnapshot с метками модуля-источника.
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Фазы, оптики и статусы модулей; сущности, переходы и межфазные контракты.
//   3. Измеряемая телеметрия и общий снимок состояния UniverseSnapshot.
// ============================================================================


// ----------------------------------------------------------------------------
// 1. ИДЕНТИФИКАТОРЫ ФАЗ, ПОДАКТОВ, УРОВНЕЙ ИНСПЕКЦИИ И ЭШЕЛОНОВ ГЛУБИНЫ Z0..Z3
// ----------------------------------------------------------------------------
export type PhaseId =
    | '01_VOID'
    | '02_GENESIS'
    | '03_EVOLUTION'
    | '04_COLLAPSE' // В UI отображается как TENSION / BREACH (решение D-4)
    | '05_SINGULARITY';

export type SingularityAct =
    | 'NONE'
    | 'INACTIVE'
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

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

// Четыре эшелона глубины по спецификации MASTER 00 (раздел 4)
export type DepthEchelon =
    | 'Z0_FOREGROUND' // depthZ ≈ 1.25–1.60: крупная расфокусированная пыль и нити у объектива
    | 'Z1_MIDGROUND'  // depthZ ≈ 0.70–1.20: активные узлы, сомы, импульсы, главные структуры
    | 'Z2_BACKGROUND' // depthZ ≈ 0.30–0.65: объёмные облака туманностей и далёкие скопления
    | 'Z3_DEEP';      // depthZ ≈ 0.10–0.29: скрытая математическая геометрия X-RAY / LOGIC

// Числовые коды семантических типов сущностей для хранения в Uint8Array (SceneBuffer SoA)
export enum EntityKindCode {
    STAR = 0,
    NODE = 1,
    SOMA = 2,
    FILAMENT_POINT = 3,
    DUST = 4,
    CENTER = 5,
    GLYPH = 6,
}

export type EntitySemanticKind =
    | 'star'
    | 'node'
    | 'soma'
    | 'filamentPoint'
    | 'dust'
    | 'center'
    | 'glyph';

// ----------------------------------------------------------------------------
// 2. МЕТКИ ИСТОЧНИКОВ ВЫЧИСЛЕНИЙ И ЧЕСТНЫЕ СТАТУСЫ ПОЛИГЛОТ-МОДУЛЕЙ (TRUTH POLICY)
// ----------------------------------------------------------------------------
export type ComputeSourceTag =
    | 'WASM'
    | 'WORKER'
    | 'PYODIDE'
    | 'SERVER'
    | 'RENDERER'
    | 'AUDIO'
    | 'TS_CORE';

export type HonestStatusLabel =
    | 'WEBGPU ACTIVE'
    | 'CANVAS2D FALLBACK'
    | 'WASM READY'
    | 'TS FALLBACK'
    | 'LOCAL WORKER'
    | 'PYODIDE LOADING'
    | 'PYODIDE READY'
    | 'PYTHON: TS FALLBACK'
    | 'SERVER CONNECTED'
    | 'CLIENT-ONLY'
    | 'AUDIO: PLAYING'
    | 'AUDIO: MUTED'
    | 'AUDIO: AWAITING GESTURE'
    | 'ZERO_SILENCE';

// ----------------------------------------------------------------------------
// 3. СТРУКТУРА ОБЪЕКТА МИРА (WORLD ENTITY) И ОГИБАЮЩЕЙ ПЕРЕХОДА (TRANSITION ENVELOPE)
// ----------------------------------------------------------------------------
export interface WorldEntity {
    readonly id: number; // Стабильный u32 идентификатор на все 108 секунд цикла
    kind: EntitySemanticKind;
    pos: [number, number, number];
    vel: [number, number, number];
    depthZ: number;
    echelon: DepthEchelon;
    energy: number;
    graphRef?: {
        clusterId: number;
        degree: number;
        hemisphere: 0 | 1;
        kuramotoPhase: number;
        ownerModule: string;
    };
}

export interface TransitionEnvelope {
    fromPhase: PhaseId;
    toPhase: PhaseId;
    startSec: number;
    durationSec: number;
    progress: number; // Гладкий C¹-прогресс (smoothstep 0.0 .. 1.0)
    preserveVelocity: boolean;
}

export interface SignalEvent {
    readonly edgeId: string;
    readonly from: number;
    readonly to: number;
    readonly t0: number;
    readonly duration: number;
    readonly energy: number;
    readonly speedClass: 'AXON_TRUNK' | 'BRIDGE' | 'DENDRITE';
}

// ----------------------------------------------------------------------------
// 4. МЕЖФАЗНЫЕ КОНТРАКТЫ ПЕРЕДАЧИ СОСТОЯНИЯ БЕЗ ШВОВ (MASTER 01 -> 05)
// ----------------------------------------------------------------------------

// Контракт перехода VOID -> GENESIS (t ≈ 17 с)
export interface BirthRecord {
    readonly id: number;
    pos: [number, number, number];
    vel: [number, number, number];
    mass: number;
    depthZ: number;
    energy: number;
    ringIndex: number;
    birthPhase: number;
    seedOffset: number;
}

export interface VoidToGenesisContract {
    records: BirthRecord[];
    chirpPhase: number;
    stateDigest: number;
}

// Контракт перехода GENESIS -> NEXUS (t ≈ 39 с)
export interface SomaCandidate {
    readonly id: number;
    pos: [number, number, number];
    vel: [number, number, number];
    energy: number;
    phase: number;
    tripleGroupId?: number;
}

export interface FilamentPolyline {
    readonly id: number;
    polyline: Array<[number, number, number]>;
    thickness: number;
    seed: number;
}

export interface GenesisToNexusContract {
    somaCandidates: SomaCandidate[];
    filaments: FilamentPolyline[];
    bridge: {
        ids: number[];
        polyline: Array<[number, number, number]>;
    };
    hemisphereAssignment: Record<number, 0 | 1>;
    kuramotoR: number;
    stateDigest: number;
}

// Контракт перехода NEXUS -> BREACH (t ≈ 61 с)
export interface AnomalyScheduleItem {
    readonly anomalyIndex: 0 | 1 | 2;
    targetType: 'FILAMENTS' | 'AXON_TRUNKS' | 'NEAR_STARS';
    startSec: number;
    peakSec: number;
    endSec: number;
    centerNorm: [number, number];
}

export interface NexusToBreachContract {
    edgeStress: Record<string, number>;
    anomalySchedule: AnomalyScheduleItem[];
    stateDigest: number;
}

// Контракт перехода BREACH -> SINGULARITY (t ≈ 79 с)
export interface AccretionPrepArc {
    center: [number, number];
    radius: number;
    angleRange: [number, number];
    energy: number;
}

export interface BreachToSingularityContract {
    arcs: AccretionPrepArc[];
    stress: number;
    stateDigest: number;
}

// ----------------------------------------------------------------------------
// 5. КОНТРАКТ ИЗМЕРЯЕМОЙ ТЕЛЕМЕТРИИ И ГЛАВНОГО СРЕЗА UNIVERSE SNAPSHOT
// ----------------------------------------------------------------------------
export interface MeasuredMetricField<T = number> {
    value: T;
    source: ComputeSourceTag;
    ownerModule: string; // Например: 'rust/gravity.rs', 'python/graph_logic.py', 'wgsl/breach.wgsl'
}

export interface TelemetrySnapshot {
    fps: number;
    frameTimeMs: number;
    frameTimeP95Ms: number;
    physicsStepMs: number;
    activeEntities: number;
    activeConnections: number;
    activePulses: number;
    energyDriftRatio: MeasuredMetricField<number>; // ΔE/E₀ из интегратора скорости Верле
    kuramotoOrderR: MeasuredMetricField<number>;   // Параметр фазовой синхронизации r(t) ∈ [0,1]
    silenceRmsDb: MeasuredMetricField<number>;     // Контроль тишины в Акте C (порог < -80 dBFS)
    stateDigestHex: string;                        // 32-битный FNV-1a дайджест буфера SceneBuffer
}

export interface UniverseSnapshot {
    t: number;                  // Монотонное время цикла (0.0 .. 108.0 с)
    tick: number;               // Целочисленный счётчик фиксированных физических шагов
    seed: number;               // Детерминированный seed Вселенной
    cycleCount: number;         // Номер текущего цикла
    cycleT: number;             // Нормализованное время цикла ∈ [0.0, 1.0]
    phase: PhaseId;
    nextPhase: PhaseId;
    transitionProgress: number; // Прогресс активной огибающей перехода (0.0 .. 1.0)
    subAct: SingularityAct;
    zeroSilenceElapsed: number; // Таймер импульса Точки Нуля в мс (0 .. 450 мс)
    audioStatus: HonestStatusLabel;
    quality: QualityTier;
    inspectionLevel: InspectionLevel;
    stateDigest: number;
    telemetry: TelemetrySnapshot;
}
