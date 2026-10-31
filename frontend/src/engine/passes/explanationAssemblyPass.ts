// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/explanationAssemblyPass.ts
// НАЗНАЧЕНИЕ: Пыль сцены, собирающая окно путеводителя, прямо в основном Canvas сцены:
//             полёт со всех сторон, светящийся контур и мерцание плоскости, пока окно открыто,
//             и рассыпание обратно в поле после закрытия.
// РАЗДЕЛЫ: 1. Бюджет и цвета; 2. Проход общего кадра; 3. Рассыпание.
// ФУНКЦИИ: renderExplanationAssemblyPass, grainAlpha, warmAlpha, veilAlpha, traceLandedContour, getActiveBounds,
//          drawWarmSparks, renderExplanationScatter.
// Не создаёт второй полноэкранный Canvas, shadowBlur и RAF: песчинки рисуются спрайтами
// общего атласа свечения, хвосты и контур — одним путём каждый.
// ============================================================================

import {
    DUST_KIND_CONTOUR, DUST_KIND_TRIGGER, DUST_KIND_WARM, EXPLANATION_ASSEMBLY_MS, EXPLANATION_SCATTER_MS,
    EXPLANATION_TEXT_DELAY_MS, explanationAssembly, getExplanationAssemblyFrame, sampleExplanationDustGrain, sampleExplanationDustScatter, smootherstep,
    type ExplanationAssemblyState, type ExplanationDustField, type ExplanationGrainSample,
} from '../../core/explanationAssembly';
import { drawParticleGlow } from '../rendering/particleGlowAtlas';

// НАЧАЛО РАЗДЕЛА 1. БЮДЖЕТ И ЦВЕТА
/** Хвост рисуется у каждой третьей песчинки: длина — путь за последние 70 мс. */
const STREAK_EVERY = 3;
const STREAK_LAG_MS = 70;
const IGNITION_MS = 600;
/** Яркость севшей песчинки: контур светится, плоскость едва мерцает. */
const REST_ALPHA_CONTOUR = 0.82;
const REST_ALPHA_PLANE = 0.42;
/** Рамка и вуаль гаснут за это время после закрытия, пока контурная пыль ещё на месте. */
const FRAME_FADE_MS = 450;
const grain: ExplanationGrainSample = { x: 0, y: 0, progress: 0 };
const previous: ExplanationGrainSample = { x: 0, y: 0, progress: 0 };
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРОХОД ОБЩЕГО КАДРА
// НАЧАЛО ФУНКЦИИ renderExplanationAssemblyPass
/**
 * Рисует текущий кадр сборки поверх сцены и возвращает true, если что-то нарисовано.
 * Без активной сборки стоит одной проверки: ни выделений памяти, ни вызовов Canvas.
 */
export function renderExplanationAssemblyPass(
    ctx: CanvasRenderingContext2D,
    sources: ArrayLike<{ readonly x: number; readonly y: number }> | null,
    nowMs: number,
    state: ExplanationAssemblyState = explanationAssembly,
): boolean {
    const active = state.getActive();
    if (!active) return false;
    const field = state.ensureField(sources);
    if (!field) return false;
    if (active.scatterStartMs !== null) {
        return renderExplanationScatter(ctx, state, active.token, field, nowMs - active.scatterStartMs, active.closedAtMs);
    }
    const elapsed = nowMs - active.spec.startMs;
    if (!Number.isFinite(elapsed)) return false;
    const time = Math.max(0, elapsed);
    const resting = time >= EXPLANATION_ASSEMBLY_MS;
    // Плоскость из пыли гаснет, пока на её месте проявляется панель (непрозрачность фона 0,94): пока
    // окно открыто, рисуется только рамка (песчинки 0..contourCount-1), плоскость снова видна при рассыпании.
    const planeAlpha = 1 - getExplanationAssemblyFrame(time).nativeOpacity;
    const visibleCount = time >= EXPLANATION_TEXT_DELAY_MS ? field.contourCount : field.count;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // 1. Вспышка у нажатой кнопки — мгновенный отклик на нажатие.
    if (field.trigger && time < IGNITION_MS) {
        const k = smootherstep(time / IGNITION_MS);
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.strokeStyle = '#8fe0ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(field.trigger.x, field.trigger.y, 10 + k * 36, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 2. Хвосты летящих песчинок: один путь, один stroke; севшая пыль хвостов не имеет.
    if (!resting) {
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = '#9edcff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        let streaks = 0;
        for (let index = 0; index < field.count; index += STREAK_EVERY) {
            sampleExplanationDustGrain(field, index, time, grain);
            if (grain.progress <= 0.04 || grain.progress >= 0.97) continue;
            sampleExplanationDustGrain(field, index, time - STREAK_LAG_MS, previous);
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(grain.x, grain.y);
            streaks++;
        }
        if (streaks) ctx.stroke();
    }

    // 3. Песчинки: спрайты атласа; в полёте ярче, севшие плавно переходят в спокойное мерцание.
    let fallback = false;
    for (let index = 0; index < visibleCount; index++) {
        const kind = field.kind[index];
        const contour = (kind & DUST_KIND_CONTOUR) !== 0;
        sampleExplanationDustGrain(field, index, time, grain);
        const alpha = grainAlpha(field, index, time, grain.progress) * (contour ? 1 : planeAlpha);
        if (alpha <= 0.004) continue;
        const radius = field.radius[index] * (contour ? 2.7 : 2.4);
        const sprite = (kind & (DUST_KIND_TRIGGER | DUST_KIND_CONTOUR)) !== 0 ? 'halo-ice' : 'halo-blue';
        if (!fallback && !drawParticleGlow(ctx, sprite, grain.x, grain.y, Math.max(1, radius), alpha)) fallback = true;
        if (contour && !fallback) drawParticleGlow(ctx, 'halo-ice', grain.x, grain.y, Math.max(1, field.radius[index]), alpha);
    }
    if (fallback) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#bfe9ff';
        ctx.beginPath();
        for (let index = 0; index < visibleCount; index++) {
            sampleExplanationDustGrain(field, index, time, grain);
            const size = field.radius[index] * 1.4;
            ctx.rect(grain.x - size / 2, grain.y - size / 2, size, size);
        }
        ctx.fill();
    }

    // 4. Тёплые искры: те же координаты, отдельный цвет, один fill; севшие тоже мерцают.
    drawWarmSparks(ctx, field, visibleCount, (index) => sampleExplanationDustGrain(field, index, time, grain), warmAlpha(time));

    // 5. Плоскость окна «конденсируется» под садящейся пылью, пока DOM-окно ещё не проявилось.
    const bounds = getActiveBounds(state);
    const veil = veilAlpha(time);
    if (bounds && veil > 0.004) {
        ctx.globalAlpha = veil;
        ctx.fillStyle = '#4a97c1';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    // 6. Контур «дорастает» по мере посадки и остаётся тонкой светящейся рамкой окна.
    if (traceLandedContour(ctx, field, time)) {
        ctx.strokeStyle = '#74d8ff';
        ctx.globalAlpha = resting ? 0.12 : 0.16;
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.globalAlpha = resting ? 0.4 : 0.55;
        ctx.lineWidth = 0.9;
        ctx.stroke();
    }

    ctx.restore();
    return true;
}
// КОНЕЦ ФУНКЦИИ renderExplanationAssemblyPass

// НАЧАЛО ФУНКЦИИ grainAlpha
/** Яркость песчинки в момент сборки time: проявление перед стартом, полёт и спокойное мерцание севшей. */
function grainAlpha(field: ExplanationDustField, index: number, time: number, progress: number): number {
    const contour = (field.kind[index] & DUST_KIND_CONTOUR) !== 0;
    const appear = smootherstep((time - field.delayMs[index] + 150) / 300);
    const flightAlpha = (contour ? 1 : 0.72) * appear * (0.7 + 0.3 * Math.sin(Math.PI * progress));
    const twinkle = 0.72 + 0.28 * Math.sin(time * 0.0021 + index * 2.39);
    const restAlpha = (contour ? REST_ALPHA_CONTOUR : REST_ALPHA_PLANE) * twinkle;
    return flightAlpha + (restAlpha - flightAlpha) * smootherstep((progress - 0.9) / 0.1);
}
// КОНЕЦ ФУНКЦИИ grainAlpha

// НАЧАЛО ФУНКЦИИ warmAlpha
function warmAlpha(time: number): number {
    return time >= EXPLANATION_ASSEMBLY_MS ? 0.55 + 0.25 * Math.sin(time * 0.0017) : 0.85;
}
// КОНЕЦ ФУНКЦИИ warmAlpha

// НАЧАЛО ФУНКЦИИ veilAlpha
function veilAlpha(time: number): number {
    return smootherstep((time - 2300) / 700) * (1 - getExplanationAssemblyFrame(time).nativeOpacity) * 0.07;
}
// КОНЕЦ ФУНКЦИИ veilAlpha

// НАЧАЛО ФУНКЦИИ traceLandedContour
/**
 * Строит путь рамки: отрезок есть только между двумя соседями по периметру, уже севшими к
 * моменту time. Возвращает число отрезков; stroke делает вызывающий.
 */
function traceLandedContour(ctx: CanvasRenderingContext2D, field: ExplanationDustField, time: number): number {
    if (field.contourCount <= 2) return 0;
    ctx.beginPath();
    let segments = 0;
    let previousLanded = false;
    for (let step = 0; step <= field.contourCount; step++) {
        const index = step % field.contourCount;
        const landed = sampleExplanationDustGrain(field, index, time, grain).progress >= 0.985;
        if (landed && previousLanded) { ctx.lineTo(field.targetX[index], field.targetY[index]); segments++; }
        else if (landed) ctx.moveTo(field.targetX[index], field.targetY[index]);
        previousLanded = landed;
    }
    return segments;
}
// КОНЕЦ ФУНКЦИИ traceLandedContour

// НАЧАЛО ФУНКЦИИ getActiveBounds
function getActiveBounds(state: ExplanationAssemblyState): { left: number; top: number; width: number; height: number } | null {
    return state.getActive()?.spec.to ?? null;
}
// КОНЕЦ ФУНКЦИИ getActiveBounds

// НАЧАЛО ФУНКЦИИ drawWarmSparks
/** Тёплые искры среди первых visibleCount песчинок одним fill. */
function drawWarmSparks(ctx: CanvasRenderingContext2D, field: ExplanationDustField, visibleCount: number,
    sample: (index: number) => ExplanationGrainSample, alpha: number): void {
    if (alpha <= 0.004) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffdca1';
    ctx.beginPath();
    for (let index = 4; index < visibleCount; index += 9) {
        if ((field.kind[index] & DUST_KIND_WARM) === 0) continue;
        const point = sample(index);
        const size = field.radius[index] * 1.15;
        ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
    }
    ctx.fill();
}
// КОНЕЦ ФУНКЦИИ drawWarmSparks
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. РАССЫПАНИЕ ПОСЛЕ ЗАКРЫТИЯ
// НАЧАЛО ФУНКЦИИ renderExplanationScatter
/**
 * Окно закрыто: песчинки возвращаются туда, откуда пришли, и растворяются в поле пыли.
 * Первый кадр рассыпания совпадает с последним кадром сборки (closedAtMs) — даже если окно
 * закрыли посреди полёта. По окончании сборка освобождает свой буфер; пыль сцены никуда не исчезала.
 */
function renderExplanationScatter(ctx: CanvasRenderingContext2D, state: ExplanationAssemblyState, token: number,
    field: ExplanationDustField, scatterElapsedMs: number, closedAtMs: number): boolean {
    if (!Number.isFinite(scatterElapsedMs) || scatterElapsedMs >= EXPLANATION_SCATTER_MS) {
        state.end(token);
        return false;
    }
    const time = Math.max(0, scatterElapsedMs);
    const fade = 1 - smootherstep(time / EXPLANATION_SCATTER_MS);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Хвосты разлетающейся пыли.
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#9edcff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let streaks = 0;
    for (let index = 0; index < field.count; index += STREAK_EVERY) {
        sampleExplanationDustScatter(field, index, time, closedAtMs, grain);
        if (grain.progress <= 0.04 || grain.progress >= 0.9) continue;
        sampleExplanationDustScatter(field, index, time - STREAK_LAG_MS, closedAtMs, previous);
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(grain.x, grain.y);
        streaks++;
    }
    if (streaks) ctx.stroke();

    // Песчинки начинают с той яркости, что была при закрытии, и гаснут к концу пути, сливаясь с полем.
    let fallback = false;
    for (let index = 0; index < field.count; index++) {
        const closedAlpha = grainAlpha(field, index, closedAtMs, sampleExplanationDustGrain(field, index, closedAtMs, previous).progress);
        sampleExplanationDustScatter(field, index, time, closedAtMs, grain);
        const alpha = closedAlpha * (1 - smootherstep((grain.progress - 0.55) / 0.45));
        if (alpha <= 0.004) continue;
        const contour = index < field.contourCount;
        const radius = field.radius[index] * (contour ? 2.7 : 2.4);
        if (!fallback && !drawParticleGlow(ctx, contour ? 'halo-ice' : 'halo-blue', grain.x, grain.y, Math.max(1, radius), alpha)) {
            fallback = true;
        }
    }
    if (fallback) {
        ctx.globalAlpha = 0.45 * fade;
        ctx.fillStyle = '#bfe9ff';
        ctx.beginPath();
        for (let index = 0; index < field.count; index++) {
            sampleExplanationDustScatter(field, index, time, closedAtMs, grain);
            const size = field.radius[index] * 1.4;
            ctx.rect(grain.x - size / 2, grain.y - size / 2, size, size);
        }
        ctx.fill();
    }
    drawWarmSparks(ctx, field, field.count, (index) => sampleExplanationDustScatter(field, index, time, closedAtMs, grain),
        warmAlpha(closedAtMs) * fade);

    // Рамка и вуаль гаснут первыми, пока контурная пыль ещё на месте.
    const frameAlpha = 1 - smootherstep(time / FRAME_FADE_MS);
    const bounds = getActiveBounds(state);
    const veil = veilAlpha(closedAtMs) * frameAlpha;
    if (bounds && veil > 0.004) {
        ctx.globalAlpha = veil;
        ctx.fillStyle = '#4a97c1';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }
    if (frameAlpha > 0.004 && traceLandedContour(ctx, field, closedAtMs)) {
        const settled = closedAtMs >= EXPLANATION_ASSEMBLY_MS;
        ctx.strokeStyle = '#74d8ff';
        ctx.globalAlpha = (settled ? 0.12 : 0.16) * frameAlpha;
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.globalAlpha = (settled ? 0.4 : 0.55) * frameAlpha;
        ctx.lineWidth = 0.9;
        ctx.stroke();
    }

    ctx.restore();
    return true;
}
// КОНЕЦ ФУНКЦИИ renderExplanationScatter
// КОНЕЦ РАЗДЕЛА 3
