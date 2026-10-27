// ============================================================================
// ФАЙЛ: frontend/src/core/buttonMotion.ts
// НАЗНАЧЕНИЕ: Полные обороты цельных 3D-тел вокруг собственной неподвижной оси.
// РАЗДЕЛЫ: 1. Оси/контракт; 2. Привязка и освобождение; 3. Движение общего кадра.
// ФУНКЦИИ: easeC2, formatCssNumber, createAxis, constructor, mount, dispose,
// setInteracting, updateReadTarget, setHeld, snapFront, publishAngle, publishShadow,
// publishGithubAccent, updateSceneSpeed, update.
// Host сохраняет геометрию и доступность; rotate3d получает только вложенное тело.
// Новых RAF и таймеров нет. Наведение, keyboard focus и текущая фаза задают читаемую грань.
// ============================================================================
import { subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';

// НАЧАЛО РАЗДЕЛА 1. ОСИ И КОНТРАКТ
export interface ButtonMotionBinding {
    readonly listenerCount: number;
    readonly dispose: () => void;
}
const SHADOW_PROPERTIES = [
    '--button-shadow-x', '--button-shadow-y', '--button-shadow-blur',
    '--button-shadow-opacity', '--button-shadow-scale-x', '--button-shadow-scale-y',
] as const;
const BUTTON_PROPERTIES = ['--button-axis-x', '--button-axis-y', '--button-axis-z', '--button-spin-angle', ...SHADOW_PROPERTIES] as const;
const GITHUB_INK_PROPERTY = '--github-ink-color';
type ButtonProperty = typeof BUTTON_PROPERTIES[number] | typeof GITHUB_INK_PROPERTY;
interface ButtonPose {
    readonly element: HTMLElement;
    readonly direction: 1 | -1;
    readonly baseSpeed: number;
    readonly axis: readonly [number, number, number];
    readonly originalStyles: readonly { property: ButtonProperty; value: string; priority: string }[];
    readonly originalMarker: string | undefined;
    readonly originalPhaseEmphasis: string | undefined;
    readonly phaseId: string | undefined;
    readonly githubAccent: boolean;
    cleanup: () => void;
    hovered: boolean;
    keyboardFocused: boolean;
    held: boolean;
    angle: number;
    alignFrom: number;
    alignTarget: number;
    alignElapsedSec: number;
    releaseElapsedSec: number;
    lastAngle: string;
    shadowElapsedSec: number;
    lastShadowAngle: number | null;
    lastShadowValues: readonly string[];
    accentElapsedSec: number;
    lastAccentColor: string;
}
const ALIGN_DURATION_SEC = 0.65;
const RELEASE_DURATION_SEC = 0.9;
const SHADOW_INTERVAL_SEC = 1 / 12;
const SHADOW_PHASE_STEP = 0.618033988749895;
const GITHUB_ACCENT_PERIOD_SEC = 18;
const GITHUB_HEAT_COLORS = [
    [255, 230, 166], [255, 210, 174], [255, 236, 230], [204, 228, 255],
] as const;
const PHASE_SPEED: Readonly<Record<VisualSignalSnapshot['phase'], number>> = Object.freeze({
    '01_VOID': 0.94, '02_GENESIS': 1.015, '03_EVOLUTION': 1.04,
    '04_COLLAPSE': 0.985, '05_SINGULARITY': 0.92,
});
// НАЧАЛО ФУНКЦИИ easeC2
function easeC2(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ easeC2
// НАЧАЛО ФУНКЦИИ formatCssNumber
function formatCssNumber(value: number, unit = ''): string {
    return `${Math.abs(value) < 0.0000005 ? 0 : value.toFixed(6)}${unit}`;
}
// КОНЕЦ ФУНКЦИИ formatCssNumber
// НАЧАЛО ФУНКЦИИ createAxis
/** Почти горизонтальная ось широкой строки ограничивает её вертикальный размах. */
function createAxis(index: number, status: boolean): readonly [number, number, number] {
    const xSign = index % 2 === 0 ? 1 : -1;
    const zSign = Math.floor(index / 2) % 2 === 0 ? 1 : -1;
    const candidates: readonly (readonly [number, number, number])[] = [
        [1, 0.12, 0.04], [0.1, 1, -0.04], [1, -0.1, -0.035], [-0.08, 1, 0.045],
    ];
    const raw: readonly [number, number, number] = status
        ? [1, xSign * 0.015, zSign * 0.005] : candidates[index % candidates.length];
    const length = Math.hypot(...raw);
    return [raw[0] / length, raw[1] / length, raw[2] / length];
}
// КОНЕЦ ФУНКЦИИ createAxis
// КОНЕЦ РАЗДЕЛА 1

export class ButtonMotionController {
    private buttons: ButtonPose[] = [];
    private unsubscribe: (() => void) | null = null;
    private sceneSpeedFactor = 1;
    private paused = false;
    private reducedMotion = false;
    private currentPhase: VisualSignalSnapshot['phase'] | null = null;
    private generation = 0;

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(private readonly subscribeFrame: typeof subscribeVisualSignals = subscribeVisualSignals) {}
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО РАЗДЕЛА 2. ПРИВЯЗКА И ОСВОБОЖДЕНИЕ
    // НАЧАЛО ФУНКЦИИ mount
    public mount(elements: readonly HTMLElement[]): ButtonMotionBinding {
        this.dispose();
        const generation = ++this.generation;
        this.sceneSpeedFactor = 1;
        this.paused = false;
        this.reducedMotion = false;
        this.currentPhase = null;
        this.buttons = Array.from(new Set(elements)).map((element, index) => {
            const axis = createAxis(index, element.dataset.buttonSolidKind === 'status');
            const githubAccent = element.id === 'link-hud-github';
            const properties: readonly ButtonProperty[] = githubAccent ? [...BUTTON_PROPERTIES, GITHUB_INK_PROPERTY] : BUTTON_PROPERTIES;
            const pose: ButtonPose = {
                element,
                direction: index % 4 === 0 || index % 4 === 3 ? 1 : -1,
                baseSpeed: 13 + (index * 0.371) % 5,
                axis,
                originalStyles: properties.map((property) => ({
                    property, value: element.style.getPropertyValue(property),
                    priority: element.style.getPropertyPriority(property),
                })),
                originalMarker: element.dataset.buttonMotion,
                originalPhaseEmphasis: element.dataset.buttonPhaseEmphasis,
                phaseId: element.dataset.phaseId,
                githubAccent,
                cleanup: () => {}, hovered: false, keyboardFocused: element.matches(':focus-visible'),
                held: false,
                angle: 0, alignFrom: 0, alignTarget: 0,
                alignElapsedSec: 0, releaseElapsedSec: 0, lastAngle: '',
                shadowElapsedSec: 0, lastShadowAngle: null, lastShadowValues: [],
                accentElapsedSec: 0, lastAccentColor: '',
            };
            element.style.setProperty('--button-axis-x', formatCssNumber(axis[0]));
            element.style.setProperty('--button-axis-y', formatCssNumber(axis[1]));
            element.style.setProperty('--button-axis-z', formatCssNumber(axis[2]));
            const enter = (): void => this.setInteracting(pose, true, element.matches(':focus-visible'));
            const leave = (): void => this.setInteracting(pose, false, element.matches(':focus-visible'));
            const focus = (): void => this.setInteracting(pose, pose.hovered, element.matches(':focus-visible'));
            const blur = (): void => this.setInteracting(pose, pose.hovered, false);
            // Активация открывает подпись перед действием, в том числе перед PAUSE.
            const activate = (): void => this.snapFront(pose);
            element.addEventListener('pointerenter', enter);
            element.addEventListener('pointerleave', leave);
            element.addEventListener('focus', focus);
            element.addEventListener('blur', blur);
            element.addEventListener('click', activate);
            pose.cleanup = (): void => {
                element.removeEventListener('pointerenter', enter);
                element.removeEventListener('pointerleave', leave);
                element.removeEventListener('focus', focus);
                element.removeEventListener('blur', blur);
                element.removeEventListener('click', activate);
            };
            element.dataset.buttonMotion = '1';
            this.publishAngle(pose);
            this.publishShadow(pose, true);
            this.publishGithubAccent(pose);
            // Разнесённые фазы не собирают перерисовку всех мягких теней в один кадр.
            pose.shadowElapsedSec = SHADOW_INTERVAL_SEC * ((index * SHADOW_PHASE_STEP) % 1);
            return pose;
        });
        this.updateReadTarget();
        if (this.buttons.length) this.unsubscribe = this.subscribeFrame(this.update);
        let disposed = false;
        return {
            listenerCount: this.buttons.length * 5,
            dispose: (): void => {
                if (!disposed && generation === this.generation) this.dispose();
                disposed = true;
            },
        };
    }
    // КОНЕЦ ФУНКЦИИ mount

    // НАЧАЛО ФУНКЦИИ dispose
    public dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.buttons.forEach((pose) => {
            pose.cleanup();
            pose.originalStyles.forEach(({ property, value, priority }) => {
                if (value) pose.element.style.setProperty(property, value, priority);
                else pose.element.style.removeProperty(property);
            });
            if (pose.originalMarker === undefined) delete pose.element.dataset.buttonMotion;
            else pose.element.dataset.buttonMotion = pose.originalMarker;
            if (pose.originalPhaseEmphasis === undefined) delete pose.element.dataset.buttonPhaseEmphasis;
            else pose.element.dataset.buttonPhaseEmphasis = pose.originalPhaseEmphasis;
        });
        this.buttons = [];
    }
    // КОНЕЦ ФУНКЦИИ dispose

    // НАЧАЛО ФУНКЦИИ setInteracting
    private setInteracting(pose: ButtonPose, hovered: boolean, keyboardFocused: boolean): void {
        pose.hovered = hovered;
        pose.keyboardFocused = keyboardFocused;
        this.updateReadTarget();
    }
    // КОНЕЦ ФУНКЦИИ setInteracting

    // НАЧАЛО ФУНКЦИИ updateReadTarget
    /** В шкале фаз читается одна кнопка; наведение и keyboard focus временно важнее текущей фазы. */
    private updateReadTarget(): void {
        const phaseTarget = this.buttons.find((pose) => pose.phaseId && pose.hovered) ??
            this.buttons.find((pose) => pose.phaseId && pose.keyboardFocused) ??
            this.buttons.find((pose) => pose.phaseId === this.currentPhase);
        this.buttons.forEach((pose) => {
            if (pose.phaseId) {
                if (pose === phaseTarget) {
                    if (pose.element.dataset.buttonPhaseEmphasis !== '1') pose.element.dataset.buttonPhaseEmphasis = '1';
                } else if (pose.element.dataset.buttonPhaseEmphasis !== undefined) {
                    delete pose.element.dataset.buttonPhaseEmphasis;
                }
            }
            this.setHeld(pose, pose.phaseId ? pose === phaseTarget : pose.hovered || pose.keyboardFocused);
        });
    }
    // КОНЕЦ ФУНКЦИИ updateReadTarget

    // НАЧАЛО ФУНКЦИИ setHeld
    private setHeld(pose: ButtonPose, held: boolean): void {
        if (pose.held === held) return;
        pose.held = held;
        if (held) {
            pose.alignFrom = pose.angle;
            pose.alignTarget = Math.round(pose.angle / 360) * 360;
            pose.alignElapsedSec = 0;
            // Явный выбор в паузе открывает читаемую грань только этого тела,
            // не продвигая часы и не сдвигая остальные тела.
            if (this.paused || this.reducedMotion) this.snapFront(pose);
        } else {
            // Отпускание не меняет угол: тело разгоняется от своей текущей позы.
            pose.releaseElapsedSec = 0;
        }
    }
    // КОНЕЦ ФУНКЦИИ setHeld
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ДВИЖЕНИЕ ОБЩЕГО КАДРА
    // НАЧАЛО ФУНКЦИИ snapFront
    private snapFront(pose: ButtonPose): void {
        pose.angle = Math.round(pose.angle / 360) * 360;
        pose.alignFrom = pose.angle;
        pose.alignTarget = pose.angle;
        pose.alignElapsedSec = ALIGN_DURATION_SEC;
        pose.releaseElapsedSec = 0;
        this.publishAngle(pose);
        this.publishShadow(pose, true);
    }
    // КОНЕЦ ФУНКЦИИ snapFront

    // НАЧАЛО ФУНКЦИИ publishAngle
    private publishAngle(pose: ButtonPose): void {
        const value = formatCssNumber(pose.angle, 'deg');
        if (pose.lastAngle === value) return;
        pose.element.style.setProperty('--button-spin-angle', value);
        pose.lastAngle = value;
    }
    // КОНЕЦ ФУНКЦИИ publishAngle

    // НАЧАЛО ФУНКЦИИ publishShadow
    /** Проекция собственной оси задаёт отдельную тень; фильтр применяется только к её слою. */
    private publishShadow(pose: ButtonPose, force = false): void {
        if (pose.lastShadowAngle === pose.angle || (!force && pose.shadowElapsedSec < SHADOW_INTERVAL_SEC)) return;
        pose.shadowElapsedSec = 0;
        pose.lastShadowAngle = pose.angle;
        const radians = (pose.angle % 360) * Math.PI / 180;
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        const u = 1 - c;
        const [x, y, z] = pose.axis;
        const normalX = x * z * u + y * s;
        const normalY = y * z * u - x * s;
        const edge = 1 - Math.abs(c + z * z * u);
        const projectionX = Math.min(1, Math.abs(c + x * x * u) + 0.18 * Math.abs(normalX));
        const projectionY = Math.min(1, Math.abs(c + y * y * u) + 0.18 * Math.abs(normalY));
        const values = [
            formatCssNumber(3 + normalX * 4, 'px'),
            formatCssNumber(7 + edge * 4 - normalY * 1.5, 'px'),
            formatCssNumber(4.5 + edge * 3.5, 'px'),
            formatCssNumber(0.58 - edge * 0.18),
            formatCssNumber(0.22 + projectionX * 0.78),
            formatCssNumber(0.24 + projectionY * 0.76),
        ];
        values.forEach((value, index) => {
            if (value !== pose.lastShadowValues[index]) pose.element.style.setProperty(SHADOW_PROPERTIES[index], value);
        });
        pose.lastShadowValues = values;
    }
    // КОНЕЦ ФУНКЦИИ publishShadow

    // НАЧАЛО ФУНКЦИИ publishGithubAccent
    /** Более яркий раскалённый металл: янтарь, коралл, розовый свет и холодный отблеск. */
    private publishGithubAccent(pose: ButtonPose): void {
        if (!pose.githubAccent) return;
        const phase = pose.accentElapsedSec / GITHUB_ACCENT_PERIOD_SEC * GITHUB_HEAT_COLORS.length;
        const index = Math.floor(phase) % GITHUB_HEAT_COLORS.length;
        const mix = easeC2(phase - Math.floor(phase));
        const from = GITHUB_HEAT_COLORS[index];
        const to = GITHUB_HEAT_COLORS[(index + 1) % GITHUB_HEAT_COLORS.length];
        const r = Math.round(from[0] + (to[0] - from[0]) * mix);
        const g = Math.round(from[1] + (to[1] - from[1]) * mix);
        const b = Math.round(from[2] + (to[2] - from[2]) * mix);
        const color = `rgb(${r} ${g} ${b})`;
        if (color === pose.lastAccentColor) return;
        pose.element.style.setProperty(GITHUB_INK_PROPERTY, color);
        pose.lastAccentColor = color;
    }
    // КОНЕЦ ФУНКЦИИ publishGithubAccent

    // НАЧАЛО ФУНКЦИИ updateSceneSpeed
    /** Изображение сцены и звук меняют только скорость; знак и накопленный угол сохраняются. */
    private updateSceneSpeed(signals: Readonly<VisualSignalSnapshot>, dt: number): void {
        const music = signals.low * 0.6 + signals.mid * 0.4;
        const target = Math.max(0.9, Math.min(1.1, PHASE_SPEED[signals.phase] +
            (signals.phaseProgress - 0.5) * 0.04 + (signals.kuramotoR - 0.5) * 0.04 +
            signals.globalStress * 0.035 + music * 0.025 + signals.pulse * 0.01));
        this.sceneSpeedFactor += (target - this.sceneSpeedFactor) * (1 - Math.exp(-dt / 2));
    }
    // КОНЕЦ ФУНКЦИИ updateSceneSpeed

    // НАЧАЛО ФУНКЦИИ update
    private update = (signals: Readonly<VisualSignalSnapshot>): void => {
        this.paused = signals.isPaused;
        if (this.currentPhase !== signals.phase) {
            this.currentPhase = signals.phase;
            this.updateReadTarget();
        }
        if (signals.reducedMotion) {
            if (!this.reducedMotion) this.buttons.forEach((pose) => this.snapFront(pose));
            this.reducedMotion = true;
            return;
        }
        if (this.reducedMotion) {
            this.buttons.forEach((pose, index) => {
                pose.releaseElapsedSec = 0;
                pose.shadowElapsedSec = SHADOW_INTERVAL_SEC * ((index * SHADOW_PHASE_STEP) % 1);
            });
            this.reducedMotion = false;
        }
        if (this.paused) return;
        const dt = Number.isFinite(signals.frameDtSec) ? Math.max(0, Math.min(0.05, signals.frameDtSec)) : 0;
        if (dt === 0) return;
        this.updateSceneSpeed(signals, dt);
        this.buttons.forEach((pose) => {
            if (pose.githubAccent) {
                pose.accentElapsedSec = (pose.accentElapsedSec + dt) % GITHUB_ACCENT_PERIOD_SEC;
                this.publishGithubAccent(pose);
            }
            pose.shadowElapsedSec = Math.min(SHADOW_INTERVAL_SEC, pose.shadowElapsedSec + dt);
            let alignedNow = false;
            if (pose.held) {
                const wasAligned = pose.alignElapsedSec >= ALIGN_DURATION_SEC;
                pose.alignElapsedSec += dt;
                const progress = easeC2(pose.alignElapsedSec / ALIGN_DURATION_SEC);
                pose.angle = pose.alignFrom + (pose.alignTarget - pose.alignFrom) * progress;
                if (progress === 1) pose.angle = pose.alignTarget;
                alignedNow = !wasAligned && progress === 1;
            } else {
                pose.releaseElapsedSec += dt;
                const acceleration = easeC2(pose.releaseElapsedSec / RELEASE_DURATION_SEC);
                pose.angle += pose.direction * pose.baseSpeed * this.sceneSpeedFactor * acceleration * dt;
            }
            this.publishAngle(pose);
            this.publishShadow(pose, alignedNow);
        });
    };
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 3
}

export const buttonMotionController = new ButtonMotionController();
