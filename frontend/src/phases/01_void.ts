// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/01_void.ts
// НАЗНАЧЕНИЕ: Ядро плавного морфинга 5 Образов Вселенной, Нейро-Мозга и Синапсов
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Центрирует все 5 визуальных образов строго по центру экрана 16:9 без смещений.
// 2. Вычисляет плавное перетекание (morphing) координат и энергии при смене фаз.
// 3. Строит выраженную нейросеть головного мозга (сомы, дендриты, изогнутые аксоны).
// 4. Запускает крупные синаптические сигналы-кометы и вспышки колец активации нейронов.
// ============================================================================

import type { PhaseId } from '../store/universeState';
import { UNIVERSE_PHASES, universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { computeGenesisTarget } from './02_genesis';
import { computeEvolutionBrainTarget } from './03_evolution';
import { computeCollapseStormTarget } from './04_collapse';
import { computeSingularityTarget } from './05_singularity';

export type DepthLayerTier = 'FOREGROUND' | 'MIDGROUND' | 'BACKGROUND' | 'DEEP_LAYER';
export type NexusEdgeClass = 'AXON_TRUNK' | 'BRIDGE' | 'DENDRITE';

export interface MorphTargetPoint {
    x: number;
    y: number;
    energy: number;
}

export interface QuantumParticle {
    id: number;
    x: number;
    y: number;
    homeNormX: number;
    homeNormY: number;
    depthZ: number;
    depthTier: DepthLayerTier;
    clusterId: number;
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    energy: number;
    synapticCharge: number;    // Яркость вспышки сомы нейрона при получении сигнала (0..1)
    interferenceFlash: number; // Кольцо синаптического озарения вокруг нейрона (0..1)
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
    progress: number;
    speed: number;
    bodyLength: number;
    tailLength: number;
    intensity: number;
    cascadeDepth: number;
}

const REAL_MODULE_TAGS = [
    '01_void.ts',
    '02_genesis.ts',
    '03_evolution.ts',
    '04_collapse.ts',
    '05_singularity.ts',
    'stressState.ts',
    'universeState.ts',
];

// 10 симметричных кортикальных центров левого и правого полушарий мозга (строго по центру экрана)
export const BRAIN_HEMISPHERE_LOBES: ReadonlyArray<[number, number]> = [
    [-0.34, -0.16], // Левая лобная кора
    [-0.36, 0.08],  // Левая височная кора
    [-0.24, -0.28], // Левая верхняя теменная извилина
    [-0.22, 0.25],  // Левая затылочная доля
    [-0.09, -0.04], // Левый таламус / мозолистое тело
    [0.09, 0.04],   // Правый таламус / мозолистое тело
    [0.22, -0.25],  // Правая верхняя теменная извилина
    [0.24, 0.28],   // Правая затылочная доля
    [0.36, -0.08],  // Правая височная кора
    [0.34, 0.16],   // Правая лобная кора
];

export class VoidPhaseSimulation {
    private particles: QuantumParticle[] = [];
    private edges: TopologyEdge[] = [];
    private pulses: SynapticPulse[] = [];
    private afterglowMap: Map<string, number> = new Map();
    private width = 1920;
    private height = 1080;
    private lastCycleCount = 1;
    private previousPhase: PhaseId = '01_VOID';

    constructor(initialWidth = 1920, initialHeight = 1080) {
        this.width = initialWidth;
        this.height = initialHeight;
        this.respawnParticles(UNIVERSE_PHASES['03_EVOLUTION'].targetParticleCount);
    }

    private seededRandom(seed: number): number {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    public resize(width: number, height: number): void {
        const scaleX = width / Math.max(1, this.width);
        const scaleY = height / Math.max(1, this.height);
        this.width = width;
        this.height = height;

        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].x *= scaleX;
            this.particles[i].y *= scaleY;
        }
    }

    public respawnParticles(count: number): void {
        const uState = universeStore.getState();
        const cappedCount = Math.min(count, uState.reducedMotion ? 420 : 780);
        this.particles = [];
        this.edges = [];
        this.pulses = [];
        this.afterglowMap.clear();

        for (let i = 0; i < cappedCount; i++) {
            this.particles.push(this.createSingleParticle(i));
        }
    }

    private createSingleParticle(id: number): QuantumParticle {
        const seed = universeStore.getState().seed + id * 37;
        const r1 = this.seededRandom(seed);
        const r2 = this.seededRandom(seed + 1);
        const r3 = this.seededRandom(seed + 2);
        const r4 = this.seededRandom(seed + 3);

        let depthZ: number;
        let depthTier: DepthLayerTier;
        if (r1 < 0.14) {
            depthZ = 0.14 + r2 * 0.15;
            depthTier = 'DEEP_LAYER';
        } else if (r1 < 0.42) {
            depthZ = 0.34 + r2 * 0.30;
            depthTier = 'BACKGROUND';
        } else if (r1 < 0.90) {
            depthZ = 0.72 + r2 * 0.46;
            depthTier = 'MIDGROUND';
        } else {
            depthZ = 1.26 + r2 * 0.32;
            depthTier = 'FOREGROUND';
        }

        const clusterId = id % BRAIN_HEMISPHERE_LOBES.length;
        const [lobeX, lobeY] = BRAIN_HEMISPHERE_LOBES[clusterId];

        const angle = r4 * Math.PI * 2;
        const radiusSpread = 0.03 + Math.pow(r3, 0.8) * 0.13;
        const homeNormX = Math.max(-0.45, Math.min(0.45, lobeX + Math.cos(angle) * radiusSpread));
        const homeNormY = Math.max(-0.42, Math.min(0.42, lobeY + Math.sin(angle) * (radiusSpread * 1.1)));

        const x = this.width * (0.5 + homeNormX);
        const y = this.height * (0.5 + homeNormY);

        return {
            id,
            x,
            y,
            homeNormX,
            homeNormY,
            depthZ,
            depthTier,
            clusterId,
            vx: 0,
            vy: 0,
            mass: 0.7 + depthZ * 1.1,
            radius: (1.15 + r3 * 1.95) * (depthTier === 'FOREGROUND' ? 1.6 : depthZ),
            energy: 0.3 + r2 * 0.5,
            synapticCharge: 0,
            interferenceFlash: 0,
            lastSignalArrivalMs: 0,
            cooldownUntilMs: 0,
            degree: 0,
            moduleTag: REAL_MODULE_TAGS[id % REAL_MODULE_TAGS.length],
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
                return this.computeVoidWaveTarget(p, centerX, centerY, simTimeSec, phaseProgress);
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

    private computeVoidWaveTarget(
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        simTimeSec: number,
        phaseProgress: number
    ): MorphTargetPoint {
        const baseDistX = p.homeNormX * this.width * 0.92;
        const baseDistY = p.homeNormY * this.height * 0.88;
        const dist = Math.hypot(baseDistX, baseDistY) + 1.0;
        const angle = Math.atan2(baseDistY, baseDistX) + simTimeSec * 0.08 * p.quantumSpin;

        const ripple = Math.sin(dist * 0.018 - simTimeSec * 1.4 + p.phaseOffset) * 22;
        const anticipation = Math.max(0, (phaseProgress - 0.65) / 0.35);
        const gatherScale = p.id % 3 === 0 ? 1.0 - anticipation * 0.45 : 1.0;

        const x = centerX + Math.cos(angle) * (dist * gatherScale + ripple);
        const y = centerY + Math.sin(angle) * (dist * gatherScale + ripple) * 0.85;

        const waveGlow = 0.5 + 0.5 * Math.sin(dist * 0.02 - simTimeSec * 1.6 + p.phaseOffset);
        const energy = 0.15 + waveGlow * 0.45 + anticipation * 0.3;
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

        if (uState.cycleCount !== this.lastCycleCount) {
            this.lastCycleCount = uState.cycleCount;
            this.previousPhase = '01_VOID';
            this.respawnParticles(UNIVERSE_PHASES['03_EVOLUTION'].targetParticleCount);
        }

        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.pulses = [];
            return;
        }

        const dt = Math.min(dtSeconds, 0.05) * timeScale * (uState.reducedMotion ? 0.5 : 1.0);
        const stressState = stressStore.getState();
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.5;
        const phaseProgress = uState.telemetry.phaseProgress;
        const nowMs = performance.now();

        const morphWindow = 0.28;
        const rawBlend = phaseProgress < morphWindow ? phaseProgress / morphWindow : 1.0;
        const smoothBlend = rawBlend * rawBlend * (3.0 - 2.0 * rawBlend);

        if (phaseProgress >= morphWindow && this.previousPhase !== phase) {
            this.previousPhase = phase;
        }

        const springRate = Math.min(1.0, dt * (2.6 + gravityMultiplier * 0.9));

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.degree = 0;

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
            p.vx = dx * 2.8;
            p.vy = dy * 2.8;

            if (stressState.isPointerInside && stressState.currentBreachRadius > 4) {
                const dxPtr = p.x - stressState.lensX;
                const dyPtr = p.y - stressState.lensY;
                const distPtr = Math.hypot(dxPtr, dyPtr) + 0.1;
                const influenceRadius = stressState.currentBreachRadius * 1.35;

                if (distPtr < influenceRadius) {
                    const factor = 1.0 - distPtr / influenceRadius;
                    p.synapticCharge = Math.min(1.0, p.synapticCharge + factor * dt * 3.5);

                    if (stressState.isBreaching) {
                        const push = factor * 24;
                        targetX += (-dyPtr / distPtr) * push;
                        targetY += (dxPtr / distPtr) * push;
                    }
                }
            }

            p.x += (targetX - p.x) * springRate;
            p.y += (targetY - p.y) * springRate;
            p.energy += (targetEnergy - p.energy) * Math.min(1.0, dt * 4.0);

            if (p.synapticCharge > 0) {
                p.synapticCharge = Math.max(0, p.synapticCharge - dt * 1.1);
            }
            if (p.interferenceFlash > 0) {
                p.interferenceFlash = Math.max(0, p.interferenceFlash - dt * 1.45);
            }
        }

        this.buildNexusOrganicTopology(dt, phase, simTimeSec);
        this.updateSynapticPulses(dt, phase, nowMs);
    }

    private buildNexusOrganicTopology(dt: number, phase: PhaseId, simTimeSec: number): void {
        const keysToDelete: string[] = [];
        this.afterglowMap.forEach((glow, edgeId) => {
            const nextGlow = glow * Math.exp(-dt * 0.85);
            if (nextGlow < 0.02) {
                keysToDelete.push(edgeId);
            } else {
                this.afterglowMap.set(edgeId, nextGlow);
            }
        });
        for (let k = 0; k < keysToDelete.length; k++) {
            this.afterglowMap.delete(keysToDelete[k]);
        }

        this.edges = [];
        const screenScale = Math.max(1.0, Math.min(this.width, this.height) / 920);
        const maxConnectDist =
            (phase === '03_EVOLUTION' || phase === '04_COLLAPSE' ? 230 : 185) * screenScale;
        const maxConnectDistSq = maxConnectDist * maxConnectDist;
        const count = this.particles.length;
        const stride = count > 520 ? 2 : 1;

        for (let i = 0; i < count; i += stride) {
            const p1 = this.particles[i];
            if (p1.depthTier === 'FOREGROUND') continue;
            let connections = 0;

            for (let j = i + stride; j < count; j += stride) {
                const p2 = this.particles[j];
                if (p2.depthTier === 'FOREGROUND') continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxConnectDistSq && distSq > 100) {
                    const dist = Math.sqrt(distSq);
                    const strength = 1.0 - dist / maxConnectDist;
                    const edgeId = `${p1.id}_${p2.id}`;

                    let edgeClass: NexusEdgeClass = 'DENDRITE';
                    if (p1.clusterId !== p2.clusterId || dist > maxConnectDist * 0.55) {
                        edgeClass = 'AXON_TRUNK';
                    } else if (connections === 0) {
                        edgeClass = 'BRIDGE';
                    }

                    const midX = (p1.x + p2.x) * 0.5;
                    const midY = (p1.y + p2.y) * 0.5;
                    const normX = -dy / dist;
                    const normY = dx / dist;
                    const curveSign = (p1.id + p2.id) % 2 === 0 ? 1 : -1;
                    const wave = Math.sin(simTimeSec * 0.8 + p1.phaseOffset) * 8.0;
                    const bendOffset =
                        edgeClass === 'AXON_TRUNK'
                            ? dist * 0.22 * curveSign + wave
                            : edgeClass === 'BRIDGE'
                                ? dist * 0.14 * curveSign
                                : dist * 0.08 * curveSign;

                    const ctrlX = midX + normX * bendOffset;
                    const ctrlY = midY + normY * bendOffset;
                    const arcLength =
                        (dist + Math.hypot(ctrlX - p1.x, ctrlY - p1.y) + Math.hypot(p2.x - ctrlX, p2.y - ctrlY)) *
                        0.5;

                    const truthVisibility = stressStore.getTruthRevealFactorAt(midX, midY);
                    const afterglow = this.afterglowMap.get(edgeId) ?? 0;

                    this.edges.push({
                        id: edgeId,
                        fromIndex: i,
                        toIndex: j,
                        edgeClass,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        ctrlX,
                        ctrlY,
                        arcLength,
                        strength,
                        truthVisibility,
                        afterglow,
                    });

                    p1.degree++;
                    p2.degree++;
                    connections++;
                    if (connections >= 3) break;
                }
            }
        }
    }

    private updateSynapticPulses(dt: number, phase: PhaseId, nowMs: number): void {
        if (this.edges.length === 0) {
            this.pulses = [];
            return;
        }

        const maxPulses =
            phase === '01_VOID'
                ? 18
                : phase === '02_GENESIS'
                    ? 45
                    : phase === '03_EVOLUTION'
                        ? 95
                        : 85;

        if (this.pulses.length < maxPulses && Math.random() < 0.92) {
            const candidate = this.edges[Math.floor(Math.random() * this.edges.length)];
            if (candidate) {
                this.spawnPulseOnEdge(candidate, Math.random() > 0.5, 1.0, 3);
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
                    pTo.interferenceFlash = deltaArrivalMs <= 360 ? 1.0 : 0.72;
                    pTo.cooldownUntilMs = nowMs + 240;
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

        pFrom.synapticCharge = Math.min(1.0, pFrom.synapticCharge + 0.65);
        const speedPxPerSec = edge.edgeClass === 'AXON_TRUNK' ? 245 : 185;
        const normalizedSpeed = speedPxPerSec / Math.max(60, edge.arcLength);

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
            progress: 0,
            speed: normalizedSpeed,
            bodyLength: 0.16,
            tailLength: 0.26,
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