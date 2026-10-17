// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Главный режиссёрский композитор и клиентский загрузчик UNIVERSE v2.0
// ЗАДАЧИ ФАЙЛА:
// 1. Выполнять фиксированный шаг физики (FIXED_DT = 1/120 с) через accumulator
//    и плавно интерполировать координаты рендера между prevX/prevY и x/y.
// 2. Соблюдать строгую палитру MASTER 00 (#020308, #03050A, #060B19, #7DD3FC,
//    #38BDF8, #1E1B4B, #6366F1, #8B5CF6, #F8FAFC, #F59E0B) и Blue-Noise дизеринг.
// 3. Рисовать 4 эшелона глубины (Z0-Z3), тёмные пылевые каньоны поглощения,
//    5 кеплеровских колец в полушариях мозга, сплайны Мюррея и LUT-импульсы.
// 4. Выводить в X-RAY неперекрывающиеся выноски с гистерезисом и тегом языка-владельца.
// 5. Исполнять Акт C (2500 мс живой тишины D-1), Акт D (3D-барабаны Odometer)
//    и монтировать все 4 реактивных острова Layer2-Layer5 при загрузке страницы.
// ============================================================================

import { universeStore, type PhaseId, type UniverseState } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { integrationRegistry } from '../core/integrationRegistry';
import { cipherOdometerEngine } from '../bridge/cipherOdometerEngine';
import { pythonSocketClient } from '../bridge/pythonSocketClient';
import {
    VoidPhaseSimulation,
    BRAIN_HEMISPHERE_LOBES,
    type QuantumParticle,
    type TopologyEdge,
    type SynapticPulse,
} from '../phases/01_void';
import { RenderPipeline } from './pipeline';
import { audioSync } from '../utils/audioSync';
import { mountLayer2Metrics } from '../layers/Layer2_Metrics';
import { mountLayer3Topology } from '../layers/Layer3_Topology';
import { mountLayer4Terminal } from '../layers/Layer4_Terminal';
import { mountLayer5CipherFinale } from '../layers/Layer5_CipherFinale';

// ----------------------------------------------------------------------------
// 1. СТРОГАЯ ЦВЕТОВАЯ КОНСТИТУЦИЯ MASTER 00 (БЕЗ КОРИЧНЕВЫХ И КИСЛОТНЫХ ТОНОВ)
// ----------------------------------------------------------------------------
interface PhaseVisualTheme {
    bgCenter: string;
    bgMid: string;
    bgEdge: string;
    nebulaPrimary: string;
    nebulaSecondary: string;
    canyonShadow: string;
    rimLightColor: string;
    axonColor: string;
    pulseHeadColor: string;
    pulseTailColor: string;
    somaCoreColor: string;
    somaHaloColor: string;
}

const PHASE_VISUAL_THEMES: Record<PhaseId, PhaseVisualTheme> = {
    '01_VOID': {
        bgCenter: '#060b19',
        bgMid: '#03050a',
        bgEdge: '#020308',
        nebulaPrimary: '#1e1b4b',
        nebulaSecondary: '#38bdf8',
        canyonShadow: '#020308',
        rimLightColor: '#7dd3fc',
        axonColor: '#38bdf8',
        pulseHeadColor: '#f8fafc',
        pulseTailColor: '#7dd3fc',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#7dd3fc',
    },
    '02_GENESIS': {
        bgCenter: '#060b19',
        bgMid: '#03050a',
        bgEdge: '#020308',
        nebulaPrimary: '#6366f1',
        nebulaSecondary: '#38bdf8',
        canyonShadow: '#020308',
        rimLightColor: '#7dd3fc',
        axonColor: '#38bdf8',
        pulseHeadColor: '#f8fafc',
        pulseTailColor: '#7dd3fc',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#38bdf8',
    },
    '03_EVOLUTION': {
        bgCenter: '#060b19',
        bgMid: '#03050a',
        bgEdge: '#020308',
        nebulaPrimary: '#8b5cf6',
        nebulaSecondary: '#38bdf8',
        canyonShadow: '#020308',
        rimLightColor: '#7dd3fc',
        axonColor: '#7dd3fc',
        pulseHeadColor: '#f8fafc',
        pulseTailColor: '#38bdf8',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#7dd3fc',
    },
    '04_COLLAPSE': {
        bgCenter: '#060b19',
        bgMid: '#03050a',
        bgEdge: '#020308',
        nebulaPrimary: '#6366f1',
        nebulaSecondary: '#1e1b4b',
        canyonShadow: '#020308',
        rimLightColor: '#38bdf8',
        axonColor: '#38bdf8',
        pulseHeadColor: '#f8fafc',
        pulseTailColor: '#7dd3fc',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#38bdf8',
    },
    '05_SINGULARITY': {
        bgCenter: '#060b19',
        bgMid: '#03050a',
        bgEdge: '#020308',
        nebulaPrimary: '#1e1b4b',
        nebulaSecondary: '#38bdf8',
        canyonShadow: '#020308',
        rimLightColor: '#7dd3fc',
        axonColor: '#7dd3fc',
        pulseHeadColor: '#f8fafc',
        pulseTailColor: '#38bdf8',
        somaCoreColor: '#f8fafc',
        somaHaloColor: '#7dd3fc',
    },
};

const KEPLER_RINGS_NORMS: ReadonlyArray<number> = [0.22, 0.36, 0.52, 0.70, 0.88];

export class UniverseRenderer {
    private pipeline: RenderPipeline;
    private simulation: VoidPhaseSimulation;
    private animationFrameId: number | null = null;
    private lastTimestamp = 0;

    private readonly fixedPhysicsDt = 1 / 120;
    private physicsAccumulator = 0;
    private renderInterpAlpha = 1.0;

    private simulationTimeSec = 0;
    private phaseElapsedSec = 0;
    private lastTrackedPhase: PhaseId = universeStore.getState().currentPhase;
    private previousVisualPhase: PhaseId = universeStore.getState().currentPhase;
    private phaseTransitionBlend = 1.0;
    private lastTrackedCycle = universeStore.getState().cycleCount;
    private restartCollapseElapsed = 0;

    private calloutHysteresisMap: Map<number, { x: number; y: number }> = new Map();

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
                this.physicsAccumulator = 0;
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
    // 2. ЛИНЕЙНАЯ ИНТЕРПОЛЯЦИЯ ПАЛИТРЫ МЕЖДУ ФАЗАМИ БЕЗ СКАЧКОВ
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
            canyonShadow: this.lerpHexColor(prev.canyonShadow, target.canyonShadow, s),
            rimLightColor: this.lerpHexColor(prev.rimLightColor, target.rimLightColor, s),
            axonColor: this.lerpHexColor(prev.axonColor, target.axonColor, s),
            pulseHeadColor: this.lerpHexColor(prev.pulseHeadColor, target.pulseHeadColor, s),
            pulseTailColor: this.lerpHexColor(prev.pulseTailColor, target.pulseTailColor, s),
            somaCoreColor: this.lerpHexColor(prev.somaCoreColor, target.somaCoreColor, s),
            somaHaloColor: this.lerpHexColor(prev.somaHaloColor, target.somaHaloColor, s),
        };
    }

    // --------------------------------------------------------------------------
    // 3. КАДРОВЫЙ ЦИКЛ С ФИКСИРОВАННЫМ ШАГОМ ФИЗИКИ (ACCUMULATOR)
    // --------------------------------------------------------------------------
    private tick(now: number): void {
        const rawDeltaMs = Math.max(1, now - this.lastTimestamp);
        this.lastTimestamp = now;

        const uState = universeStore.getState();
        if (uState.isTabHidden) return;

        const frameDtSec = Math.min(rawDeltaMs / 1000, 0.1);

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
            this.calloutHysteresisMap.clear();
        }

        if (this.phaseTransitionBlend < 1.0) {
            this.phaseTransitionBlend = Math.min(1.0, this.phaseTransitionBlend + frameDtSec * 0.22);
        }

        if (uState.singularityAct === 'RESTART_COLLAPSE') {
            this.restartCollapseElapsed += frameDtSec * 0.82;
            if (this.restartCollapseElapsed >= 1.0) {
                this.restartCollapseElapsed = 0;
                this.simulationTimeSec = 0;
                this.phaseElapsedSec = 0;
                this.physicsAccumulator = 0;
                universeStore.completeRestartToVoid();
            }
        }

        stressStore.setTargetStress(uState.phaseMeta.baseEntropy);
        stressStore.stepPhysics(frameDtSec);

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
            const scaledFrameDt = frameDtSec * uState.timeScale;
            this.simulationTimeSec += scaledFrameDt;
            this.phaseElapsedSec += scaledFrameDt;
            this.physicsAccumulator += scaledFrameDt;

            let steps = 0;
            const maxSubSteps = 6;
            while (this.physicsAccumulator >= this.fixedPhysicsDt && steps < maxSubSteps) {
                this.simulation.update(
                    this.fixedPhysicsDt,
                    uState.currentPhase,
                    1.0,
                    uState.gravityMultiplier,
                    this.simulationTimeSec
                );
                this.physicsAccumulator -= this.fixedPhysicsDt;
                steps++;
            }

            if (steps === maxSubSteps) {
                this.physicsAccumulator = 0;
            }

            this.renderInterpAlpha = Math.max(0, Math.min(1, this.physicsAccumulator / this.fixedPhysicsDt));
            universeStore
                .getSceneBuffer()
                .computeInterpolatedPositions(this.simulation.getParticles().length, this.renderInterpAlpha);
        }

        const renderStartMs = performance.now();
        this.renderScene();
        const renderDurMs = performance.now() - renderStartMs;
        integrationRegistry.recordModuleStep('canvas2d-render', renderDurMs);

        const particles = this.simulation.getParticles();
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        universeStore.updateTelemetry({
            frameTimeMs: Number(rawDeltaMs.toFixed(1)),
            activeParticles: particles.length,
            activeConnections: edges.length,
            activePulses: pulses.length,
            simulationTimeSec: Number((uState.phaseMeta.startSec + this.phaseElapsedSec).toFixed(2)),
            phaseElapsedSec: Number(this.phaseElapsedSec.toFixed(2)),
            engineBackend: this.pipeline.getCapabilities().activeBackend,
        });
    }

    // --------------------------------------------------------------------------
    // 4. ГЛАВНЫЙ КОНВЕЙЕР ОТРИСОВКИ СЦЕНЫ (4 ЭШЕЛОНА ГЛУБИНЫ Z0-Z3)
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

        const bgGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(width, height) * 0.75);
        bgGrad.addColorStop(0, theme.bgCenter);
        bgGrad.addColorStop(0.54, theme.bgMid);
        bgGrad.addColorStop(1, theme.bgEdge);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const ditherPattern = this.pipeline.getDitherPattern();
        if (ditherPattern) {
            ctx.save();
            ctx.fillStyle = ditherPattern;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.renderLivingSilenceHorizonD1(ctx, cx, cy, uState.zeroSilenceElapsedMs / 1000, theme);
            return;
        }

        if (
            uState.singularityAct === 'ACT_D_GITHUB_CARD' ||
            uState.singularityAct === 'RESTART_COLLAPSE'
        ) {
            const progress =
                uState.singularityAct === 'RESTART_COLLAPSE'
                    ? Math.max(0, 1.0 - this.restartCollapseElapsed)
                    : uState.githubCardAssemblyProgress;
            this.renderOdometerReelsAndGeodesicCard(ctx, width, height, progress, theme, uState.reducedMotion);
            return;
        }

        ctx.save();
        ctx.translate(cx + uState.camera.driftX * 0.32, cy + uState.camera.driftY * 0.32);
        ctx.scale(uState.camera.zoom, uState.camera.zoom);
        ctx.translate(-cx, -cy);

        const particles = this.simulation.getParticles();
        const edges = this.simulation.getEdges();
        const pulses = this.simulation.getPulses();

        this.renderTruthCoordinateGrid(ctx, width, height, theme.axonColor, fullXRay);

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

        this.renderAnisotropicNebulaeWithCanyons(ctx, width, height, particles, theme);
        this.renderCosmicStreamlineFilaments(ctx, width, height, theme);

        if (uState.layers.layer3_topologyGraph || fullXRay) {
            this.renderSynapticBrainNetworkAndComets(ctx, edges, pulses, theme, fullXRay);
        }

        this.renderNeuronsAndSynapticRings(ctx, particles, theme, fullXRay);
        this.renderBreachLensAndCallouts(ctx, sState, particles, theme.axonColor, fullXRay);

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 5. АКТ C (РЕШЕНИЕ D-1): 2,5 СЕКУНДЫ ЖИВОЙ ТИШИНЫ И АКТ D: 3D-БАРАБАНЫ ODOMETER
    // --------------------------------------------------------------------------
    private renderLivingSilenceHorizonD1(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        silenceSec: number,
        theme: PhaseVisualTheme
    ): void {
        ctx.save();
        const breathScale = 1.0 + Math.sin(silenceSec * Math.PI * 2 * 0.2) * 0.028;
        const horizonRadius = 38 * breathScale;

        ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.34);
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
        ctx.stroke();

        const coreGrad = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 14 * breathScale);
        coreGrad.addColorStop(0, '#f8fafc');
        coreGrad.addColorStop(0.4, RenderPipeline.hexToRgba('#7dd3fc', 0.28));
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 14 * breathScale, 0, Math.PI * 2);
        ctx.fill();

        if (silenceSec > 2.05) {
            const glyphAlpha = ((silenceSec - 2.05) / 0.45) * 0.28;
            const seedGlyphs = ['U', 'N', 'V', 'S', '0', '1'];
            ctx.font = '10px "JetBrains Mono", Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', glyphAlpha);

            for (let i = 0; i < seedGlyphs.length; i++) {
                const a = (i / seedGlyphs.length) * Math.PI * 2;
                ctx.fillText(
                    seedGlyphs[i],
                    cx + Math.cos(a) * (horizonRadius + 14),
                    cy + Math.sin(a) * (horizonRadius + 14)
                );
            }
        }

        ctx.restore();
    }

    private renderOdometerReelsAndGeodesicCard(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        progress: number,
        theme: PhaseVisualTheme,
        reducedMotion: boolean
    ): void {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const p = Math.max(0, Math.min(1, progress));

        ctx.save();

        const cardW = Math.min(760, width * 0.92);
        const cardH = Math.min(310, height * 0.62);
        const left = cx - cardW * 0.5;
        const top = cy - cardH * 0.5 - 12;

        ctx.fillStyle = RenderPipeline.hexToRgba('#060b19', 0.68 * p);
        ctx.fillRect(left, top, cardW, cardH * p);

        ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.38 * p);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(cx - cardW * 0.5 * p, top);
        ctx.lineTo(cx + cardW * 0.5 * p, top);
        ctx.moveTo(cx - cardW * 0.5 * p, top + cardH);
        ctx.lineTo(cx + cardW * 0.5 * p, top + cardH);
        ctx.stroke();

        const cells = cipherOdometerEngine.evaluateCells(width, height, p, reducedMotion);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            ctx.font = `${cell.fontWeight} ${cell.fontSizePx}px "JetBrains Mono", Consolas, monospace`;

            if (!cell.isLocked) {
                const slotH = cell.fontSizePx * 1.45;
                const spinFade = 0.55;

                ctx.save();
                ctx.translate(cell.currentX, cell.currentY);

                ctx.fillStyle = 'rgba(3, 5, 10, 0.72)';
                ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', 0.35);
                ctx.lineWidth = 0.65;
                ctx.fillRect(-cell.stepWidthPx * 0.46, -slotH * 0.54, cell.stepWidthPx * 0.92, slotH * 1.08);
                ctx.strokeRect(-cell.stepWidthPx * 0.46, -slotH * 0.54, cell.stepWidthPx * 0.92, slotH * 1.08);

                ctx.beginPath();
                ctx.rect(-cell.stepWidthPx * 0.48, -slotH * 0.54, cell.stepWidthPx * 0.96, slotH * 1.08);
                ctx.clip();

                ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.32 * spinFade);
                ctx.fillText(cell.upperChar, 0, (cell.wheelPhaseFrac - 0.82) * slotH);

                ctx.save();
                ctx.translate(0, cell.wheelPhaseFrac * slotH * 0.42);
                ctx.scale(1.0, cell.verticalScale);
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(cell.primaryChar, 0, 0);
                ctx.restore();

                ctx.fillStyle = RenderPipeline.hexToRgba('#38bdf8', 0.32 * spinFade);
                ctx.fillText(cell.lowerChar, 0, (cell.wheelPhaseFrac + 0.82) * slotH);

                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(cell.targetX, cell.targetY);

                if (cell.lockFlash > 0.02) {
                    ctx.fillStyle = RenderPipeline.hexToRgba('#f59e0b', cell.lockFlash * 0.42);
                    ctx.fillRect(
                        -cell.stepWidthPx * 0.48,
                        -cell.fontSizePx * 0.65,
                        cell.stepWidthPx * 0.96,
                        cell.fontSizePx * 1.3
                    );
                }

                ctx.fillStyle = cell.lockFlash > 0.25 ? '#f8fafc' : cell.colorHex;
                ctx.fillText(cell.targetChar, 0, 0);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 6. ФОНОВЫЕ АРХЕТИПЫ 5 ФАЗ (С ЧИРПОМ, 5 КОЛЬЦАМИ D-3 И ЛИНЗИРОВАНИЕМ)
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
        const uState = universeStore.getState();
        ctx.save();

        if (phase === '01_VOID') {
            const phaseSec = uState.telemetry.phaseElapsedSec;

            if (phaseSec >= 2.8) {
                const fade = Math.min(1.0, (phaseSec - 2.8) / 1.5);
                for (let r = 0; r < 6; r++) {
                    const waveProg = (t * 0.24 + r / 6) % 1.0;
                    const rx = width * 0.46 * waveProg;
                    const ry = height * 0.36 * waveProg;
                    const alpha = Math.sin(waveProg * Math.PI) * 0.22 * fade;

                    ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, alpha);
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, -0.12, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            const zeroGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 64);
            zeroGrad.addColorStop(0, '#f8fafc');
            zeroGrad.addColorStop(0.22, RenderPipeline.hexToRgba('#f59e0b', 0.65));
            zeroGrad.addColorStop(0.58, RenderPipeline.hexToRgba(theme.axonColor, 0.22));
            zeroGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = zeroGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, 64, 0, Math.PI * 2);
            ctx.fill();

            const streakW = Math.min(280, width * 0.24);
            const streakGrad = ctx.createLinearGradient(cx - streakW, cy, cx + streakW, cy);
            streakGrad.addColorStop(0, 'rgba(125, 211, 252, 0)');
            streakGrad.addColorStop(0.5, 'rgba(248, 250, 252, 0.42)');
            streakGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.strokeStyle = streakGrad;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(cx - streakW, cy);
            ctx.lineTo(cx + streakW, cy);
            ctx.stroke();
        } else if (phase === '02_GENESIS') {
            const unfold = Math.min(1.0, 0.45 + uState.telemetry.phaseProgress * 0.6);
            for (let arm = 0; arm < 4; arm++) {
                const baseA = (arm * Math.PI) / 2 - t * 0.34;
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    arm % 2 === 0 ? theme.nebulaPrimary : theme.nebulaSecondary,
                    0.18
                );
                ctx.lineWidth = 18;
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
            for (let k = 0; k < KEPLER_RINGS_NORMS.length; k++) {
                const ratio = KEPLER_RINGS_NORMS[k];
                ctx.strokeStyle = RenderPipeline.hexToRgba(theme.axonColor, 0.11);
                ctx.lineWidth = 0.85;
                ctx.beginPath();
                ctx.ellipse(cx, cy, width * 0.42 * ratio, height * 0.36 * ratio, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            for (let h = -1; h <= 1; h += 2) {
                const hx = cx + h * (width * 0.19);
                const rx = width * 0.235;
                const ry = height * 0.375;

                const lobeGrad = ctx.createRadialGradient(hx, cy, 12, hx, cy, Math.max(rx, ry));
                lobeGrad.addColorStop(0, RenderPipeline.hexToRgba(theme.nebulaPrimary, 0.14));
                lobeGrad.addColorStop(0.62, RenderPipeline.hexToRgba(theme.nebulaSecondary, 0.08));
                lobeGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = lobeGrad;
                ctx.beginPath();
                ctx.ellipse(hx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();

                for (let shell = 0; shell < 2; shell++) {
                    const scale = shell === 0 ? 1.0 : 0.68;
                    ctx.strokeStyle = RenderPipeline.hexToRgba(
                        shell === 0 ? theme.rimLightColor : theme.nebulaPrimary,
                        shell === 0 ? 0.24 : 0.15
                    );
                    ctx.lineWidth = shell === 0 ? 1.3 : 0.9;
                    ctx.beginPath();
                    for (let s = 0; s <= 72; s++) {
                        const a = (s / 72) * Math.PI * 2;
                        const gyri =
                            1.0 +
                            0.06 * Math.sin(a * 6.0 + t * 0.75 + shell) +
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
        } else if (phase === '04_COLLAPSE') {
            const tilts = [-0.46, -0.22, 0.0, 0.22, 0.46];
            for (let g = 0; g < 5; g++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(tilts[g]);
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    g % 2 === 0 ? theme.rimLightColor : theme.nebulaPrimary,
                    0.22
                );
                ctx.lineWidth = 1.25;
                ctx.beginPath();
                ctx.ellipse(0, 0, width * 0.42, height * (g === 2 ? 0.36 : 0.24), 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        } else if (phase === '05_SINGULARITY') {
            const collapseScale =
                uState.singularityAct === 'ACT_B_LOGIC' && uState.singularityActProgress > 0.55
                    ? Math.max(0.04, Math.pow(1.0 - (uState.singularityActProgress - 0.55) / 0.45, 2.4))
                    : 1.0;

            const precession = Math.sin(t * 0.9) * 0.045;
            const jetLen = height * 0.45 * collapseScale;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(precession);
            const jetGrad = ctx.createLinearGradient(0, -jetLen, 0, jetLen);
            jetGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            jetGrad.addColorStop(0.45, RenderPipeline.hexToRgba('#38bdf8', 0.32));
            jetGrad.addColorStop(0.5, '#f8fafc');
            jetGrad.addColorStop(0.55, RenderPipeline.hexToRgba('#38bdf8', 0.32));
            jetGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.strokeStyle = jetGrad;
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(0, -jetLen);
            ctx.lineTo(0, jetLen);
            ctx.stroke();
            ctx.restore();

            const haloR = Math.min(width, height) * 0.23 * collapseScale;
            const diskGrad = ctx.createRadialGradient(cx, cy, haloR * 0.22, cx, cy, haloR * 1.48);
            diskGrad.addColorStop(0, '#020308');
            diskGrad.addColorStop(0.24, '#f8fafc');
            diskGrad.addColorStop(0.36, RenderPipeline.hexToRgba('#f59e0b', 0.78));
            diskGrad.addColorStop(0.68, RenderPipeline.hexToRgba('#38bdf8', 0.28));
            diskGrad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = diskGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, haloR * 1.48, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-0.14);
            const diskW = width * 0.42 * collapseScale;
            const dopplerGrad = ctx.createLinearGradient(-diskW, 0, diskW, 0);
            dopplerGrad.addColorStop(0, 'rgba(125, 211, 252, 0)');
            dopplerGrad.addColorStop(0.28, RenderPipeline.hexToRgba('#f8fafc', 0.72));
            dopplerGrad.addColorStop(0.5, RenderPipeline.hexToRgba('#f59e0b', 0.65));
            dopplerGrad.addColorStop(0.76, RenderPipeline.hexToRgba('#38bdf8', 0.24));
            dopplerGrad.addColorStop(1, 'rgba(30, 27, 75, 0)');

            ctx.fillStyle = dopplerGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, diskW, height * 0.078 * collapseScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const eventHorizonR = Math.max(4, 34 * collapseScale);
            ctx.fillStyle = '#020308';
            ctx.beginPath();
            ctx.arc(cx, cy, eventHorizonR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = RenderPipeline.hexToRgba('#f8fafc', 0.65);
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(cx, cy, eventHorizonR + 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 7. FX 01 & FX 02: ТУМАННОСТИ С ТЁМНЫМИ КАНЬОНАМИ, СПЛАЙНЫ МЮРРЕЯ И СОМЫ
    // --------------------------------------------------------------------------
    private renderAnisotropicNebulaeWithCanyons(
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
            const lx = width * (0.5 + normX) + Math.cos(t * 0.2 + i) * 26;
            const ly = height * (0.5 + normY) + Math.sin(t * 0.18 + i) * 20;
            const rx = width * 0.22;
            const ry = height * 0.155;

            let internalLight = 0;
            if (activeNode) {
                const d = Math.hypot(activeNode.x - lx, activeNode.y - ly);
                internalLight = (bestCharge * 0.62) / (1.0 + 0.004 * d + 0.000012 * d * d);
            }

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(normX * 1.15 + Math.sin(t * 0.1 + i) * 0.12);
            ctx.scale(1.0, ry / rx);

            const color = i % 2 === 0 ? theme.nebulaPrimary : theme.nebulaSecondary;
            const alpha = Math.min(0.24, 0.12 + internalLight * 0.12);
            const grad = ctx.createRadialGradient(internalLight > 0.05 ? 20 : 0, 0, 10, 0, 0, rx);
            grad.addColorStop(0, RenderPipeline.hexToRgba(color, alpha));
            grad.addColorStop(0.55, RenderPipeline.hexToRgba(theme.nebulaSecondary, alpha * 0.45));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, rx, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.07 + internalLight * 0.11);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, rx * 0.62, -0.68, 0.68);
            ctx.stroke();

            const canyonGrad = ctx.createLinearGradient(0, -26, 0, 26);
            canyonGrad.addColorStop(0, 'rgba(2, 3, 8, 0)');
            canyonGrad.addColorStop(0.5, RenderPipeline.hexToRgba(theme.canyonShadow, 0.56));
            canyonGrad.addColorStop(1, 'rgba(2, 3, 8, 0)');
            ctx.fillStyle = canyonGrad;
            ctx.fillRect(-rx * 0.82, -26, rx * 1.64, 52);

            ctx.restore();
        }
    }

    private renderCosmicStreamlineFilaments(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        theme: PhaseVisualTheme
    ): void {
        const t = this.simulationTimeSec * 0.3;
        const cx = width * 0.5;
        const cy = height * 0.5;

        ctx.save();
        for (let f = 0; f < 8; f++) {
            const a = (f / 8) * Math.PI * 2 + t * 0.14;
            const x0 = cx + Math.cos(a) * (width * 0.08);
            const y0 = cy + Math.sin(a) * (height * 0.08);
            const x2 = cx + Math.cos(a + 0.95) * (width * 0.42);
            const y2 = cy + Math.sin(a + 0.95) * (height * 0.38);
            const cpx = (x0 + x2) * 0.5 + Math.sin(t + f * 1.9) * 88;
            const cpy = (y0 + y2) * 0.5 - Math.cos(t + f * 1.5) * 78;

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.nebulaSecondary, 0.065);
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cpx, cpy, x2, y2);
            ctx.stroke();

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.rimLightColor, 0.15);
            ctx.lineWidth = 0.85;
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
                    ? 0.22 + glow * 0.58
                    : edge.edgeClass === 'BRIDGE'
                        ? 0.14 + glow * 0.44
                        : 0.08 + glow * 0.32;

            ctx.strokeStyle = RenderPipeline.hexToRgba(
                glow > 0.35 && !fullXRay ? theme.pulseTailColor : theme.axonColor,
                Math.min(0.9, alpha)
            );
            ctx.lineWidth = edge.murrayRadiusPx + glow * 0.65;
            ctx.beginPath();
            ctx.moveTo(edge.x1, edge.y1);
            ctx.quadraticCurveTo(edge.ctrlX, edge.ctrlY, edge.x2, edge.y2);
            ctx.stroke();
        }

        for (let i = 0; i < pulses.length; i++) {
            const pulse = pulses[i];
            const tHead = pulse.progress;
            const tMid = Math.max(0, tHead - pulse.bodyLength);
            const tTail = Math.max(0, tHead - pulse.bodyLength - pulse.tailLength);

            const headPt = this.simulation.samplePulsePoint(pulse, tHead);
            const midPt = this.simulation.samplePulsePoint(pulse, tMid);
            const tailPt = this.simulation.samplePulsePoint(pulse, tTail);

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.pulseTailColor, 0.52);
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(tailPt.x, tailPt.y);
            ctx.lineTo(midPt.x, midPt.y);
            ctx.stroke();

            ctx.strokeStyle = RenderPipeline.hexToRgba(theme.pulseHeadColor, 0.94);
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(midPt.x, midPt.y);
            ctx.lineTo(headPt.x, headPt.y);
            ctx.stroke();

            const pulseGlow = ctx.createRadialGradient(headPt.x, headPt.y, 0.5, headPt.x, headPt.y, 9);
            pulseGlow.addColorStop(0, '#f8fafc');
            pulseGlow.addColorStop(0.45, RenderPipeline.hexToRgba(theme.pulseTailColor, 0.68));
            pulseGlow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pulseGlow;
            ctx.beginPath();
            ctx.arc(headPt.x, headPt.y, 9, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private renderNeuronsAndSynapticRings(
        ctx: CanvasRenderingContext2D,
        particles: ReadonlyArray<QuantumParticle>,
        theme: PhaseVisualTheme,
        fullXRay: boolean
    ): void {
        const uState = universeStore.getState();
        const logicW = uState.opticalWeights.logicConvergence;
        const alphaInterp = this.renderInterpAlpha;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.energy <= 0.03) continue;

            const interpX = p.prevX + (p.x - p.prevX) * alphaInterp;
            const interpY = p.prevY + (p.y - p.prevY) * alphaInterp;

            const refraction = stressStore.getBoundaryRefractionOffset(interpX, interpY, this.simulationTimeSec);
            const drawX = interpX + refraction.dx;
            const drawY = interpY + refraction.dy;

            if (p.depthTier === 'FOREGROUND' && !fullXRay) {
                const bokehR = p.radius * 4.4;
                const grad = ctx.createRadialGradient(drawX, drawY, 0.5, drawX, drawY, bokehR);
                grad.addColorStop(0, RenderPipeline.hexToRgba(theme.somaHaloColor, 0.14 * p.energy));
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(drawX, drawY, bokehR, 0, Math.PI * 2);
                ctx.fill();
                continue;
            }

            const truthFactor = stressStore.getTruthRevealFactorAt(interpX, interpY, fullXRay);
            const charge = p.synapticCharge;
            const flash = p.interferenceFlash;

            if (truthFactor < 0.85 || logicW > 0.2) {
                const alpha = Math.min(1.0, 0.34 + p.energy * 0.54 + charge * 0.4);
                const haloColor = flash > 0.2 ? '#f59e0b' : theme.somaHaloColor;

                if (flash > 0.05) {
                    const ringR = p.radius * (2.8 + (1.0 - flash) * 11.5);
                    ctx.strokeStyle = RenderPipeline.hexToRgba('#f59e0b', flash * 0.78);
                    ctx.lineWidth = 1.25;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, ringR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if ((charge > 0.22 || uState.currentPhase === '03_EVOLUTION') && p.id % 5 === 0) {
                    this.renderNeuronDendrites(ctx, drawX, drawY, p.phaseOffset, 0.32 + charge * 0.52, haloColor);
                }

                const haloR = p.radius * (3.0 + charge * 2.6);
                ctx.fillStyle = RenderPipeline.hexToRgba(haloColor, alpha * 0.22);
                ctx.beginPath();
                ctx.arc(drawX, drawY, haloR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = RenderPipeline.hexToRgba(theme.somaCoreColor, alpha);
                ctx.beginPath();
                ctx.arc(drawX, drawY, p.radius * (1.0 + charge * 0.42), 0, Math.PI * 2);
                ctx.fill();
            }

            if (truthFactor >= 0.35 || logicW > 0.35) {
                const xrayAlpha = Math.max(truthFactor, logicW) * 0.84;
                ctx.strokeStyle = RenderPipeline.hexToRgba(theme.axonColor, xrayAlpha);
                ctx.lineWidth = 0.75;
                const s = p.radius * 2.1;
                ctx.strokeRect(interpX - s * 0.5, interpY - s * 0.5, s, s);

                const speedMag = Math.hypot(p.vx, p.vy);
                if (speedMag > 0.5) {
                    const logLen = Math.log1p(speedMag) * 5.2;
                    const vxNorm = (p.vx / speedMag) * logLen;
                    const vyNorm = (p.vy / speedMag) * logLen;
                    ctx.beginPath();
                    ctx.moveTo(interpX, interpY);
                    ctx.lineTo(interpX + vxNorm, interpY + vyNorm);
                    ctx.stroke();
                }
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
        ctx.strokeStyle = RenderPipeline.hexToRgba(colorHex, intensity * 0.45);
        ctx.lineWidth = 0.75;
        for (let d = 0; d < 4; d++) {
            const a = baseAngle + (d * Math.PI) / 2;
            const len = 8.5 + intensity * 10.5;
            const mx = x + Math.cos(a) * len;
            const my = y + Math.sin(a) * len;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(mx, my);
            ctx.lineTo(mx + Math.cos(a + 0.48) * (len * 0.62), my + Math.sin(a + 0.48) * (len * 0.62));
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(a - 0.48) * (len * 0.62), my + Math.sin(a - 0.48) * (len * 0.62));
            ctx.stroke();
        }
        ctx.restore();
    }

    // --------------------------------------------------------------------------
    // 8. FX 03: КООРДИНАТНАЯ СЕТКА, ЛИНЗА BREACH LENS И ВЫНОСКИ С МЕТКОЙ ЯЗЫКА
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

        ctx.strokeStyle = RenderPipeline.hexToRgba(truthColor, fullXRay ? 0.1 : 0.16);
        ctx.lineWidth = 0.6;
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
        if (sState.ghostHintAlpha > 0.01 && !fullXRay) {
            ctx.save();
            ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', sState.ghostHintAlpha);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.arc(
                sState.lensX,
                sState.lensY,
                34 + Math.sin(this.simulationTimeSec * 3.0) * 6,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
        }

        if (!fullXRay && sState.currentBreachRadius > 4) {
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
            ctx.strokeStyle = RenderPipeline.hexToRgba(truthHex, sState.isBreaching ? 0.68 : 0.26);
            ctx.lineWidth = sState.isBreaching ? 1.2 : 0.8;
            ctx.stroke();

            for (let c = 0; c < sState.microCracks.length; c++) {
                const crack = sState.microCracks[c];
                const rimR = stressStore.getDeformedLensRadiusAtAngle(crack.anchorAngle, this.simulationTimeSec);
                const ox = sState.lensX + Math.cos(crack.anchorAngle) * rimR;
                const oy = sState.lensY + Math.sin(crack.anchorAngle) * rimR;

                ctx.strokeStyle = RenderPipeline.hexToRgba('#f8fafc', crack.life * 0.78);
                for (let s = 0; s < crack.segments.length; s++) {
                    const seg = crack.segments[s];
                    ctx.lineWidth = seg.thickness;
                    ctx.beginPath();
                    ctx.moveTo(ox + seg.x1, oy + seg.y1);
                    ctx.lineTo(ox + seg.x2, oy + seg.y2);
                    ctx.stroke();
                }
                ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', crack.life * 0.55);
                for (let b = 0; b < crack.branches.length; b++) {
                    const br = crack.branches[b];
                    ctx.lineWidth = br.thickness;
                    ctx.beginPath();
                    ctx.moveTo(ox + br.x1, oy + br.y1);
                    ctx.lineTo(ox + br.x2, oy + br.y2);
                    ctx.stroke();
                }
            }

            if (sState.isBreaching || sState.revealIntensity > 0.45) {
                this.renderOpticalCalloutsWithOwnerTags(
                    ctx,
                    particles,
                    sState.lensX,
                    sState.lensY,
                    sState.currentBreachRadius,
                    truthHex
                );
            }
            ctx.restore();
        } else if (fullXRay) {
            const { viewportWidth, viewportHeight } = this.pipeline.getCapabilities();
            this.renderOpticalCalloutsWithOwnerTags(
                ctx,
                particles,
                viewportWidth * 0.5,
                viewportHeight * 0.5,
                Math.min(viewportWidth, viewportHeight) * 0.38,
                truthHex
            );
        }
    }

    private renderOpticalCalloutsWithOwnerTags(
        ctx: CanvasRenderingContext2D,
        particles: ReadonlyArray<QuantumParticle>,
        lensX: number,
        lensY: number,
        lensRadius: number,
        truthHex: string
    ): void {
        const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
        const uState = universeStore.getState();
        const digestShort = uState.telemetry.stateDigestHex.slice(0, 6);
        let count = 0;

        ctx.font = '10px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        for (let i = 0; i < particles.length && count < 5; i += 17) {
            const p = particles[i];
            const dx = p.x - lensX;
            const dy = p.y - lensY;
            const d = Math.hypot(dx, dy);

            if (d < lensRadius * 0.76) {
                const targetLx = p.x + (dx >= 0 ? 18 : -168);
                const targetLy = p.y - 10;

                const prevPos = this.calloutHysteresisMap.get(p.id);
                const lx = prevPos ? prevPos.x + (targetLx - prevPos.x) * 0.25 : targetLx;
                const ly = prevPos ? prevPos.y + (targetLy - prevPos.y) * 0.25 : targetLy;
                this.calloutHysteresisMap.set(p.id, { x: lx, y: ly });

                const boxW = 158;
                const boxH = 36;

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

                const speed = Math.round(Math.hypot(p.vx, p.vy));
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(`ID#${p.id} [${p.moduleTag}]`, lx, ly);
                ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.88);
                ctx.fillText(
                    `v:${speed} deg:${p.degree} Z:${p.depthZ.toFixed(2)} ${digestShort}`,
                    lx,
                    ly + 12
                );
            }
        }
    }
}

// ----------------------------------------------------------------------------
// 9. АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ СЦЕНЫ И ОСТРОВОВ ИНСПЕКЦИИ НА КЛИЕНТЕ
// ----------------------------------------------------------------------------
export function bootstrapUniverseV2(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('universe-canvas') as HTMLCanvasElement | null;
    if (!canvas || canvas.getAttribute('data-bootstrapped') === 'true') return;
    canvas.setAttribute('data-bootstrapped', 'true');

    const renderer = new UniverseRenderer(canvas);
    renderer.start();

    pythonSocketClient.connect();

    mountLayer2Metrics(document.getElementById('layer2-metrics-root'));
    mountLayer3Topology(document.getElementById('layer3-topology-root'));
    mountLayer4Terminal(document.getElementById('layer4-terminal-root'));
    mountLayer5CipherFinale(document.getElementById('layer5-finale-root'));

    const elHudRoot = document.getElementById('hud-overlay-root');
    const elCodename = document.getElementById('ui-phase-codename');
    const elTitle = document.getElementById('ui-phase-title');
    const elSubtitle = document.getElementById('ui-phase-subtitle');
    const elPhilosophy = document.getElementById('ui-phase-philosophy');
    const elProgress = document.getElementById('ui-phase-progress');

    const btnPause = document.getElementById('btn-toggle-pause');
    const btnAutoCycle = document.getElementById('btn-toggle-autocycle');
    const btnAudio = document.getElementById('btn-toggle-audio');
    const btnMetrics = document.getElementById('btn-toggle-metrics');
    const btnTopology = document.getElementById('btn-toggle-topology');
    const btnTerminal = document.getElementById('btn-toggle-terminal');
    const btnXRay = document.getElementById('btn-toggle-xray');
    const phaseButtons = document.querySelectorAll<HTMLButtonElement>('[data-phase-id]');

    let lastPhase: PhaseId = universeStore.getState().currentPhase;
    let kioskRestartTimer: number | null = null;

    universeStore.subscribe((state: Readonly<UniverseState>) => {
        if (elCodename) elCodename.textContent = state.phaseMeta.codeName;
        if (elTitle) elTitle.textContent = state.phaseMeta.titleRu;
        if (elSubtitle) elSubtitle.textContent = state.phaseMeta.subtitleRu;
        if (elPhilosophy) elPhilosophy.textContent = state.phaseMeta.philosophyRu;

        if (elProgress) {
            elProgress.style.width = `${Math.min(100, Math.round(state.telemetry.phaseProgress * 100))}%`;
        }

        const hideHudForFinale =
            state.singularityAct === 'ACT_C_ZERO_SILENCE' ||
            state.singularityAct === 'ACT_D_GITHUB_CARD' ||
            state.singularityAct === 'RESTART_COLLAPSE';
        elHudRoot?.classList.toggle('act-silence-hidden', hideHudForFinale);

        if (
            state.kioskMode &&
            state.singularityAct === 'ACT_D_GITHUB_CARD' &&
            state.githubCardAssemblyProgress >= 1.0 &&
            kioskRestartTimer === null
        ) {
            kioskRestartTimer = window.setTimeout(() => {
                kioskRestartTimer = null;
                universeStore.triggerUniverseRestart();
            }, 12000);
        }

        phaseButtons.forEach((btn) => {
            const id = btn.getAttribute('data-phase-id');
            btn.classList.toggle('active', id === state.currentPhase);
        });

        if (btnPause) {
            btnPause.textContent = state.isPaused ? '▶ RESUME' : '⏸ PAUSE';
            btnPause.classList.toggle('active-toggle', state.isPaused);
        }
        if (btnAutoCycle) {
            btnAutoCycle.textContent = state.autoCyclePhases ? '🔄 AUTO: ON' : '🔄 AUTO: OFF';
            btnAutoCycle.classList.toggle('active-toggle', state.autoCyclePhases);
        }
        if (btnAudio) {
            const aStatus = state.telemetry.audioStatus;
            btnAudio.textContent =
                aStatus === 'PLAYING_MP3' || aStatus === 'PLAYING_SYNTH'
                    ? '🔊 AUDIO: ON'
                    : aStatus === 'MUTED'
                        ? '🔇 AUDIO: OFF'
                        : '🔊 AUDIO: CLICK';
            btnAudio.classList.toggle('active-toggle', state.audioEnabled);
        }
        if (btnMetrics) {
            btnMetrics.classList.toggle('active-toggle', state.layers.layer2_metricsHud);
        }
        if (btnTopology) {
            btnTopology.classList.toggle('active-toggle', state.inspectionLevel === 'TOPOLOGY');
        }
        if (btnTerminal) {
            btnTerminal.classList.toggle('active-toggle', state.layers.layer4_architectTerminal);
        }
        if (btnXRay) {
            btnXRay.classList.toggle('active-toggle', state.layers.layer5_truthXRayMode);
        }

        if (state.currentPhase !== lastPhase) {
            lastPhase = state.currentPhase;
            audioSync.transitionToPhase(state.currentPhase);
        }
    });

    phaseButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const phaseId = btn.getAttribute('data-phase-id') as PhaseId | null;
            if (phaseId) universeStore.setPhase(phaseId);
        });
    });

    btnPause?.addEventListener('click', () => universeStore.togglePause());
    btnAutoCycle?.addEventListener('click', () => universeStore.toggleAutoCycle());
    btnAudio?.addEventListener('click', () => {
        const nextAudio = !universeStore.getState().audioEnabled;
        audioSync.setEnabled(nextAudio);
    });
    btnMetrics?.addEventListener('click', () => universeStore.toggleLayer('layer2_metricsHud'));
    btnTopology?.addEventListener('click', () => {
        const current = universeStore.getState().inspectionLevel;
        universeStore.setInspectionLevel(current === 'TOPOLOGY' ? 'COSMOS' : 'TOPOLOGY');
    });
    btnTerminal?.addEventListener('click', () =>
        universeStore.toggleLayer('layer4_architectTerminal')
    );
    btnXRay?.addEventListener('click', () => universeStore.toggleLayer('layer5_truthXRayMode'));

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === '1') universeStore.setInspectionLevel('COSMOS');
        else if (e.key === '2') universeStore.toggleLayer('layer2_metricsHud');
        else if (e.key === '3') universeStore.setInspectionLevel('TOPOLOGY');
        else if (e.key === '4') universeStore.toggleLayer('layer4_architectTerminal');
        else if (e.key === '5') universeStore.toggleLayer('layer5_truthXRayMode');
        else if (e.key.toLowerCase() === 'p') universeStore.togglePause();
        else if (e.key.toLowerCase() === 'm') {
            audioSync.setEnabled(!universeStore.getState().audioEnabled);
        } else if (e.key.toLowerCase() === 'r' && e.shiftKey) {
            universeStore.triggerUniverseRestart();
        }
    });
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapUniverseV2);
    } else {
        bootstrapUniverseV2();
    }
}