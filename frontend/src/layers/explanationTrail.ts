// ============================================================================
// ФАЙЛ: frontend/src/layers/explanationTrail.ts
// НАЗНАЧЕНИЕ: Короткий звёздный след от выбранной кнопки к окну объяснения.
// РАЗДЕЛЫ: 1. Геометрия пути; 2. Частицы и отрисовка; 3. Временный жизненный цикл.
// ФУНКЦИИ: buildExplanationTrailPath, sampleExplanationTrailPath, fraction,
// makeTrailStars, paintExplanationTrail, playExplanationTrail, cleanup,
// handleVisibilityChange, frame.
// ============================================================================

import { resourceLedger } from '../core/resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. ГЕОМЕТРИЯ ПУТИ
export interface ExplanationTrailPoint { readonly x: number; readonly y: number; }
export interface ExplanationTrailPath {
    readonly start: ExplanationTrailPoint;
    readonly control: ExplanationTrailPoint;
    readonly end: ExplanationTrailPoint;
}
interface TrailBounds { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
export const EXPLANATION_TRAIL_DURATION_MS = 1100;
const TRAVEL_MS = 350;
const DUST_MS = EXPLANATION_TRAIL_DURATION_MS - TRAVEL_MS;
const STAR_COUNT = 80;

// НАЧАЛО ФУНКЦИИ buildExplanationTrailPath
/** Центры реальных layout-прямоугольников задают концы плавной квадратичной кривой. */
export function buildExplanationTrailPath(from: TrailBounds, to: TrailBounds): ExplanationTrailPath {
    const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const bend = Math.min(150, distance * 0.22);
    const control = {
        x: (start.x + end.x) / 2 - dy / (distance || 1) * bend,
        y: (start.y + end.y) / 2 + dx / (distance || 1) * bend,
    };
    return { start, control, end };
}
// КОНЕЦ ФУНКЦИИ buildExplanationTrailPath

// НАЧАЛО ФУНКЦИИ sampleExplanationTrailPath
export function sampleExplanationTrailPath(path: ExplanationTrailPath, progress: number): ExplanationTrailPoint {
    const t = Math.max(0, Math.min(1, progress));
    const u = 1 - t;
    return {
        x: u * u * path.start.x + 2 * u * t * path.control.x + t * t * path.end.x,
        y: u * u * path.start.y + 2 * u * t * path.control.y + t * t * path.end.y,
    };
}
// КОНЕЦ ФУНКЦИИ sampleExplanationTrailPath
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ДЕТЕРМИНИРОВАННЫЕ ЧАСТИЦЫ И ОТРИСОВКА
interface TrailStar {
    readonly point: ExplanationTrailPoint;
    readonly birthMs: number;
    readonly driftX: number;
    readonly driftY: number;
    readonly radius: number;
    readonly warm: boolean;
    readonly cross: boolean;
}

// НАЧАЛО ФУНКЦИИ fraction
function fraction(index: number): number {
    let bits = Math.imul(index + 1, 0x9e3779b1) ^ 0x85ebca6b;
    bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
    return ((bits ^ (bits >>> 15)) >>> 0) / 0xffffffff;
}
// КОНЕЦ ФУНКЦИИ fraction

// НАЧАЛО ФУНКЦИИ makeTrailStars
function makeTrailStars(path: ExplanationTrailPath): readonly TrailStar[] {
    return Array.from({ length: STAR_COUNT }, (_, index) => {
        const t = index / (STAR_COUNT - 1);
        const point = sampleExplanationTrailPath(path, t);
        const tangentX = (1 - t) * (path.control.x - path.start.x) + t * (path.end.x - path.control.x);
        const tangentY = (1 - t) * (path.control.y - path.start.y) + t * (path.end.y - path.control.y);
        const length = Math.hypot(tangentX, tangentY) || 1;
        const spread = (fraction(index * 3) - 0.5) * 18;
        return {
            point: { x: point.x - tangentY / length * spread, y: point.y + tangentX / length * spread },
            birthMs: t * TRAVEL_MS,
            driftX: (fraction(index * 3 + 1) - 0.5) * 30,
            driftY: (fraction(index * 3 + 2) - 0.5) * 30,
            radius: 0.8 + fraction(index + 251) * 1.3,
            warm: index % 7 === 0,
            cross: index % 5 === 0,
        };
    });
}
// КОНЕЦ ФУНКЦИИ makeTrailStars

// НАЧАЛО ФУНКЦИИ paintExplanationTrail
function paintExplanationTrail(
    context: CanvasRenderingContext2D, path: ExplanationTrailPath, stars: readonly TrailStar[],
    elapsedMs: number, width: number, height: number,
): void {
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    const travel = Math.min(1, elapsedMs / TRAVEL_MS);
    const tailFade = Math.max(0, 1 - Math.max(0, elapsedMs - TRAVEL_MS) / 400);
    if (tailFade > 0) {
        context.beginPath();
        for (let index = 0; index <= 36; index++) {
            const point = sampleExplanationTrailPath(path, Math.max(0, travel - 0.8) + Math.min(travel, 0.8) * index / 36);
            if (index === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
        }
        context.strokeStyle = `rgba(119, 211, 255, ${tailFade * 0.58})`;
        context.lineWidth = 1.25;
        context.shadowColor = '#74d8ff';
        context.shadowBlur = 13;
        context.stroke();
    }

    for (const star of stars) {
        const age = elapsedMs - star.birthMs;
        if (age < 0 || age >= DUST_MS) continue;
        const life = age / DUST_MS;
        const alpha = Math.pow(1 - life, 1.5) * 0.88;
        const x = star.point.x + star.driftX * life;
        const y = star.point.y + star.driftY * life;
        const color = star.warm ? '255, 223, 166' : '180, 230, 255';
        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.shadowColor = star.warm ? '#ffdca1' : '#81d8ff';
        context.shadowBlur = star.cross ? 11 : 6;
        context.beginPath();
        context.arc(x, y, star.radius * (1 - life * 0.35), 0, Math.PI * 2);
        context.fill();
        if (star.cross) {
            const arm = star.radius * 2.9;
            context.beginPath();
            context.moveTo(x - arm, y); context.lineTo(x + arm, y);
            context.moveTo(x, y - arm); context.lineTo(x, y + arm);
            context.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
            context.lineWidth = 0.7;
            context.stroke();
        }
    }

    if (elapsedMs < TRAVEL_MS + 220) {
        const leader = sampleExplanationTrailPath(path, travel);
        const alpha = Math.max(0, 1 - Math.max(0, elapsedMs - TRAVEL_MS) / 220);
        context.shadowColor = '#9de6ff';
        context.shadowBlur = 22;
        context.fillStyle = `rgba(240, 251, 255, ${alpha})`;
        context.beginPath(); context.arc(leader.x, leader.y, 3.8, 0, Math.PI * 2); context.fill();
    }
    if (elapsedMs < 260) {
        const halo = elapsedMs / 260;
        context.shadowColor = '#82d9ff';
        context.shadowBlur = 13;
        context.strokeStyle = `rgba(143, 224, 255, ${(1 - halo) * 0.9})`;
        context.lineWidth = 1.5;
        context.beginPath(); context.arc(path.start.x, path.start.y, 12 + halo * 28, 0, Math.PI * 2); context.stroke();
    }
    context.shadowBlur = 0;
}
// КОНЕЦ ФУНКЦИИ paintExplanationTrail
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ВРЕМЕННЫЙ CANVAS И ОГРАНИЧЕННЫЙ RAF
// НАЧАЛО ФУНКЦИИ playExplanationTrail
/** Собственные часы работают и при паузе сцены; после короткого пролёта ресурсов не остаётся. */
export function playExplanationTrail(trigger: HTMLElement | null, dialog: HTMLDialogElement): () => void {
    const noop = (): void => {};
    if (typeof window === 'undefined' || typeof document === 'undefined' || !trigger?.isConnected || !dialog.open ||
        document.hidden || typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function' ||
        typeof window.matchMedia !== 'function') return noop;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return noop; }
    catch { return noop; }
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return noop;
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') return noop;
    let context: CanvasRenderingContext2D | null;
    try { context = canvas.getContext('2d'); }
    catch { return noop; }
    const methods = ['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke'] as const;
    if (!context || methods.some((method) => typeof context[method] !== 'function')) return noop;
    const from = trigger.getBoundingClientRect();
    const to = dialog.getBoundingClientRect();
    if ([from, to].some((rect) => ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0)) return noop;
    const path = buildExplanationTrailPath(from, to);
    const stars = makeTrailStars(path);
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.className = 'explanation-trail';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('inert', '');
    for (const [property, value] of Object.entries({
        position: 'fixed', inset: '0', width: '100vw', height: '100vh', 'pointer-events': 'none', 'z-index': '80',
    })) canvas.style.setProperty(property, value);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.append(canvas);
    dialog.dataset.entryAnimation = 'true';
    resourceLedger.trackPageLifetimeAllocation('buffers', 1);
    resourceLedger.trackPageLifetimeAllocation('listeners', 2);
    let disposed = false;
    let frameId: number | null = null;
    let startMs: number | null = null;

    // НАЧАЛО ФУНКЦИИ cleanup
    function cleanup(): void {
        if (disposed) return;
        disposed = true;
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', cleanup);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        canvas.width = canvas.height = 0;
        canvas.remove();
        delete dialog.dataset.entryAnimation;
        resourceLedger.trackPageLifetimeRelease('buffers', 1);
        resourceLedger.trackPageLifetimeRelease('listeners', 2);
    }
    // КОНЕЦ ФУНКЦИИ cleanup

    // НАЧАЛО ФУНКЦИИ handleVisibilityChange
    function handleVisibilityChange(): void { if (document.hidden) cleanup(); }
    // КОНЕЦ ФУНКЦИИ handleVisibilityChange

    // НАЧАЛО ФУНКЦИИ frame
    function frame(timestamp: number): void {
        if (disposed) return;
        frameId = null;
        if (!dialog.open || !dialog.isConnected || document.hidden) { cleanup(); return; }
        if (startMs === null) startMs = timestamp;
        const elapsed = Math.max(0, timestamp - startMs);
        if (elapsed >= EXPLANATION_TRAIL_DURATION_MS) { cleanup(); return; }
        paintExplanationTrail(context!, path, stars, elapsed, width, height);
        frameId = window.requestAnimationFrame(frame);
    }
    // КОНЕЦ ФУНКЦИИ frame

    window.addEventListener('resize', cleanup, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    paintExplanationTrail(context, path, stars, 0, width, height);
    frameId = window.requestAnimationFrame(frame);
    return cleanup;
}
// КОНЕЦ ФУНКЦИИ playExplanationTrail
// КОНЕЦ РАЗДЕЛА 3
