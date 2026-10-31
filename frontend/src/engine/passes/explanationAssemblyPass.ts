// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/explanationAssemblyPass.ts
// НАЗНАЧЕНИЕ: Песчаный вихрь, собирающий окно путеводителя, прямо в основном Canvas сцены.
// РАЗДЕЛЫ: 1. Бюджет и цвета; 2. Проход общего кадра.
// ФУНКЦИИ: renderExplanationAssemblyPass.
// Не создаёт второй полноэкранный Canvas, shadowBlur и RAF: песчинки рисуются спрайтами
// общего атласа свечения, хвосты и контур — одним путём каждый.
// ============================================================================

import {
    DUST_KIND_CONTOUR, DUST_KIND_TRIGGER, DUST_KIND_WARM, EXPLANATION_TRAIL_DURATION_MS,
    explanationAssembly, getExplanationAssemblyFrame, sampleExplanationDustGrain, smootherstep,
    type ExplanationAssemblyState, type ExplanationGrainSample,
} from '../../core/explanationAssembly';
import { drawParticleGlow } from '../rendering/particleGlowAtlas';

// НАЧАЛО РАЗДЕЛА 1. БЮДЖЕТ И ЦВЕТА
/** Хвост рисуется у каждой третьей песчинки: длина — путь за последние 55 мс. */
const STREAK_EVERY = 3;
const STREAK_LAG_MS = 55;
const IGNITION_MS = 520;
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
    const elapsed = nowMs - active.spec.startMs;
    if (!Number.isFinite(elapsed) || elapsed >= EXPLANATION_TRAIL_DURATION_MS) return false;
    const field = state.ensureField(sources);
    if (!field) return false;
    const time = Math.max(0, elapsed);
    const frame = getExplanationAssemblyFrame(time);
    const fade = frame.dustOpacity;
    if (fade <= 0.001) return false;

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

    // 2. Хвосты летящих песчинок: один путь, один stroke.
    ctx.globalAlpha = 0.36 * fade;
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

    // 3. Песчинки: спрайты атласа; без атласа — один путь мелких точек.
    let fallback = false;
    ctx.globalAlpha = 1;
    for (let index = 0; index < field.count; index++) {
        sampleExplanationDustGrain(field, index, time, grain);
        const kind = field.kind[index];
        const contour = (kind & DUST_KIND_CONTOUR) !== 0;
        const appear = smootherstep((time - field.delayMs[index] + 150) / 300);
        // Песчинка ярче всего в полёте и спокойнее, когда легла на место.
        const flight = 0.7 + 0.3 * Math.sin(Math.PI * grain.progress);
        const alpha = (contour ? 1 : 0.72) * appear * flight * fade;
        if (alpha <= 0.004) continue;
        const radius = field.radius[index] * (contour ? 2.7 : 2.4);
        const sprite = (kind & (DUST_KIND_TRIGGER | DUST_KIND_CONTOUR)) !== 0 ? 'halo-ice' : 'halo-blue';
        if (!fallback && !drawParticleGlow(ctx, sprite, grain.x, grain.y, Math.max(1, radius), alpha)) fallback = true;
        if (contour && !fallback) drawParticleGlow(ctx, 'halo-ice', grain.x, grain.y, Math.max(1, field.radius[index]), alpha);
    }
    if (fallback) {
        ctx.globalAlpha = 0.75 * fade;
        ctx.fillStyle = '#bfe9ff';
        ctx.beginPath();
        for (let index = 0; index < field.count; index++) {
            sampleExplanationDustGrain(field, index, time, grain);
            const size = field.radius[index] * 1.4;
            ctx.rect(grain.x - size / 2, grain.y - size / 2, size, size);
        }
        ctx.fill();
    }

    // 4. Тёплые искры: те же координаты, отдельный цвет, один fill.
    ctx.globalAlpha = 0.85 * fade;
    ctx.fillStyle = '#ffdca1';
    ctx.beginPath();
    for (let index = 4; index < field.count; index += 9) {
        if ((field.kind[index] & DUST_KIND_WARM) === 0) continue;
        sampleExplanationDustGrain(field, index, time, grain);
        const size = field.radius[index] * 1.15;
        ctx.rect(grain.x - size / 2, grain.y - size / 2, size, size);
    }
    ctx.fill();

    // 5. Плоскость окна «конденсируется»: едва заметная вуаль на месте будущей панели.
    const bounds = active.spec.to;
    const veil = smootherstep((time - 1250) / 650) * fade;
    if (veil > 0.004) {
        ctx.globalAlpha = veil * 0.07;
        ctx.fillStyle = '#4a97c1';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    // 6. Контур: отрезок появляется только между двумя уже севшими соседями по периметру,
    //    поэтому линия «дорастает» по мере посадки песка и всегда ровная.
    if (field.contourCount > 2) {
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
        if (segments) {
            ctx.strokeStyle = '#74d8ff';
            ctx.globalAlpha = 0.16 * fade;
            ctx.lineWidth = 3.2;
            ctx.stroke();
            ctx.globalAlpha = 0.55 * fade;
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }
    }

    ctx.restore();
    return true;
}
// КОНЕЦ ФУНКЦИИ renderExplanationAssemblyPass
// КОНЕЦ РАЗДЕЛА 2
