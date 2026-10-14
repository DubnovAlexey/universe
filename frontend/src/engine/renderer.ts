// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Главный движок рендеринга 5D-инсталляции (Космос как Нейросеть Мозга)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Управляет циклом отрисовки высокой четкости (60–144+ FPS).
// 2. Рисует многослойные объемные туманности (Nebula Clouds) в мире Иллюзии.
// 3. Визуализирует синаптическую сеть (аксоны, дендриты и бегущие импульсы мыслей).
// 4. Проявляет сквозь Линзу Разрыва (Breach Lens) математическую изнанку и векторы Истины.
// ============================================================================

import { universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { VoidPhaseSimulation } from '../phases/01_void';
import { RenderPipeline } from './pipeline';
import { audioSync } from '../utils/audioSync';

export class UniverseRenderer {
    private pipeline: RenderPipeline;
    private simulation: VoidPhaseSimulation;
    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    private simulationTimeSec = 0;
    private phaseElapsedSec = 0;
    private smoothedFps = 60;

    constructor(canvas: HTMLCanvasElement) {
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.simulation = new VoidPhaseSimulation(caps.viewportWidth, caps.viewportHeight);

        this.bindEvents();
    }

    // --------------------------------------------------------------------------
    // 1. ПРИВЯЗКА СОБЫТИЙ ОКНА И КУРСОРА НАБЛЮДАТЕЛЯ
    // --------------------------------------------------------------------------
    private bindEvents(): void {
        window.addEventListener('resize', () => {
            const { width, height } = this.pipeline.updateViewportSize();
            this.simulation.resize(width, height);
        });

        window.addEventListener('pointermove', (e: PointerEvent) => {
            const caps = this.pipeline.getCapabilities();
            stressStore.updatePointer(e.clientX, e.clientY, caps.viewportWidth, caps.viewportHeight);
        });

        window.addEventListener('pointerdown', (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('[data-ui-panel="true"]')) return;
            stressStore.setBreaching(true, true);
            audioSync.triggerShockwavePulse(0.85);
        });

        window.addEventListener('pointerup', () => {
            stressStore.setBreaching(false, false);
        });

        window.addEventListener('pointerleave', () => {
            stressStore.clearPointer();
        });
    }

    // --------------------------------------------------------------------------
    // 2. ЗАПУСК И ОСТАНОВКА ГЛАВНОГО ЦИКЛА РЕНДЕРИНГА
    // --------------------------------------------------------------------------
    public start(): void {
        if (this.animationFrameId !== null) return;
        this.lastTimestamp = performance.now();
        const loop = (now: number) => {
            this.tick(now);
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    public stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // --------------------------------------------------------------------------
    // 3. ВЫПОЛНЕНИЕ ОДНОГО КАДРА СИМУЛЯЦИИ И ОТРИСОВКИ
    // --------------------------------------------------------------------------
    private tick(now: number): void {
        const rawDeltaMs = Math.max(1, now - this.lastTimestamp);
        this.lastTimestamp = now;
        const dtSeconds = Math.min(rawDeltaMs / 1000, 0.05);

        const currentInstantFps = 1000 / rawDeltaMs;
        this.smoothedFps = this.smoothedFps * 0.92 + currentInstantFps * 0.08;

        const uState = universeStore.getState();

        stressStore.setTargetStress(uState.phaseMeta.baseEntropy);
        stressStore.stepPhysics(dtSeconds);

        const sState = stressStore.getState();

        audioSync.updateRealtimeModulation(
            sState.currentBreachRadius,
            sState.isBreaching,
            sState.globalStress,
            uState.layers.layer5_truthXRayMode
        );

        if (!uState.isPaused) {
            this.simulationTimeSec += dtSeconds * uState.timeScale;
            this.phaseElapsedSec += dtSeconds * uState.timeScale;

            this.simulation.update(
                dtSeconds,
                uState.currentPhase,
                uState.timeScale,
                uState.gravityMultiplier,
                this.simulationTimeSec
            );
        }

        this.renderScene();

        universeStore.updateTelemetry({
            fps: Math.round(this.smoothedFps),
            frameTimeMs: Number(rawDeltaMs.toFixed(1)),
            activeParticles: this.simulation.getParticles().length,
            activeConnections: this.simulation.getEdges().length,
            simulationTimeSec: Number(this.simulationTimeSec.toFixed(1)),
            phaseElapsedSec: Number(this.phaseElapsedSec.toFixed(1)),
        });
    }

    // --------------------------------------------------------------------------
    // 4. ОТРИСОВКА КОСМИЧЕСКОЙ ИЛЛЮЗИИ, НЕЙРОСЕТИ И МАТРИЦЫ ИСТИНЫ
    // --------------------------------------------------------------------------
    private renderScene(): void {
        const ctx = this.pipeline.getContext();
        const { viewportWidth: width, viewportHeight: height } = this.pipeline.getCapabilities();
        const uState = universeStore.getState();
        const sState = stressStore.getState();
        const colors = uState.phaseMeta.colors;
        const fullTruthXRay = uState.layers.layer5_truthXRayMode;

        // 1. Заливка глубокого фона вакуума
        ctx.fillStyle = colors.backgroundVoid;
        ctx.fillRect(0, 0, width, height);

        // 2. Дышащие объемные туманности / доли Космического Мозга (Мир Иллюзии)
        if (uState.layers.layer1_illusionCanvas && !fullTruthXRay) {
            this.renderCosmicNebulaClouds(ctx, width, height, colors.illusionPrimary, colors.illusionSecondary);
        }

        // 3. Отрисовка математической координатной сетки Истины (внутри Линзы Разрыва)
        this.renderTruthCoordinateGrid(ctx, width, height, colors.truthWireframe, fullTruthXRay);

        // 4. Отрисовка аксонных связей и бегущих синаптических импульсов (Слой 3)
        if (uState.layers.layer3_topologyGraph) {
            this.renderTopologyGraphAndSynapses(
                ctx,
                colors.illusionPrimary,
                colors.illusionSecondary,
                colors.truthWireframe,
                fullTruthXRay
            );
        }

        // 5. Отрисовка звезд-нейронов (Иллюзия снаружи, векторы и сомы внутри Разрыва)
        if (uState.layers.layer1_illusionCanvas || fullTruthXRay) {
            this.renderParticles(
                ctx,
                colors.illusionPrimary,
                colors.illusionSecondary,
                colors.truthWireframe,
                fullTruthXRay
            );
        }

        // 6. Отрисовка Линзы Разрыва (Breach Lens) и гравитационных волн
        this.renderBreachLensAndWaves(ctx, sState, colors.truthWireframe, fullTruthXRay);
    }

    // Многослойное объемное свечение туманностей
    private renderCosmicNebulaClouds(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        primaryHex: string,
        secondaryHex: string
    ): void {
        const t = this.simulationTimeSec * 0.25;
        const cx = width * 0.5 + Math.cos(t) * 90;
        const cy = height * 0.5 + Math.sin(t * 0.8) * 65;
        const radius = Math.max(width, height) * 0.58;

        const grad1 = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
        grad1.addColorStop(0, RenderPipeline.hexToRgba(primaryHex, 0.14));
        grad1.addColorStop(0.45, RenderPipeline.hexToRgba(secondaryHex, 0.06));
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);

        // Второе смещенное облако для ощущения 3D-глубины
        const cx2 = width * 0.5 - Math.sin(t * 0.6) * 160;
        const cy2 = height * 0.5 + Math.cos(t * 0.9) * 110;
        const grad2 = ctx.createRadialGradient(cx2, cy2, 20, cx2, cy2, radius * 0.75);
        grad2.addColorStop(0, RenderPipeline.hexToRgba(secondaryHex, 0.1));
        grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);
    }

    // Математическая сетка мира Истины внутри Линзы Разрыва
    private renderTruthCoordinateGrid(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        truthColor: string,
        fullXRay: boolean
    ): void {
        const sState = stressStore.getState();
        if (!fullXRay && sState.currentBreachRadius < 5 && sState.globalStress < 0.65) return;

        const gridStep = 64;
        ctx.save();
        ctx.lineWidth = 1;

        if (!fullXRay && sState.currentBreachRadius > 5) {
            ctx.beginPath();
            ctx.arc(sState.pointerX, sState.pointerY, sState.currentBreachRadius, 0, Math.PI * 2);
            ctx.clip();
        }

        ctx.strokeStyle = RenderPipeline.hexToRgba(truthColor, fullXRay ? 0.12 : 0.2);
        ctx.beginPath();
        for (let x = 0; x < width; x += gridStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += gridStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Отрисовка аксонных нитей графа и бегущих синаптических импульсов
    private renderTopologyGraphAndSynapses(
        ctx: CanvasRenderingContext2D,
        primaryHex: string,
        secondaryHex: string,
        truthColor: string,
        fullXRay: boolean
    ): void {
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        // 1. Рисуем нити графа (дендриты и аксоны космической паутины)
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const truthFactor = fullXRay ? 1.0 : edge.truthVisibility;

            if (truthFactor > 0.15) {
                ctx.lineWidth = 1.15;
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    truthColor,
                    Math.min(0.88, edge.strength * truthFactor * 0.95)
                );
            } else {
                ctx.lineWidth = 0.85;
                ctx.strokeStyle = RenderPipeline.hexToRgba(secondaryHex, edge.strength * 0.22);
            }

            ctx.beginPath();
            ctx.moveTo(edge.x1, edge.y1);
            ctx.lineTo(edge.x2, edge.y2);
            ctx.stroke();
        }

        // 2. Рисуем бегущие по нитям синаптические импульсы (потенциалы действия)
        for (let i = 0; i < pulses.length; i++) {
            const pulse = pulses[i];
            const curX = pulse.x1 + (pulse.x2 - pulse.x1) * pulse.progress;
            const curY = pulse.y1 + (pulse.y2 - pulse.y1) * pulse.progress;

            // Координата хвоста импульса для эффекта летящей кометы/разряда
            const tailProgress = Math.max(0, pulse.progress - 0.22);
            const tailX = pulse.x1 + (pulse.x2 - pulse.x1) * tailProgress;
            const tailY = pulse.y1 + (pulse.y2 - pulse.y1) * tailProgress;

            const isInsideTruth = stressStore.getTruthRevealFactorAt(curX, curY, fullXRay) > 0.4;
            const pulseColor = isInsideTruth ? truthColor : primaryHex;

            // Линия электрического шлейфа
            ctx.strokeStyle = RenderPipeline.hexToRgba(pulseColor, 0.78 * pulse.intensity);
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(curX, curY);
            ctx.stroke();

            // Яркая головка синаптического сигнала
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, curY, 2.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Дуальная отрисовка звезд-нейронов
    private renderParticles(
        ctx: CanvasRenderingContext2D,
        primaryHex: string,
        secondaryHex: string,
        truthHex: string,
        fullXRay: boolean
    ): void {
        const particles = this.simulation.getParticles();

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const truthFactor = stressStore.getTruthRevealFactorAt(p.x, p.y, fullXRay);
            const synapticBoost = p.synapticCharge;

            if (truthFactor < 0.5) {
                // МИР ИЛЛЮЗИИ: Сияющая звезда / сома нейрона с биолюминесцентным ореолом
                const alpha = Math.min(1.0, 0.35 + p.energy * 0.55 + synapticBoost * 0.45);
                const color = synapticBoost > 0.25 ? truthHex : i % 2 === 0 ? primaryHex : secondaryHex;
                const haloRadius = p.radius * (3.2 + synapticBoost * 2.8);

                // Внешний мягкий ореол
                ctx.fillStyle = RenderPipeline.hexToRgba(color, alpha * (0.2 + synapticBoost * 0.25));
                ctx.beginPath();
                ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
                ctx.fill();

                // Яркое ядро звезды-нейрона
                ctx.fillStyle = RenderPipeline.hexToRgba('#ffffff', alpha);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius * (1.0 + synapticBoost * 0.4), 0, Math.PI * 2);
                ctx.fill();
            } else {
                // МИР ИСТИНЫ: Математический узел + вектор импульса
                ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, 0.88);
                ctx.lineWidth = 1.15;

                const boxSize = p.radius * (2.2 + synapticBoost * 1.2);
                ctx.strokeRect(p.x - boxSize * 0.5, p.y - boxSize * 0.5, boxSize, boxSize);

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx * 0.35, p.y + p.vy * 0.35);
                ctx.stroke();
            }
        }
    }

    // Отрисовка кольца Разрыва (Breach Lens) и гравитационных волн
    private renderBreachLensAndWaves(
        ctx: CanvasRenderingContext2D,
        sState: ReturnType<typeof stressStore.getState>,
        truthHex: string,
        fullXRay: boolean
    ): void {
        if (!fullXRay && sState.isPointerInside && sState.currentBreachRadius > 2) {
            ctx.save();

            // Мягкая подсветка линзы изнутри
            const lensGrad = ctx.createRadialGradient(
                sState.pointerX,
                sState.pointerY,
                sState.currentBreachRadius * 0.2,
                sState.pointerX,
                sState.pointerY,
                sState.currentBreachRadius
            );
            lensGrad.addColorStop(0, RenderPipeline.hexToRgba(truthHex, 0.07));
            lensGrad.addColorStop(1, RenderPipeline.hexToRgba(truthHex, 0.0));
            ctx.fillStyle = lensGrad;
            ctx.beginPath();
            ctx.arc(sState.pointerX, sState.pointerY, sState.currentBreachRadius, 0, Math.PI * 2);
            ctx.fill();

            // Контур сканера Истины
            ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, sState.isBreaching ? 0.92 : 0.45);
            ctx.lineWidth = sState.isBreaching ? 2.0 : 1.1;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(sState.pointerX, sState.pointerY, sState.currentBreachRadius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = RenderPipeline.hexToRgba(truthHex, 0.78);
            ctx.font = '10px monospace';
            ctx.fillText(
                `SYNAPTIC_LENS: ${Math.round(sState.currentBreachRadius)}px | X:${Math.round(sState.pointerX)} Y:${Math.round(sState.pointerY)}`,
                sState.pointerX + 14,
                sState.pointerY - 10
            );
            ctx.restore();
        }

        for (let i = 0; i < sState.shockwaves.length; i++) {
            const wave = sState.shockwaves[i];
            ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, wave.life * 0.65);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.currentRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}