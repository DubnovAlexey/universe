// ============================================================================
// ФАЙЛ: frontend/src/layers/explanationButtonMotion.ts
// НАЗНАЧЕНИЕ: Собственные кубоиды кнопок путеводителя с малым покачиванием и тенями.
// РАЗДЕЛЫ: 1. Контракт и ограниченная поза; 2. Общий кадр; 3. Привязки и освобождение.
// ФУНКЦИИ: getExplanationButtonAngle, advanceExplanationButtonAngle, getExplanationModeInk,
// getExplanationFacetLight, mountExplanationButtonMotion, writeProperty, publishPose, publishLight, stabilize,
// tick, dispose; локальные обработчики pointerenter, pointerleave, focus, blur.
// Общая геометрия ButtonSolidManager сохраняет семантическую кнопку и её hit area.
// Глобальные экземпляры HUD не используются; новых RAF и таймеров нет.
// ============================================================================

import { ButtonSolidManager } from '../core/buttonSolid';
import { resourceLedger } from '../core/resourceLedger';
import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ И ОГРАНИЧЕННАЯ ПОЗА
export interface ExplanationButtonMotionBinding { dispose(): void; }
const SHADOW_INTERVAL_SEC = 1 / 12;
const AXIS_LENGTH = Math.hypot(0.86, 0.5, 0.05);
const AXIS = [0.86 / AXIS_LENGTH, 0.5 / AXIS_LENGTH, 0.05 / AXIS_LENGTH] as const;
const MAX_BUTTON_ANGLE = 10;
const MOTION_PROPERTIES = [
    '--button-axis-x', '--button-axis-y', '--button-axis-z', '--button-spin-angle', '--button-back-label-turn',
    '--button-shadow-x', '--button-shadow-y', '--button-shadow-blur', '--button-shadow-opacity',
    '--button-shadow-scale-x', '--button-shadow-scale-y', '--explanation-mode-ink',
    '--explanation-facet-x', '--explanation-facet-y', '--explanation-facet-angle', '--explanation-facet-opacity',
] as const;
const MODE_COLORS = [[255, 230, 166], [255, 210, 174], [255, 236, 230], [204, 228, 255]] as const;
interface ButtonPose {
    readonly element: HTMLElement;
    readonly index: number;
    readonly originalMarker: string | undefined;
    readonly originalStyles: readonly { property: string; value: string; priority: string }[];
    readonly values: Map<string, string>;
    cleanup(): void;
    hovered: boolean;
    focused: boolean;
    angle: number;
}

// НАЧАЛО ФУНКЦИИ getExplanationButtonAngle
/** Частоты совпадают со стенкой каскада 5; сумма никогда не выходит за ±10 градусов. */
export function getExplanationButtonAngle(timeSec: number, index: number): number {
    const time = Number.isFinite(timeSec) ? timeSec : 0;
    const slot = Number.isFinite(index) ? index : 0;
    return 7 * Math.sin(-time * 1.15 + 3.75 + slot * 0.28) + 3 * Math.cos(time * 1.45 + slot * 0.13);
}
// КОНЕЦ ФУНКЦИИ getExplanationButtonAngle

// НАЧАЛО ФУНКЦИИ advanceExplanationButtonAngle
/** Ограниченный шаг сохраняет непрерывную позу при смене фазы и плавно гасит её под фокусом. */
export function advanceExplanationButtonAngle(previous: number, timeSec: number, index: number, held: boolean, frameDtSec: number): number {
    const angle = Number.isFinite(previous) ? Math.max(-MAX_BUTTON_ANGLE, Math.min(MAX_BUTTON_ANGLE, previous)) : 0;
    const dt = Number.isFinite(frameDtSec) ? Math.max(0, Math.min(0.05, frameDtSec)) : 0;
    if (!dt) return angle;
    const target = held ? 0 : getExplanationButtonAngle(timeSec, index);
    const next = angle + (target - angle) * (1 - Math.exp(-dt / (held ? 0.1 : 0.28)));
    return held && Math.abs(next) < 0.003 ? 0 : next;
}
// КОНЕЦ ФУНКЦИИ advanceExplanationButtonAngle

// НАЧАЛО ФУНКЦИИ getExplanationModeInk
/** Полный яркий цвет надписи меняется за двадцать активных секунд, без прозрачности. */
export function getExplanationModeInk(timeSec: number): string {
    const time = Number.isFinite(timeSec) ? timeSec : 0;
    const phase = ((time % 20 + 20) % 20) / 20 * MODE_COLORS.length;
    const index = Math.floor(phase);
    const p = phase - index;
    const mix = p * p * p * (p * (p * 6 - 15) + 10);
    const from = MODE_COLORS[index];
    const to = MODE_COLORS[(index + 1) % MODE_COLORS.length];
    const channels = from.map((channel, component) => Math.round(channel + (to[component] - channel) * mix));
    return `rgb(${channels.join(' ')})`;
}
// КОНЕЦ ФУНКЦИИ getExplanationModeInk

// НАЧАЛО ФУНКЦИИ getExplanationFacetLight
/** Медленные некратные колебания и сдвиг по индексу не создают общего заметного цикла бликов. */
export function getExplanationFacetLight(timeSec: number, index: number): Readonly<{
    xPercent: number; yPercent: number; angleDeg: number; opacity: number;
}> {
    const time = Number.isFinite(timeSec) ? timeSec : 0;
    const slot = Number.isFinite(index) ? index : 0;
    const phase = slot * 2.399963229728653;
    return {
        xPercent: 50 + 22 * Math.sin(time * 0.157 + phase) + 8 * Math.cos(time * 0.097 + phase * 0.61),
        yPercent: 50 + 18 * Math.sin(time * 0.131 + phase * 0.73) + 12 * Math.cos(time * 0.083 + phase),
        angleDeg: 120 + 12 * Math.sin(time * 0.071 + phase) + 6 * Math.cos(time * 0.109 + phase * 0.37),
        opacity: 0.07 + 0.025 * Math.sin(time * 0.113 + phase * 0.89),
    };
}
// КОНЕЦ ФУНКЦИИ getExplanationFacetLight
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ mountExplanationButtonMotion
/** Одна подписка обслуживает все существующие кнопки до закрытия окна. */
export function mountExplanationButtonMotion(
    elements: readonly HTMLElement[], subscribeFrame: typeof subscribeVisualSignals = subscribeVisualSignals,
): ExplanationButtonMotionBinding {
    // Минимальные SSR/тестовые DOM оставляют семантические кнопки без декоративной оболочки.
    const hosts = Array.from(new Set(elements)).filter((element) =>
        typeof element.cloneNode === 'function' && element.childNodes !== undefined &&
        typeof element.hasAttribute === 'function' && typeof element.addEventListener === 'function');
    if (!hosts.length) return { dispose: () => {} };
    const solids = new ButtonSolidManager();
    const solidBinding = solids.mount(hosts);
    const poses: ButtonPose[] = hosts.map((element, index) => ({
        element, index, originalMarker: element.dataset.explanationButtonMotion,
        originalStyles: MOTION_PROPERTIES.map((property) => ({ property,
            value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) })),
        values: new Map(), cleanup: () => {}, hovered: false,
        focused: element.ownerDocument.activeElement === element, angle: 0,
    }));
    let disposed = false;
    let paused = getVisualSignals().isPaused;
    let reducedMotion = getVisualSignals().reducedMotion;
    let media: MediaQueryList | null = null;
    try { if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') media = window.matchMedia('(prefers-reduced-motion: reduce)'); }
    catch { /* Режим общего кадра доступен и без MediaQueryList. */ }
    let shadowElapsed = 0;
    let colorTime = 0;
    let lightTime = 0;
    let unsubscribe = (): void => {};

    // НАЧАЛО РАЗДЕЛА 2. ОБЩИЙ КАДР И СОБСТВЕННЫЕ ТЕНИ
    // НАЧАЛО ФУНКЦИИ writeProperty
    function writeProperty(pose: ButtonPose, property: string, value: string): void {
        if (pose.values.get(property) === value) return;
        pose.element.style.setProperty(property, value);
        pose.values.set(property, value);
    }
    // КОНЕЦ ФУНКЦИИ writeProperty

    // НАЧАЛО ФУНКЦИИ publishPose
    /** Малый поворот меняет отдельную тень, оставляя прямоугольник кнопки неподвижным. */
    function publishPose(pose: ButtonPose, shadow: boolean): void {
        writeProperty(pose, '--button-spin-angle', `${pose.angle.toFixed(3)}deg`);
        if (!shadow) return;
        const radians = pose.angle * Math.PI / 180;
        const c = Math.cos(radians), s = Math.sin(radians), u = 1 - c;
        const [x, y, z] = AXIS;
        const normalX = x * z * u + y * s;
        const normalY = y * z * u - x * s;
        const edge = 1 - Math.abs(c + z * z * u);
        const values = [
            ['--button-shadow-x', `${(2.8 + normalX * 4).toFixed(3)}px`],
            ['--button-shadow-y', `${(6.5 + edge * 5 - normalY * 1.5).toFixed(3)}px`],
            ['--button-shadow-blur', `${(4 + edge * 3.5).toFixed(3)}px`],
            ['--button-shadow-opacity', (0.64 - edge * 0.14).toFixed(3)],
            ['--button-shadow-scale-x', (1 - edge * 0.15).toFixed(3)],
            ['--button-shadow-scale-y', (0.88 - edge * 0.14).toFixed(3)],
        ];
        for (const [property, value] of values) writeProperty(pose, property, value);
    }
    // КОНЕЦ ФУНКЦИИ publishPose

    // НАЧАЛО ФУНКЦИИ publishLight
    function publishLight(pose: ButtonPose): void {
        const light = getExplanationFacetLight(lightTime, pose.index);
        writeProperty(pose, '--explanation-facet-x', `${light.xPercent.toFixed(3)}%`);
        writeProperty(pose, '--explanation-facet-y', `${light.yPercent.toFixed(3)}%`);
        writeProperty(pose, '--explanation-facet-angle', `${light.angleDeg.toFixed(3)}deg`);
        writeProperty(pose, '--explanation-facet-opacity', light.opacity.toFixed(4));
    }
    // КОНЕЦ ФУНКЦИИ publishLight

    // НАЧАЛО ФУНКЦИИ stabilize
    /** Reduced motion сразу убирает наклон; пауза сохраняет позу до плавного возобновления. */
    function stabilize(pose: ButtonPose): void {
        if (reducedMotion || media?.matches) {
            pose.angle = 0;
            publishPose(pose, true);
        }
    }
    // КОНЕЦ ФУНКЦИИ stabilize

    // НАЧАЛО ФУНКЦИИ tick
    function tick(signals: Readonly<VisualSignalSnapshot>): void {
        if (disposed) return;
        if (poses.every(({ element }) => !element.isConnected)) { dispose(); return; }
        paused = signals.isPaused;
        const reduce = signals.reducedMotion || Boolean(media?.matches);
        if (reduce) {
            if (!reducedMotion) for (const pose of poses) { pose.angle = 0; publishPose(pose, true); }
            reducedMotion = true;
            return;
        }
        reducedMotion = false;
        if (paused) return;
        const dt = Number.isFinite(signals.frameDtSec) ? Math.max(0, Math.min(0.05, signals.frameDtSec)) : 0;
        if (!dt) return;
        shadowElapsed += dt;
        const shadow = shadowElapsed >= SHADOW_INTERVAL_SEC;
        if (shadow) shadowElapsed %= SHADOW_INTERVAL_SEC;
        colorTime = (colorTime + dt) % 20;
        lightTime += dt;
        const ink = getExplanationModeInk(colorTime);
        for (const pose of poses) {
            if (!pose.element.isConnected) continue;
            const held = pose.hovered || pose.focused;
            pose.angle = advanceExplanationButtonAngle(pose.angle, signals.simTimeSec, pose.index, held, dt);
            publishPose(pose, shadow);
            publishLight(pose);
            if (pose.element.dataset.explanationMode) writeProperty(pose, '--explanation-mode-ink', ink);
        }
    }
    // КОНЕЦ ФУНКЦИИ tick
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. СТАБИЛЬНЫЕ ОБРАБОТЧИКИ И ОСВОБОЖДЕНИЕ
    for (const pose of poses) {
        AXIS.forEach((value, index) => writeProperty(pose, ['--button-axis-x', '--button-axis-y', '--button-axis-z'][index], value.toFixed(6)));
        writeProperty(pose, '--button-back-label-turn', '0deg');
        if (pose.element.dataset.explanationMode) writeProperty(pose, '--explanation-mode-ink', getExplanationModeInk(0));
        publishPose(pose, true);
        publishLight(pose);
        pose.element.dataset.explanationButtonMotion = '1';
        // Четыре обработчика живут столько же, сколько открытая панель, а не строка текста.
        const enter = (): void => { pose.hovered = true; stabilize(pose); };
        const leave = (): void => { pose.hovered = false; };
        const focus = (): void => { pose.focused = true; stabilize(pose); };
        const blur = (): void => { pose.focused = false; };
        pose.element.addEventListener('pointerenter', enter);
        pose.element.addEventListener('pointerleave', leave);
        pose.element.addEventListener('focus', focus);
        pose.element.addEventListener('blur', blur);
        pose.cleanup = (): void => {
            pose.element.removeEventListener('pointerenter', enter);
            pose.element.removeEventListener('pointerleave', leave);
            pose.element.removeEventListener('focus', focus);
            pose.element.removeEventListener('blur', blur);
        };
    }
    const listenerCount = poses.length * 4 + 1;
    resourceLedger.trackPageLifetimeAllocation('listeners', listenerCount);
    unsubscribe = subscribeFrame(tick, 'explanation-buttons');
    if (disposed) unsubscribe();

    // НАЧАЛО ФУНКЦИИ dispose
    function dispose(): void {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        for (const pose of poses) {
            pose.cleanup();
            for (const { property, value, priority } of pose.originalStyles) {
                if (value) pose.element.style.setProperty(property, value, priority);
                else pose.element.style.removeProperty(property);
            }
            if (pose.originalMarker === undefined) delete pose.element.dataset.explanationButtonMotion;
            else pose.element.dataset.explanationButtonMotion = pose.originalMarker;
        }
        solidBinding.dispose();
        resourceLedger.trackPageLifetimeRelease('listeners', listenerCount);
    }
    // КОНЕЦ ФУНКЦИИ dispose
    // КОНЕЦ РАЗДЕЛА 3
    return { dispose };
}
// КОНЕЦ ФУНКЦИИ mountExplanationButtonMotion
