// ============================================================================
// ФАЙЛ: frontend/src/phases/01_void.ts
// НАЗНАЧЕНИЕ: Единая модель узлов, 4 планов глубины, топологии NEXUS и Фазы 01 (VOID)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Создает кластерное распределение узлов с пустотами в 4 эшелонах глубины (depthZ).
// 2. Реализует Фазу 01 (VOID): живую микроскопическую Точку Нуля и предчувствие GENESIS.
// 3. Строит 3 класса кривых Безье для сети NEXUS: аксонные магистрали, мосты и дендриты.
// 4. Проводит каскадные световые пакеты вдоль длины дуги (arc length) с afterglow (0.8-1.6с).
// 5. Моделирует интерференцию сигналов в соме нейрона (окно 120-300мс + рефрактерная пауза).
// ============================================================================

import type { PhaseId } from '../store/universeState';
import { UNIVERSE_PHASES, universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { applyGenesisPhysics } from './02_genesis';
import { applyEvolutionPhysics } from './03_evolution';
import { applyCollapsePhysics } from './04_collapse';
import { applySingularityPhysics } from './05_singularity';

// ----------------------------------------------------------------------------
// 1. ТИПЫ 4 ЭШЕЛОНОВ ГЛУБИНЫ, УЗЛОВ-СОМ, 3 КЛАССОВ РЕБЕР NEXUS И ИМПУЛЬСОВ
// ----------------------------------------------------------------------------
export type DepthLayerTier = 'FOREGROUND' | 'MIDGROUND' | 'BACKGROUND' | 'DEEP_LAYER';
export type NexusEdgeClass = 'AXON_TRUNK' | 'BRIDGE' | 'DENDRITE';

export interface QuantumParticle {
    id: number;
    x: number;
    y: number;
    depthZ: number;            // 0.1..0.29 (Deep), 0.3..0.65 (Bg), 0.7..1.2 (Mid), 1.25..1.6 (Fg)
    depthTier: DepthLayerTier;
    clusterId: number;         // Привязка к одному из 7 асимметричных кластеров коры NEXUS
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    energy: number;
    synapticCharge: number;    // Заряд сомы нейрона при приходе импульса (0..1)
    interferenceFlash: number; // Вспышка интерференции при совпадении >=2 сигналов (0..1)
    lastSignalArrivalMs: number;
    cooldownUntilMs: number;   // Рефрактерный период сомы (200-400 мс)
    degree: number;            // Количество активных связей узла для X-RAY выносок
    moduleTag: string;         // Реальное имя модуля проекта для инженерного режима X-RAY
    phaseOffset: number;
    quantumSpin: number;
}

export interface TopologyEdge {
    id: string;
    fromIndex: number;
    toIndex: number;
    edgeClass: NexusEdgeClass; // Магистраль (A), Мост (B) или Дендрит (C)
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    ctrlX: number;             // Контрольная точка кривой Безье (смещенная по нормали)
    ctrlY: number;
    arcLength: number;         // Длина дуги для равномерной скорости импульса
    strength: number;
    truthVisibility: number;
    afterglow: number;         // Остаточное свечение ребра после прохода сигнала (0..1)
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
    progress: number;          // Положение вдоль дуги кривой (0.0 -> 1.0)
    speed: number;
    bodyLength: number;        // 6-14% длины ребра
    tailLength: number;        // 10-22% длины ребра позади тела
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

// ----------------------------------------------------------------------------
// 2. ГЛАВНЫЙ КЛАСС СИМУЛЯЦИИ ВСЕЛЕННОЙ И ТОПОЛОГИИ NEXUS
// ----------------------------------------------------------------------------
export class VoidPhaseSimulation {
    private particles: QuantumParticle[] = [];
    private edges: TopologyEdge[] = [];
    private pulses: SynapticPulse[] = [];
    private afterglowMap: Map<string, number> = new Map();
    private width = 1920;
    private height = 1080;
    private lastCycleCount = 1;

    constructor(initialWidth = 1920, initialHeight = 1080) {
        this.width = initialWidth;
        this.height = initialHeight;
        this.respawnParticles(UNIVERSE_PHASES['01_VOID'].targetParticleCount);
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

    public syncParticleCount(targetCount: number): void {
        const uState = universeStore.getState();
        const limit = uState.reducedMotion ? 420 : 880;
        const cappedTarget = Math.min(targetCount, limit);
        if (this.particles.length === cappedTarget) return;

        if (this.particles.length < cappedTarget) {
            const toAdd = cappedTarget - this.particles.length;
            for (let i = 0; i < toAdd; i++) {
                this.particles.push(this.createSingleParticle(this.particles.length));
            }
        } else {
            this.particles.length = cappedTarget;
        }
    }

    public respawnParticles(count: number): void {
        const uState = universeStore.getState();
        const cappedCount = Math.min(count, uState.reducedMotion ? 420 : 880);
        this.particles = [];
        this.edges = [];
        this.pulses = [];
        this.afterglowMap.clear();

        for (let i = 0; i < cappedCount; i++) {
            this.particles.push(this.createSingleParticle(i));
        }
    }

    // --------------------------------------------------------------------------
    // 3. КЛАСТЕРНАЯ ГЕНЕРАЦИЯ УЗЛОВ С ПУСТОТАМИ И 4 ЭШЕЛОНАМИ ГЛУБИНЫ
    // --------------------------------------------------------------------------
    private createSingleParticle(id: number): QuantumParticle {
        const seed = universeStore.getState().seed + id * 31;
        const r1 = this.seededRandom(seed);
        const r2 = this.seededRandom(seed + 1);
        const r3 = this.seededRandom(seed + 2);
        const r4 = this.seededRandom(seed + 3);

        // Распределение по 4 эшелонам глубины согласно Project Bible v1.1
        let depthZ = 0.85;
        let depthTier: DepthLayerTier = 'MIDGROUND';
        if (r1 < 0.14) {
            depthZ = 0.12 + r2 * 0.16;
            depthTier = 'DEEP_LAYER';
        } else if (r1 < 0.44) {
            depthZ = 0.32 + r2 * 0.32;
            depthTier = 'BACKGROUND';
        } else if (r1 < 0.91) {
            depthZ = 0.72 + r2 * 0.46;
            depthTier = 'MIDGROUND';
        } else {
            depthZ = 1.26 + r2 * 0.32;
            depthTier = 'FOREGROUND';
        }

        // 7 асимметричных кластеров, чтобы оставались выразительные космические пустоты
        const clusterId = id % 7;
        const clusterAngle = (clusterId / 7) * Math.PI * 2 + 0.35;
        const clusterDist = (0.12 + (clusterId % 3) * 0.11) * Math.min(this.width, this.height);
        const cx = this.width * 0.5 + Math.cos(clusterAngle) * clusterDist;
        const cy = this.height * 0.5 + Math.sin(clusterAngle) * clusterDist * 0.78;

        const localSpread = (45 + r3 * 195) * (depthTier === 'BACKGROUND' ? 1.45 : 0.95);
        const localAngle = r4 * Math.PI * 2;

        const x = cx + Math.cos(localAngle) * localSpread;
        const y = cy + Math.sin(localAngle) * localSpread;

        const speed = (3 + r2 * 14) * (0.5 + depthZ * 0.5);
        return {
            id,
            x,
            y,
            depthZ,
            depthTier,
            clusterId,
            vx: Math.cos(localAngle + 1.4) * speed,
            vy: Math.sin(localAngle + 1.4) * speed,
            mass: 0.65 + depthZ * 1.15,
            radius: (0.95 + r3 * 1.75) * (depthTier === 'FOREGROUND' ? 1.45 : depthZ),
            energy: 0.18 + r2 * 0.55,
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

    // --------------------------------------------------------------------------
    // 4. ГЛАВНЫЙ ШАГ ФИЗИКИ, ТОПОЛОГИИ NEXUS И КАСКАДНЫХ СИГНАЛОВ
    // --------------------------------------------------------------------------
    public update(
        dtSeconds: number,
        phase: PhaseId,
        timeScale: number,
        gravityMultiplier: number,
        simTimeSec: number
    ): void {
        const uState = universeStore.getState();

        // Проверка перезапуска цикла (Restart Universe)
        if (uState.cycleCount !== this.lastCycleCount) {
            this.lastCycleCount = uState.cycleCount;
            this.respawnParticles(UNIVERSE_PHASES['01_VOID'].targetParticleCount);
        }

        // В состоянии 2.5с абсолютной тишины (ZERO_SILENCE) физика и импульсы полностью неподвижны
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.pulses = [];
            return;
        }

        const motionFactor = uState.reducedMotion ? 0.45 : 1.0;
        const dt = Math.min(dtSeconds, 0.05) * timeScale * motionFactor;
        const phaseMeta = UNIVERSE_PHASES[phase];

        this.syncParticleCount(phaseMeta.targetParticleCount);

        const stressState = stressStore.getState();
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.5;
        const effectiveGravity = phaseMeta.baseGravity * gravityMultiplier;
        const phaseProgress = uState.telemetry.phaseProgress;
        const nowMs = performance.now();

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.degree = 0;

            switch (phase) {
                case '01_VOID':
                    this.applyVoidPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity, phaseProgress);
                    break;
                case '02_GENESIS':
                    applyGenesisPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity, phaseProgress);
                    break;
                case '03_EVOLUTION':
                    applyEvolutionPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity);
                    break;
                case '04_COLLAPSE':
                    applyCollapsePhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity);
                    break;
                case '05_SINGULARITY':
                    applySingularityPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity);
                    break;
            }

            // Взаимодействие с инерционной BREACH LENS
            if (stressState.isPointerInside && stressState.currentBreachRadius > 4) {
                const dxPtr = p.x - stressState.lensX;
                const dyPtr = p.y - stressState.lensY;
                const distPtr = Math.sqrt(dxPtr * dxPtr + dyPtr * dyPtr) + 0.1;
                const influenceRadius = stressState.currentBreachRadius * 1.25;

                if (distPtr < influenceRadius) {
                    const factor = 1.0 - distPtr / influenceRadius;
                    p.synapticCharge = Math.min(1.0, p.synapticCharge + factor * dt * 2.4);

                    if (stressState.isBreaching) {
                        const swirlX = -dyPtr / distPtr;
                        const swirlY = dxPtr / distPtr;
                        p.vx += (swirlX * 95 + (dxPtr / distPtr) * 38) * factor * dt;
                        p.vy += (swirlY * 95 + (dyPtr / distPtr) * 38) * factor * dt;
                    }
                }
            }

            // Затухание синаптического потенциала и вспышки интерференции
            if (p.synapticCharge > 0) {
                p.synapticCharge = Math.max(0, p.synapticCharge - dt * 1.35);
            }
            if (p.interferenceFlash > 0) {
                p.interferenceFlash = Math.max(0, p.interferenceFlash - dt * 2.1);
            }

            // Вязкое демпфирование и параллакс 4 эшелонов глубины
            const damping = phase === '05_SINGULARITY' ? 0.955 : 0.984;
            p.vx *= damping;
            p.vy *= damping;

            // Передний план дает выраженный параллакс, дальний и глубинный почти неподвижны
            const parallaxSpeed =
                p.depthTier === 'FOREGROUND'
                    ? 1.28
                    : p.depthTier === 'MIDGROUND'
                        ? 0.88
                        : p.depthTier === 'BACKGROUND'
                            ? 0.34
                            : 0.16;

            p.x += p.vx * parallaxSpeed * dt;
            p.y += p.vy * parallaxSpeed * dt;

            // Мягкое удержание в пределах сцены
            const margin = 48;
            if (p.x < -margin) p.x = this.width + margin;
            if (p.x > this.width + margin) p.x = -margin;
            if (p.y < -margin) p.y = this.height + margin;
            if (p.y > this.height + margin) p.y = -margin;
        }

        this.buildNexusOrganicTopology(dt, phase, simTimeSec);
        this.updateSynapticPulses(dt, phase, nowMs);
    }

    // --------------------------------------------------------------------------
    // 5. ХОРЕОГРАФИЯ ФАЗЫ 01 (VOID): ТИШИНА, ТОЧКА НУЛЯ И ПРЕДЧУВСТВИЕ GENESIS
    // --------------------------------------------------------------------------
    private applyVoidPhysics(
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        dt: number,
        simTimeSec: number,
        effectiveGravity: number,
        phaseProgress: number
    ): void {
        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1.0;

        // В начале VOID почти все частицы погружены в темноту; видна лишь редкая пыль вокруг Точки Нуля
        const isRareDust = p.id % 14 === 0;
        const anticipation = Math.max(0, (phaseProgress - 0.62) / 0.38); // Предчувствие в последние 38% фазы

        const driftX = Math.sin(simTimeSec * 0.45 + p.phaseOffset) * 4.5;
        const driftY = Math.cos(simTimeSec * 0.38 + p.phaseOffset) * 4.5;

        // По мере приближения к GENESIS ближайшие флуктуации ориентируются к Точке Нуля
        const orientPull = (8 + anticipation * 58) * effectiveGravity;
        p.vx += (driftX + (dx / dist) * orientPull) * dt;
        p.vy += (driftY + (dy / dist) * orientPull) * dt;

        if (isRareDust) {
            p.energy = 0.14 + 0.22 * Math.sin(simTimeSec * 0.9 + p.phaseOffset) + anticipation * 0.35;
        } else {
            // Остальные узлы спят в темноте и мягко просыпаются только в фазе предчувствия
            p.energy = anticipation * anticipation * 0.42;
        }
    }

    // --------------------------------------------------------------------------
    // 6. ПОСТРОЕНИЕ 3 КЛАССОВ КРИВЫХ NEXUS (МАГИСТРАЛИ, МОСТЫ, ДЕНДРИТЫ) И AFTERGLOW
    // --------------------------------------------------------------------------
    private buildNexusOrganicTopology(dt: number, phase: PhaseId, simTimeSec: number): void {
        // 1. Экспоненциальное затухание afterglow на всех ребрах (время жизни 0.8-1.6 сек)
        for (const [edgeId, glow] of this.afterglowMap.entries()) {
            const nextGlow = glow * Math.exp(-dt * 1.05);
            if (nextGlow < 0.015) {
                this.afterglowMap.delete(edgeId);
            } else {
                this.afterglowMap.set(edgeId, nextGlow);
            }
        }

        this.edges = [];
        const uState = universeStore.getState();
        if (phase === '01_VOID' && uState.telemetry.phaseProgress < 0.65) {
            return; // В начале VOID сеть скрыта в темноте
        }

        const maxConnectDist = phase === '03_EVOLUTION' || phase === '04_COLLAPSE' ? 128 : 105;
        const maxConnectDistSq = maxConnectDist * maxConnectDist;
        const count = this.particles.length;
        const stride = count > 540 ? 2 : 1;

        for (let i = 0; i < count; i += stride) {
            const p1 = this.particles[i];
            if (p1.depthTier === 'FOREGROUND') continue; // Пыль переднего плана не входит в граф
            let connections = 0;

            for (let j = i + stride; j < count; j += stride) {
                const p2 = this.particles[j];
                if (p2.depthTier === 'FOREGROUND') continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxConnectDistSq && distSq > 64) {
                    const dist = Math.sqrt(distSq);
                    const strength = 1.0 - dist / maxConnectDist;
                    const edgeId = `${p1.id}_${p2.id}`;

                    // Классификация ребра: Магистраль (A), Второстепенный мост (B) или Дендрит (C)
                    let edgeClass: NexusEdgeClass = 'DENDRITE';
                    if (p1.id % 9 === 0 && dist > maxConnectDist * 0.52) {
                        edgeClass = 'AXON_TRUNK';
                    } else if (p1.clusterId !== p2.clusterId || connections === 0) {
                        edgeClass = 'BRIDGE';
                    }

                    // Вычисление контрольной точки квадратичной/кубической дуги со смещением по нормали
                    const midX = (p1.x + p2.x) * 0.5;
                    const midY = (p1.y + p2.y) * 0.5;
                    const normX = -dy / dist;
                    const normY = dx / dist;
                    const curveSign = ((p1.id + p2.id) % 2 === 0 ? 1 : -1);
                    const flowWave = Math.sin(simTimeSec * 0.7 + p1.phaseOffset) * 4.5;
                    const bendOffset =
                        edgeClass === 'AXON_TRUNK'
                            ? dist * 0.18 * curveSign + flowWave
                            : edgeClass === 'BRIDGE'
                                ? dist * 0.12 * curveSign
                                : dist * 0.07 * curveSign;

                    const ctrlX = midX + normX * bendOffset;
                    const ctrlY = midY + normY * bendOffset;

                    // Аппроксимация длины дуги (arc length) для постоянной скорости импульса
                    const chord1 = Math.hypot(ctrlX - p1.x, ctrlY - p1.y);
                    const chord2 = Math.hypot(p2.x - ctrlX, p2.y - ctrlY);
                    const arcLength = (dist + chord1 + chord2) * 0.5;

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

    // --------------------------------------------------------------------------
    // 7. ДВИЖЕНИЕ СВЕТОВЫХ ПАКЕТОВ И ИНТЕРФЕРЕНЦИЯ В СОМАХ НЕЙРОНОВ (FX 02)
    // --------------------------------------------------------------------------
    private updateSynapticPulses(dt: number, phase: PhaseId, nowMs: number): void {
        if (this.edges.length === 0) {
            this.pulses = [];
            return;
        }

        const maxPulses =
            phase === '01_VOID'
                ? 6
                : phase === '02_GENESIS'
                    ? 22
                    : phase === '03_EVOLUTION'
                        ? 48
                        : 60;
        const spawnChance = phase === '01_VOID' ? 0.08 : 0.65;

        if (this.pulses.length < maxPulses && Math.random() < spawnChance) {
            const candidate = this.edges[Math.floor(Math.random() * this.edges.length)];
            if (candidate) {
                this.spawnPulseOnEdge(candidate, true, 1.0, 2);
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

            // Поддерживаем afterglow на ребре, по которому идет сигнал
            this.afterglowMap.set(pulse.edgeId, Math.max(this.afterglowMap.get(pulse.edgeId) ?? 0, 0.92));

            if (pulse.progress >= 1.0) {
                // Приход сигнала в сому нейрона: проверяем окно интерференции 120-300 мс!
                const deltaArrivalMs = nowMs - pTo.lastSignalArrivalMs;
                pTo.lastSignalArrivalMs = nowMs;
                pTo.synapticCharge = Math.min(1.0, pTo.synapticCharge + 0.72);

                if (deltaArrivalMs >= 20 && deltaArrivalMs <= 300 && nowMs > pTo.cooldownUntilMs) {
                    // Вспышка интерференции двух совпавших сигналов + рефрактерная пауза 320 мс
                    pTo.interferenceFlash = 1.0;
                    pTo.cooldownUntilMs = nowMs + 320;
                    universeStore.emitEvent('signal:arrived', undefined, { nodeId: pTo.id, interference: true });
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

        pFrom.synapticCharge = Math.min(1.0, pFrom.synapticCharge + 0.45);
        // Нормализуем скорость по длине дуги (arcLength), чтобы пакет шел равномерно
        const worldSpeedPxPerSec = edge.edgeClass === 'AXON_TRUNK' ? 165 : 125;
        const normalizedSpeed = worldSpeedPxPerSec / Math.max(45, edge.arcLength);

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
            bodyLength: 0.11, // 11% длины ребра (в рамках 6-14% по спец. FX 02)
            tailLength: 0.18, // 18% мягкого хвоста позади (в рамках 10-22%)
            intensity,
            cascadeDepth,
        });
    }

    private triggerCascadeFromNode(nodeIndex: number, prevIndex: number, remainingDepth: number): void {
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            if (edge.fromIndex === nodeIndex && edge.toIndex !== prevIndex) {
                this.spawnPulseOnEdge(edge, true, 0.85, remainingDepth);
                break;
            }
            if (edge.toIndex === nodeIndex && edge.fromIndex !== prevIndex) {
                this.spawnPulseOnEdge(edge, false, 0.85, remainingDepth);
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