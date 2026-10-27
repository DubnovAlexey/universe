// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/nexusPass.ts
// НАЗНАЧЕНИЕ: Отрисовка графа NEXUS, синаптических импульсов и частиц Z0..Z3.
// РАЗДЕЛЫ: 1. КРИВЫЕ ГРАФА И КОМЕТЫ ИМПУЛЬСОВ; 2. ЧАСТИЦЫ, СОМЫ НЕЙРОНОВ И БОКЕ.
// ФУНКЦИИ: renderTopologyEdgesAndPulses, renderMultiEchelonParticles.
// Порядок вызовов и общий жизненный цикл кадра задаёт UniverseRenderer.
// ============================================================================

import type { PhaseId } from '../../store/universeState';
import { stressStore } from '../../store/stressState';
import { RenderPipeline } from '../pipeline';
import type { QuantumParticle, SynapticPulse, TopologyEdge } from '../../phases/01_void';
import { NexusGraphEngine } from '../../bridge/simulationWorker';
import type { AudioModulationSnapshot } from '../../utils/audioSync';
import { TAU, clamp } from '../math/noise2d';
import { renderBorderlessNodeCallout } from './nodeCallout';

// НАЧАЛО РАЗДЕЛА 1. КРИВЫЕ ГРАФА И КОМЕТЫ ИМПУЛЬСОВ
// НАЧАЛО ФУНКЦИИ renderTopologyEdgesAndPulses
/**
 * Отрисовывает 3 класса кривых Безье графа NEXUS (AXON_TRUNK, BRIDGE, DENDRITE)
 * с сужением по биофизическому закону Мюррея и движущиеся по длине дуги (lengthLUT)
 * кометы синаптических импульсов.
 */
export function renderTopologyEdgesAndPulses(
    ctx: CanvasRenderingContext2D,
    edges: ReadonlyArray<TopologyEdge>,
    pulses: ReadonlyArray<SynapticPulse>,
    phase: PhaseId,
    phaseProgress: number,
    fullXRayMode: boolean,
    audioSnap: AudioModulationSnapshot
): void {
    const baseGraphWeight = fullXRayMode
        ? 0.92
        : phase === '03_EVOLUTION' || phase === '04_COLLAPSE'
            ? 0.85
            : phase === '02_GENESIS'
                ? 0.25 + phaseProgress * 0.45
                : phase === '01_VOID'
                    ? 0.16
                    : 0.42;

    ctx.save();

    for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (e.arcLength < 8.0) continue;

        const revealBoost = Math.max(baseGraphWeight, e.truthVisibility * 0.95);
        const alpha = clamp(
            (e.edgeClass === 'AXON_TRUNK'
                ? 0.34
                : e.edgeClass === 'BRIDGE'
                    ? 0.21
                    : 0.13) *
            e.strength *
            revealBoost +
            e.afterglow * 0.45,
            0.0,
            0.92
        );
        if (alpha < 0.015) continue;

        let colorHex = '#38bdf8';
        if (e.afterglow > 0.82) {
            colorHex = '#f8fafc';
        } else if (e.edgeClass === 'AXON_TRUNK') {
            colorHex = e.afterglow > 0.25 ? '#f8fafc' : '#7dd3fc';
        } else if (e.edgeClass === 'BRIDGE') {
            colorHex = '#38bdf8';
        } else {
            colorHex = '#6366f1';
        }

        ctx.strokeStyle = RenderPipeline.hexToRgba(colorHex, alpha);
        ctx.lineWidth =
            e.murrayRadiusPx *
            (0.75 + 0.25 * revealBoost) *
            (1.0 + e.afterglow * 0.35);

        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.quadraticCurveTo(e.ctrlX, e.ctrlY, e.x2, e.y2);
        ctx.stroke();
    }

    for (let i = 0; i < pulses.length; i++) {
        const pulse = pulses[i];
        const headPos = NexusGraphEngine.sampleBezierByArcLength(
            pulse.x1,
            pulse.y1,
            pulse.ctrlX,
            pulse.ctrlY,
            pulse.x2,
            pulse.y2,
            pulse.lengthLUT,
            pulse.progress
        );
        const tailFrac = Math.max(0, pulse.progress - pulse.tailLength);
        const tailPos = NexusGraphEngine.sampleBezierByArcLength(
            pulse.x1,
            pulse.y1,
            pulse.ctrlX,
            pulse.ctrlY,
            pulse.x2,
            pulse.y2,
            pulse.lengthLUT,
            tailFrac
        );

        const isCascadePeak = pulse.cascadeDepth >= 2 || i % 7 === 0;
        const headColor = '#f8fafc';
        const midColor = isCascadePeak ? '#bae6fd' : '#7dd3fc';

        const tailGrad = ctx.createLinearGradient(
            tailPos.x,
            tailPos.y,
            headPos.x,
            headPos.y
        );
        tailGrad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
        tailGrad.addColorStop(
            0.6,
            RenderPipeline.hexToRgba(midColor, pulse.intensity * 0.55 * baseGraphWeight)
        );
        tailGrad.addColorStop(
            1.0,
            RenderPipeline.hexToRgba(headColor, pulse.intensity * 0.95 * baseGraphWeight)
        );

        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = pulse.edgeClass === 'AXON_TRUNK' ? 2.1 : 1.45;
        ctx.beginPath();
        ctx.moveTo(tailPos.x, tailPos.y);
        ctx.lineTo(headPos.x, headPos.y);
        ctx.stroke();

        const rGlow = (2.4 + 1.4 * audioSnap.pulse) * pulse.intensity;
        const headGlow = ctx.createRadialGradient(
            headPos.x,
            headPos.y,
            0.4,
            headPos.x,
            headPos.y,
            rGlow * 2.8
        );
        headGlow.addColorStop(
            0.0,
            RenderPipeline.hexToRgba(headColor, 0.92 * baseGraphWeight)
        );
        headGlow.addColorStop(
            0.5,
            RenderPipeline.hexToRgba(midColor, 0.42 * baseGraphWeight)
        );
        headGlow.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, rGlow * 2.8, 0, TAU);
        ctx.fill();
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderTopologyEdgesAndPulses
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ЧАСТИЦЫ, СОМЫ НЕЙРОНОВ И БОКЕ
// НАЧАЛО ФУНКЦИИ renderMultiEchelonParticles
/**
 * Отрисовывает частицы, трёхчастные сомы нейронов и боке переднего плана по 4 эшелонам Z0..Z3
 * с учётом C1/C2-преломления на кромке линзы BREACH LENS.
 */
export function renderMultiEchelonParticles(
    ctx: CanvasRenderingContext2D,
    particles: ReadonlyArray<QuantumParticle>,
    simTimeSec: number,
    phase: PhaseId,
    fullXRayMode: boolean,
    audioSnap: AudioModulationSnapshot
): void {
    ctx.save();
    let xrayCalloutsRendered = 0;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const refract = stressStore.getBoundaryRefractionOffset(p.x, p.y, simTimeSec);
        const sx = p.x + refract.dx;
        const sy = p.y + refract.dy;

        const breath = 0.84 + 0.24 * Math.sin(p.kuramotoPhase + simTimeSec * 1.1);
        const radius =
            p.radius *
            breath *
            (1.0 + refract.rimHighlight * 0.35 + audioSnap.pulse * 0.14);
        const alpha = clamp(
            (0.38 + p.energy * 0.56 + p.synapticCharge * 0.35) *
            (p.depthTier === 'DEEP_LAYER'
                ? 0.55
                : p.depthTier === 'BACKGROUND'
                    ? 0.75
                    : 1.0),
            0.08,
            0.98
        );

        if (p.depthTier === 'FOREGROUND') {
            const bokehR = radius * 3.4;
            const bokehGrad = ctx.createRadialGradient(sx, sy, 0.5, sx, sy, bokehR);
            bokehGrad.addColorStop(
                0.0,
                RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.26)
            );
            bokehGrad.addColorStop(
                0.6,
                RenderPipeline.hexToRgba('#6366f1', alpha * 0.09)
            );
            bokehGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
            ctx.fillStyle = bokehGrad;
            ctx.beginPath();
            ctx.arc(sx, sy, bokehR, 0, TAU);
            ctx.fill();
            continue;
        }

        const isExcitedSoma = p.interferenceFlash > 0.15 || p.synapticCharge > 0.65;
        if (
            isExcitedSoma ||
            p.degree >= 3 ||
            refract.rimHighlight > 0.25 ||
            phase === '03_EVOLUTION'
        ) {
            const haloR = radius * (isExcitedSoma ? 4.2 : 3.2);
            const haloColor = isExcitedSoma
                ? '#bae6fd'
                : p.clusterId % 3 === 0
                    ? '#7dd3fc'
                    : '#6366f1';
            const haloGrad = ctx.createRadialGradient(sx, sy, 0.4, sx, sy, haloR);
            haloGrad.addColorStop(
                0.0,
                RenderPipeline.hexToRgba(
                    haloColor,
                    alpha * (isExcitedSoma ? 0.62 : 0.36)
                )
            );
            haloGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(sx, sy, haloR, 0, TAU);
            ctx.fill();
        }

        ctx.fillStyle = isExcitedSoma
            ? RenderPipeline.hexToRgba('#f8fafc', alpha)
            : p.depthTier === 'MIDGROUND'
                ? RenderPipeline.hexToRgba('#f8fafc', alpha * 0.94)
                : RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.82);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, radius), 0, TAU);
        ctx.fill();

        if (fullXRayMode && p.degree >= 3 && i % 29 === 0 && xrayCalloutsRendered < 6) {
            renderBorderlessNodeCallout(ctx, sx, sy, p, simTimeSec, 0.88);
            xrayCalloutsRendered++;
        }
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderMultiEchelonParticles
// КОНЕЦ РАЗДЕЛА 2
