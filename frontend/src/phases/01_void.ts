// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/01_void.ts
// НАЗНАЧЕНИЕ: Ядро симуляции 5 фаз, SceneBuffer SoA, чирп-рябь VOID и импульсы NEXUS (v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Генерировать детерминированные сущности в 4 эшелонах глубины (Z0..Z3) через DeterministicPRNG.
// 2. Реализовать драматургию VOID (0–17 с): первая искра (1.2 с), наклонные 3D-фронты чирпа (3–10 с)
//    и рождение потоков с круговой скоростью v_t ≈ sqrt(G·M(r)/r) (10–17 с).
// 3. Обеспечивать C¹-гладкий морфинг координат и скоростей между всеми 5 фазами без hard cuts.
// 4. Синхронизировать все тела с SceneBufferSoA, wasmPhysicsBridge и nexusGraphEngine.
// 5. Двигать синаптические импульсы строго по таблице длины дуги (lengthLUT) с интерференцией.
// ============================================================================

import { EntityKindCode, type PhaseId } from '../core/contracts';
import { DeterministicPRNG } from '../core/prng';
import { wasmPhysicsBridge } from '../bridge/wasmBridge';
import {
    NexusGraphEngine,
    nexusGraphEngine,
    type ComputedEdgeClass,
} from '../bridge/simulationWorker';
import { UNIVERSE_PHASES, universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { computeGenesisTarget } from './02_genesis';
import { computeEvolutionBrainTarget } from './03_evolution';
import { computeCollapseStormTarget } from './04_collapse';
import { computeSingularityTarget } from './05_singularity';

// ----------------------------------------------------------------------------
// 1. ТИПЫ ЭШЕЛОНОВ ГЛУБИНЫ Z0..Z3, ЧАСТИЦ, СПЛАЙНОВ БЕЗЬЕ И СИНАПТИЧЕСКИХ ПАКЕТОВ
// ----------------------------------------------------------------------------
export type DepthLayerTier = 'FOREGROUND' | 'MIDGROUND' | 'BACKGROUND' | 'DEEP_LAYER';
export type NexusEdgeClass = ComputedEdgeClass;

export interface MorphTargetPoint {
    x: number;
    y: number;
    energy: number;
    dopplerBoost?: number;
}

export interface QuantumParticle {
    id: number;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    homeNormX: number;
    homeNormY: number;
    depthZ: number;            // Z0: 1.25–1.6, Z1: 0.7–1.2, Z2: 0.3–0.65, Z3: 0.1–0.29 (MASTER 00)
    depthTier: DepthLayerTier;
    clusterId: number;
    ringIndex: number;         // Индекс одного из 5 встречных кеплеровских колец (решение D-3)
    tripleGroupId: number;     // Идентификатор тройного узла синхронизации Курамото
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    energy: number;
    kuramotoPhase: number;     // Фаза осциллятора θ_i для волны синхронизации
    synapticCharge: number;    // Заряд сомы нейрона (0..1)
    interferenceFlash: number; // Вспышка интерференции #F59E0B при совпадении >= 2 сигналов (0..1)
    lastSignalArrivalMs: number;
    cooldownUntilMs: number;   // Рефрактерный период сомы (200–400 мс по MASTER 03)
    degree: number;
    moduleTag: string;         // Метка модуля-владельца для X-RAY callouts (MASTER 00B / 04)
    phaseOffset: number;
    quantumSpin: number;
}

export interface TopologyEdge {
    id: string;
    fromIndex: number;
    toIndex: number;
    edgeClass: NexusEdgeClass;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    ctrlX: number;
    ctrlY: number;
    arcLength: number;
    lengthLUT: readonly [number, number, number, number, number];
    murrayRadiusPx: number;
    strength: number;
    truthVisibility: number;
    afterglow: number;
}

export interface SynapticPulse {
    edgeId: string;
    fromIndex: number;
    toIndex: number;
    edgeClass: NexusEdgeClass;
    x1: number;
    y1: number;
    ctrlX: number;
    ctrlY: number;
    x2: number;
    y2: number;
    lengthLUT: readonly [number, number, number, number, number];
    progress: number;          // Нормализованная координата ВДОЛЬ ДЛИНЫ ДУГИ s ∈ [0, 1]
    speed: number;
    bodyLength: number;        // 6–14% длины ребра (MASTER 03)
    tailLength: number;        // 10–22% длины ребра (MASTER 03)
    intensity: number;
    cascadeDepth: number;
}

// Истинные метки языковых модулей по стандарту MASTER 00B (раздел 5)
const POLYGLOT_OWNER_TAGS: ReadonlyArray<string> = [
    'rust/gravity.rs',
    'python/graph_logic.py',
    'wgsl/illusion.wgsl',
    'wgsl/breach.wgsl',
    'rust/breach_math.rs',
    'python/singularity.py',
    'ts/sceneBuffer.ts',
];

// 10 симметричных кортикальных центров левого и правого полушарий мозга (строго по центру экрана)
export const BRAIN_HEMISPHERE_LOBES: ReadonlyArray<[number, number]> = [
    [-0.34, -0.16],
    [-0.36, 0.08],
    [-0.24, -0.28],
    [-0.22, 0.25],
    [-0.09, -0.04],
    [0.09, 0.04],
    [0.22, -0.25],
    [0.24, 0.28],
    [0.36, -0.08],
    [0.34, 0.16],
];

// ----------------------------------------------------------------------------
// 2. ГЛАВНЫЙ КЛАСС СИМУЛЯЦИИ ВСЕЛЕННОЙ (VOID PHASE SIMULATION V2.0)
// ----------------------------------------------------------------------------
export class VoidPhaseSimulation {
    private particles: QuantumParticle[] = [];
    private edges: TopologyEdge[] = [];
    private pulses: SynapticPulse[] = [];
    private afterglowMap: Map<string, number> = new Map();
    private width = 1920;
    private height = 1080;
    private lastCycleCount = 1;
    private previousPhase: PhaseId = '01_VOID';
    private tickCounter = 0;
    private prng: DeterministicPRNG;

    constructor(initialWidth = 1920, initialHeight = 1080) {
        this.width = initialWidth;
        this.height = initialHeight;
        const initialSeed = universeStore.getState().seed;
        this.prng = new DeterministicPRNG(initialSeed);

        const targetCount = UNIVERSE_PHASES['03_EVOLUTION'].targetParticleCount;
        this.respawnParticles(targetCount);
        void wasmPhysicsBridge.tryLoadWasmModule(initialSeed, targetCount);
    }

    public resize(width: number, height: number): void {
        const scaleX = width / Math.max(1, this.width);
        const scaleY = height / Math.max(1, this.height);
        this.width = width;
        this.height = height;

        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].x *= scaleX;
            this.particles[i].y *= scaleY;
            this.particles[i].prevX = this.particles[i].x;
            this.particles[i].prevY = this.particles[i].y;
        }
    }

    public respawnParticles(count: number): void {
        const uState = universeStore.getState();
        const profileMult = universeStore.getQualityGovernor().getProfile().particleMultiplier;
        const maxCap = uState.reducedMotion ? 420 : Math.round(820 * profileMult);
        const cappedCount = Math.max(240, Math.min(count, maxCap));

        this.prng = new DeterministicPRNG(uState.seed);
        wasmPhysicsBridge.initKuramotoOscillators(uState.seed);

        this.particles = [];
        this.edges = [];
        this.pulses = [];
        this.afterglowMap.clear();
        this.tickCounter = 0;

        for (let i = 0; i < cappedCount; i++) {
            this.particles.push(this.createSingleParticle(i, uState.seed));
        }
    }

    // Детерминированное создание частицы с иерархической кластеризацией и 4 эшелонами Z0..Z3
    private createSingleParticle(id: number, seed: number): QuantumParticle {
        const r1 = DeterministicPRNG.hashFloat(seed, id * 37 + 1);
        const r2 = DeterministicPRNG.hashFloat(seed, id * 37 + 2);
        const r3 = DeterministicPRNG.hashFloat(seed, id * 37 + 3);
        const r4 = DeterministicPRNG.hashFloat(seed, id * 37 + 4);

        let depthZ: number;
        let depthTier: DepthLayerTier;
        if (r1 < 0.14) {
            depthZ = 0.10 + r2 * 0.19; // Z3 deep ≈ 0.10–0.29
            depthTier = 'DEEP_LAYER';
        } else if (r1 < 0.42) {
            depthZ = 0.30 + r2 * 0.35; // Z2 background ≈ 0.30–0.65
            depthTier = 'BACKGROUND';
        } else if (r1 < 0.91) {
            depthZ = 0.70 + r2 * 0.50; // Z1 midground ≈ 0.70–1.20
            depthTier = 'MIDGROUND';
        } else {
            depthZ = 1.25 + r2 * 0.35; // Z0 foreground ≈ 1.25–1.60
            depthTier = 'FOREGROUND';
        }

        const clusterId = id % BRAIN_HEMISPHERE_LOBES.length;
        const [lobeX, lobeY] = BRAIN_HEMISPHERE_LOBES[clusterId];

        const angle = r4 * Math.PI * 2;
        const radiusSpread = 0.025 + Math.pow(r3, 0.82) * 0.135;
        const homeNormX = Math.max(-0.45, Math.min(0.45, lobeX + Math.cos(angle) * radiusSpread));
        const homeNormY = Math.max(-0.42, Math.min(0.42, lobeY + Math.sin(angle) * (radiusSpread * 1.1)));

        const x = this.width * (0.5 + homeNormX);
        const y = this.height * (0.5 + homeNormY);

        return {
            id,
            x,
            y,
            prevX: x,
            prevY: y,
            homeNormX,
            homeNormY,
            depthZ,
            depthTier,
            clusterId,
            ringIndex: id % 5,
            tripleGroupId: Math.floor(id / 3),
            vx: 0,
            vy: 0,
            mass: 0.65 + depthZ * 1.15,
            radius: (1.1 + r3 * 1.85) * (depthTier === 'FOREGROUND' ? 1.65 : depthZ),
            energy: 0.25 + r2 * 0.5,
            kuramotoPhase: r4 * Math.PI * 2,
            synapticCharge: 0,
            interferenceFlash: 0,
            lastSignalArrivalMs: 0,
            cooldownUntilMs: 0,
            degree: 0,
            moduleTag: POLYGLOT_OWNER_TAGS[id % POLYGLOT_OWNER_TAGS.length],
            phaseOffset: r4 * Math.PI * 2,
            quantumSpin: id % 2 === 0 ? 1 : -1,
        };
    }

    // --------------------------------------------------------------------------
    // 3. ВЫЧИСЛЕНИЕ ЦЕЛЕВОЙ ТОЧКИ ОБРАЗА И ГРАВИТАЦИОННОГО ЧИРПА VOID (0–17 С)
    // --------------------------------------------------------------------------
    private computePhaseArchetypePoint(
        phase: PhaseId,
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        simTimeSec: number,
        phaseProgress: number
    ): MorphTargetPoint {
        switch (phase) {
            case '01_VOID':
                return this.computeVoidChirpTarget(p, centerX, centerY, simTimeSec, phaseProgress);
            case '02_GENESIS':
                return computeGenesisTarget(p, centerX, centerY, this.width, this.height, simTimeSec, phaseProgress);
            case '03_EVOLUTION':
                return computeEvolutionBrainTarget(p, centerX, centerY, this.width, this.height, simTimeSec, phaseProgress);
            case '04_COLLAPSE':
                return computeCollapseStormTarget(p, centerX, centerY, this.width, this.height, simTimeSec, phaseProgress);
            case '05_SINGULARITY':
                return computeSingularityTarget(p, centerX, centerY, this.width, this.height, simTimeSec);
        }
    }

    // MASTER 01 v2.0 (0–17 с):
    // 0–3 с: Потенциал + первая искра на 1.2 с.
    // 3–10 с: Наклонные 3D-фронты ряби с сокращением интервалов по чирпу T_n = T_0 · (1 - n/N)^α.
    // 10–17 с: Предчувствие материи и закрутка с круговой скоростью v_t ≈ sqrt(G·M(r)/r).
    private computeVoidChirpTarget(
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        simTimeSec: number,
        phaseProgress: number
    ): MorphTargetPoint {
        const phaseSec = phaseProgress * 17.0;
        const baseDistX = p.homeNormX * this.width * 0.90;
        const baseDistY = p.homeNormY * this.height * 0.86;
        const r = Math.hypot(baseDistX, baseDistY) + 1.0;

        // 1. Закон гравитационного чирпа двойной системы: частота колец растёт от 3 с к 17 с
        const chirpProgress = Math.max(0, Math.min(0.96, (phaseSec - 3.0) / 14.0));
        const chirpAlpha = 0.75;
        const chirpFreqMultiplier = 1.0 / Math.pow(1.0 - chirpProgress * 0.65, chirpAlpha);

        // 2. В третьем окне (10–17 с) узлы набирают круговую скорость v_t ≈ sqrt(G·M(r)/r)
        const matterAnticipation = Math.max(0, Math.min(1, (phaseSec - 10.0) / 7.0));
        const enclosedMass = 120.0 + r * 0.85;
        const circularAngularVel = Math.sqrt(enclosedMass / Math.max(45, r)) * 0.14;

        const baseAngle =
            Math.atan2(baseDistY, baseDistX) +
            simTimeSec * (0.06 * p.quantumSpin + matterAnticipation * circularAngularVel);

        // Наклонный 3D-фронт ряби (наклон 62° = сжатие по вертикали 0.78)
        const rippleWave =
            phaseSec >= 3.0
                ? Math.sin(r * 0.019 * chirpFreqMultiplier - simTimeSec * 1.85 + p.phaseOffset) *
                (18 + chirpProgress * 14)
                : Math.sin(simTimeSec * 0.9 + p.phaseOffset) * 6;

        const radialGather = p.id % 4 === 0 ? 1.0 - matterAnticipation * 0.28 : 1.0;
        const finalR = r * radialGather + rippleWave;

        const x = centerX + Math.cos(baseAngle) * finalR;
        const y = centerY + Math.sin(baseAngle) * finalR * 0.78;

        // Первая искра на ≈ 1.2 с (MASTER 01 раздел Драматургия)
        const firstSparkBoost =
            phaseSec >= 1.0 && phaseSec <= 1.8 && p.id % 19 === 0
                ? Math.sin(((phaseSec - 1.0) / 0.8) * Math.PI) * 0.75
                : 0;

        const fresnelRim =
            phaseSec >= 3.0
                ? Math.max(0, Math.sin(r * 0.019 * chirpFreqMultiplier - simTimeSec * 1.85)) * 0.42
                : 0.08;

        const energy = Math.min(1.0, 0.14 + fresnelRim + firstSparkBoost + matterAnticipation * 0.28);
        return { x, y, energy };
    }

    // --------------------------------------------------------------------------
    // 4. ФИКСИРОВАННЫЙ ШАГ СИМУЛЯЦИИ, СИНХРОНИЗАЦИЯ SCENE BUFFER И КАСКАДЫ NEXUS
    // --------------------------------------------------------------------------
    public update(
        dtSeconds: number,
        phase: PhaseId,
        timeScale: number,
        gravityMultiplier: number,
        simTimeSec: number
    ): void {
        const uState = universeStore.getState();
        const sceneBuffer = universeStore.getSceneBuffer();

        if (uState.cycleCount !== this.lastCycleCount) {
            this.lastCycleCount = uState.cycleCount;
            this.previousPhase = '01_VOID';
            this.respawnParticles(UNIVERSE_PHASES['03_EVOLUTION'].targetParticleCount);
        }

        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.pulses = [];
            return;
        }

        this.tickCounter++;
        const dt = Math.min(dtSeconds, 0.05) * timeScale * (uState.reducedMotion ? 0.45 : 1.0);
        const stressState = stressStore.getState();
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.5;
        const phaseProgress = uState.telemetry.phaseProgress;
        const nowMs = performance.now();

        // Сохраняем предыдущие позиции в SceneBuffer для гладкой межкадровой интерполяции
        sceneBuffer.snapshotPreviousPositions(this.particles.length);

        // Плавное C¹-перетекание между предыдущей и текущей фазой в первые 26% времени фазы
        const morphWindow = 0.26;
        const rawBlend = phaseProgress < morphWindow ? phaseProgress / morphWindow : 1.0;
        const smoothBlend = rawBlend * rawBlend * (3.0 - 2.0 * rawBlend);

        if (phaseProgress >= morphWindow && this.previousPhase !== phase) {
            this.previousPhase = phase;
        }

        // Критически демпфированный коэффициент подтягивания с сохранением инерции
        const springRate = Math.min(1.0, dt * (2.8 + gravityMultiplier * 0.85));

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.degree = 0;
            p.kuramotoPhase = wasmPhysicsBridge.getKuramotoPhase(i);

            const currentTarget = this.computePhaseArchetypePoint(
                phase,
                p,
                centerX,
                centerY,
                simTimeSec,
                phaseProgress
            );

            let targetX = currentTarget.x;
            let targetY = currentTarget.y;
            let targetEnergy = currentTarget.energy;

            if (smoothBlend < 0.999 && this.previousPhase !== phase) {
                const prevTarget = this.computePhaseArchetypePoint(
                    this.previousPhase,
                    p,
                    centerX,
                    centerY,
                    simTimeSec,
                    1.0
                );
                targetX = prevTarget.x * (1.0 - smoothBlend) + currentTarget.x * smoothBlend;
                targetY = prevTarget.y * (1.0 - smoothBlend) + currentTarget.y * smoothBlend;
                targetEnergy = prevTarget.energy * (1.0 - smoothBlend) + currentTarget.energy * smoothBlend;
            }

            const dx = targetX - p.x;
            const dy = targetY - p.y;
            p.vx = dx * 2.75;
            p.vy = dy * 2.75;

            // Отклик на оптическую линзу BREACH LENS
            if (stressState.isPointerInside && stressState.currentBreachRadius > 4) {
                const dxPtr = p.x - stressState.lensX;
                const dyPtr = p.y - stressState.lensY;
                const distPtr = Math.hypot(dxPtr, dyPtr) + 0.1;
                const influenceRadius = stressState.currentBreachRadius * 1.32;

                if (distPtr < influenceRadius) {
                    const factor = 1.0 - distPtr / influenceRadius;
                    p.synapticCharge = Math.min(1.0, p.synapticCharge + factor * dt * 3.4);

                    if (stressState.isBreaching) {
                        const push = factor * 22;
                        targetX += (-dyPtr / distPtr) * push;
                        targetY += (dxPtr / distPtr) * push;
                    }
                }
            }

            p.x += (targetX - p.x) * springRate;
            p.y += (targetY - p.y) * springRate;
            p.energy += (targetEnergy - p.energy) * Math.min(1.0, dt * 4.2);

            if (p.synapticCharge > 0) {
                p.synapticCharge = Math.max(0, p.synapticCharge - dt * 1.05);
            }
            if (p.interferenceFlash > 0) {
                p.interferenceFlash = Math.max(0, p.interferenceFlash - dt * 1.4);
            }

            // Записываем актуальное состояние частицы в единый SceneBuffer (SoA)
            const kindCode =
                p.depthTier === 'FOREGROUND'
                    ? EntityKindCode.DUST
                    : phase === '03_EVOLUTION'
                        ? EntityKindCode.SOMA
                        : EntityKindCode.STAR;

            sceneBuffer.syncEntityFromParticle(
                i,
                p.id,
                kindCode,
                p.x,
                p.y,
                p.depthZ,
                p.vx,
                p.vy,
                0,
                p.depthZ,
                p.energy,
                (p.clusterId << 4) | (p.interferenceFlash > 0.1 ? 1 : 0)
            );
        }

        // Выполняем симплектический шаг в wasmPhysicsBridge (расчёт ΔE/E₀ и Kuramoto r(t))
        const kuramotoK = phase === '02_GENESIS' ? 0.4 + phaseProgress * 1.8 : 1.2;
        const physTelemetry = wasmPhysicsBridge.stepSymplecticPhysics(
            sceneBuffer,
            this.particles.length,
            dt,
            simTimeSec,
            centerX,
            centerY,
            this.width,
            this.height,
            kuramotoK
        );

        // Фиксируем тик и вычисляем единый State Digest (FNV-1a 32-bit)
        sceneBuffer.commitTickAndComputeDigest(this.tickCounter, this.particles.length, uState.seed);

        universeStore.updateTelemetry({
            tick: this.tickCounter,
            physicsStepMs: Number(physTelemetry.stepDurationMs.toFixed(2)),
            energyDriftRatio: physTelemetry.energyDriftRatio,
            kuramotoOrderR: physTelemetry.kuramotoOrderR,
        });

        this.buildTopologyViaGraphEngine(dt, phase, simTimeSec, uState.seed);
        this.updateSynapticPulsesByArcLut(dt, phase, nowMs);
    }

    // Построение 3 классов кривых через детерминированный NexusGraphEngine (MASTER 03)
    private buildTopologyViaGraphEngine(
        dt: number,
        phase: PhaseId,
        simTimeSec: number,
        seed: number
    ): void {
        const keysToDelete: string[] = [];
        this.afterglowMap.forEach((glow, edgeId) => {
            const nextGlow = glow * Math.exp(-dt * 0.88);
            if (nextGlow < 0.02) {
                keysToDelete.push(edgeId);
            } else {
                this.afterglowMap.set(edgeId, nextGlow);
            }
        });
        for (let k = 0; k < keysToDelete.length; k++) {
            this.afterglowMap.delete(keysToDelete[k]);
        }

        const screenScale = Math.max(1.0, Math.min(this.width, this.height) / 920);
        const maxConnectDist =
            (phase === '03_EVOLUTION' || phase === '04_COLLAPSE' ? 225 : 180) * screenScale;

        const graphInputs = [];
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.depthTier === 'FOREGROUND') continue;
            graphInputs.push({
                index: i,
                id: p.id,
                x: p.x,
                y: p.y,
                clusterId: p.clusterId,
                energy: p.energy,
            });
        }

        const { edges: computedEdges, degreeByIndex } = nexusGraphEngine.buildDeterministicGraph(
            graphInputs,
            maxConnectDist,
            seed,
            simTimeSec
        );

        for (let i = 0; i < graphInputs.length; i++) {
            const pIdx = graphInputs[i].index;
            this.particles[pIdx].degree = degreeByIndex[i] ?? 0;
        }

        this.edges = computedEdges.map((ce) => {
            const midX = (ce.x1 + ce.x2) * 0.5;
            const midY = (ce.y1 + ce.y2) * 0.5;
            return {
                id: ce.id,
                fromIndex: ce.fromIndex,
                toIndex: ce.toIndex,
                edgeClass: ce.edgeClass,
                x1: ce.x1,
                y1: ce.y1,
                x2: ce.x2,
                y2: ce.y2,
                ctrlX: ce.ctrlX,
                ctrlY: ce.ctrlY,
                arcLength: ce.arcLength,
                lengthLUT: ce.lengthLUT,
                murrayRadiusPx: ce.murrayRadiusPx,
                strength: Math.max(0.15, 1.0 - ce.arcLength / (maxConnectDist * 1.25)),
                truthVisibility: stressStore.getTruthRevealFactorAt(midX, midY),
                afterglow: this.afterglowMap.get(ce.id) ?? 0,
            };
        });
    }

    // Дискретно-событийное движение импульсов по параметру длины дуги (lengthLUT)
    private updateSynapticPulsesByArcLut(dt: number, phase: PhaseId, nowMs: number): void {
        if (this.edges.length === 0) {
            this.pulses = [];
            return;
        }

        const maxPulses =
            phase === '01_VOID'
                ? 14
                : phase === '02_GENESIS'
                    ? 42
                    : phase === '03_EVOLUTION'
                        ? 92
                        : 82;

        if (this.pulses.length < maxPulses && this.prng.nextFloat() < 0.9) {
            const candidateIdx = this.prng.nextU32() % this.edges.length;
            const candidate = this.edges[candidateIdx];
            if (candidate) {
                this.spawnPulseOnEdge(candidate, this.prng.nextFloat() > 0.5, 1.0, 3);
            }
        }

        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const pulse = this.pulses[i];
            const pFrom = this.particles[pulse.fromIndex];
            const pTo = this.particles[pulse.toIndex];

            if (!pFrom || !pTo) {
                this.pulses.splice(i, 1);
                continue;
            }

            pulse.x1 = pFrom.x;
            pulse.y1 = pFrom.y;
            pulse.x2 = pTo.x;
            pulse.y2 = pTo.y;

            pulse.progress += pulse.speed * dt;
            this.afterglowMap.set(pulse.edgeId, 1.0);

            if (pulse.progress >= 1.0) {
                const deltaArrivalMs = nowMs - pTo.lastSignalArrivalMs;
                pTo.lastSignalArrivalMs = nowMs;
                pTo.synapticCharge = 1.0;

                // Окно совпадения 120–300 мс и рефрактерный период 240 мс по MASTER 03:
                // при совпадении >= 2 сигналов сома даёт жемчужно-янтарную вспышку #F59E0B
                if (nowMs > pTo.cooldownUntilMs) {
                    const isInterference = deltaArrivalMs >= 20 && deltaArrivalMs <= 300;
                    pTo.interferenceFlash = isInterference ? 1.0 : 0.68;
                    pTo.cooldownUntilMs = nowMs + 260;

                    if (isInterference) {
                        universeStore.emitEventOnce(
                            `soma_interf_${Math.floor(nowMs / 1500)}`,
                            'signal:arrived',
                            `Интерференция сигналов в соме #${pTo.id} (Δt=${Math.round(deltaArrivalMs)} мс) [python/graph_logic.py]`
                        );
                    }
                }

                if (pulse.cascadeDepth > 0 && this.pulses.length < maxPulses) {
                    this.triggerCascadeFromNode(pulse.toIndex, pulse.fromIndex, pulse.cascadeDepth - 1);
                }

                this.pulses.splice(i, 1);
            }
        }
    }

    private spawnPulseOnEdge(
        edge: TopologyEdge,
        forward: boolean,
        intensity: number,
        cascadeDepth: number
    ): void {
        const startIdx = forward ? edge.fromIndex : edge.toIndex;
        const endIdx = forward ? edge.toIndex : edge.fromIndex;
        const pFrom = this.particles[startIdx];
        const pTo = this.particles[endIdx];
        if (!pFrom || !pTo) return;

        pFrom.synapticCharge = Math.min(1.0, pFrom.synapticCharge + 0.62);
        // Скорость проводимости зависит от класса ребра (магистрали быстрее: 255 px/s)
        const speedPxPerSec =
            edge.edgeClass === 'AXON_TRUNK' ? 255 : edge.edgeClass === 'BRIDGE' ? 195 : 145;
        const normalizedSpeed = speedPxPerSec / Math.max(55, edge.arcLength);

        this.pulses.push({
            edgeId: edge.id,
            fromIndex: startIdx,
            toIndex: endIdx,
            edgeClass: edge.edgeClass,
            x1: pFrom.x,
            y1: pFrom.y,
            ctrlX: edge.ctrlX,
            ctrlY: edge.ctrlY,
            x2: pTo.x,
            y2: pTo.y,
            lengthLUT: edge.lengthLUT,
            progress: 0,
            speed: normalizedSpeed,
            bodyLength: 0.12, // 12% длины ребра (в каноничном окне 6–14% MASTER 03)
            tailLength: 0.18, // 18% длины ребра (в каноничном окне 10–22% MASTER 03)
            intensity,
            cascadeDepth,
        });
    }

    private triggerCascadeFromNode(
        nodeIndex: number,
        prevIndex: number,
        remainingDepth: number
    ): void {
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            if (edge.fromIndex === nodeIndex && edge.toIndex !== prevIndex) {
                this.spawnPulseOnEdge(edge, true, 0.95, remainingDepth);
                break;
            }
            if (edge.toIndex === nodeIndex && edge.fromIndex !== prevIndex) {
                this.spawnPulseOnEdge(edge, false, 0.95, remainingDepth);
                break;
            }
        }
    }

    // Точное вычисление позиции импульса через таблицу длины дуги (lengthLUT)
    public samplePulsePoint(pulse: SynapticPulse, arcFraction: number): { x: number; y: number } {
        return NexusGraphEngine.sampleBezierByArcLength(
            pulse.x1,
            pulse.y1,
            pulse.ctrlX,
            pulse.ctrlY,
            pulse.x2,
            pulse.y2,
            pulse.lengthLUT,
            arcFraction
        );
    }

    public getParticles(): ReadonlyArray<QuantumParticle> {
        return this.particles;
    }

    public getEdges(): ReadonlyArray<TopologyEdge> {
        return this.edges;
    }

    public getPulses(): ReadonlyArray<SynapticPulse> {
        return this.pulses;
    }
}