// ============================================================================
// ФАЙЛ: frontend/src/layers/explanationTrail.ts
// НАЗНАЧЕНИЕ: Проявление окна путеводителя на месте, где его собирает песчаный вихрь.
// РАЗДЕЛЫ: 1. Проверка среды и геометрии; 2. Поза окна на общей шкале; 3. Освобождение.
// ФУНКЦИИ: playExplanationTrail, applyPose, cleanup, handleVisibilityChange, frame.
// Песчинки рисует основной renderer (engine/passes/explanationAssemblyPass.ts) по общему
// состоянию core/explanationAssembly.ts. Здесь только окно: прозрачность и малый поворот,
// записанные прямо в style (не через наследуемые CSS-переменные всего поддерева).
// ============================================================================

import {
    EXPLANATION_DUST_COUNT, EXPLANATION_DUST_COUNT_COMPACT, EXPLANATION_TRAIL_DURATION_MS,
    explanationAssembly, getExplanationAssemblyFrame, type ExplanationAssemblyState,
} from '../core/explanationAssembly';
import { resourceLedger } from '../core/resourceLedger';
import { getVisualSignals } from '../core/visualSignals';

export interface ExplanationTrailOptions {
    readonly state?: ExplanationAssemblyState;
    readonly clock?: () => number;
}
const POSE_PROPERTIES = ['opacity', 'transform', 'transform-origin'] as const;

// НАЧАЛО ФУНКЦИИ playExplanationTrail
/**
 * Запускает сборку окна из песка и возвращает функцию досрочной остановки.
 * Reduced motion, скрытая вкладка или недоступная геометрия — окно показывается сразу.
 */
export function playExplanationTrail(trigger: HTMLElement | null, dialog: HTMLDialogElement,
    options: ExplanationTrailOptions = {}): () => void {
    const noop = (): void => {};
    // НАЧАЛО РАЗДЕЛА 1. ПРОВЕРКА СРЕДЫ И ГЕОМЕТРИИ
    if (typeof window === 'undefined' || typeof document === 'undefined' || !trigger?.isConnected || !dialog.open ||
        document.hidden || typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function' ||
        typeof window.matchMedia !== 'function') return noop;
    let motionPreference: MediaQueryList;
    try {
        motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionPreference.matches) return noop;
    }
    catch { return noop; }
    if (getVisualSignals().reducedMotion) return noop;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return noop;
    const from = trigger.getBoundingClientRect();
    const to = dialog.getBoundingClientRect();
    if ([from, to].some((rect) => ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0)) return noop;
    const state = options.state ?? explanationAssembly;
    const clock = options.clock ?? (() => performance.now());
    const startMs = clock();
    if (!Number.isFinite(startMs)) return noop;
    const token = state.begin({
        from: { left: from.left, top: from.top, width: from.width, height: from.height },
        to: { left: to.left, top: to.top, width: to.width, height: to.height },
        viewport: { width, height }, startMs,
        count: width <= 920 ? EXPLANATION_DUST_COUNT_COMPACT : EXPLANATION_DUST_COUNT,
    });
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. ПОЗА ОКНА НА ОБЩЕЙ ШКАЛЕ
    const original = POSE_PROPERTIES.map((property) => ({ property,
        value: dialog.style.getPropertyValue(property), priority: dialog.style.getPropertyPriority(property) }));
    const originalStage = dialog.dataset.entryStage;
    const published = new Map<string, string>();

    // НАЧАЛО ФУНКЦИИ applyPose
    /** Окно не летит: проявляется на месте сборки с затухающим поворотом вокруг Y. */
    function applyPose(elapsedMs: number): void {
        const pose = getExplanationAssemblyFrame(elapsedMs);
        const values: Record<(typeof POSE_PROPERTIES)[number], string> = {
            opacity: pose.nativeOpacity.toFixed(4),
            transform: `perspective(1000px) rotateY(${pose.yaw.toFixed(3)}deg) scale(${pose.scale.toFixed(5)})`,
            'transform-origin': 'center',
        };
        for (const property of POSE_PROPERTIES) {
            if (published.get(property) === values[property]) continue;
            dialog.style.setProperty(property, values[property]);
            published.set(property, values[property]);
        }
        const stage = pose.nativeOpacity < 0.5 ? 'gathering' : 'revealing';
        if (dialog.dataset.entryStage !== stage) dialog.dataset.entryStage = stage;
    }
    // КОНЕЦ ФУНКЦИИ applyPose

    applyPose(0);
    dialog.dataset.entryAnimation = 'true';
    resourceLedger.trackPageLifetimeAllocation('listeners', 2);
    let disposed = false;
    let frameId: number | null = null;
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ОСВОБОЖДЕНИЕ
    // НАЧАЛО ФУНКЦИИ cleanup
    /** Любая остановка оставляет окно полностью видимым и возвращает исходные inline-стили. */
    function cleanup(): void {
        if (disposed) return;
        disposed = true;
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        window.removeEventListener('resize', cleanup);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        state.end(token);
        delete dialog.dataset.entryAnimation;
        if (originalStage === undefined) delete dialog.dataset.entryStage;
        else dialog.dataset.entryStage = originalStage;
        original.forEach(({ property, value, priority }) => {
            if (value) dialog.style.setProperty(property, value, priority);
            else dialog.style.removeProperty(property);
        });
        resourceLedger.trackPageLifetimeRelease('listeners', 2);
    }
    // КОНЕЦ ФУНКЦИИ cleanup

    // НАЧАЛО ФУНКЦИИ handleVisibilityChange
    function handleVisibilityChange(): void { if (document.hidden) cleanup(); }
    // КОНЕЦ ФУНКЦИИ handleVisibilityChange

    // НАЧАЛО ФУНКЦИИ frame
    function frame(): void {
        if (disposed) return;
        frameId = null;
        if (!dialog.open || !dialog.isConnected || document.hidden || motionPreference.matches) { cleanup(); return; }
        const elapsed = clock() - startMs;
        if (!Number.isFinite(elapsed) || elapsed >= EXPLANATION_TRAIL_DURATION_MS) { cleanup(); return; }
        applyPose(Math.max(0, elapsed));
        frameId = window.requestAnimationFrame(frame);
    }
    // КОНЕЦ ФУНКЦИИ frame

    window.addEventListener('resize', cleanup, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    frameId = window.requestAnimationFrame(frame);
    return cleanup;
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ playExplanationTrail
