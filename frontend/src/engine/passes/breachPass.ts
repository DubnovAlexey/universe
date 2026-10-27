// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/breachPass.ts
// НАЗНАЧЕНИЕ: Отрисовка органической мембраны BREACH LENS и глубинного эшелона Z4.
// РАЗДЕЛЫ: 1. АПЕРТУРА, РЕНТГЕНОВСКАЯ СЕТКА, МИКРОТРЕЩИНЫ И ТОКИ Z4.
// ФУНКЦИИ: renderBreachLensAndSubQuantumZ4.
// Порядок вызовов и общий жизненный цикл кадра задаёт UniverseRenderer.
// ============================================================================

import { smootherstep, type UniverseState } from '../../store/universeState';
import { stressStore } from '../../store/stressState';
import { RenderPipeline } from '../pipeline';
import type { QuantumParticle } from '../../phases/01_void';
import type { AudioModulationSnapshot } from '../../utils/audioSync';
import type { SubQuantumNodeZ4 } from '../backgroundFields';
import { TAU, clamp, fbm2D } from '../math/noise2d';
import { renderBorderlessNodeCallout } from './nodeCallout';

// НАЧАЛО РАЗДЕЛА 1. АПЕРТУРА, РЕНТГЕНОВСКАЯ СЕТКА, МИКРОТРЕЩИНЫ И ТОКИ Z4
// НАЧАЛО ФУНКЦИИ renderBreachLensAndSubQuantumZ4
/**
 * Отрисовывает мембрану BREACH LENS, криволинейные геодезические клеточки рентгена,
 * микротрещины и глубинный суб-квантовый слой Z4 («обратную сторону Вселенной»).
 * ИСПРАВЛЕНО: В Акте B (ACT_B_LOGIC) радиус схождения оптики сжимается строго в 0 px
 * вместе с Чёрной дырой, поэтому на экране никогда не застревает гигантский статичный круг.
 */
export function renderBreachLensAndSubQuantumZ4(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    simTimeSec: number,
    state: Readonly<UniverseState>,
    particles: ReadonlyArray<QuantumParticle>,
    audioSnap: AudioModulationSnapshot,
    subQuantumZ4: readonly SubQuantumNodeZ4[]
): void {
    const sState = stressStore.getState();
    const userFullXRay = state.layers.layer5_truthXRayMode;
    const isLogicActB =
        state.currentPhase === '05_SINGULARITY' &&
        state.singularityAct === 'ACT_B_LOGIC';

    // В Акте D (во время показа визитки) линза рентгена отключена, если пользователь
    // явно не включил кнопку X-RAY и не зажимает кнопку мыши
    if (
        state.currentPhase === '05_SINGULARITY' &&
        (state.singularityAct === 'ACT_D_GITHUB_CARD' ||
            state.singularityAct === 'RESTART_COLLAPSE') &&
        !userFullXRay &&
        !sState.isBreaching
    ) {
        return;
    }

    let activeRadius = sState.currentBreachRadius;
    let revealStrength = Math.max(
        sState.revealIntensity,
        sState.isPointerInside ? 0.42 : 0.0
    );

    if (userFullXRay) {
        activeRadius = Math.min(w, h) * 0.44;
        revealStrength = 0.88;
    } else if (isLogicActB) {
        // Плавное сжатие радиуса оптического кольца из 42% экрана строго в 0 px (Точку Нуля)
        const collapseT = smootherstep(0.05, 0.98, state.singularityActProgress);
        const shrinkEnv = Math.pow(1.0 - collapseT, 1.85);
        activeRadius = Math.max(
            sState.currentBreachRadius,
            Math.min(w, h) * 0.42 * shrinkEnv
        );
        revealStrength = Math.max(
            revealStrength,
            Math.sin(collapseT * Math.PI) * 0.78
        );
    }

    if (activeRadius < 5.0 || revealStrength < 0.02) {
        return;
    }

    const useCenterLock = (userFullXRay || isLogicActB) && !sState.isPointerInside;
    const lx = useCenterLock ? cx : sState.lensX;
    const ly = useCenterLock ? cy : sState.lensY;

    ctx.save();

    const z4BgGrad = ctx.createRadialGradient(
        lx,
        ly,
        activeRadius * 0.05,
        lx,
        ly,
        activeRadius * 1.12
    );
    z4BgGrad.addColorStop(
        0.0,
        RenderPipeline.hexToRgba('#060b19', 0.72 * revealStrength)
    );
    z4BgGrad.addColorStop(
        0.55,
        RenderPipeline.hexToRgba('#1e1b4b', 0.34 * revealStrength)
    );
    z4BgGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
    ctx.fillStyle = z4BgGrad;
    ctx.beginPath();
    ctx.arc(lx, ly, activeRadius * 1.12, 0, TAU);
    ctx.fill();

    const parallaxX = (lx - cx) * -0.16;
    const parallaxY = (ly - cy) * -0.16;

    for (let i = 0; i < subQuantumZ4.length; i++) {
        const zNode = subQuantumZ4[i];
        const zx = cx + zNode.xNorm * w + parallaxX;
        const zy = cy + zNode.yNorm * h + parallaxY;

        const dist = Math.hypot(zx - lx, zy - ly);
        if (dist >= activeRadius) continue;

        const u = dist / activeRadius;
        const bellMask = Math.pow(1.0 - u * u, 2.0) * revealStrength;
        if (bellMask < 0.02) continue;

        for (let nIdx = 0; nIdx < zNode.neighbors.length; nIdx++) {
            const nb = subQuantumZ4[zNode.neighbors[nIdx]];
            const nbx = cx + nb.xNorm * w + parallaxX;
            const nby = cy + nb.yNorm * h + parallaxY;

            if (Math.hypot(nbx - lx, nby - ly) >= activeRadius * 1.04) continue;

            const bend = zNode.ctrlBends[nIdx] ?? 0.14;
            const ctrlX = (zx + nbx) * 0.5 - (nby - zy) * bend;
            const ctrlY = (zy + nby) * 0.5 + (nbx - zx) * bend;

            ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', 0.26 * bellMask);
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(zx, zy);
            ctx.quadraticCurveTo(ctrlX, ctrlY, nbx, nby);
            ctx.stroke();

            const pT = (simTimeSec * 0.78 + i * 0.17 + nIdx * 0.33) % 1.0;
            const omt = 1.0 - pT;
            const ix = omt * omt * zx + 2.0 * omt * pT * ctrlX + pT * pT * nbx;
            const iy = omt * omt * zy + 2.0 * omt * pT * ctrlY + pT * pT * nby;

            ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.74 * bellMask);
            ctx.beginPath();
            ctx.arc(ix, iy, 1.3, 0, TAU);
            ctx.fill();
        }

        const zPulse = 0.5 + 0.5 * Math.sin(zNode.phase + simTimeSec * 2.3);
        ctx.fillStyle = RenderPipeline.hexToRgba(
            '#7dd3fc',
            (0.35 + 0.45 * zPulse) * bellMask
        );
        ctx.beginPath();
        ctx.arc(zx, zy, 1.4 + 0.8 * zPulse, 0, TAU);
        ctx.fill();
    }

    const cellStep = 34;
    const halfSpan = Math.ceil(activeRadius / cellStep) * cellStep;
    const baseGx = Math.floor(lx / cellStep) * cellStep;
    const baseGy = Math.floor(ly / cellStep) * cellStep;

    for (let gx = baseGx - halfSpan; gx <= baseGx + halfSpan; gx += cellStep) {
        for (let gy = baseGy - halfSpan; gy <= baseGy + halfSpan; gy += cellStep) {
            const dx = gx - lx;
            const dy = gy - ly;
            const d = Math.hypot(dx, dy);
            if (d >= activeRadius * 0.92) continue;

            const u = d / (activeRadius * 0.92);
            const cellAlpha = Math.pow(1.0 - u * u, 2.0) * revealStrength * 0.22;
            if (cellAlpha < 0.015) continue;

            const warpX =
                Math.sin(gy * 0.025 + simTimeSec * 1.4) * 3.2 * (1.0 - u);
            const warpY =
                Math.cos(gx * 0.025 - simTimeSec * 1.4) * 3.2 * (1.0 - u);
            const px = gx + warpX;
            const py = gy + warpY;

            ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', cellAlpha);
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(px - cellStep * 0.45, py);
            ctx.lineTo(px + cellStep * 0.45, py);
            ctx.moveTo(px, py - cellStep * 0.45);
            ctx.lineTo(px, py + cellStep * 0.45);
            ctx.stroke();
        }
    }

    const rimSegs = 96;
    const rimChunks = 16;
    const segPerChunk = rimSegs / rimChunks;

    for (let c = 0; c < rimChunks; c++) {
        const s0 = c * segPerChunk;
        const s1 = (c + 1) * segPerChunk;
        const midAngle = (((s0 + s1) * 0.5) / rimSegs) * TAU;
        const crest =
            0.5 +
            0.5 *
            Math.sin(
                midAngle * 3.0 - simTimeSec * 2.2 + Math.cos(midAngle * 2.0)
            );
        const rimAlpha = revealStrength * (0.08 + 0.48 * Math.pow(crest, 1.4));
        if (rimAlpha < 0.02) continue;

        ctx.beginPath();
        for (let s = s0; s <= s1; s++) {
            const theta = (s / rimSegs) * TAU;
            const deformedR =
                userFullXRay || isLogicActB
                    ? activeRadius *
                    (1.0 + 0.03 * Math.sin(theta * 4.0 + simTimeSec * 1.8))
                    : stressStore.getDeformedLensRadiusAtAngle(theta, simTimeSec) *
                    (1.0 +
                        0.028 *
                        fbm2D(
                            Math.cos(theta) * 2.0,
                            Math.sin(theta) * 2.0 + simTimeSec * 0.5,
                            3
                        ));
            const px = lx + Math.cos(theta) * deformedR;
            const py = ly + Math.sin(theta) * deformedR;
            if (s === s0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', rimAlpha);
        ctx.lineWidth = 0.95 + 0.9 * crest * (1.0 + 0.2 * audioSnap.pulse);
        ctx.stroke();
    }

    for (let i = 0; i < sState.microCracks.length; i++) {
        const crack = sState.microCracks[i];
        const baseR = stressStore.getDeformedLensRadiusAtAngle(
            crack.anchorAngle,
            simTimeSec
        );
        const anchorX = lx + Math.cos(crack.anchorAngle) * baseR;
        const anchorY = ly + Math.sin(crack.anchorAngle) * baseR;
        const crackAlpha = clamp(
            crack.life * crack.intensity * revealStrength,
            0,
            0.85
        );
        if (crackAlpha < 0.02) continue;

        ctx.strokeStyle = RenderPipeline.hexToRgba('#f8fafc', crackAlpha);
        for (let s = 0; s < crack.segments.length; s++) {
            const seg = crack.segments[s];
            ctx.lineWidth = seg.thickness;
            ctx.beginPath();
            ctx.moveTo(anchorX + seg.x1, anchorY + seg.y1);
            ctx.lineTo(anchorX + seg.x2, anchorY + seg.y2);
            ctx.stroke();
        }
        ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', crackAlpha * 0.7);
        for (let b = 0; b < crack.branches.length; b++) {
            const br = crack.branches[b];
            ctx.lineWidth = br.thickness;
            ctx.beginPath();
            ctx.moveTo(anchorX + br.x1, anchorY + br.y1);
            ctx.lineTo(anchorX + br.x2, anchorY + br.y2);
            ctx.stroke();
        }
    }

    let calloutCount = 0;
    for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        const d = Math.hypot(pt.x - lx, pt.y - ly);
        if (d >= activeRadius * 0.82) continue;

        const u = d / (activeRadius * 0.82);
        const localMask = Math.pow(1.0 - u * u, 1.8) * revealStrength;

        if (i % 4 === 0) {
            const speed = Math.hypot(pt.vx, pt.vy);
            if (speed > 0.15) {
                const logLen = Math.log(1.0 + speed) * 9.5;
                const ux = pt.vx / speed;
                const uy = pt.vy / speed;
                ctx.strokeStyle = RenderPipeline.hexToRgba(
                    '#38bdf8',
                    localMask * 0.48
                );
                ctx.lineWidth = 0.65;
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(pt.x + ux * logLen, pt.y + uy * logLen);
                ctx.stroke();
            }
        }

        if (calloutCount < 4 && i % 23 === 0 && d < activeRadius * 0.68) {
            renderBorderlessNodeCallout(
                ctx,
                pt.x,
                pt.y,
                pt,
                simTimeSec,
                localMask
            );
            calloutCount++;
        }
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderBreachLensAndSubQuantumZ4
// КОНЕЦ РАЗДЕЛА 1
