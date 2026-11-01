// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/explanationAssemblyPass.ts
// НАЗНАЧЕНИЕ: Пыль сцены, вихрем собирающая окно путеводителя, прямо в основном Canvas сцены:
//             светящиеся песчинки с хвостами, вспышки посадки, впитывание пыли в проявляющееся окно
//             и рассыпание обратно в облако после закрытия.
// РАЗДЕЛЫ: 1. Бюджет и цвета; 2. Проход общего кадра; 3. Рассыпание.
// ФУНКЦИИ: renderExplanationAssemblyPass, getVisualScale, grainAlpha, veilAlpha, drawGrains, drawStreaks,
//          drawWarmSparks, renderExplanationScatter.
// Не создаёт второй полноэкранный Canvas, shadowBlur и RAF: песчинки рисуются спрайтами общего атласа
// свечения, хвосты — одним путём на два прохода (свечение и ядро).
// ============================================================================

import {
    DUST_KIND_TRIGGER, DUST_KIND_WARM, EXPLANATION_FLIGHT_MS, EXPLANATION_SCATTER_MS, EXPLANATION_TEXT_DELAY_MS,
    explanationAssembly, getExplanationAssemblyFrame, sampleExplanationDustGrain, sampleExplanationDustScatter, smootherstep,
    type ExplanationAssemblyState, type ExplanationDustField, type ExplanationGrainSample,
} from '../../core/explanationAssembly';
import { drawParticleGlow } from '../rendering/particleGlowAtlas';

// НАЧАЛО РАЗДЕЛА 1. БЮДЖЕТ И ЦВЕТА
/** Хвост — путь песчинки за последние 110 мс: у окна он изогнут и показывает вращение вихря. */
const STREAK_LAG_MS = 110;
/** Хвост появляется, когда песчинка прошла эту долю пути: далёкое облако осыпается тихо, без штрихов. */
const STREAK_FROM_PROGRESS = 0.3;
const IGNITION_MS = 700;
/** Вспышка посадки: длительность, размер и сила относительно песчинки. */
const LANDING_FLASH_MS = 420;
const LANDING_FLASH_SCALE = 3.6;
const LANDING_FLASH_ALPHA = 0.75;
/** Яркость севшей песчинки до впитывания в окно. */
const REST_ALPHA = 0.7;
const grain: ExplanationGrainSample = { x: 0, y: 0, progress: 0 };
const previous: ExplanationGrainSample = { x: 0, y: 0, progress: 0 };
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРОХОД ОБЩЕГО КАДРА
// НАЧАЛО ФУНКЦИИ renderExplanationAssemblyPass
/**
 * Рисует текущий кадр сборки поверх сцены и возвращает true, если что-то нарисовано.
 * Без активной сборки стоит одной проверки: ни выделений памяти, ни вызовов Canvas. После проявления
 * окна пыль уже впиталась в него: сборка ждёт закрытия, ничего не рисуя.
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
    const scale = getVisualScale(ctx, active.spec.viewport);
    if (active.scatterStartMs !== null) {
        return renderExplanationScatter(ctx, state, active.token, field, nowMs - active.scatterStartMs, active.closedAtMs, scale);
    }
    const elapsed = nowMs - active.spec.startMs;
    if (!Number.isFinite(elapsed) || elapsed >= EXPLANATION_TEXT_DELAY_MS) return false;
    const time = Math.max(0, elapsed);
    const dust = getExplanationAssemblyFrame(time).dustOpacity;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // 1. Вспышка у нажатой кнопки — мгновенный отклик на нажатие.
    if (field.trigger && time < IGNITION_MS) {
        const k = smootherstep(time / IGNITION_MS);
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = '#8fe0ff';
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.arc(field.trigger.x, field.trigger.y, (14 + k * 64) * scale, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 2. Хвосты летящих песчинок; 3. сами песчинки и вспышки посадки; 4. тёплые искры.
    drawStreaks(ctx, field, (index, ms, out) => sampleExplanationDustGrain(field, index, ms, out), time, dust, scale);
    drawGrains(ctx, field, (index, out) => sampleExplanationDustGrain(field, index, time, out),
        (index, progress) => grainAlpha(field, index, time, progress) * dust, scale, time);
    drawWarmSparks(ctx, field, (index) => sampleExplanationDustGrain(field, index, time, grain), 0.9 * dust, scale);

    // 5. Плоскость окна «конденсируется» под садящейся пылью, пока DOM-окно ещё не проявилось.
    const bounds = state.getActive()?.spec.to;
    const veil = veilAlpha(time);
    if (bounds && veil > 0.004) {
        ctx.globalAlpha = veil;
        ctx.fillStyle = '#4a97c1';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }

    ctx.restore();
    return true;
}
// КОНЕЦ ФУНКЦИИ renderExplanationAssemblyPass

// НАЧАЛО ФУНКЦИИ getVisualScale
/**
 * Размер песчинок и хвостов растёт с экраном и не тает при масштабе страницы меньше 100%:
 * при DPR 0,83 (масштаб 67% на ноутбуке) CSS-пиксель меньше физического, и пыль иначе мельчает.
 */
function getVisualScale(ctx: CanvasRenderingContext2D, viewport: { readonly width: number; readonly height: number }): number {
    const screen = Math.max(0.9, Math.min(1.6, Math.min(viewport.width, viewport.height) / 900));
    const pixelRatio = typeof ctx.getTransform === 'function' ? ctx.getTransform().a : 1;
    const zoom = Number.isFinite(pixelRatio) && pixelRatio > 0 ? Math.max(1, Math.min(1.35, 1 / pixelRatio)) : 1;
    return screen * zoom;
}
// КОНЕЦ ФУНКЦИИ getVisualScale

// НАЧАЛО ФУНКЦИИ grainAlpha
/**
 * Яркость песчинки в момент сборки time: бледная у облака, разгорается по мере подлёта к окну,
 * спокойно мерцает севшей. Внимание собирается у окна, а не по всему экрану.
 */
function grainAlpha(field: ExplanationDustField, index: number, time: number, progress: number): number {
    const appear = smootherstep((time - field.delayMs[index] + 200) / 400);
    const flight = 0.3 + 0.65 * smootherstep(progress / 0.85);
    const twinkle = 0.75 + 0.25 * Math.sin(time * 0.0021 + index * 2.39);
    const settle = smootherstep((progress - 0.92) / 0.08);
    return appear * (flight + (REST_ALPHA * twinkle - flight) * settle);
}
// КОНЕЦ ФУНКЦИИ grainAlpha

// НАЧАЛО ФУНКЦИИ veilAlpha
function veilAlpha(time: number): number {
    return smootherstep((time - 2300) / 700) * (1 - getExplanationAssemblyFrame(time).nativeOpacity) * 0.08;
}
// КОНЕЦ ФУНКЦИИ veilAlpha

// НАЧАЛО ФУНКЦИИ drawStreaks
/** Хвосты песчинок, подлетающих к окну, одним путём: мягкое свечение и тонкое ядро. */
function drawStreaks(ctx: CanvasRenderingContext2D, field: ExplanationDustField,
    sample: (index: number, ms: number, out: ExplanationGrainSample) => ExplanationGrainSample,
    time: number, alpha: number, scale: number, minProgress = STREAK_FROM_PROGRESS, maxProgress = 0.995): void {
    if (alpha <= 0.004) return;
    ctx.beginPath();
    let streaks = 0;
    for (let index = 0; index < field.count; index++) {
        sample(index, time, grain);
        if (grain.progress <= minProgress || grain.progress >= maxProgress) continue;
        sample(index, time - STREAK_LAG_MS, previous);
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(grain.x, grain.y);
        streaks++;
    }
    if (!streaks) return;
    ctx.strokeStyle = '#9edcff';
    ctx.globalAlpha = 0.07 * alpha;
    ctx.lineWidth = 2.4 * scale;
    ctx.stroke();
    ctx.globalAlpha = 0.3 * alpha;
    ctx.lineWidth = 0.9 * scale;
    ctx.stroke();
}
// КОНЕЦ ФУНКЦИИ drawStreaks

// НАЧАЛО ФУНКЦИИ drawGrains
/**
 * Песчинки: ореол у каждой и яркое ядро у каждой второй; в момент посадки — короткая вспышка.
 * Без атласа свечения — запасной путь: квадратики одним fill.
 */
function drawGrains(ctx: CanvasRenderingContext2D, field: ExplanationDustField,
    sample: (index: number, out: ExplanationGrainSample) => ExplanationGrainSample,
    alphaOf: (index: number, progress: number) => number, scale: number, time: number | null): void {
    let fallback = false;
    for (let index = 0; index < field.count; index++) {
        sample(index, grain);
        const alpha = alphaOf(index, grain.progress);
        if (alpha <= 0.004) continue;
        const size = field.radius[index] * scale;
        const frame = index < field.frameCount;
        const sprite = frame || (field.kind[index] & DUST_KIND_TRIGGER) !== 0 ? 'halo-ice' : 'halo-blue';
        if (!fallback && !drawParticleGlow(ctx, sprite, grain.x, grain.y, Math.max(1, size * 3), alpha)) fallback = true;
        if (fallback) continue;
        // Ядро у каждой песчинки рамки (рамка окна читается при сборке) и у каждой третьей на поверхности.
        if (frame || index % 3 === 0) drawParticleGlow(ctx, 'halo-ice', grain.x, grain.y, Math.max(1, size * 1.1), alpha);
        if (time === null) continue;
        // Посадка: песчинка коротко вспыхивает в своей точке окна — рамка и поверхность зажигаются искрами.
        const sinceLanding = time - (field.delayMs[index] + EXPLANATION_FLIGHT_MS);
        if (sinceLanding > -120 && sinceLanding < LANDING_FLASH_MS) {
            const flash = Math.sin(Math.PI * (sinceLanding + 120) / (LANDING_FLASH_MS + 120));
            drawParticleGlow(ctx, 'halo-ice', field.targetX[index], field.targetY[index],
                Math.max(1, size * LANDING_FLASH_SCALE), alpha * flash * LANDING_FLASH_ALPHA);
        }
    }
    if (!fallback) return;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath();
    for (let index = 0; index < field.count; index++) {
        sample(index, grain);
        if (alphaOf(index, grain.progress) <= 0.004) continue;
        const size = field.radius[index] * 1.6 * scale;
        ctx.rect(grain.x - size / 2, grain.y - size / 2, size, size);
    }
    ctx.fill();
}
// КОНЕЦ ФУНКЦИИ drawGrains

// НАЧАЛО ФУНКЦИИ drawWarmSparks
/** Тёплые искры (каждая седьмая песчинка) одним fill: золото среди холодной пыли. */
function drawWarmSparks(ctx: CanvasRenderingContext2D, field: ExplanationDustField,
    sample: (index: number) => ExplanationGrainSample, alpha: number, scale: number): void {
    if (alpha <= 0.004) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffdca1';
    ctx.beginPath();
    for (let index = 3; index < field.count; index += 7) {
        if ((field.kind[index] & DUST_KIND_WARM) === 0) continue;
        const point = sample(index);
        const size = field.radius[index] * 1.5 * scale;
        ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
    }
    ctx.fill();
}
// КОНЕЦ ФУНКЦИИ drawWarmSparks
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. РАССЫПАНИЕ ПОСЛЕ ЗАКРЫТИЯ
// НАЧАЛО ФУНКЦИИ renderExplanationScatter
/**
 * Окно закрыто: панель рассыпается на пыль, и песчинки раскручиваются по своим спиралям обратно
 * к частицам облака, гаснут к концу пути. Первый кадр рассыпания продолжает кадр сборки (closedAtMs),
 * даже если окно закрыли посреди полёта. По окончании сборка освобождает свой буфер.
 */
function renderExplanationScatter(ctx: CanvasRenderingContext2D, state: ExplanationAssemblyState, token: number,
    field: ExplanationDustField, scatterElapsedMs: number, closedAtMs: number, scale: number): boolean {
    if (!Number.isFinite(scatterElapsedMs) || scatterElapsedMs >= EXPLANATION_SCATTER_MS) {
        state.end(token);
        return false;
    }
    const time = Math.max(0, scatterElapsedMs);
    const fade = 1 - smootherstep(time / EXPLANATION_SCATTER_MS);
    // Окно распадается вспышкой: первые 350 мс песчинки крупнее и ярче, затем раскручиваются в облако.
    const burst = 1 - smootherstep(time / 350);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    drawStreaks(ctx, field, (index, ms, out) => sampleExplanationDustScatter(field, index, ms, closedAtMs, out),
        time, fade, scale, 0.02, 0.9);
    // Песчинка, которая уже стала окном, вспыхивает в полную силу полёта; не успевшая взлететь — со своей яркостью.
    drawGrains(ctx, field, (index, out) => sampleExplanationDustScatter(field, index, time, closedAtMs, out),
        (index, progress) => {
            const closedProgress = sampleExplanationDustGrain(field, index, closedAtMs, previous).progress;
            const start = closedProgress > 0 ? 0.95 : grainAlpha(field, index, closedAtMs, closedProgress);
            return Math.min(1, start * (1 + 0.4 * burst)) * (1 - smootherstep((progress - 0.55) / 0.45));
        }, scale * (1 + 0.6 * burst), null);
    drawWarmSparks(ctx, field, (index) => sampleExplanationDustScatter(field, index, time, closedAtMs, grain), 0.7 * fade, scale);
    const bounds = state.getActive()?.spec.to;
    const veil = veilAlpha(closedAtMs) * (1 - smootherstep(time / 450));
    if (bounds && veil > 0.004) {
        ctx.globalAlpha = veil;
        ctx.fillStyle = '#4a97c1';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }
    ctx.restore();
    return true;
}
// КОНЕЦ ФУНКЦИИ renderExplanationScatter
// КОНЕЦ РАЗДЕЛА 3
