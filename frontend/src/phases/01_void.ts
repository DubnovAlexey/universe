// ============================================================================
// ФАЙЛ: frontend/src/phases/01_void.ts
// НАЗНАЧЕНИЕ: Ядро симуляции частиц, 5 фаз эволюции и Нейронной Сети Вселенной
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Хранит 3D-состояние квантовых узлов (звезд-нейронов) и их мембранный потенциал.
// 2. Координирует астрофизику всех 5 фаз (от Пустоты до Сингулярности).
// 3. Выстраивает топологический граф связей (аксонов и дендритов космической паутины).
// 4. Моделирует движение синаптических импульсов (мыслей) от нейрона к нейрону.
// ============================================================================

import type { PhaseId } from '../store/universeState';
import { UNIVERSE_PHASES } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { applyGenesisPhysics } from './02_genesis';
import { applyEvolutionPhysics } from './03_evolution';
import { applyCollapsePhysics } from './04_collapse';
import { applySingularityPhysics } from './05_singularity';

// ----------------------------------------------------------------------------
// 1. СТРУКТУРЫ ДАННЫХ: КВАНТОВЫЙ НЕЙРОН, АКСОННАЯ СВЯЗЬ И СИНАПТИЧЕСКИЙ ИМПУЛЬС
// ----------------------------------------------------------------------------
export interface QuantumParticle {
    id: number;
    x: number;
    y: number;
    depthZ: number;       // 3D-глубина (0.3 — далекий слой коры, 1.5 — ближний план)
    vx: number;
    vy: number;
    mass: number;
    radius: number;
    energy: number;       // Базовая светимость звезды / мембранный потенциал нейрона (0..1)
    synapticCharge: number; // Вспышка при получении нейронного сигнала (0..1)
    phaseOffset: number;
    quantumSpin: number;
}

export interface TopologyEdge {
    fromIndex: number;
    toIndex: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: number;        // Проводимость аксона / натяжение гравитационной нити (0..1)
    truthVisibility: number; // Степень обнажения нейронной структуры сквозь Иллюзию (0..1)
}

export interface SynapticPulse {
    fromIndex: number;
    toIndex: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    progress: number;     // Положение сигнала вдоль нити аксона (0.0 -> 1.0)
    speed: number;        // Скорость передачи потенциала действия
    intensity: number;    // Яркость нейронного импульса
    cascadeDepth: number; // Глубина цепочки передачи мысли (чтобы импульс шел дальше по сети)
}

// ----------------------------------------------------------------------------
// 2. КЛАСС СИМУЛЯЦИИ КОСМИЧЕСКОГО МОЗГА И ФИЗИЧЕСКОГО ПОЛЯ
// ----------------------------------------------------------------------------
export class VoidPhaseSimulation {
    private particles: QuantumParticle[] = [];
    private edges: TopologyEdge[] = [];
    private pulses: SynapticPulse[] = [];
    private width = 1920;
    private height = 1080;

    constructor(initialWidth = 1920, initialHeight = 1080) {
        this.width = initialWidth;
        this.height = initialHeight;
        this.respawnParticles(UNIVERSE_PHASES['01_VOID'].targetParticleCount);
    }

    // Масштабирование координат при ресайзе окна
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

    // Динамическая подстройка числа звезд-нейронов под текущую фазу
    public syncParticleCount(targetCount: number): void {
        const cappedTarget = Math.min(targetCount, 950);
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

    // Полное пересоздание ансамбля частиц
    public respawnParticles(count: number): void {
        const cappedCount = Math.min(count, 950);
        this.particles = [];
        this.pulses = [];
        for (let i = 0; i < cappedCount; i++) {
            this.particles.push(this.createSingleParticle(i));
        }
    }

    // Генерация одного квантового узла (звезды / сомы нейрона)
    private createSingleParticle(id: number): QuantumParticle {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 22;
        const depthZ = 0.35 + Math.random() * 1.15;
        return {
            id,
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            depthZ,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            mass: 0.6 + depthZ * 1.2,
            radius: (1.1 + Math.random() * 2.2) * depthZ,
            energy: 0.25 + Math.random() * 0.75,
            synapticCharge: 0,
            phaseOffset: Math.random() * Math.PI * 2,
            quantumSpin: id % 2 === 0 ? 1 : -1,
        };
    }

    // --------------------------------------------------------------------------
    // 3. ГЛАВНЫЙ ШАГ ФИЗИКИ И НЕЙРОННОЙ АКТИВНОСТИ (ВЫЗЫВАЕТСЯ КАЖДЫЙ КАДР)
    // --------------------------------------------------------------------------
    public update(
        dtSeconds: number,
        phase: PhaseId,
        timeScale: number,
        gravityMultiplier: number,
        simTimeSec: number
    ): void {
        const dt = Math.min(dtSeconds, 0.05) * timeScale;
        const phaseMeta = UNIVERSE_PHASES[phase];

        this.syncParticleCount(phaseMeta.targetParticleCount);

        const stressState = stressStore.getState();
        const centerX = this.width * 0.5;
        const centerY = this.height * 0.5;
        const effectiveGravity = phaseMeta.baseGravity * gravityMultiplier;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // 1. Вызов астрофизического модуля соответствующей фазы
            switch (phase) {
                case '01_VOID':
                    this.applyVoidPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity);
                    break;
                case '02_GENESIS':
                    applyGenesisPhysics(p, centerX, centerY, dt, simTimeSec, effectiveGravity);
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

            // 2. Реакция на курсор Наблюдателя (прорыв ткани реальности и стимуляция нейронов)
            if (stressState.isPointerInside) {
                const dxPtr = p.x - stressState.pointerX;
                const dyPtr = p.y - stressState.pointerY;
                const distPtr = Math.sqrt(dxPtr * dxPtr + dyPtr * dyPtr) + 0.1;
                const influenceRadius = Math.max(155, stressState.currentBreachRadius * 1.3);

                if (distPtr < influenceRadius) {
                    const factor = 1.0 - distPtr / influenceRadius;
                    // Курсор возбуждает синаптический заряд ближайших узлов
                    p.synapticCharge = Math.min(1.0, p.synapticCharge + factor * dt * 3.5);

                    if (stressState.isBreaching) {
                        const swirlX = -dyPtr / distPtr;
                        const swirlY = dxPtr / distPtr;
                        p.vx += (swirlX * 185 + (dxPtr / distPtr) * 75) * factor * dt;
                        p.vy += (swirlY * 185 + (dyPtr / distPtr) * 75) * factor * dt;
                    } else {
                        p.vx += (dxPtr / distPtr) * 32 * factor * dt;
                        p.vy += (dyPtr / distPtr) * 32 * factor * dt;
                    }
                }
            }

            // 3. Плавное затухание синаптической вспышки нейрона
            if (p.synapticCharge > 0) {
                p.synapticCharge = Math.max(0, p.synapticCharge - dt * 1.6);
            }

            // 4. Вязкое трение и интеграция координат с 3D-параллаксом
            const damping = phase === '05_SINGULARITY' ? 0.968 : 0.986;
            p.vx *= damping;
            p.vy *= damping;

            const parallaxFactor = 0.52 + p.depthZ * 0.56;
            p.x += p.vx * parallaxFactor * dt;
            p.y += p.vy * parallaxFactor * dt;

            // 5. Тороидальное замыкание границ пространства
            const margin = 24;
            if (p.x < -margin) p.x = this.width + margin;
            if (p.x > this.width + margin) p.x = -margin;
            if (p.y < -margin) p.y = this.height + margin;
            if (p.y > this.height + margin) p.y = -margin;
        }

        // Перестраиваем граф связей (аксонов) и двигаем синаптические сигналы
        this.buildTopologyEdges();
        this.updateSynapticPulses(dt, phase);
    }

    // Волновая физика Фазы 01 (Квантовый вакуум и зарождение первых нейронных связей)
    private applyVoidPhysics(
        p: QuantumParticle,
        centerX: number,
        centerY: number,
        dt: number,
        simTimeSec: number,
        effectiveGravity: number
    ): void {
        const waveX = Math.sin(simTimeSec * 0.8 + p.phaseOffset + p.y * 0.004) * 15;
        const waveY = Math.cos(simTimeSec * 0.65 + p.phaseOffset + p.x * 0.004) * 15;

        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1.0;

        p.vx += (waveX + (dx / dist) * effectiveGravity * 14) * dt;
        p.vy += (waveY + (dy / dist) * effectiveGravity * 14) * dt;
        p.energy = 0.3 + 0.7 * Math.abs(Math.sin(simTimeSec * 1.1 + p.phaseOffset));
    }

    // --------------------------------------------------------------------------
    // 4. ПОСТРОЕНИЕ ТОПОЛОГИЧЕСКОГО ГРАФА (КОСМИЧЕСКАЯ ПАУТИНА / АКСОНЫ МОЗГА)
    // --------------------------------------------------------------------------
    private buildTopologyEdges(): void {
        this.edges = [];
        const maxConnectDist = 115;
        const maxConnectDistSq = maxConnectDist * maxConnectDist;
        const count = this.particles.length;
        const stride = count > 520 ? 2 : 1;

        for (let i = 0; i < count; i += stride) {
            const p1 = this.particles[i];
            let connectionsForParticle = 0;

            for (let j = i + stride; j < count; j += stride) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxConnectDistSq) {
                    const dist = Math.sqrt(distSq);
                    const strength = 1.0 - dist / maxConnectDist;
                    const midX = (p1.x + p2.x) * 0.5;
                    const midY = (p1.y + p2.y) * 0.5;
                    const truthVisibility = stressStore.getTruthRevealFactorAt(midX, midY);

                    this.edges.push({
                        fromIndex: i,
                        toIndex: j,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y,
                        strength,
                        truthVisibility,
                    });

                    connectionsForParticle++;
                    if (connectionsForParticle >= 4) break;
                }
            }
        }
    }

    // --------------------------------------------------------------------------
    // 5. СИМУЛЯЦИЯ НЕЙРОННЫХ ИМПУЛЬСОВ (ПОТЕНЦИАЛОВ ДЕЙСТВИЯ В МЕГА-МОЗГЕ)
    // --------------------------------------------------------------------------
    private updateSynapticPulses(dt: number, phase: PhaseId): void {
        if (this.edges.length === 0) {
            this.pulses = [];
            return;
        }

        // 1. Спонтанное зарождение новых мыслей-импульсов в сети (чаще в Эволюции и Коллапсе)
        const maxPulses = phase === '01_VOID' ? 28 : 65;
        const spawnRate = phase === '01_VOID' ? 0.35 : 0.85;

        if (this.pulses.length < maxPulses && Math.random() < spawnRate) {
            const randomEdge = this.edges[Math.floor(Math.random() * this.edges.length)];
            if (randomEdge) {
                const forward = Math.random() > 0.5;
                const startIdx = forward ? randomEdge.fromIndex : randomEdge.toIndex;
                const endIdx = forward ? randomEdge.toIndex : randomEdge.fromIndex;
                this.spawnPulseBetween(startIdx, endIdx, 1.0, 2);
            }
        }

        // 2. Движение существующих импульсов вдоль нитей и каскадная передача следующим нейронам
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const pulse = this.pulses[i];
            const pFrom = this.particles[pulse.fromIndex];
            const pTo = this.particles[pulse.toIndex];

            if (!pFrom || !pTo) {
                this.pulses.splice(i, 1);
                continue;
            }

            // Привязываем концы траектории к живым координатам звезд-нейронов
            pulse.x1 = pFrom.x;
            pulse.y1 = pFrom.y;
            pulse.x2 = pTo.x;
            pulse.y2 = pTo.y;

            pulse.progress += pulse.speed * dt;

            // Когда сигнал дошел до целевого нейрона — зажигаем его и передаем импульс дальше!
            if (pulse.progress >= 1.0) {
                pTo.synapticCharge = Math.min(1.0, pTo.synapticCharge + 0.85);

                if (pulse.cascadeDepth > 0 && this.pulses.length < maxPulses) {
                    this.triggerCascadeFromNode(pulse.toIndex, pulse.fromIndex, pulse.cascadeDepth - 1);
                }

                this.pulses.splice(i, 1);
            }
        }
    }

    // Запуск одного синаптического сигнала между двумя узлами
    private spawnPulseBetween(
        fromIndex: number,
        toIndex: number,
        intensity: number,
        cascadeDepth: number
    ): void {
        const pFrom = this.particles[fromIndex];
        const pTo = this.particles[toIndex];
        if (!pFrom || !pTo) return;

        pFrom.synapticCharge = Math.min(1.0, pFrom.synapticCharge + 0.6);

        this.pulses.push({
            fromIndex,
            toIndex,
            x1: pFrom.x,
            y1: pFrom.y,
            x2: pTo.x,
            y2: pTo.y,
            progress: 0,
            speed: 1.6 + Math.random() * 1.4,
            intensity,
            cascadeDepth,
        });
    }

    // Каскадное ветвление сигнала (когда возбужденный нейрон передает сигнал соседям)
    private triggerCascadeFromNode(nodeIndex: number, previousNodeIndex: number, remainingDepth: number): void {
        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            if (edge.fromIndex === nodeIndex && edge.toIndex !== previousNodeIndex) {
                this.spawnPulseBetween(nodeIndex, edge.toIndex, 0.85, remainingDepth);
                break;
            }
            if (edge.toIndex === nodeIndex && edge.fromIndex !== previousNodeIndex) {
                this.spawnPulseBetween(nodeIndex, edge.fromIndex, 0.85, remainingDepth);
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