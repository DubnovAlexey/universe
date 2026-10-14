// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Главный режиссерский рендерер 5 Образов Вселенной и Нейро-Мозга
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Управляет 4 планами глубины (Deep Layer, Background, Midground, Foreground Bokeh) и камерой.
// 2. FX 01: Рисует анизотропные туманности с темными пылевыми каньонами-тенями,
//    внутренним освещением от активных сом, контровым rim-light и силовыми волокнами (filaments).
// 3. FX 02: Рисует скульптурные полушария Головного Мозга с извилинами, 3 класса сплайнов Безье,
//    ветвящиеся кроны дендритов, кометы синаптических импульсов и кольца озарения нейронов.
// 4. FX 03: Реализует оптическую мембрану BREACH LENS с преломлением звезд на кромке,
//    ветвящимися микротрещинами и неперекрывающимися научными выносками (Optical Callouts).
// 5. FX 04: Исполняет финал LOGIC -> 2.5с ZERO_SILENCE -> 5-шаговую сборку голограммы GitHub.
// ============================================================================

import { universeStore, type PhaseId } from '../store/universeState';
import { stressStore } from '../store/stressState';
import {
    VoidPhaseSimulation,
    BRAIN_HEMISPHERE_LOBES,
    type QuantumParticle,
    type TopologyEdge,
    type SynapticPulse,
} from '../phases/01_void';
import { RenderPipeline } from './pipeline';
import { audioSync } from '../utils/audioSync';

// ----------------------------------------------------------------------------
// 1. ЦВЕТОВАЯ И СВЕТОТЕНЕВАЯ ДРАМАТУРГИЯ КАЖДОГО ИЗ 5 ОБРАЗОВ
// ----------------------------------------------------------------------------
interface PhaseVisualTheme {
    bgCenter: string;
    bgMid: string;
    bgEdge: string;
    nebulaPrimary: string;
    nebulaSecondary: string;
    nebulaShadow: string;
    rimLightColor: string;
    axonColor: string;
    pulseHeadColor: string;
    pulseTailColor: string;
    somaCoreColor: string;
    somaHaloColor: string;
}

const PHASE_VISUAL_THEMES: Record<PhaseId, PhaseVisualTheme> = {
    '01_VOID': {
        bgCenter: '#070f26',
        bgMid: '#040814',
        bgEdge: '#020308',
        nebulaPrimary: '#1e3a8a',
        nebulaSecondary: '#312e81',
        nebulaShadow: '#02040a',
        rimLightColor: '#7dd3fc',
        axonColor: '#38bdf8',
        pulseHeadColor: '#fef08a',
        pulseTailColor: '#38bdf8',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#7dd3fc',
    },
    '02_GENESIS': {
        bgCenter: '#160a2c',
        bgMid: '#090618',
        bgEdge: '#03040c',
        nebulaPrimary: '#9333ea',
        nebulaSecondary: '#06b6d4',
        nebulaShadow: '#05030d',
        rimLightColor: '#67e8f9',
        axonColor: '#22d3ee',
        pulseHeadColor: '#fde047',
        pulseTailColor: '#f59e0b',
        somaCoreColor: '#fef9c3',
        somaHaloColor: '#c084fc',
    },
    '03_EVOLUTION': {
        bgCenter: '#061c30',
        bgMid: '#040e1d',
        bgEdge: '#02050d',
        nebulaPrimary: '#00f5d4',
        nebulaSecondary: '#6366f1',
        nebulaShadow: '#030712',
        rimLightColor: '#5eead4',
        axonColor: '#00f5d4',
        pulseHeadColor: '#ffffff',
        pulseTailColor: '#f59e0b',
        somaCoreColor: '#ffffff',
        somaHaloColor: '#00f5d4',
    },
    '04_COLLAPSE': {
        bgCenter: '#22091a',
        bgMid: '#110612',
        bgEdge: '#040308',
        nebulaPrimary: '#f43f5e',
        nebulaSecondary: '#f59e0b',
        nebulaShadow: '#060309',
        rimLightColor: '#fda4af',
        axonColor: '#fb7185',
        pulseHeadColor: '#ffffff',
        pulseTailColor: '#38bdf8',
        somaCoreColor: '#fff1f2',
        somaHaloColor: '#f97316',
    },
    '05_SINGULARITY': {
        bgCenter: '#1f1306',
        bgMid: '#0d0905',
        bgEdge: '#020205',
        nebulaPrimary: '#f59e0b',
        nebulaSecondary: '#38bdf8',
        nebulaShadow: '#020204',
        rimLightColor: '#fde047',
        axonColor: '#fde047',
        pulseHeadColor: '#ffffff',
        pulseTailColor: '#38bdf8',
        somaCoreColor: '#ffffff',
        somaHaloColor: '#fbbf24',
    },
};

export class UniverseRenderer {
    private pipeline: RenderPipeline;
    private simulation: VoidPhaseSimulation;
    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    private simulationTimeSec = 0;
    private phaseElapsedSec = 0;
    private lastTrackedPhase: PhaseId = universeStore.getState().currentPhase;
    private lastTrackedCycle = universeStore.getState().cycleCount;
    private restartCollapseElapsed = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.simulation = new VoidPhaseSimulation(caps.viewportWidth, caps.viewportHeight);
        this.bindEvents();
    }

    // --------------------------------------------------------------------------
    // 2. ПРИВЯЗКА СОБЫТИЙ МЫШИ, TOUCH-КАСАНИЙ, ВКЛАДКИ И ОЧИСТКИ РЕСУРСОВ
    // --------------------------------------------------------------------------
    private bindEvents(): void {
        window.addEventListener('resize', () => {
            const { width, height } = this.pipeline.updateViewportSize();
            this.simulation.resize(width, height);
        });

        window.addEventListener('pagehide', () => {
            this.stop();
        });

        document.addEventListener('visibilitychange', () => {
            universeStore.setTabHidden(document.hidden);
            if (!document.hidden) {
                this.lastTimestamp = performance.now();
            }
        });

        window.addEventListener('pointermove', (e: PointerEvent) => {
            const caps = this.pipeline.getCapabilities();
            stressStore.updatePointer(e.clientX, e.clientY, caps.viewportWidth, caps.viewportHeight);
        });

        window.addEventListener('pointerdown', (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('[data-ui-panel="true"], [data-github-card="true"]')) return;
            const caps = this.pipeline.getCapabilities();
            stressStore.updatePointer(e.clientX, e.clientY, caps.viewportWidth, caps.viewportHeight);
            stressStore.setBreaching(true, true);
            audioSync.triggerShockwavePulse(0.72);
        });

        window.addEventListener('pointerup', () => {
            stressStore.setBreaching(false, false);
        });

        window.addEventListener('pointercancel', () => {
            stressStore.setBreaching(false, false);
        });

        window.addEventListener('pointerleave', () => {
            stressStore.clearPointer();
        });
    }

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
    // 3. ЕДИНЫЙ КАДРОВЫЙ ЦИКЛ СИМУЛЯЦИИ, ТАЙМЛАЙНА И РЕНДЕРИНГА
    // --------------------------------------------------------------------------
    private tick(now: number): void {
        const rawDeltaMs = Math.max(1, now - this.lastTimestamp);
        this.lastTimestamp = now;

        const uState = universeStore.getState();
        if (uState.isTabHidden) return;

        const dtSeconds = Math.min(rawDeltaMs / 1000, 0.05);

        if (
            uState.currentPhase !== this.lastTrackedPhase ||
            uState.cycleCount !== this.lastTrackedCycle
        ) {
            this.lastTrackedPhase = uState.currentPhase;
            this.lastTrackedCycle = uState.cycleCount;
            this.phaseElapsedSec = 0;
            this.restartCollapseElapsed = 0;
        }

        if (uState.singularityAct === 'RESTART_COLLAPSE') {
            this.restartCollapseElapsed += dtSeconds * 0.95;
            if (this.restartCollapseElapsed >= 1.0) {
                this.restartCollapseElapsed = 0;
                this.simulationTimeSec = 0;
                this.phaseElapsedSec = 0;
                universeStore.completeRestartToVoid();
            }
        }

        stressStore.setTargetStress(uState.phaseMeta.baseEntropy);
        stressStore.stepPhysics(dtSeconds);

        const sState = stressStore.getState();

        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            audioSync.updateRealtimeModulation(0, false, 0, false);
        } else {
            audioSync.updateRealtimeModulation(
                sState.currentBreachRadius,
                sState.isBreaching,
                sState.globalStress,
                uState.layers.layer5_truthXRayMode
            );
        }

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

        const particles = this.simulation.getParticles();
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        universeStore.updateTelemetry({
            frameTimeMs: Number(rawDeltaMs.toFixed(1)),
            activeParticles: particles.length,
            activeConnections: edges.length,
            activePulses: pulses.length,
            simulationTimeSec: Number(this.simulationTimeSec.toFixed(1)),
            phaseElapsedSec: Number(this.phaseElapsedSec.toFixed(1)),
            engineBackend: 'Canvas2D-HighDPI',
        });
    }

    // --------------------------------------------------------------------------
    // 4. ГЛАВНЫЙ КОНВЕЙЕР СЦЕНЫ: 4 ПЛАНА ГЛУБИНЫ И 5 ХУДОЖЕСТВЕННЫХ ОБРАЗОВ
    // --------------------------------------------------------------------------
    private renderScene(): void {
        const ctx = this.pipeline.getContext();
        const { viewportWidth: width, viewportHeight: height } = this.pipeline.getCapabilities();
        const uState = universeStore.getState();
        const sState = stressStore.getState();
        const theme = PHASE_VISUAL_THEMES[uState.currentPhase];
        const fullXRay = uState.layers.layer5_truthXRayMode;

        const cx = width * 0.5;
        const cy = height * 0.5;

        // 1. Многослойный глубокий вакуум с полутонами фазы
        const bgGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(width, height) * 0.74);
        bgGrad.addColorStop(0, theme.bgCenter);
        bgGrad.addColorStop(0.52, theme.bgMid);
        bgGrad.addColorStop(1, theme.bgEdge);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // АКТ C: РОВНО 2.5 СЕКУНДЫ АБСОЛЮТНОЙ НЕПОДВИЖНОЙ ТИШИНЫ (ZERO_SILENCE)
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            ctx.fillStyle = 'rgba(248, 250, 252, 0.45)';
            ctx.beginPath();
            ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // АКТ D: 5-ШАГОВАЯ ГЕОДЕЗИЧЕСКАЯ СБОРКА ИЛИ СВОРАЧИВАНИЕ КАРТОЧКИ GITHUB
        if (
            uState.singularityAct === 'ACT_D_GITHUB_CARD' ||
            uState.singularityAct === 'RESTART_COLLAPSE'
        ) {
            const progress =
                uState.singularityAct === 'RESTART_COLLAPSE'
                    ? Math.max(0, 1.0 - this.restartCollapseElapsed)
                    : uState.githubCardAssemblyProgress;
            this.renderGeodesicGitHubHologramCanvas(ctx, width, height, progress, theme);
            return;
        }

        ctx.save();
        ctx.translate(cx + uState.camera.driftX * 0.35, cy + uState.camera.driftY * 0.35);
        ctx.scale(uState.camera.zoom, uState.camera.zoom);
        ctx.translate(-cx, -cy);

        const particles = this.simulation.getParticles();
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        // 2. ЭШЕЛОН 4 (DEEP LAYER): Координатная сетка X-RAY (внутри линзы BREACH, в LOGIC или X-RAY)
        this.renderTruthCoordinateGrid(ctx, width, height, theme.axonColor, fullXRay);

        // 3. ЭШЕЛОН 3 (BACKGROUND): Уникальный центральный образ каждой из 5 фаз на весь экран
        this.renderPhaseSignatureBackdrop(ctx, width, height, cx, cy, uState.currentPhase, theme);

        // 4. FX 01: Анизотропные туманности с пылевыми тенями, подсветкой изнутри, rim-light и волокнами
        this.renderAnisotropicNebulaeWithShadows(ctx, width, height, particles, theme);
        this.renderCosmicStreamlineFilaments(ctx, width, height, theme);

        // 5. ЭШЕЛОН 2 (MIDGROUND): FX 02 — Сеть головного мозга NEXUS и кометы синаптических импульсов
        if (uState.layers.layer3_topologyGraph || fullXRay) {
            this.renderSynapticBrainNetworkAndComets(ctx, edges, pulses, theme, fullXRay);
        }

        // 6. ЭШЕЛОН 1 и 2: Многолучевые нейроны (сомы с дендритами и кольцами озарения) + Bokeh
        this.renderNeuronsAndSynapticRings(ctx, particles, theme, fullXRay);

        // 7. FX 03: Оптическая мембрана BREACH LENS с рефракцией, микротрещинами и выносками
        this.renderBreachLensAndCallouts(ctx, sState, particles, theme.axonColor, fullXRay);

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 5. УНИКАЛЬНЫЙ ЦЕНТРАЛЬНЫЙ АРХЕТИП КАЖДОЙ ИЗ 5 ФАЗ (ВО ВЕСЬ ЭКРАН 16:9)
    // --------------------------------------------------------------------------
    private renderPhaseSignatureBackdrop(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        cx: number,
        cy: number,
        phase: PhaseId,
        theme: PhaseVisualTheme
    ): void {
        const t = this.simulationTimeSec;
        ctx.save();

        if (phase === '01_VOID') {
            // ОБРАЗ 01: Гравитационные волны Квантовой Колыбели и корона Точки Нуля
            for (let r = 0; r < 6; r++) {
                const waveProg = (t * 0.22 + r / 6) % 1.0;
                const rx = width * 0.46 * waveProg;
                const ry = height * 0.42 * waveProg;
                const alpha = Math.sin(waveProg * Math.PI) * 0.22;

                ctx.strokeStyle = RenderPipeline.hexToRgba(theme.somaHaloColor, alpha);
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            const zeroGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 74);
            zeroGrad.addColorStop(0, '#ffffff');
            zeroGrad.addColorStop(0.24, RenderPipeline.hexToRgba('#f59e0b', 0.68));
            zeroGrad.addColorStop(0.58, RenderPipeline.hexToRgba(theme.axonColor, 0.24));
            zeroGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = zeroGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, 74, 0, Math.PI * 2);
            ctx.fill();
        } else if (phase === '02_GENESIS') {
            // ОБРАЗ 02: Четыре спиральных рукава Галактики и золотой бинарный центр
            const unfold = Math.min(1.0, 0.4 + universeStore.getState().telemetry.phaseProgress * 0.65);
            for (let arm = 0; arm < 4; arm++) {
                const baseA = (arm * Math.PI) / 2 - t * 0.36;
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    arm % 2 === 0 ? theme.nebulaPrimary : theme.nebulaSecondary,
                    0.22
                );
                ctx.lineWidth = 20;
                ctx.beginPath();
                for (let step = 0; step <= 28; step++) {
                    const frac = step / 28;
                    const a = baseA + frac * 2.85;
                    const px = cx + Math.cos(a) * width * 0.44 * frac * unfold;
                    const py = cy + Math.sin(a) * height * 0.38 * frac * unfold;
                    if (step === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
        } else if (phase === '03_EVOLUTION') {
            // ОБРАЗ 03: Скульптурные Левое и Правое Полушария Головного Мозга с бороздами извилин
            for (let h = -1; h <= 1; h += 2) {
                const hx = cx + h * (width * 0.19);
                const rx = width * 0.23;
                const ry = height * 0.37;

                const lobeGrad = ctx.createRadialGradient(hx, cy, 12, hx, cy, Math.max(rx, ry));
                lobeGrad.addColorStop(0, RenderPipeline.hexToRgba(theme.nebulaPrimary, 0.15));
                lobeGrad.addColorStop(0.62, RenderPipeline.hexToRgba(theme.nebulaSecondary, 0.08));
                lobeGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = lobeGrad;
                ctx.beginPath();
                ctx.ellipse(hx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();

                // Внешний и внутренний контуры коры полушария с рельефом извилин
                for (let shell = 0; shell < 2; shell++) {
                    const scale = shell === 0 ? 1.0 : 0.68;
                    ctx.strokeStyle = RenderPipeline.hexToRgba(
                        shell === 0 ? theme.axonColor : theme.nebulaSecondary,
                        shell === 0 ? 0.26 : 0.16
                    );
                    ctx.lineWidth = shell === 0 ? 1.5 : 1.0;
                    ctx.beginPath();
                    for (let s = 0; s <= 72; s++) {
                        const a = (s / 72) * Math.PI * 2;
                        const gyri =
                            1.0 +
                            0.06 * Math.sin(a * 6.0 + t * 0.8 + shell) +
                            0.04 * Math.cos(a * 10.0 - shell);
                        const px = hx + Math.cos(a) * rx * scale * gyri;
                        const py = cy + Math.sin(a) * ry * scale * gyri;
                        if (s === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }

            // Светящийся межполушарный мост (Corpus Callosum) в самом центре мозга
            const bridgeGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, width * 0.16);
            bridgeGrad.addColorStop(0, RenderPipeline.hexToRgba('#f59e0b', 0.24));
            bridgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bridgeGrad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, width * 0.16, height * 0.11, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (phase === '04_COLLAPSE') {
            // ОБРАЗ 04: Три пересекающихся гироскопических кольца шторма строго по центру экрана
            const tilts = [-0.48, 0.0, 0.48];
            for (let g = 0; g < 3; g++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(tilts[g]);
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    g === 1 ? theme.nebulaSecondary : theme.nebulaPrimary,
                    0.28
                );
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.ellipse(0, 0, width * 0.41, height * (g === 1 ? 0.36 : 0.22), 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else if (phase === '05_SINGULARITY') {
            // ОБРАЗ 05: Сверхмассивная Черная Дыра с золотым аккреционным диском и полярными джетами
            const uState = universeStore.getState();
            const collapseScale =
                uState.singularityAct === 'ACT_B_LOGIC' && uState.singularityActProgress > 0.58
                    ? Math.max(0.05, 1.0 - (uState.singularityActProgress - 0.58) / 0.42)
                    : 1.0;

            // Полярные релятивистские джеты вдоль вертикальной оси
            const jetLen = height * 0.45 * collapseScale;
            const jetGrad = ctx.createLinearGradient(cx, cy - jetLen, cx, cy + jetLen);
            jetGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            jetGrad.addColorStop(0.45, RenderPipeline.hexToRgba('#38bdf8', 0.32));
            jetGrad.addColorStop(0.5, '#ffffff');
            jetGrad.addColorStop(0.55, RenderPipeline.hexToRgba('#38bdf8', 0.32));
            jetGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.strokeStyle = jetGrad;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - jetLen);
            ctx.lineTo(cx, cy + jetLen);
            ctx.stroke();

            // Гравитационно-линзированное гало вокруг горизонта событий
            const haloR = Math.min(width, height) * 0.24 * collapseScale;
            const diskGrad = ctx.createRadialGradient(cx, cy, haloR * 0.22, cx, cy, haloR * 1.5);
            diskGrad.addColorStop(0, '#000000');
            diskGrad.addColorStop(0.24, '#ffffff');
            diskGrad.addColorStop(0.38, RenderPipeline.hexToRgba('#f59e0b', 0.85));
            diskGrad.addColorStop(0.68, RenderPipeline.hexToRgba('#38bdf8', 0.28));
            diskGrad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = diskGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, haloR * 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Наклонный экваториальный аккреционный диск на 84% ширины экрана
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-0.14);
            const eqGrad = ctx.createRadialGradient(0, 0, 18, 0, 0, width * 0.42 * collapseScale);
            eqGrad.addColorStop(0, '#ffffff');
            eqGrad.addColorStop(0.25, RenderPipeline.hexToRgba('#fde047', 0.78));
            eqGrad.addColorStop(0.6, RenderPipeline.hexToRgba('#f59e0b', 0.34));
            eqGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = eqGrad;
            ctx.beginPath();
            ctx.ellipse(
                0,
                0,
                width * 0.42 * collapseScale,
                height * 0.08 * collapseScale,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.restore();

            // Черная сфера Горизонта Событий в центре
            ctx.fillStyle = '#020205';
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(6, 34 * collapseScale), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 6. FX 01: АНИЗОТРОПНЫЕ ТУМАННОСТИ С ТЕНЯМИ, RIM-LIGHT И ВОЛОКНАМИ
    // --------------------------------------------------------------------------
    private renderAnisotropicNebulaeWithShadows(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        particles: ReadonlyArray<QuantumParticle>,
        theme: PhaseVisualTheme
    ): void {
        const t = this.simulationTimeSec;

        // Находим самую яркую активную сому для внутренней подсветки близлежащего облака
        let activeNode: QuantumParticle | null = null;
        let bestCharge = 0.25;
        for (let i = 0; i < particles.length; i += 4) {
            const p = particles[i];
            const score = p.synapticCharge + p.interferenceFlash * 1.4;
            if (score > bestCharge) {
                bestCharge = score;
                activeNode = p;
            }
        }

        for (let i = 0; i < BRAIN_HEMISPHERE_LOBES.length; i++) {
            const [normX, normY] = BRAIN_HEMISPHERE_LOBES[i];
            const lx = width * (0.5 + normX) + Math.cos(t * 0.2 + i) * 28;
            const ly = height * (0.5 + normY) + Math.sin(t * 0.18 + i) * 22;
            const rx = width * 0.22;
            const ry = height * 0.16;

            let internalLight = 0;
            if (activeNode) {
                const d = Math.hypot(activeNode.x - lx, activeNode.y - ly);
                internalLight = (bestCharge * 0.6) / (1.0 + 0.004 * d + 0.00001 * d * d);
            }

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(normX * 1.2 + Math.sin(t * 0.1 + i) * 0.12);
            ctx.scale(1.0, ry / rx);

            const color = i % 2 === 0 ? theme.nebulaPrimary : theme.nebulaSecondary;
            const alpha = Math.min(0.26, 0.13 + internalLight * 0.12);
            const grad = ctx.createRadialGradient(internalLight > 0.05 ? 22 : 0, 0, 10, 0, 0, rx);
            grad.addColorStop(0, RenderPipeline.hexToRgba(color, alpha));
            grad.addColorStop(0.55, RenderPipeline.hexToRgba(theme.nebulaSecondary, alpha * 0.48));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, rx, 0, Math.PI * 2);
            ctx.fill();

            // Холодный контровой блик (Rim Light) на гребне газовой складки
            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.06 + internalLight * 0.1);
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(0, 0, rx * 0.64, -0.7, 0.7);
            ctx.stroke();

            // Темная пылевая прожилка (каньон поглощения света) для глубоких полутеней
            const shadowGrad = ctx.createLinearGradient(0, -28, 0, 28);
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
            shadowGrad.addColorStop(0.5, RenderPipeline.hexToRgba(theme.nebulaShadow, 0.52));
            shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = shadowGrad;
            ctx.fillRect(-rx * 0.82, -28, rx * 1.64, 56);

            ctx.restore();
        }
    }

    private renderCosmicStreamlineFilaments(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        theme: PhaseVisualTheme
    ): void {
        const t = this.simulationTimeSec * 0.32;
        const cx = width * 0.5;
        const cy = height * 0.5;

        ctx.save();
        for (let f = 0; f < 8; f++) {
            const a = (f / 8) * Math.PI * 2 + t * 0.14;
            const x0 = cx + Math.cos(a) * (width * 0.08);
            const y0 = cy + Math.sin(a) * (height * 0.08);
            const x2 = cx + Math.cos(a + 0.95) * (width * 0.42);
            const y2 = cy + Math.sin(a + 0.95) * (height * 0.38);
            const cpx = (x0 + x2) * 0.5 + Math.sin(t + f * 1.9) * 90;
            const cpy = (y0 + y2) * 0.5 - Math.cos(t + f * 1.5) * 80;

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.nebulaSecondary, 0.07);
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cpx, cpy, x2, y2);
            ctx.stroke();

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.16);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cpx, cpy, x2, y2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 7. FX 02: ИЗОГНУТЫЕ АКСОНЫ МОЗГА И ЯРКИЕ КОМЕТЫ СИНАПТИЧЕСКИХ ИМПУЛЬСОВ
    // --------------------------------------------------------------------------
    private renderSynapticBrainNetworkAndComets(
        ctx: CanvasRenderingContext2D,
        edges: ReadonlyArray<TopologyEdge>,
        pulses: ReadonlyArray<SynapticPulse>,
        theme: PhaseVisualTheme,
        fullXRay: boolean
    ): void {
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const glow = edge.afterglow;
            const alpha =
                edge.edgeClass === 'AXON_TRUNK'
                    ? 0.24 + glow * 0.62
                    : edge.edgeClass === 'BRIDGE'
                        ? 0.15 + glow * 0.48
                        : 0.09 + glow * 0.35;

            const lineW =
                (edge.edgeClass === 'AXON_TRUNK' ? 1.5 : edge.edgeClass === 'BRIDGE' ? 1.0 : 0.7) +
                glow * 1.1;

            ctx.strokeStyle = RenderPipeline.hexToRgba(
                glow > 0.3 && !fullXRay ? theme.pulseTailColor : theme.axonColor,
                Math.min(0.92, alpha)
            );
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.moveTo(edge.x1, edge.y1);
            ctx.quadraticCurveTo(edge.ctrlX, edge.ctrlY, edge.x2, edge.y2);
            ctx.stroke();
        }

        for (let i = 0; i < pulses.length; i++) {
            const pulse = pulses[i];
            const tHead = pulse.progress;
            const tMid = Math.max(0, tHead - pulse.bodyLength * 0.6);
            const tTail = Math.max(0, tHead - pulse.bodyLength - pulse.tailLength);

            const headPt = this.evalBezier(pulse.x1, pulse.y1, pulse.ctrlX, pulse.ctrlY, pulse.x2, pulse.y2, tHead);
            const midPt = this.evalBezier(pulse.x1, pulse.y1, pulse.ctrlX, pulse.ctrlY, pulse.x2, pulse.y2, tMid);
            const tailPt = this.evalBezier(pulse.x1, pulse.y1, pulse.ctrlX, pulse.ctrlY, pulse.x2, pulse.y2, tTail);

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.pulseTailColor, 0.55);
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(tailPt.x, tailPt.y);
            ctx.lineTo(midPt.x, midPt.y);
            ctx.stroke();

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.pulseHeadColor, 0.95);
            ctx.lineWidth = 3.4;
            ctx.beginPath();
            ctx.moveTo(midPt.x, midPt.y);
            ctx.lineTo(headPt.x, headPt.y);
            ctx.stroke();

            const pulseGlow = ctx.createRadialGradient(headPt.x, headPt.y, 0.5, headPt.x, headPt.y, 11);
            pulseGlow.addColorStop(0, '#ffffff');
            pulseGlow.addColorStop(0.4, RenderPipeline.hexToRgba(theme.pulseTailColor, 0.75));
            pulseGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pulseGlow;
            ctx.beginPath();
            ctx.arc(headPt.x, headPt.y, 11, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private evalBezier(
        x1: number,
        y1: number,
        cx: number,
        cy: number,
        x2: number,
        y2: number,
        t: number
    ): { x: number; y: number } {
        const inv = 1 - t;
        return {
            x: inv * inv * x1 + 2 * inv * t * cx + t * t * x2,
            y: inv * inv * y1 + 2 * inv * t * cy + t * t * y2,
        };
    }

    // --------------------------------------------------------------------------
    // 8. МНОГОЛУЧЕВЫЕ НЕЙРОНЫ (СОМЫ С ДЕНДРИТАМИ И КОЛЬЦАМИ ОЗАРЕНИЯ)
    // --------------------------------------------------------------------------
    private renderNeuronsAndSynapticRings(
        ctx: CanvasRenderingContext2D,
        particles: ReadonlyArray<QuantumParticle>,
        theme: PhaseVisualTheme,
        fullXRay: boolean
    ): void {
        const uState = universeStore.getState();
        const logicW = uState.opticalWeights.logicConvergence;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.energy <= 0.03) continue;

            const refraction = stressStore.getBoundaryRefractionOffset(p.x, p.y, this.simulationTimeSec);
            const drawX = p.x + refraction.dx;
            const drawY = p.y + refraction.dy;

            if (p.depthTier === 'FOREGROUND' && !fullXRay) {
                const bokehR = p.radius * 4.5;
                const grad = ctx.createRadialGradient(drawX, drawY, 0.5, drawX, drawY, bokehR);
                grad.addColorStop(0, RenderPipeline.hexToRgba(theme.somaHaloColor, 0.16 * p.energy));
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(drawX, drawY, bokehR, 0, Math.PI * 2);
                ctx.fill();
                continue;
            }

            const truthFactor = stressStore.getTruthRevealFactorAt(p.x, p.y, fullXRay);
            const charge = p.synapticCharge;
            const flash = p.interferenceFlash;

            if (truthFactor < 0.85 || logicW > 0.2) {
                const alpha = Math.min(1.0, 0.35 + p.energy * 0.55 + charge * 0.4);
                const haloColor = flash > 0.2 ? '#f59e0b' : theme.somaHaloColor;

                if (flash > 0.05) {
                    const ringR = p.radius * (3.0 + (1.0 - flash) * 12.0);
                    ctx.strokeStyle = RenderPipeline.hexToRgba('#fde047', flash * 0.78);
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, ringR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if ((charge > 0.2 || uState.currentPhase === '03_EVOLUTION') && p.id % 5 === 0) {
                    this.renderNeuronDendrites(ctx, drawX, drawY, p.phaseOffset, 0.35 + charge * 0.55, haloColor);
                }

                const haloR = p.radius * (3.2 + charge * 2.8);
                ctx.fillStyle = RenderPipeline.hexToRgba(haloColor, alpha * 0.24);
                ctx.beginPath();
                ctx.arc(drawX, drawY, haloR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = RenderPipeline.hexToRgba(theme.somaCoreColor, alpha);
                ctx.beginPath();
                ctx.arc(drawX, drawY, p.radius * (1.0 + charge * 0.45), 0, Math.PI * 2);
                ctx.fill();
            }

            if (truthFactor >= 0.35 || logicW > 0.35) {
                const xrayAlpha = Math.max(truthFactor, logicW) * 0.85;
                ctx.strokeStyle = RenderPipeline.hexToRgba(theme.axonColor, xrayAlpha);
                ctx.lineWidth = 0.9;
                const s = p.radius * 2.2;
                ctx.strokeRect(p.x - s * 0.5, p.y - s * 0.5, s, s);

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx * 0.28, p.y + p.vy * 0.28);
                ctx.stroke();
            }
        }
    }

    private renderNeuronDendrites(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        baseAngle: number,
        intensity: number,
        colorHex: string
    ): void {
        ctx.save();
        ctx.strokeStyle = RenderPipeline.hexToRgba(colorHex, intensity * 0.48);
        ctx.lineWidth = 0.8;
        for (let d = 0; d < 4; d++) {
            const a = baseAngle + (d * Math.PI) / 2;
            const len = 9 + intensity * 11;
            const mx = x + Math.cos(a) * len;
            const my = y + Math.sin(a) * len;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(mx, my);
            ctx.lineTo(mx + Math.cos(a + 0.5) * (len * 0.65), my + Math.sin(a + 0.5) * (len * 0.65));
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(a - 0.5) * (len * 0.65), my + Math.sin(a - 0.5) * (len * 0.65));
            ctx.stroke();
        }
        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 9. FX 03 & FX 04: СЕТКА X-RAY, ОПТИЧЕСКАЯ ЛИНЗА BREACH И 5 ШАГОВ ГОЛОГРАММЫ GITHUB
    // --------------------------------------------------------------------------
    private renderTruthCoordinateGrid(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        truthColor: string,
        fullXRay: boolean
    ): void {
        const sState = stressStore.getState();
        const logicWeight = universeStore.getState().opticalWeights.logicConvergence;
        if (!fullXRay && logicWeight < 0.1 && sState.currentBreachRadius < 6) return;

        const step = 72;
        ctx.save();
        if (!fullXRay && logicWeight < 0.15 && sState.currentBreachRadius > 6) {
            ctx.beginPath();
            ctx.arc(sState.lensX, sState.lensY, sState.currentBreachRadius, 0, Math.PI * 2);
            ctx.clip();
        }

        ctx.strokeStyle = RenderPipeline.hexToRgba(truthColor, fullXRay ? 0.11 : 0.18);
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        for (let x = 0; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    private renderBreachLensAndCallouts(
        ctx: CanvasRenderingContext2D,
        sState: ReturnType<typeof stressStore.getState>,
        particles: ReadonlyArray<QuantumParticle>,
        truthHex: string,
        fullXRay: boolean
    ): void {
        if (!fullXRay && sState.isPointerInside && sState.currentBreachRadius > 4) {
            ctx.save();
            const segments = 64;
            ctx.beginPath();
            for (let i = 0; i <= segments; i++) {
                const a = (i / segments) * Math.PI * 2;
                const r = stressStore.getDeformedLensRadiusAtAngle(a, this.simulationTimeSec);
                const px = sState.lensX + Math.cos(a) * r;
                const py = sState.lensY + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, sState.isBreaching ? 0.72 : 0.28);
            ctx.lineWidth = sState.isBreaching ? 1.4 : 0.85;
            ctx.stroke();

            for (let c = 0; c < sState.microCracks.length; c++) {
                const crack = sState.microCracks[c];
                const rimR = stressStore.getDeformedLensRadiusAtAngle(crack.anchorAngle, this.simulationTimeSec);
                const ox = sState.lensX + Math.cos(crack.anchorAngle) * rimR;
                const oy = sState.lensY + Math.sin(crack.anchorAngle) * rimR;
                ctx.strokeStyle = RenderPipeline.hexToRgba('#ffffff', crack.life * 0.8);
                for (let s = 0; s < crack.segments.length; s++) {
                    const seg = crack.segments[s];
                    ctx.lineWidth = seg.thickness;
                    ctx.beginPath();
                    ctx.moveTo(ox + seg.x1, oy + seg.y1);
                    ctx.lineTo(ox + seg.x2, oy + seg.y2);
                    ctx.stroke();
                }
            }

            if (sState.isBreaching || sState.revealIntensity > 0.5) {
                this.renderOpticalCallouts(ctx, particles, sState.lensX, sState.lensY, sState.currentBreachRadius, truthHex);
            }
            ctx.restore();
        }
    }

    private renderOpticalCallouts(
        ctx: CanvasRenderingContext2D,
        particles: ReadonlyArray<QuantumParticle>,
        lensX: number,
        lensY: number,
        lensRadius: number,
        truthHex: string
    ): void {
        const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
        let count = 0;
        ctx.font = '10px "JetBrains Mono", Consolas, monospace';

        for (let i = 0; i < particles.length && count < 4; i += 13) {
            const p = particles[i];
            const dx = p.x - lensX;
            const dy = p.y - lensY;
            const d = Math.hypot(dx, dy);

            if (d < lensRadius * 0.75) {
                const lx = p.x + (dx >= 0 ? 16 : -136);
                const ly = p.y - 10;
                const boxW = 126;
                const boxH = 26;

                const overlaps = placedBoxes.some(
                    (b) => lx < b.x + b.w && lx + boxW > b.x && ly < b.y + b.h && ly + boxH > b.y
                );
                if (overlaps) continue;

                placedBoxes.push({ x: lx, y: ly, w: boxW, h: boxH });
                count++;

                ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, 0.72);
                ctx.lineWidth = 0.65;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(lx + (dx >= 0 ? -4 : boxW + 4), ly);
                ctx.stroke();

                ctx.fillStyle = '#f8fafc';
                ctx.fillText(`NEURON#${p.id} [${p.moduleTag}]`, lx, ly);
                ctx.fillStyle = RenderPipeline.hexToRgba(truthHex, 0.85);
                ctx.fillText(`P(${Math.round(p.x)},${Math.round(p.y)}) syn:${p.degree}`, lx, ly + 12);
            }
        }
    }

    // Полная 5-шаговая геодезическая сборка голографической карточки GitHub из Точки Нуля
    private renderGeodesicGitHubHologramCanvas(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        progress: number,
        theme: PhaseVisualTheme
    ): void {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const p = Math.max(0, Math.min(1, progress));
        const cardW = Math.min(460, width * 0.88);
        const cardH = 250;
        const left = cx - cardW * 0.5;
        const top = cy - cardH * 0.5;

        ctx.save();

        // Шаг 1: Остаточный импульс Точки Нуля и выход тонких геодезических дуг
        const step1 = Math.min(1, p / 0.25);
        const pulseR = 6 + step1 * 34;
        const zeroHalo = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, pulseR);
        zeroHalo.addColorStop(0, RenderPipeline.hexToRgba('#ffffff', 0.7 * (1 - p * 0.45)));
        zeroHalo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = zeroHalo;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = RenderPipeline.hexToRgba(theme.axonColor, 0.32 * step1);
        ctx.lineWidth = 0.85;
        for (let g = -1; g <= 1; g += 2) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.quadraticCurveTo(
                cx + g * cardW * 0.62 * step1,
                cy - cardH * 0.52 * step1,
                cx + g * (cardW * 0.5) * step1,
                cy + g * (cardH * 0.5) * step1
            );
            ctx.stroke();
        }

        // Шаг 2: Поэтапное проведение геодезических сегментов контура рамки
        if (p > 0.2) {
            const step2 = Math.min(1, (p - 0.2) / 0.35);
            const segW = cardW * step2;
            const segH = cardH * step2;

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.48 * step2);
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(cx - segW * 0.5, top);
            ctx.lineTo(cx + segW * 0.5, top);
            ctx.moveTo(cx - segW * 0.5, top + cardH);
            ctx.lineTo(cx + segW * 0.5, top + cardH);
            ctx.moveTo(left, cy - segH * 0.5);
            ctx.lineTo(left, cy + segH * 0.5);
            ctx.moveTo(left + cardW, cy - segH * 0.5);
            ctx.lineTo(left + cardW, cy + segH * 0.5);
            ctx.stroke();
        }

        // Шаг 3: Сканирующая волна матовой графитово-синей поверхности
        if (p > 0.45) {
            const step3 = Math.min(1, (p - 0.45) / 0.35);
            const scanY = top + cardH * step3;
            ctx.fillStyle = `rgba(6, 11, 25, ${0.65 * step3})`;
            ctx.fillRect(left, top, cardW, cardH * step3);

            if (step3 < 0.99) {
                ctx.strokeStyle = RenderPipeline.hexToRgba(theme.axonColor, 0.6 * (1 - step3));
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(left, scanY);
                ctx.lineTo(left + cardW, scanY);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}