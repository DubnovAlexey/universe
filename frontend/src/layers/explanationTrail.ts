// ============================================================================
// ФАЙЛ: frontend/src/layers/explanationTrail.ts
// НАЗНАЧЕНИЕ: Пылевые точки поля собирают плоскость окна в его конечной левой позиции.
// РАЗДЕЛЫ: 1. Геометрия и стадии сборки; 2. Частицы поля и плоскости; 3. Временный Canvas.
// ФУНКЦИИ: buildExplanationTrailPath, sampleExplanationTrailPath, smooth,
// getExplanationAssemblyFrame, fraction, buildExplanationDustParticles,
// projectExplanationWindowPoint, sampleExplanationDustParticle, paintExplanationTrail,
// playExplanationTrail, positionPanel, cleanup, handleVisibilityChange, frame.
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
export const EXPLANATION_TRAIL_DURATION_MS = 4200;
export const EXPLANATION_ASSEMBLY_MS = 3000;
export const EXPLANATION_DUST_COUNT = 224;
const PERIMETER_COUNT = 176;

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
    const t = smooth(progress);
    const u = 1 - t;
    return {
        x: u * u * path.start.x + 2 * u * t * path.control.x + t * t * path.end.x,
        y: u * u * path.start.y + 2 * u * t * path.control.y + t * t * path.end.y,
    };
}
// КОНЕЦ ФУНКЦИИ sampleExplanationTrailPath

// НАЧАЛО ФУНКЦИИ smooth
/** Квинтическая граница имеет нулевые скорость и ускорение на обоих концах. */
function smooth(progress: number): number {
    const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    return p * p * p * (p * (p * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ smooth

export interface ExplanationAssemblyFrame {
    readonly gather: number;
    readonly nativeOpacity: number;
    readonly dustOpacity: number;
    readonly yaw: number;
    readonly scale: number;
}

// НАЧАЛО ФУНКЦИИ getExplanationAssemblyFrame
/** Плоскость собирается за три секунды; готовое окно появляется только на месте сборки. */
export function getExplanationAssemblyFrame(elapsedMs: number): ExplanationAssemblyFrame {
    const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const gather = smooth(time / EXPLANATION_ASSEMBLY_MS);
    const nativeOpacity = smooth((time - EXPLANATION_ASSEMBLY_MS) / 1000);
    const remaining = 1 - smooth(time / 4000);
    return {
        gather, nativeOpacity,
        dustOpacity: 1 - smooth((time - 3300) / 900),
        yaw: -14 * (1 - nativeOpacity) + Math.sin(time * 0.00145) * 1.8 * remaining,
        scale: 0.985 + nativeOpacity * 0.015,
    };
}
// КОНЕЦ ФУНКЦИИ getExplanationAssemblyFrame
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ДЕТЕРМИНИРОВАННЫЕ ЧАСТИЦЫ И ПЛОСКОСТЬ
export interface ExplanationDustParticle {
    readonly origin: ExplanationTrailPoint;
    readonly target: ExplanationTrailPoint;
    readonly bend: ExplanationTrailPoint;
    readonly delayMs: number;
    readonly radius: number;
    readonly boundary: boolean;
    readonly fromTrigger: boolean;
    readonly warm: boolean;
}

// НАЧАЛО ФУНКЦИИ fraction
function fraction(index: number): number {
    let bits = Math.imul(index + 1, 0x9e3779b1) ^ 0x85ebca6b;
    bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
    return ((bits ^ (bits >>> 15)) >>> 0) / 0xffffffff;
}
// КОНЕЦ ФУНКЦИИ fraction

// НАЧАЛО ФУНКЦИИ buildExplanationDustParticles
/** Это декоративная выборка поля: исходная Вселенная не изменяется и её точки не исчезают. */
export function buildExplanationDustParticles(
    from: TrailBounds, to: TrailBounds, viewport: { readonly width: number; readonly height: number },
): readonly ExplanationDustParticle[] {
    const start = buildExplanationTrailPath(from, to).start;
    const insetX = Math.min(16, to.width * 0.035);
    const insetY = Math.min(18, to.height * 0.035);
    const left = to.left + insetX, top = to.top + insetY;
    const width = Math.max(1, to.width - insetX * 2), height = Math.max(1, to.height - insetY * 2);
    const perimeter = 2 * (width + height);
    return Array.from({ length: EXPLANATION_DUST_COUNT }, (_, index) => {
        const boundary = index < PERIMETER_COUNT;
        let x: number, y: number;
        if (boundary) {
            const distance = index / PERIMETER_COUNT * perimeter;
            if (distance < width) { x = left + distance; y = top; }
            else if (distance < width + height) { x = left + width; y = top + distance - width; }
            else if (distance < width * 2 + height) { x = left + width - (distance - width - height); y = top + height; }
            else { x = left; y = top + height - (distance - width * 2 - height); }
        } else {
            const planeIndex = index - PERIMETER_COUNT;
            x = left + ((planeIndex % 8) + 0.5) / 8 * width;
            y = top + (Math.floor(planeIndex / 8) + 0.5) / 6 * height;
        }
        const fromTrigger = index % 13 === 0;
        const origin = fromTrigger
            ? { x: start.x + (fraction(index + 59) - 0.5) * from.width * 0.4,
                y: start.y + (fraction(index + 83) - 0.5) * from.height * 0.4 }
            : { x: fraction(index * 7 + 17) * viewport.width, y: fraction(index * 11 + 43) * viewport.height };
        return {
            origin, target: { x, y }, boundary, fromTrigger,
            bend: { x: (fraction(index * 3 + 1) - 0.5) * (width * 0.32 + 48),
                y: (fraction(index * 3 + 2) - 0.65) * (height * 0.18 + 42) },
            delayMs: fraction(index + 151) * 320,
            radius: (boundary ? 0.9 : 0.6) + fraction(index + 251) * 0.8,
            warm: index % 11 === 0,
        };
    });
}
// КОНЕЦ ФУНКЦИИ buildExplanationDustParticles

// НАЧАЛО ФУНКЦИИ projectExplanationWindowPoint
/** Та же перспектива и Y-раскрытие, что у нативного окна; центр плоскости неподвижен. */
export function projectExplanationWindowPoint(
    point: ExplanationTrailPoint, center: ExplanationTrailPoint, state: ExplanationAssemblyFrame,
): ExplanationTrailPoint {
    const angle = state.yaw * Math.PI / 180;
    const x = point.x - center.x, y = point.y - center.y;
    const z = -x * Math.sin(angle);
    const perspective = 1000 / Math.max(400, 1000 - z);
    return { x: center.x + x * Math.cos(angle) * perspective * state.scale,
        y: center.y + y * perspective * state.scale };
}
// КОНЕЦ ФУНКЦИИ projectExplanationWindowPoint

// НАЧАЛО ФУНКЦИИ sampleExplanationDustParticle
export function sampleExplanationDustParticle(
    particle: ExplanationDustParticle, center: ExplanationTrailPoint, elapsedMs: number,
): ExplanationTrailPoint & { readonly progress: number } {
    const progress = smooth((elapsedMs - particle.delayMs) / (EXPLANATION_ASSEMBLY_MS - particle.delayMs));
    const target = projectExplanationWindowPoint(particle.target, center, getExplanationAssemblyFrame(elapsedMs));
    const control = { x: (particle.origin.x + target.x) / 2 + particle.bend.x,
        y: (particle.origin.y + target.y) / 2 + particle.bend.y };
    const u = 1 - progress;
    return {
        x: u * u * particle.origin.x + 2 * u * progress * control.x + progress * progress * target.x,
        y: u * u * particle.origin.y + 2 * u * progress * control.y + progress * progress * target.y,
        progress,
    };
}
// КОНЕЦ ФУНКЦИИ sampleExplanationDustParticle

// НАЧАЛО ФУНКЦИИ paintExplanationTrail
function paintExplanationTrail(
    context: CanvasRenderingContext2D, path: ExplanationTrailPath, particles: readonly ExplanationDustParticle[],
    elapsedMs: number, width: number, height: number,
): void {
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    const state = getExplanationAssemblyFrame(elapsedMs);
    const points = particles.map((particle) => sampleExplanationDustParticle(particle, path.end, elapsedMs));
    const appear = 0.25 + 0.75 * smooth(elapsedMs / 650);
    const contourOpacity = smooth((state.gather - 0.94) / 0.06) * state.dustOpacity;
    if (contourOpacity > 0) {
        context.beginPath();
        for (let index = 0; index <= PERIMETER_COUNT; index++) {
            const point = points[index % PERIMETER_COUNT];
            if (index === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
        }
        context.fillStyle = `rgba(74, 151, 193, ${contourOpacity * 0.025})`;
        context.fill();
        context.strokeStyle = `rgba(119, 211, 255, ${contourOpacity * 0.26})`;
        context.lineWidth = 0.85;
        context.shadowColor = '#74d8ff';
        context.shadowBlur = 8;
        context.stroke();
    }

    for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        const point = points[index];
        const alpha = (particle.boundary ? 0.76 : 0.34) * appear * state.dustOpacity * (0.48 + point.progress * 0.52);
        if (alpha <= 0) continue;
        const { x, y } = point;
        const color = particle.warm ? '255, 223, 166' : '180, 230, 255';
        if (index % 3 === 0 && point.progress > 0.08 && point.progress < 0.96) {
            const previous = sampleExplanationDustParticle(particle, path.end, Math.max(0, elapsedMs - 45));
            context.shadowBlur = 0;
            context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(x, y);
            context.lineWidth = 0.65;
            context.strokeStyle = `rgba(${color}, ${alpha * 0.3})`;
            context.stroke();
        }
        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.shadowColor = particle.warm ? '#ffdca1' : '#81d8ff';
        context.shadowBlur = particle.boundary ? 7 : 4;
        context.beginPath();
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
        if (index % 17 === 0) {
            const arm = particle.radius * 2.6;
            context.beginPath();
            context.moveTo(x - arm, y); context.lineTo(x + arm, y);
            context.moveTo(x, y - arm); context.lineTo(x, y + arm);
            context.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
            context.lineWidth = 0.7;
            context.stroke();
        }
    }

    if (elapsedMs < 650) {
        const halo = smooth(elapsedMs / 650);
        context.shadowColor = '#82d9ff';
        context.shadowBlur = 13;
        context.strokeStyle = `rgba(143, 224, 255, ${(1 - halo) * 0.65})`;
        context.lineWidth = 1.1;
        context.beginPath(); context.arc(path.start.x, path.start.y, 12 + halo * 28, 0, Math.PI * 2); context.stroke();
    }
    context.shadowBlur = 0;
}
// КОНЕЦ ФУНКЦИИ paintExplanationTrail
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ВРЕМЕННЫЙ CANVAS И ОГРАНИЧЕННЫЙ RAF
// НАЧАЛО ФУНКЦИИ playExplanationTrail
/** Временный слой собирает пыль на месте окна, не меняя ни одной частицы основной сцены. */
export function playExplanationTrail(trigger: HTMLElement | null, dialog: HTMLDialogElement): () => void {
    const noop = (): void => {};
    if (typeof window === 'undefined' || typeof document === 'undefined' || !trigger?.isConnected || !dialog.open ||
        document.hidden || typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function' ||
        typeof window.matchMedia !== 'function') return noop;
    let motionPreference: MediaQueryList;
    try {
        motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionPreference.matches) return noop;
    }
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
    const particles = buildExplanationDustParticles(from, to, { width, height });
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
    const flightProperties = ['--explanation-flight-x', '--explanation-flight-y', '--explanation-flight-scale',
        '--explanation-flight-turn', '--explanation-flight-yaw', '--explanation-flight-opacity'];
    const originalFlight = flightProperties.map((property) => ({ property, value: dialog.style.getPropertyValue(property), priority: dialog.style.getPropertyPriority(property) }));
    const originalStage = dialog.dataset.entryStage;
    const published = new Map<string, string>();
    // НАЧАЛО ФУНКЦИИ positionPanel
    /** Нативная панель не летит: проявляется с малым Y-раскрытием в конечном положении. */
    function positionPanel(elapsedMs: number): void {
        const state = getExplanationAssemblyFrame(elapsedMs);
        const values: Record<string, string> = {
            '--explanation-flight-x': '0px', '--explanation-flight-y': '0px', '--explanation-flight-turn': '0deg',
            '--explanation-flight-scale': state.scale.toFixed(5), '--explanation-flight-yaw': `${state.yaw.toFixed(3)}deg`,
            '--explanation-flight-opacity': state.nativeOpacity.toFixed(4),
        };
        for (const [property, value] of Object.entries(values)) {
            if (published.get(property) === value) continue;
            dialog.style.setProperty(property, value);
            published.set(property, value);
        }
        const stage = elapsedMs < EXPLANATION_ASSEMBLY_MS ? 'gathering' : 'revealing';
        if (dialog.dataset.entryStage !== stage) dialog.dataset.entryStage = stage;
    }
    // КОНЕЦ ФУНКЦИИ positionPanel
    positionPanel(0);
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
        if (originalStage === undefined) delete dialog.dataset.entryStage;
        else dialog.dataset.entryStage = originalStage;
        originalFlight.forEach(({ property, value, priority }) => {
            if (value) dialog.style.setProperty(property, value, priority);
            else dialog.style.removeProperty(property);
        });
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
        if (!dialog.open || !dialog.isConnected || document.hidden || motionPreference.matches) { cleanup(); return; }
        if (startMs === null) startMs = timestamp;
        const elapsed = Math.max(0, timestamp - startMs);
        if (elapsed >= EXPLANATION_TRAIL_DURATION_MS) { cleanup(); return; }
        positionPanel(elapsed);
        paintExplanationTrail(context!, path, particles, elapsed, width, height);
        frameId = window.requestAnimationFrame(frame);
    }
    // КОНЕЦ ФУНКЦИИ frame

    window.addEventListener('resize', cleanup, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    paintExplanationTrail(context, path, particles, 0, width, height);
    frameId = window.requestAnimationFrame(frame);
    return cleanup;
}
// КОНЕЦ ФУНКЦИИ playExplanationTrail
// КОНЕЦ РАЗДЕЛА 3
