// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/cosmosPass.ts
// НАЗНАЧЕНИЕ: Послойная отрисовка космического фона, светового эха и когнитивных полушарий.
// РАЗДЕЛЫ: 1. СВЕТОВОЕ ЭХО RS PUPPIS; 2. СПИРАЛЬНАЯ ПЫЛЬ И КАНЬОНЫ ПОГЛОЩЕНИЯ; 3. КРИВОЛИНЕЙНЫЕ ПОЛЕВЫЕ СИГНАЛЫ; 4. КОГНИТИВНЫЕ ПОЛУШАРИЯ И КЕПЛЕРОВСКИЕ КОЛЬЦА.
// ФУНКЦИИ: renderBreathingLightEchoRings, renderSpiralDustAndCanyons, renderCurvedFieldSignals, renderCorticalHemispheresAndKeplerRings.
// Порядок вызовов и общий жизненный цикл кадра задаёт UniverseRenderer.
// ============================================================================

import type { PhaseId } from '../../store/universeState';
import { stressStore } from '../../store/stressState';
import { RenderPipeline } from '../pipeline';
import type { QuantumParticle } from '../../phases/01_void';
import type { AudioModulationSnapshot } from '../../utils/audioSync';
import type { SpiralDustCloud, CurvedFieldSignal } from '../backgroundFields';
import { TAU, clamp, fbm2D } from '../math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. СВЕТОВОЕ ЭХО RS PUPPIS
// НАЧАЛО ФУНКЦИИ renderBreathingLightEchoRings
/**
 * Отрисовывает нестабильные, живо дышащие концентрические кольца светового эха
 * переменной звезды RS Puppis с угловой модуляцией FBM и притяжением к сгусткам энергии.
 */
export function renderBreathingLightEchoRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    simTimeSec: number,
    masterAlpha: number,
    particles: ReadonlyArray<QuantumParticle>,
    audioSnap: AudioModulationSnapshot
): void {
    const ringCount = 7;
    const totalSegs = 120;
    const arcChunks = 24;
    const segsPerChunk = totalSegs / arcChunks;

    ctx.save();

    for (let k = 0; k < ringCount; k++) {
        const chirpFactor = Math.pow(1.0 - k / (ringCount + 1.5), 1.65);
        const cycleProgress = (simTimeSec * 0.135 + chirpFactor) % 1.0;
        const baseRadiusPx = (0.045 + Math.pow(cycleProgress, 0.86) * 0.48) * scale;

        const envelopeFade =
            Math.sin(cycleProgress * Math.PI) *
            Math.exp(-cycleProgress * 1.08) *
            masterAlpha;
        if (envelopeFade < 0.02) continue;

        for (let c = 0; c < arcChunks; c++) {
            const sStart = c * segsPerChunk;
            const sEnd = (c + 1) * segsPerChunk;
            const midTheta = (((sStart + sEnd) * 0.5) / totalSegs) * TAU;

            const crestMod =
                0.52 +
                0.48 *
                Math.sin(
                    midTheta * 3.0 -
                    simTimeSec * 1.3 +
                    k * 1.7 +
                    fbm2D(
                        Math.cos(midTheta) * 1.6,
                        Math.sin(midTheta) * 1.6 + simTimeSec * 0.28,
                        3
                    ) *
                    2.1
                );
            const arcAlpha = envelopeFade * (0.07 + 0.62 * Math.pow(crestMod, 1.6));
            if (arcAlpha < 0.015) continue;

            ctx.beginPath();
            for (let s = sStart; s <= sEnd; s++) {
                const theta = (s / totalSegs) * TAU;
                const cosT = Math.cos(theta);
                const sinT = Math.sin(theta);

                const harmonicWave =
                    0.034 * Math.sin(2.0 * theta + simTimeSec * 1.15 + k) +
                    0.025 * Math.cos(3.0 * theta - simTimeSec * 1.55 + k * 2.1) +
                    0.018 * Math.sin(5.0 * theta + simTimeSec * 0.92 - k * 1.3);

                const fbmWave =
                    0.058 *
                    fbm2D(
                        cosT * 1.85 + k * 0.7,
                        sinT * 1.85 + simTimeSec * 0.34,
                        3
                    );

                let localRadPx = baseRadiusPx * (1.0 + harmonicWave + fbmWave);
                const probeX = cx + cosT * localRadPx * 1.15;
                const probeY = cy + sinT * localRadPx * 0.84;

                if (particles.length > 0) {
                    const stride = Math.max(1, Math.floor(particles.length / 28));
                    let nodePullPx = 0;
                    for (
                        let pIdx = (k * 5) % stride;
                        pIdx < particles.length;
                        pIdx += stride
                    ) {
                        const pt = particles[pIdx];
                        const dx = probeX - pt.x;
                        const dy = probeY - pt.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < 9500) {
                            nodePullPx += (16.0 * pt.energy) / (1.0 + d2 / 1800.0);
                        }
                    }
                    localRadPx += Math.min(24.0, nodePullPx);
                }

                const px = cx + cosT * localRadPx * 1.15;
                const py = cy + sinT * localRadPx * 0.84;

                if (s === sStart) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }

            ctx.strokeStyle =
                crestMod > 0.78
                    ? RenderPipeline.hexToRgba('#f8fafc', arcAlpha * 0.88)
                    : crestMod > 0.42
                        ? RenderPipeline.hexToRgba('#7dd3fc', arcAlpha)
                        : RenderPipeline.hexToRgba('#6366f1', arcAlpha * 0.75);
            ctx.lineWidth = 0.75 + 1.45 * crestMod * (1.0 + 0.25 * audioSnap.pulse);
            ctx.stroke();
        }
    }

    // Жемчужно-голубая Точка Нуля (ядро цефеиды RS Кормы) с анаморфным штрихом
    const corePulse = 1.0 + 0.14 * Math.sin(simTimeSec * 2.1) + 0.2 * audioSnap.pulse;
    const coreRadius = scale * 0.085 * corePulse;
    const coreGrad = ctx.createRadialGradient(cx, cy, 1.0, cx, cy, coreRadius);
    coreGrad.addColorStop(0.0, RenderPipeline.hexToRgba('#f8fafc', 0.96 * masterAlpha));
    coreGrad.addColorStop(0.32, RenderPipeline.hexToRgba('#7dd3fc', 0.64 * masterAlpha));
    coreGrad.addColorStop(0.65, RenderPipeline.hexToRgba('#6366f1', 0.24 * masterAlpha));
    coreGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, TAU);
    ctx.fill();

    const flareW = scale * 0.24 * corePulse;
    const flareGrad = ctx.createLinearGradient(cx - flareW, cy, cx + flareW, cy);
    flareGrad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
    flareGrad.addColorStop(0.5, RenderPipeline.hexToRgba('#f8fafc', 0.42 * masterAlpha));
    flareGrad.addColorStop(1.0, 'rgba(125, 211, 252, 0.0)');
    ctx.strokeStyle = flareGrad;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx - flareW, cy);
    ctx.lineTo(cx + flareW, cy);
    ctx.stroke();

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderBreathingLightEchoRings
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. СПИРАЛЬНАЯ ПЫЛЬ И КАНЬОНЫ ПОГЛОЩЕНИЯ
// НАЧАЛО ФУНКЦИИ renderSpiralDustAndCanyons
/**
 * Отрисовывает многослойные спиралевидные газопылевые облака, тёмные каньоны поглощения
 * света (#020308) и контровой свет Rim Light (#7DD3FC) с модуляцией от баса музыки.
 */
export function renderSpiralDustAndCanyons(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    simTimeSec: number,
    phase: PhaseId,
    audioSnap: AudioModulationSnapshot,
    spiralClouds: readonly SpiralDustCloud[]
): void {
    const phaseIntensity =
        phase === '02_GENESIS'
            ? 1.0
            : phase === '03_EVOLUTION'
                ? 0.62
                : phase === '04_COLLAPSE'
                    ? 0.54
                    : phase === '01_VOID'
                        ? 0.34
                        : 0.42;

    ctx.save();
    for (let i = 0; i < spiralClouds.length; i++) {
        const cloud = spiralClouds[i];
        const angle = cloud.baseAngle - simTimeSec * cloud.driftSpeed;
        const rPx = cloud.baseRadiusFrac * scale;

        const domainWarp = fbm2D(
            Math.cos(angle) * 1.5,
            Math.sin(angle) * 1.5 + simTimeSec * 0.1,
            3
        );
        const warpedAngle = angle + domainWarp * 0.26;

        const cloudX = cx + Math.cos(warpedAngle) * rPx * 1.24;
        const cloudY = cy + Math.sin(warpedAngle) * rPx * 0.82;
        const radiusPx =
            cloud.thicknessFrac * scale * (1.15 + 0.22 * Math.sin(simTimeSec * 0.9 + i));

        const grad = ctx.createRadialGradient(
            cloudX,
            cloudY,
            radiusPx * 0.08,
            cloudX,
            cloudY,
            radiusPx
        );

        if (cloud.isAbsorptionCanyon) {
            const alpha = clamp(cloud.density * phaseIntensity * 0.88, 0.05, 0.34);
            grad.addColorStop(0.0, RenderPipeline.hexToRgba('#020308', alpha));
            grad.addColorStop(0.62, RenderPipeline.hexToRgba('#060b19', alpha * 0.55));
            grad.addColorStop(0.84, RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.12));
            grad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        } else {
            const alpha = clamp(
                cloud.density * phaseIntensity * (0.48 + 0.26 * audioSnap.low),
                0.025,
                0.18
            );
            grad.addColorStop(0.0, RenderPipeline.hexToRgba(cloud.colorHex, alpha));
            grad.addColorStop(0.55, RenderPipeline.hexToRgba('#1e1b4b', alpha * 0.55));
            grad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(
            cloudX,
            cloudY,
            radiusPx * 1.58,
            radiusPx * 0.72,
            warpedAngle + Math.PI * 0.44,
            0,
            TAU
        );
        ctx.fill();
    }
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderSpiralDustAndCanyons
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. КРИВОЛИНЕЙНЫЕ ПОЛЕВЫЕ СИГНАЛЫ
// НАЧАЛО ФУНКЦИИ renderCurvedFieldSignals
/**
 * Отрисовывает редкие криволинейные квантовые сигналы, пробегающие по полю от края до края.
 */
export function renderCurvedFieldSignals(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    simTimeSec: number,
    fieldSignals: readonly CurvedFieldSignal[]
): void {
    ctx.save();
    const minSide = Math.min(w, h);

    for (let i = 0; i < fieldSignals.length; i++) {
        const sig = fieldSignals[i];
        const lifeRatio = sig.life / Math.max(0.1, sig.maxLife);
        const env = Math.sin(lifeRatio * Math.PI);
        const alpha = sig.alpha * env;
        if (alpha < 0.02) continue;

        const headX = cx + sig.xNorm * w;
        const headY = cy + sig.yNorm * h;
        const tailLen = sig.lengthFrac * minSide;

        const bendAngle = sig.angle - 0.34 * Math.sin(simTimeSec * 1.6 + i * 1.3);
        const ctrlX = headX - Math.cos(bendAngle) * tailLen * 0.54;
        const ctrlY = headY - Math.sin(bendAngle) * tailLen * 0.54;
        const tailX = headX - Math.cos(sig.angle - 0.18) * tailLen;
        const tailY = headY - Math.sin(sig.angle - 0.18) * tailLen;

        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
        grad.addColorStop(0.65, RenderPipeline.hexToRgba('#38bdf8', alpha * 0.5));
        grad.addColorStop(1.0, RenderPipeline.hexToRgba(sig.colorHex, alpha));

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, headX, headY);
        ctx.stroke();
    }
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderCurvedFieldSignals
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. КОГНИТИВНЫЕ ПОЛУШАРИЯ И КЕПЛЕРОВСКИЕ КОЛЬЦА
// НАЧАЛО ФУНКЦИИ renderCorticalHemispheresAndKeplerRings
/**
 * Отрисовывает 5 встречных кеплеровских колец (решение D-3) и скульптурную подсветку
 * двух когнитивных полушарий Мозга в фазах 03_EVOLUTION и 04_COLLAPSE.
 */
export function renderCorticalHemispheresAndKeplerRings(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scaledW: number,
    scaledH: number,
    simTimeSec: number,
    phase: PhaseId,
    phaseProgress: number
): void {
    ctx.save();
    const keplerRatios = [0.22, 0.36, 0.52, 0.7, 0.88];
    const stress = stressStore.getState().globalStress;

    for (let rIdx = 0; rIdx < keplerRatios.length; rIdx++) {
        const ratio = keplerRatios[rIdx];
        const dir = rIdx % 2 === 0 ? 1 : -1;
        const tilt = phase === '04_COLLAPSE' ? (rIdx - 2) * 0.16 : (rIdx - 2) * 0.06;
        const rx = scaledW * 0.42 * ratio;
        const ry = scaledH * 0.35 * ratio;

        ctx.beginPath();
        const segs = 84;
        for (let s = 0; s <= segs; s++) {
            const a = (s / segs) * TAU + simTimeSec * 0.15 * dir;
            const tensionWave =
                phase === '04_COLLAPSE'
                    ? 1.0 +
                    0.065 *
                    Math.sin(a * 3.0 - simTimeSec * 2.8 + rIdx) *
                    (0.5 + stress)
                    : 1.0 + 0.02 * Math.sin(a * 4.0 + simTimeSec * 1.1);
            const lx = Math.cos(a) * rx * tensionWave;
            const ly = Math.sin(a) * ry * tensionWave;
            const px = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
            const py = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const ringAlpha = 0.06 + (rIdx === 2 ? 0.05 : 0.025);
        ctx.strokeStyle =
            rIdx % 2 === 0
                ? RenderPipeline.hexToRgba('#7dd3fc', ringAlpha)
                : RenderPipeline.hexToRgba('#6366f1', ringAlpha);
        ctx.lineWidth = 0.75;
        ctx.stroke();
    }

    for (let hSign = -1; hSign <= 1; hSign += 2) {
        const lobeX = cx + hSign * scaledW * 0.185;
        const lobeR = Math.min(scaledW, scaledH) * 0.34;
        const lobeGrad = ctx.createRadialGradient(
            lobeX,
            cy,
            lobeR * 0.08,
            lobeX,
            cy,
            lobeR
        );
        const pulse =
            0.09 + 0.03 * Math.sin(simTimeSec * 1.8 + hSign + phaseProgress * Math.PI);
        lobeGrad.addColorStop(0.0, RenderPipeline.hexToRgba('#6366f1', pulse));
        lobeGrad.addColorStop(0.55, RenderPipeline.hexToRgba('#1e1b4b', pulse * 0.6));
        lobeGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        ctx.fillStyle = lobeGrad;
        ctx.beginPath();
        ctx.arc(lobeX, cy, lobeR, 0, TAU);
        ctx.fill();
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderCorticalHemispheresAndKeplerRings
// КОНЕЦ РАЗДЕЛА 4
