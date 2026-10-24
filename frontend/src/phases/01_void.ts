// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/01_void.ts
// НАЗНАЧЕНИЕ: Ядро симуляции 5 фаз с C2-бесшовным морфингом по снимку состояния (v2.5)
// ============================================================================

import { EntityKindCode, type PhaseId } from '../core/contracts';
import { DeterministicPRNG } from '../core/prng';
import { wasmPhysicsBridge } from '../bridge/wasmBridge';
import {
    NexusGraphEngine,
    nexusGraphEngine,
    type ComputedEdgeClass,
} from '../bridge/simulationWorker';
import {
    smootherstep,
    UNIVERSE_PHASES,
    universeStore,
    type SingularityAct,
} from '../store/universeState';
import { stressStore } from '../store/stressState';
import { audioSync } from '../utils/audioSync';
import { computeGenesisTarget } from './02_genesis';
import { computeEvolutionBrainTarget } from './03_evolution';
import { computeCollapseStormTarget } from './04_collapse';
import { computeSingularityTarget } from './05_singularity';

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
    morphOriginX: number;
    morphOriginY: number;
    morphOriginEnergy: number;
    homeNormX: number;
    homeNormY: number;
    depthZ: number;
    depthTier: DepthLayerTier;
    clusterId: number;
    ringIndex: number;
    tripleGroupId: number;
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    energy: number;
    kuramotoPhase: number;
    synapticCharge: number;
    interferenceFlash: number;
    lastSignalArrivalMs: number;
    cooldownUntilMs: number;
    degree: number;
    moduleTag: string;
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
    progress: number;
    speed: number;
    bodyLength: number;
    tailLength: number;
    intensity: number;
    cascadeDepth: number;
}

const POLYGLOT_OWNER_TAGS: ReadonlyArray<string> = [
    'rust/gravity.rs',
    'python/graph_logic.py',
    'wgsl/illusion.wgsl',
    'wgsl/breach.wgsl',
    'rust/breach_math.rs',
    'python/singularity.py',
    'ts/sceneBuffer.ts',
];

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

export class VoidPhaseSimulation {
    private particles: QuantumParticle[] = [];
    private edges: TopologyEdge[] = [];
    private pulses: SynapticPulse[] = [];
    private afterglowMap: Map<string, number> = new Map();
    private width = 1920;
    private height = 1080;
    private lastCycleCount = 1;
    private activePhase: PhaseId = '01_VOID';
    private activeSingularityAct: SingularityAct = 'INACTIVE';
    private phaseMorphFactor = 1.0;
    private tickCounter = 0;
    private lastTopologyBuildSimSec = -10;
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
            const p = this.particles[i];
            p.x *= scaleX;
            p.y *= scaleY;
            p.prevX = p.x;
            p.prevY = p.y;
            p.morphOriginX *= scaleX;
            p.morphOriginY *= scaleY;
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
        this.lastTopologyBuildSimSec = -10;
        this.activePhase = uState.currentPhase;
        this.activeSingularityAct = uState.singularityAct;
        this.phaseMorphFactor = 1.0;

        for (let i = 0; i < cappedCount; i++) {
            this.particles.push(this.createSingleParticle(i, uState.seed));
        }
    }

    private createSingleParticle(id: number, seed: number): QuantumParticle {
        const r1 = DeterministicPRNG.hashFloat(seed, id * 37 + 1);
        const r2 = DeterministicPRNG.hashFloat(seed, id * 37 + 2);
        const r3 = DeterministicPRNG.hashFloat(seed, id * 37 + 3);
        const r4 = DeterministicPRNG.hashFloat(seed, id * 37 + 4);

        let depthZ: number;
        let depthTier: DepthLayerTier;
        if (r1 < 0.14) {
            depthZ = 0.1 + r2 * 0.19;
            depthTier = 'DEEP_LAYER';
        } else if (r1 < 0.42) {
            depthZ = 0.3 + r2 * 0.35;
            depthTier = 'BACKGROUND';
        } else if (r1 < 0.91) {
            depthZ = 0.7 + r2 * 0.5;
            depthTier = 'MIDGROUND';
        } else {
            depthZ = 1.25 + r2 * 0.35;
            depthTier = 'FOREGROUND';
        }

        const clusterId = id % BRAIN_HEMISPHERE_LOBES.length;
        const [lobeX, lobeY] = BRAIN_HEMISPHERE_LOBES[clusterId];

        const angle = r4 * Math.PI * 2;
        const radiusSpread = 0.025 + Math.pow(r3, 0.82) * 0.135;
        const homeNormX = Math.max(-0.45, Math.min(0.45, lobeX + Math.cos(angle) * radiusSpread));
        const homeNormY = Math.max(
            -0.42,
            Math.min(0.42, lobeY + Math.sin(angle) * (radiusSpread * 1.1))
        );

        const x = this.width * (0.5 + homeNormX);
        const y = this.height * (0.5 + homeNormY);
        const energy = 0.25 + r2 * 0.5;

        return {
            id,
            x,
            y,
            prevX: x,
            prevY: y,
            morphOriginX: x,
            morphOriginY: y,
            morphOriginEnergy: energy,
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
            energy,
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
                return this.computeVoidChirpTarget(
                    p,
                    centerX,
                    centerY,
                    simTimeSec,
                    phaseProgress
                );
            case '02_GENESIS':
                return computeGenesisTarget(
                    p,
                    centerX,
                    centerY,
                    this.width,
                    this.height,
                    simTimeSec,
                    phaseProgress
                );
            case '03_EVOLUTION':
                return computeEvolutionBrainTarget(
                    p,
                    centerX,
                    centerY,
                    this.width,
                    this.height,
                    simTimeSec,
                    phaseProgress
                );
            case '04_COLLAPSE':
                return computeCollapseStormTarget(
                    p,
                    centerX,
                    centerY,
                    this.width,
                    this.height,
                    simTimeSec,
                    phaseProgress
                );
            case '05_SINGULARITY':
                return computeSingularityTarget(
                    p,
                    centerX,
                    centerY,
                    this.width,
                    this.height,
                    simTimeSec
                );
        }
    }

    private computeVoidChirpTarget(
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        simTimeSec: number,
        phaseProgress: number
    ): MorphTargetPoint {
        const phaseSec = phaseProgress * 17.0;
        const baseDistX = p.homeNormX * this.width * 0.9;
        const baseDistY = p.homeNormY * this.height * 0.86;
        const r = Math.hypot(baseDistX, baseDistY) + 1.0;

        const chirpEnvelope = smootherstep(1.2, 6.5, phaseSec);
        const chirpProgress = smootherstep(2.0, 16.5, phaseSec);
        const chirpFreqMultiplier = 1.0 + chirpProgress * 0.52;

        const matterAnticipation = smootherstep(8.5, 16.8, phaseSec);
        const enclosedMass = 120.0 + r * 0.85;
        const circularAngularVel = Math.sqrt(enclosedMass / Math.max(45, r)) * 0.11;

        const baseAngle =
            Math.atan2(baseDistY, baseDistX) +
            simTimeSec * (0.055 * p.quantumSpin + matterAnticipation * circularAngularVel);

        const calmWave = Math.sin(simTimeSec * 0.9 + p.phaseOffset) * 6.0;
        const activeChirpWave =
            Math.sin(r * 0.017 * chirpFreqMultiplier - simTimeSec * 1.75 + p.phaseOffset) *
            (14.0 + chirpProgress * 12.0);
        const rippleWave = calmWave * (1.0 - chirpEnvelope) + activeChirpWave * chirpEnvelope;

        const radialGather = p.id % 4 === 0 ? 1.0 - matterAnticipation * 0.22 : 1.0;
        const finalR = r * radialGather + rippleWave;

        const x = centerX + Math.cos(baseAngle) * finalR;
        const y = centerY + Math.sin(baseAngle) * finalR * 0.78;

        const firstSparkBoost =
            smootherstep(0.6, 1.3, phaseSec) *
            (1.0 - smootherstep(1.5, 2.6, phaseSec)) *
            (p.id % 19 === 0 ? 0.68 : 0);

        const fresnelRim =
            0.08 +
            chirpEnvelope *
            Math.max(0, Math.sin(r * 0.017 * chirpFreqMultiplier - simTimeSec * 1.75)) *
            0.38;

        const energy = Math.min(
            1.0,
            0.14 + fresnelRim + firstSparkBoost + matterAnticipation * 0.26
        );
        return { x, y, energy };
    }

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
            this.respawnParticles(UNIVERSE_PHASES['03_EVOLUTION'].targetParticleCount);
        }

        if (phase !== this.activePhase) {
            for (let i = 0; i < this.particles.length; i++) {
                const pt = this.particles[i];
                pt.morphOriginX = pt.x;
                pt.morphOriginY = pt.y;
                pt.morphOriginEnergy = pt.energy;
            }
            this.activePhase = phase;
            this.phaseMorphFactor = 0.0;
        }

        if (uState.singularityAct !== this.activeSingularityAct) {
            this.activeSingularityAct = uState.singularityAct;
            if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
                this.pulses = [];
            }
        }

        this.tickCounter++;
        const dt =
            Math.min(dtSeconds * timeScale, 0.05) * (uState.reducedMotion ? 0.45 : 1.0);

        const morphRate = phase === '05_SINGULARITY' ? 0.95 : 0.385;
        this.phaseMorphFactor = Math.min(1.0, this.phaseMorphFactor + dt * morphRate);
        const smoothBlend = smootherstep(0.0, 1.0, this.phaseMorphFactor);

        const stressState = stressStore.getState();
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.5;
        const phaseProgress = uState.telemetry.phaseProgress;
        const nowMs = performance.now();

        // Единый аудиоснимок на кадр для мягкой модуляции (Предложение 4)
        const audioSnap = audioSync.getSnapshot(simTimeSec);
        const highSparkBoost =
            uState.reducedMotion || audioSnap.high < 0.06
                ? 0.0
                : Math.min(0.24, (audioSnap.high - 0.06) * 0.85);

        sceneBuffer.snapshotPreviousPositions(this.particles.length);

        const isSingularityCollapse =
            phase === '05_SINGULARITY' &&
            (uState.singularityAct === 'ACT_B_LOGIC' ||
                uState.singularityAct === 'ACT_C_ZERO_SILENCE' ||
                uState.singularityAct === 'ACT_D_GITHUB_CARD');
        const springRate = isSingularityCollapse
            ? Math.min(0.32, dt * 6.5)
            : Math.min(0.16, dt * (2.05 + gravityMultiplier * 0.5));
        const velDamping = Math.exp(-dt * 11.5);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.prevX = p.x;
            p.prevY = p.y;
            p.kuramotoPhase = wasmPhysicsBridge.getKuramotoPhase(i);

            const currentTarget = this.computePhaseArchetypePoint(
                this.activePhase,
                p,
                centerX,
                centerY,
                simTimeSec,
                phaseProgress
            );

            let targetX =
                p.morphOriginX * (1.0 - smoothBlend) + currentTarget.x * smoothBlend;
            let targetY =
                p.morphOriginY * (1.0 - smoothBlend) + currentTarget.y * smoothBlend;
            const targetEnergy =
                p.morphOriginEnergy * (1.0 - smoothBlend) +
                currentTarget.energy * smoothBlend;

            if (stressState.isPointerInside && stressState.currentBreachRadius > 4) {
                const dxPtr = p.x - stressState.lensX;
                const dyPtr = p.y - stressState.lensY;
                const distPtr = Math.hypot(dxPtr, dyPtr) + 0.1;
                const influenceRadius = stressState.currentBreachRadius * 1.32;

                if (distPtr < influenceRadius) {
                    const factor = 1.0 - distPtr / influenceRadius;
                    p.synapticCharge = Math.min(1.0, p.synapticCharge + factor * dt * 3.4);

                    if (stressState.isBreaching) {
                        const push = factor * 18;
                        targetX += (-dyPtr / distPtr) * push;
                        targetY += (dxPtr / distPtr) * push;
                    }
                }
            }

            const dx = targetX - p.x;
            const dy = targetY - p.y;
            p.vx = p.vx * velDamping + dx * 0.38;
            p.vy = p.vy * velDamping + dy * 0.38;

            p.x += dx * springRate;
            p.y += dy * springRate;
            p.energy += (targetEnergy - p.energy) * Math.min(1.0, dt * 3.6);

            // Тонкие звёздные искры от высоких частот (high band) на частицах переднего/среднего плана
            if (highSparkBoost > 0 && i % 11 === 0) {
                p.synapticCharge = Math.min(
                    1.0,
                    Math.max(p.synapticCharge, highSparkBoost * 0.85)
                );
            }

            if (p.synapticCharge > 0) {
                p.synapticCharge = Math.max(0, p.synapticCharge - dt * 1.05);
            }
            if (p.interferenceFlash > 0) {
                p.interferenceFlash = Math.max(0, p.interferenceFlash - dt * 1.4);
            }

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

        sceneBuffer.commitTickAndComputeDigest(
            this.tickCounter,
            this.particles.length,
            uState.seed
        );

        universeStore.updateTelemetry({
            tick: this.tickCounter,
            physicsStepMs: Number(physTelemetry.stepDurationMs.toFixed(2)),
            energyDriftRatio: physTelemetry.energyDriftRatio,
            kuramotoOrderR: physTelemetry.kuramotoOrderR,
        });

        this.updateTopologyAndEdgeCurves(dt, phase, simTimeSec, uState.seed);
        this.updateSynapticPulsesByArcLut(
            dt,
            phase,
            nowMs,
            uState.reducedMotion ? 0 : audioSnap.mid
        );
    }

    private updateTopologyAndEdgeCurves(
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

        const shouldRebuildTopology =
            this.edges.length === 0 ||
            Math.abs(simTimeSec - this.lastTopologyBuildSimSec) >= 0.12;

        if (!shouldRebuildTopology) {
            for (let i = 0; i < this.edges.length; i++) {
                const e = this.edges[i];
                const a = this.particles[e.fromIndex];
                const b = this.particles[e.toIndex];
                if (!a || !b) continue;

                e.x1 = a.x;
                e.y1 = a.y;
                e.x2 = b.x;
                e.y2 = b.y;

                const midX = (a.x + b.x) * 0.5;
                const midY = (a.y + b.y) * 0.5;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const bendSign = (a.id + b.id + seed) % 2 === 0 ? 1 : -1;
                const bendScale = e.edgeClass === 'AXON_TRUNK' ? 0.14 : 0.16;
                const ctrlOffset =
                    Math.sin(simTimeSec * 0.65 + (a.id + b.id) * 0.1) * 0.5 + 0.5;
                const factor = bendScale * bendSign * (0.65 + ctrlOffset * 0.35);

                e.ctrlX = midX - dy * factor;
                e.ctrlY = midY + dx * factor;
                e.truthVisibility = stressStore.getTruthRevealFactorAt(midX, midY);
                e.afterglow = this.afterglowMap.get(e.id) ?? 0;
            }
            return;
        }

        this.lastTopologyBuildSimSec = simTimeSec;
        const screenScale = Math.max(1.0, Math.min(this.width, this.height) / 920);
        const maxConnectDist =
            (phase === '03_EVOLUTION' || phase === '04_COLLAPSE' ? 225 : 185) * screenScale;

        const graphInputs = [];
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.degree = 0;
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

        const { edges: computedEdges, degreeByIndex } =
            nexusGraphEngine.buildDeterministicGraph(
                graphInputs,
                maxConnectDist,
                seed,
                simTimeSec
            );

        for (let i = 0; i < graphInputs.length; i++) {
            const pIdx = graphInputs[i].index;
            this.particles[pIdx].degree = degreeByIndex.get(pIdx) ?? 0;
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

    private updateSynapticPulsesByArcLut(
        dt: number,
        phase: PhaseId,
        nowMs: number,
        audioMidBand = 0
    ): void {
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
                        : phase === '04_COLLAPSE'
                            ? 82
                            : 36;

        // Полоса средних частот (mid band) мягко усиливает яркость новых импульсов в пределах [0.88 -. 1.0]
        const midIntensityMod = Math.min(1.0, 0.88 + Math.max(0, audioMidBand - 0.08) * 0.35);

        if (this.pulses.length < maxPulses && this.prng.nextFloat() < 0.85) {
            const candidateIdx = this.prng.nextU32() % this.edges.length;
            const candidate = this.edges[candidateIdx];
            if (candidate && candidate.arcLength > 12.0) {
                this.spawnPulseOnEdge(
                    candidate,
                    this.prng.nextFloat() > 0.5,
                    midIntensityMod,
                    2
                );
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

                if (nowMs > pTo.cooldownUntilMs) {
                    const isInterference = deltaArrivalMs >= 20 && deltaArrivalMs <= 300;
                    pTo.interferenceFlash = isInterference ? 1.0 : 0.68;
                    pTo.cooldownUntilMs = nowMs + 320;

                    if (
                        isInterference &&
                        universeStore.getState().singularityAct !== 'ACT_D_GITHUB_CARD'
                    ) {
                        universeStore.emitEventOnce(
                            `soma_interf_${Math.floor(nowMs / 2200)}`,
                            'signal:arrived',
                            `Интерференция сигналов в соме #${pTo.id} (Δt=${Math.round(
                                deltaArrivalMs
                            )} мс) [python/graph_logic.py]`
                        );
                    }
                }

                if (pulse.cascadeDepth > 0 && this.pulses.length < maxPulses) {
                    this.triggerCascadeFromNode(
                        pulse.toIndex,
                        pulse.fromIndex,
                        pulse.cascadeDepth - 1
                    );
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
        if (edge.arcLength < 10.0) return;
        const startIdx = forward ? edge.fromIndex : edge.toIndex;
        const endIdx = forward ? edge.toIndex : edge.fromIndex;
        const pFrom = this.particles[startIdx];
        const pTo = this.particles[endIdx];
        if (!pFrom || !pTo) return;

        pFrom.synapticCharge = Math.min(1.0, pFrom.synapticCharge + 0.62);
        const speedPxPerSec =
            edge.edgeClass === 'AXON_TRUNK'
                ? 255
                : edge.edgeClass === 'BRIDGE'
                    ? 195
                    : 145;
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
            bodyLength: 0.12,
            tailLength: 0.18,
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
            if (edge.arcLength < 12.0) continue;
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

    public samplePulsePoint(
        pulse: SynapticPulse,
        arcFraction: number
    ): { x: number; y: number } {
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

