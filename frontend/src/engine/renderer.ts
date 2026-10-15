// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Кинематографический рендерер UNIVERSE с плавным перетеканием фаз
//             и финальной матрицей вращающихся букв-счётчиков (Odometer Glyph Reels)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Плавно интерполирует цвета (lerpHexColor) и смешивает фоновые образы (cross-fade)
//    при каждом переходе между 5 фазами — без резких скачков цвета и сюжета.
// 2. Рисует 4 плана глубины, туманности с пылевыми тенями, полушария Нейро-Мозга,
//    ветвящиеся дендриты, яркие кометы синаптических импульсов и оптическую линзу BREACH.
// 3. В 5-й фазе не выключает экран в пустоту, а запускает из Точки Нуля поток символов,
//    которые крутятся как барабаны счётчиков (переворачиваясь в 3D) и выстраиваются
//    буква за буквой в смысловые строки и имя создателя (DubnovAlexey / universe).
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
// 1. ЦВЕТОВЫЕ ПАЛИТРЫ 5 ОБРАЗОВ И ФУНКЦИЯ ПЛАВНОГО ПЕРЕТЕКАНИЯ ЦВЕТА (LERP)
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

// ----------------------------------------------------------------------------
// 2. СТРОКИ И СИМВОЛЫ ДЛЯ ФИНАЛЬНОГО СЧЁТЧИКА БУКВ (CIPHER ODOMETER REELS)
// ----------------------------------------------------------------------------
const CIPHER_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ∑∆Ωλ∞∇◊◈┼';

interface CounterTextLineSpec {
    text: string;
    fontSize: number;
    fontWeight: string;
    color: string;
    yOffset: number;
    letterSpacing: number;
    startDelay: number;
}

const FINALE_COUNTER_LINES: ReadonlyArray<CounterTextLineSpec> = [
    {
        text: 'UNIVERSE // NEURAL SINGULARITY',
        fontSize: 13,
        fontWeight: '600',
        color: '#00f5d4',
        yOffset: -118,
        letterSpacing: 11,
        startDelay: 0.05,
    },
    {
        text: 'ALEXEY DUBNOV',
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        yOffset: -66,
        letterSpacing: 19,
        startDelay: 0.16,
    },
    {
        text: 'GITHUB.COM / DUBNOVALEXEY / UNIVERSE',
        fontSize: 15,
        fontWeight: '600',
        color: '#38bdf8',
        yOffset: -20,
        letterSpacing: 10.5,
        startDelay: 0.28,
    },
    {
        text: 'ВРЕМЯ · ПРОСТРАНСТВО · МЫСЛЬ · ОБРАЗ · КОД',
        fontSize: 13,
        fontWeight: '500',
        color: '#fde047',
        yOffset: 24,
        letterSpacing: 9.5,
        startDelay: 0.40,
    },
    {
        text: 'ASTRO  ·  TYPESCRIPT  ·  WEBGPU  ·  RUST/WASM  ·  PYTHON',
        fontSize: 11,
        fontWeight: '500',
        color: '#94a3b8',
        yOffset: 64,
        letterSpacing: 8.2,
        startDelay: 0.52,
    },
];

export class UniverseRenderer {
    private pipeline: RenderPipeline;
    private simulation: VoidPhaseSimulation;
    private animationFrameId: number | null = null;
    private lastTimestamp = 0;
    private simulationTimeSec = 0;
    private phaseElapsedSec = 0;
    private lastTrackedPhase: PhaseId = universeStore.getState().currentPhase;
    private previousVisualPhase: PhaseId = universeStore.getState().currentPhase;
    private phaseTransitionBlend = 1.0; // 0.0 -> 1.0 плавный микс тем и фонов (5 секунд)
    private lastTrackedCycle = universeStore.getState().cycleCount;
    private restartCollapseElapsed = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.simulation = new VoidPhaseSimulation(caps.viewportWidth, caps.viewportHeight);
        this.bindEvents();
    }

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
    // 3. ПЛАВНАЯ ИНТЕРПОЛЯЦИЯ HEX-ЦВЕТОВ МЕЖДУ ФАЗАМИ (БЕЗ РЕЗКИХ СКАЧКОВ)
    // --------------------------------------------------------------------------
    private lerpHexColor(hexA: string, hexB: string, t: number): string {
        const clamped = Math.max(0, Math.min(1, t));
        const a = hexA.replace('#', '');
        const b = hexB.replace('#', '');

        const r1 = parseInt(a.substring(0, 2), 16) || 0;
        const g1 = parseInt(a.substring(2, 4), 16) || 0;
        const b1 = parseInt(a.substring(4, 6), 16) || 0;

        const r2 = parseInt(b.substring(0, 2), 16) || 0;
        const g2 = parseInt(b.substring(2, 4), 16) || 0;
        const b2 = parseInt(b.substring(4, 6), 16) || 0;

        const r = Math.round(r1 + (r2 - r1) * clamped);
        const g = Math.round(g1 + (g2 - g1) * clamped);
        const bl = Math.round(b1 + (b2 - b1) * clamped);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    }

    private getBlendedPhaseTheme(currentPhase: PhaseId): PhaseVisualTheme {
        const target = PHASE_VISUAL_THEMES[currentPhase];
        if (this.phaseTransitionBlend >= 0.999 || this.previousVisualPhase === currentPhase) {
            return target;
        }
        const prev = PHASE_VISUAL_THEMES[this.previousVisualPhase];
        const s =
            this.phaseTransitionBlend *
            this.phaseTransitionBlend *
            (3.0 - 2.0 * this.phaseTransitionBlend);

        return {
            bgCenter: this.lerpHexColor(prev.bgCenter, target.bgCenter, s),
            bgMid: this.lerpHexColor(prev.bgMid, target.bgMid, s),
            bgEdge: this.lerpHexColor(prev.bgEdge, target.bgEdge, s),
            nebulaPrimary: this.lerpHexColor(prev.nebulaPrimary, target.nebulaPrimary, s),
            nebulaSecondary: this.lerpHexColor(prev.nebulaSecondary, target.nebulaSecondary, s),
            nebulaShadow: this.lerpHexColor(prev.nebulaShadow, target.nebulaShadow, s),
            rimLightColor: this.lerpHexColor(prev.rimLightColor, target.rimLightColor, s),
            axonColor: this.lerpHexColor(prev.axonColor, target.axonColor, s),
            pulseHeadColor: this.lerpHexColor(prev.pulseHeadColor, target.pulseHeadColor, s),
            pulseTailColor: this.lerpHexColor(prev.pulseTailColor, target.pulseTailColor, s),
            somaCoreColor: this.lerpHexColor(prev.somaCoreColor, target.somaCoreColor, s),
            somaHaloColor: this.lerpHexColor(prev.somaHaloColor, target.somaHaloColor, s),
        };
    }

    // --------------------------------------------------------------------------
    // 4. ЕДИНЫЙ КАДРОВЫЙ ЦИКЛ СИМУЛЯЦИИ И ТАЙМЛАЙНА
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
            this.previousVisualPhase = this.lastTrackedPhase;
            this.lastTrackedPhase = uState.currentPhase;
            this.lastTrackedCycle = uState.cycleCount;
            this.phaseTransitionBlend = 0.0;
            this.phaseElapsedSec = 0;
            this.restartCollapseElapsed = 0;
        }

        // Плавное перетекание цветов и фоновых декораций в течение 4.8 секунд
        if (this.phaseTransitionBlend < 1.0) {
            this.phaseTransitionBlend = Math.min(1.0, this.phaseTransitionBlend + dtSeconds * 0.21);
        }

        if (uState.singularityAct === 'RESTART_COLLAPSE') {
            this.restartCollapseElapsed += dtSeconds * 0.75;
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
    // 5. ГЛАВНЫЙ КОНВЕЙЕР СЦЕНЫ (С CROSS-FADE ФОНОВ И ФИНАЛЬНЫМ СЧЁТЧИКОМ БУКВ)
    // --------------------------------------------------------------------------
    private renderScene(): void {
        const ctx = this.pipeline.getContext();
        const { viewportWidth: width, viewportHeight: height } = this.pipeline.getCapabilities();
        const uState = universeStore.getState();
        const sState = stressStore.getState();
        const theme = this.getBlendedPhaseTheme(uState.currentPhase);
        const fullXRay = uState.layers.layer5_truthXRayMode;

        const cx = width * 0.5;
        const cy = height * 0.5;

        // 1. Многослойный глубокий вакуум с плавной интерполяцией оттенков
        const bgGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(width, height) * 0.74);
        bgGrad.addColorStop(0, theme.bgCenter);
        bgGrad.addColorStop(0.52, theme.bgMid);
        bgGrad.addColorStop(1, theme.bgEdge);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(cx + uState.camera.driftX * 0.32, cy + uState.camera.driftY * 0.32);
        ctx.scale(uState.camera.zoom, uState.camera.zoom);
        ctx.translate(-cx, -cy);

        const particles = this.simulation.getParticles();
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        // 2. Координатная сетка X-RAY
        this.renderTruthCoordinateGrid(ctx, width, height, theme.axonColor, fullXRay);

        // 3. ПЛАВНЫЙ CROSS-FADE ФОНОВЫХ ОБРАЗОВ: предыдущая фаза плавно растворяется в текущей!
        const smoothMix =
            this.phaseTransitionBlend *
            this.phaseTransitionBlend *
            (3.0 - 2.0 * this.phaseTransitionBlend);

        if (smoothMix < 0.99 && this.previousVisualPhase !== uState.currentPhase) {
            ctx.save();
            ctx.globalAlpha = 1.0 - smoothMix;
            this.renderPhaseSignatureBackdrop(
                ctx,
                width,
                height,
                cx,
                cy,
                this.previousVisualPhase,
                PHASE_VISUAL_THEMES[this.previousVisualPhase]
            );
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = smoothMix;
        this.renderPhaseSignatureBackdrop(ctx, width, height, cx, cy, uState.currentPhase, theme);
        ctx.restore();

        // 4. Анизотропные туманности с пылевыми тенями и силовые волокна
        if (
            uState.singularityAct !== 'ACT_C_ZERO_SILENCE' &&
            uState.singularityAct !== 'ACT_D_GITHUB_CARD' &&
            uState.singularityAct !== 'RESTART_COLLAPSE'
        ) {
            this.renderAnisotropicNebulaeWithShadows(ctx, width, height, particles, theme);
            this.renderCosmicStreamlineFilaments(ctx, width, height, theme);

            if (uState.layers.layer3_topologyGraph || fullXRay) {
                this.renderSynapticBrainNetworkAndComets(ctx, edges, pulses, theme, fullXRay);
            }

            this.renderNeuronsAndSynapticRings(ctx, particles, theme, fullXRay);
            this.renderBreachLensAndCallouts(ctx, sState, particles, theme.axonColor, fullXRay);
        }

        ctx.restore();

        // 5. АКТ C И D В ФАЗЕ 05: ЗАРОЖДЕНИЕ СИМВОЛОВ В ТИШИНЕ И БАРАБАНЫ-СЧЁТЧИКИ БУКВ!
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.renderSilenceHorizonAndGlyphSeeds(
                ctx,
                width,
                height,
                uState.singularityActProgress,
                theme
            );
        } else if (
            uState.singularityAct === 'ACT_D_GITHUB_CARD' ||
            uState.singularityAct === 'RESTART_COLLAPSE'
        ) {
            const progress =
                uState.singularityAct === 'RESTART_COLLAPSE'
                    ? Math.max(0, 1.0 - this.restartCollapseElapsed)
                    : uState.githubCardAssemblyProgress;
            this.renderKineticCounterReelsFinale(ctx, width, height, progress, theme);
        }
    }

    // --------------------------------------------------------------------------
    // 6. ЖИВОЙ ГОРИЗОНТ СОБЫТИЙ В ПАУЗЕ ТИШИНЫ И БАРАБАНЫ-СЧЁТЧИКИ БУКВ (ФИНАЛ)
    // --------------------------------------------------------------------------
    private renderSilenceHorizonAndGlyphSeeds(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        silenceProgress: number,
        theme: PhaseVisualTheme
    ): void {
        const cx = width * 0.5;
        const cy = height * 0.5;

        ctx.save();
        // Вместо «мертвого выключенного экрана» в центре дышит глубокое кольцо Горизонта Событий,
        // вокруг которого в последние доли тишины начинают проступать первые матрицы символов
        const haloR = 45 + Math.sin(silenceProgress * Math.PI) * 35;
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, haloR);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, RenderPipeline.hexToRgba(theme.axonColor, 0.45));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Во второй половине паузы тишины из центра начинают проступать полупрозрачные крутящиеся знаки
        if (silenceProgress > 0.45) {
            const emerge = (silenceProgress - 0.45) / 0.55;
            ctx.font = '12px "JetBrains Mono", Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < 28; i++) {
                const angle = (i / 28) * Math.PI * 2 + silenceProgress * 2.2;
                const r = (18 + (i % 5) * 42) * emerge;
                const gx = cx + Math.cos(angle) * r * 1.4;
                const gy = cy + Math.sin(angle) * r * 0.75;
                const glyphIdx = Math.floor(i * 7 + silenceProgress * 40) % CIPHER_GLYPHS.length;

                ctx.fillStyle = RenderPipeline.hexToRgba(theme.axonColor, emerge * 0.42);
                ctx.fillText(CIPHER_GLYPHS[glyphIdx], gx, gy);
            }
        }
        ctx.restore();
    }

    // ГЛАВНЫЙ ФИНАЛ: Спиральный рой знаков и барабаны-счётчики (Odometer / Split-Flap Reels),
    // где символы крутятся, переворачиваются друг перед другом и выстраиваются в слова!
    private renderKineticCounterReelsFinale(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        assemblyProgress: number,
        theme: PhaseVisualTheme
    ): void {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const t = this.simulationTimeSec;
        const p = Math.max(0, Math.min(1, assemblyProgress));

        ctx.save();

        // 1. Фоновая голографическая решетка и кружащиеся в глубине символы матрицы
        const ambientHalo = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(width, height) * 0.48);
        ambientHalo.addColorStop(0, RenderPipeline.hexToRgba('#061c30', 0.65 * p));
        ambientHalo.addColorStop(0.6, RenderPipeline.hexToRgba('#040917', 0.35 * p));
        ambientHalo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ambientHalo;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(width, height) * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // Орбитальные потоки свободных символов на заднем плане
        ctx.font = '11px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 64; i++) {
            const orbitA = (i / 64) * Math.PI * 2 + t * (i % 2 === 0 ? 0.18 : -0.14);
            const orbitRx = width * (0.18 + (i % 7) * 0.042) * Math.min(1, p * 1.4);
            const orbitRy = height * (0.14 + (i % 5) * 0.055) * Math.min(1, p * 1.4);
            const ox = cx + Math.cos(orbitA) * orbitRx;
            const oy = cy + Math.sin(orbitA) * orbitRy;

            const flip3D = Math.cos(t * 3.2 + i * 1.1);
            const charIdx = Math.floor(t * 9 + i * 13) % CIPHER_GLYPHS.length;

            ctx.save();
            ctx.translate(ox, oy);
            ctx.scale(flip3D, 1.0); // 3D-переворот символа вокруг вертикальной оси
            ctx.fillStyle = RenderPipeline.hexToRgba(
                i % 3 === 0 ? '#00f5d4' : '#38bdf8',
                0.16 * p
            );
            ctx.fillText(CIPHER_GLYPHS[charIdx], 0, 0);
            ctx.restore();
        }

        // 2. Тонкие геодезические направляющие вокруг области выстраивания слов
        const frameW = Math.min(760, width * 0.9);
        const frameH = 290;
        ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', 0.22 * p);
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(cx - frameW * 0.5 * p, cy - frameH * 0.5);
        ctx.lineTo(cx + frameW * 0.5 * p, cy - frameH * 0.5);
        ctx.moveTo(cx - frameW * 0.5 * p, cy + frameH * 0.5);
        ctx.lineTo(cx + frameW * 0.5 * p, cy + frameH * 0.5);
        ctx.stroke();

        // 3. ВЫСТРАИВАНИЕ СЛОВ ЧЕРЕЗ БАРАБАНЫ-СЧЁТЧИКИ (ODOMETER / SPLIT-FLAP REELS)
        const scaleFactor = width < 720 ? 0.68 : 1.0;

        for (let lineIdx = 0; lineIdx < FINALE_COUNTER_LINES.length; lineIdx++) {
            const line = FINALE_COUNTER_LINES[lineIdx];
            const chars = line.text.split('');
            const stepX = line.letterSpacing * scaleFactor;
            const fontSize = Math.round(line.fontSize * scaleFactor);
            const totalLineW = (chars.length - 1) * stepX;
            const startX = cx - totalLineW * 0.5;
            const targetY = cy + line.yOffset * scaleFactor;

            ctx.font = `${line.fontWeight} ${fontSize}px "JetBrains Mono", Consolas, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let c = 0; c < chars.length; c++) {
                const targetChar = chars[c];
                const targetX = startX + c * stepX;

                // Индивидуальный тайминг для каждой буквы: выстраиваются волной слева направо!
                const charStart = line.startDelay + (c / Math.max(1, chars.length)) * 0.28;
                const charDuration = 0.34;
                const localP = Math.max(0, Math.min(1, (p - charStart) / charDuration));

                if (localP <= 0.001) continue;

                // Фаза 1 (localP 0..0.45): буква прилетает по спиральной дуге из Точки Нуля в свою ячейку счётчика
                const flyEase = 1.0 - Math.pow(1.0 - Math.min(1, localP / 0.45), 3);
                const spiralAngle = (1.0 - flyEase) * (Math.PI * 1.5 + (c % 5) * 0.6);
                const spiralR = (1.0 - flyEase) * 140;

                const curX = cx + (targetX - cx) * flyEase + Math.cos(spiralAngle) * spiralR;
                const curY = cy + (targetY - cy) * flyEase + Math.sin(spiralAngle) * spiralR * 0.6;

                if (targetChar === ' ') continue;

                // Фаза 2 (localP < 1.0): ВРАЩАЮЩИЙСЯ БАРАБАН СЧЁТЧИКА (символы крутятся и переворачиваются)
                if (localP < 0.995) {
                    // Скорость вращения барабана замедляется перед щелчком фиксации
                    const spinRemaining = 1.0 - localP;
                    const wheelPos = (t * 26 + c * 3.7 + lineIdx * 5.1) * spinRemaining;
                    const baseGlyphIdx = Math.floor(wheelPos) % CIPHER_GLYPHS.length;
                    const prevGlyphIdx = (baseGlyphIdx + CIPHER_GLYPHS.length - 1) % CIPHER_GLYPHS.length;
                    const nextGlyphIdx = (baseGlyphIdx + 1) % CIPHER_GLYPHS.length;
                    const fracScroll = wheelPos - Math.floor(wheelPos); // 0.0 .. 1.0 прокрутка колёсика

                    // Эффект 3D-переворота пластинки счётчика (split-flap / counter wheel)
                    const flapScaleY = 0.28 + 0.72 * Math.abs(Math.cos(fracScroll * Math.PI));
                    const slotH = fontSize * 1.45;

                    ctx.save();
                    ctx.translate(curX, curY);

                    // Подложка ячейки счётчика во время перебора символов
                    ctx.fillStyle = `rgba(15, 23, 42, ${0.65 * spinRemaining})`;
                    ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', 0.45 * spinRemaining);
                    ctx.lineWidth = 0.75;
                    ctx.fillRect(-stepX * 0.46, -slotH * 0.55, stepX * 0.92, slotH * 1.1);
                    ctx.strokeRect(-stepX * 0.46, -slotH * 0.55, stepX * 0.92, slotH * 1.1);

                    // Обрезаем область барабана, чтобы соседние символы входили сверху и уходили вниз
                    ctx.beginPath();
                    ctx.rect(-stepX * 0.5, -slotH * 0.55, stepX, slotH * 1.1);
                    ctx.clip();

                    // Верхний уходящий символ на барабане
                    ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.38);
                    ctx.fillText(CIPHER_GLYPHS[prevGlyphIdx], 0, (fracScroll - 0.85) * slotH);

                    // Центральный переворачивающийся символ на барабане
                    ctx.save();
                    ctx.translate(0, (fracScroll - 0.5) * slotH * 0.45);
                    ctx.scale(1.0, flapScaleY);
                    ctx.fillStyle = '#fde047';
                    ctx.fillText(CIPHER_GLYPHS[baseGlyphIdx], 0, 0);
                    ctx.restore();

                    // Нижний набегающий символ на барабане
                    ctx.fillStyle = RenderPipeline.hexToRgba('#38bdf8', 0.38);
                    ctx.fillText(CIPHER_GLYPHS[nextGlyphIdx], 0, (fracScroll + 0.15) * slotH);

                    ctx.restore();
                } else {
                    // Фаза 3 (localP === 1.0): ЩЕЛЧОК ФИКСАЦИИ! Буква встала на место в слове
                    const timeSinceLock = Math.max(0, p - (charStart + charDuration));
                    const lockFlash = Math.max(0, 1.0 - timeSinceLock * 5.5);

                    ctx.save();
                    ctx.translate(targetX, targetY);

                    // Вспышка при защелкивании буквы на барабане
                    if (lockFlash > 0.02) {
                        ctx.fillStyle = RenderPipeline.hexToRgba('#fde047', lockFlash * 0.45);
                        ctx.fillRect(-stepX * 0.48, -fontSize * 0.65, stepX * 0.96, fontSize * 1.3);
                    }

                    ctx.shadowColor = lockFlash > 0.1 ? '#fde047' : line.color;
                    ctx.shadowBlur = lockFlash > 0.1 ? 14 : 8;
                    ctx.fillStyle = lockFlash > 0.25 ? '#ffffff' : line.color;
                    ctx.fillText(targetChar, 0, 0);

                    ctx.restore();
                }
            }
        }

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 7. УНИКАЛЬНЫЙ ФОНОВЫЙ АРХЕТИП КАЖДОЙ ИЗ 5 ФАЗ (ВО ВЕСЬ ЭКРАН 16:9)
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
            const unfold = Math.min(1.0, 0.45 + universeStore.getState().telemetry.phaseProgress * 0.6);
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

            const bridgeGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, width * 0.16);
            bridgeGrad.addColorStop(0, RenderPipeline.hexToRgba('#f59e0b', 0.24));
            bridgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bridgeGrad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, width * 0.16, height * 0.11, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (phase === '04_COLLAPSE') {
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
            const uState = universeStore.getState();
            if (
                uState.singularityAct === 'ACT_C_ZERO_SILENCE' ||
                uState.singularityAct === 'ACT_D_GITHUB_CARD' ||
                uState.singularityAct === 'RESTART_COLLAPSE'
            ) {
                ctx.restore();
                return;
            }

            const collapseScale =
                uState.singularityAct === 'ACT_B_LOGIC' && uState.singularityActProgress > 0.58
                    ? Math.max(0.08, 1.0 - (uState.singularityActProgress - 0.58) / 0.42)
                    : 1.0;

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

            ctx.fillStyle = '#020205';
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(6, 34 * collapseScale), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 8. АНИЗОТРОПНЫЕ ТУМАННОСТИ, АКСОНЫ, НЕЙРОНЫ И ОПТИЧЕСКАЯ ЛИНЗА BREACH
    // --------------------------------------------------------------------------
    private renderAnisotropicNebulaeWithShadows(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        particles: ReadonlyArray<QuantumParticle>,
        theme: PhaseVisualTheme
    ): void {
        const t = this.simulationTimeSec;

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

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.06 + internalLight * 0.1);
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(0, 0, rx * 0.64, -0.7, 0.7);
            ctx.stroke();

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
}