// ============================================================================
// ФАЙЛ: frontend/src/core/buttonMotion.ts
// НАЗНАЧЕНИЕ: Объёмная ориентация цельных плашек и кнопок на общем кадре сцены.
// РАЗДЕЛЫ: 1. Контракты и плавность; 2. Привязка/освобождение; 3. Общий кадр.
// ФУНКЦИИ: easeC2, formatCssNumber, constructor, mount, dispose, setInteracting,
// neutralizePose, applyPose, updateScene, update.
// Новых RAF и таймеров нет; наведение и фокус останавливают только свою кнопку.
// ============================================================================
import { subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ
export interface ButtonMotionBinding {
    readonly listenerCount: number;
    readonly dispose: () => void;
}
interface ButtonPose {
    readonly element: HTMLElement;
    readonly index: number;
    readonly originalStyles: readonly { property: ButtonProperty; value: string; priority: string }[];
    readonly originalMarker: string | undefined;
    cleanup: () => void;
    hovered: boolean;
    focused: boolean;
    angleX: number;
    angleY: number;
    angleZ: number;
    depth: number;
    fromX: number;
    fromY: number;
    fromZ: number;
    fromDepth: number;
    transitionSec: number;
    lastValues: Map<ButtonProperty, string>;
    lastLightingStep: number;
}
// Углы/глубина двигают цельный элемент; свет и тень оформляют его видимые грани.
const BUTTON_PROPERTIES = [
    '--button-rotate-x', '--button-rotate-y', '--button-rotate-z', '--button-depth',
    '--button-light-x', '--button-light-y', '--button-shadow-x', '--button-shadow-y', '--button-shade',
] as const;
type ButtonProperty = typeof BUTTON_PROPERTIES[number];
const STORY_WEIGHT: Readonly<Record<VisualSignalSnapshot['phase'], number>> = Object.freeze({
    '01_VOID': 0.72, '02_GENESIS': 1, '03_EVOLUTION': 1.12,
    '04_COLLAPSE': 0.88, '05_SINGULARITY': 0.74,
});
const PHASE_INDEX: Readonly<Record<VisualSignalSnapshot['phase'], number>> = Object.freeze({
    '01_VOID': 0, '02_GENESIS': 1, '03_EVOLUTION': 2, '04_COLLAPSE': 3, '05_SINGULARITY': 4,
});
// НАЧАЛО ФУНКЦИИ easeC2
function easeC2(value: number): number {
    const u = Math.max(0, Math.min(1, value));
    return u * u * u * (u * (u * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ easeC2
// НАЧАЛО ФУНКЦИИ formatCssNumber
function formatCssNumber(value: number, unit = ''): string {
    return `${Math.abs(value) < 0.0005 ? 0 : value.toFixed(3)}${unit}`;
}
// КОНЕЦ ФУНКЦИИ formatCssNumber
// КОНЕЦ РАЗДЕЛА 1

export class ButtonMotionController {
    private buttons: ButtonPose[] = [];
    private unsubscribe: (() => void) | null = null;
    private activeTimeSec = 0;
    private storyWeight = 0.85;
    private musicEnergy = 0;
    private sceneYaw = 0;
    private scenePitch = 0;
    private sceneRoll = 0;
    private sceneDepth = 0;
    private paused = false;
    private reducedMotion = false;
    private generation = 0;

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(private readonly subscribeFrame: typeof subscribeVisualSignals = subscribeVisualSignals) {}
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО РАЗДЕЛА 2. ПРИВЯЗКА И ОСВОБОЖДЕНИЕ
    // НАЧАЛО ФУНКЦИИ mount
    public mount(elements: readonly HTMLElement[]): ButtonMotionBinding {
        this.dispose();
        const generation = ++this.generation;
        this.activeTimeSec = 0;
        this.storyWeight = 0.85;
        this.musicEnergy = 0;
        this.sceneYaw = 0;
        this.scenePitch = 0;
        this.sceneRoll = 0;
        this.sceneDepth = 0;
        this.paused = false;
        this.reducedMotion = false;
        this.buttons = Array.from(new Set(elements)).map((element, index) => {
            const pose: ButtonPose = {
                element, index,
                originalStyles: BUTTON_PROPERTIES.map((property) => ({
                    property, value: element.style.getPropertyValue(property),
                    priority: element.style.getPropertyPriority(property),
                })),
                originalMarker: element.dataset.buttonMotion,
                cleanup: () => {}, hovered: false, focused: false,
                angleX: 0, angleY: 0, angleZ: 0, depth: 0,
                fromX: 0, fromY: 0, fromZ: 0, fromDepth: 0,
                transitionSec: 0, lastValues: new Map(), lastLightingStep: -1,
            };
            const enter = (): void => this.setInteracting(pose, true, pose.focused);
            const leave = (): void => this.setInteracting(pose, false, pose.focused);
            const focus = (): void => this.setInteracting(pose, pose.hovered, true);
            const blur = (): void => this.setInteracting(pose, pose.hovered, false);
            element.addEventListener('pointerenter', enter);
            element.addEventListener('pointerleave', leave);
            element.addEventListener('focus', focus);
            element.addEventListener('blur', blur);
            pose.cleanup = (): void => {
                element.removeEventListener('pointerenter', enter);
                element.removeEventListener('pointerleave', leave);
                element.removeEventListener('focus', focus);
                element.removeEventListener('blur', blur);
            };
            element.dataset.buttonMotion = '1';
            this.applyPose(pose, 0, 0, 0, 0);
            return pose;
        });
        if (this.buttons.length) this.unsubscribe = this.subscribeFrame(this.update);
        let disposed = false;
        return {
            listenerCount: this.buttons.length * 4,
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
        });
        this.buttons = [];
    }
    // КОНЕЦ ФУНКЦИИ dispose

    // НАЧАЛО ФУНКЦИИ setInteracting
    private setInteracting(pose: ButtonPose, hovered: boolean, focused: boolean): void {
        const wasInteracting = pose.hovered || pose.focused;
        pose.hovered = hovered;
        pose.focused = focused;
        if (wasInteracting === (hovered || focused)) return;
        pose.fromX = pose.angleX;
        pose.fromY = pose.angleY;
        pose.fromZ = pose.angleZ;
        pose.fromDepth = pose.depth;
        pose.transitionSec = 0;
        // Даже при паузе новую выбранную кнопку можно сразу читать спереди.
        if ((hovered || focused) && (this.paused || this.reducedMotion)) {
            this.neutralizePose(pose);
        }
    }
    // КОНЕЦ ФУНКЦИИ setInteracting
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ОБЩИЙ КАДР
    // НАЧАЛО ФУНКЦИИ neutralizePose
    private neutralizePose(pose: ButtonPose): void {
        this.applyPose(pose, 0, 0, 0, 0);
        pose.fromX = 0; pose.fromY = 0; pose.fromZ = 0; pose.fromDepth = 0;
        pose.transitionSec = 0;
    }
    // КОНЕЦ ФУНКЦИИ neutralizePose

    // НАЧАЛО ФУНКЦИИ applyPose
    private applyPose(pose: ButtonPose, x: number, y: number, z: number, depth: number): void {
        pose.angleX = x;
        pose.angleY = y;
        pose.angleZ = z;
        pose.depth = depth;
        const values: Partial<Record<ButtonProperty, string>> = {
            '--button-rotate-x': formatCssNumber(x, 'deg'),
            '--button-rotate-y': formatCssNumber(y, 'deg'),
            '--button-rotate-z': formatCssNumber(z, 'deg'),
            '--button-depth': formatCssNumber(depth, 'px'),
        };
        // Трансформация идёт каждый кадр, более дорогие блики/тени — 10 Гц со сдвигом плашек.
        const lightingStep = Math.floor(this.activeTimeSec * 10 + pose.index * 0.37);
        const frontFacing = x === 0 && y === 0 && z === 0 && depth === 0;
        if (frontFacing || lightingStep !== pose.lastLightingStep) {
            const tilt = Math.sqrt((x / 26) ** 2 + (y / 29) ** 2) / Math.SQRT2;
            Object.assign(values, {
                '--button-light-x': formatCssNumber(50 - y * 0.85 + z * 0.65, '%'),
                '--button-light-y': formatCssNumber(28 + x * 1.15, '%'),
                '--button-shadow-x': formatCssNumber(y * 0.17 - z * 0.3, 'px'),
                '--button-shadow-y': formatCssNumber(4 + Math.abs(x) * 0.19 + depth * 0.12, 'px'),
                '--button-shade': formatCssNumber(0.18 + tilt * 0.34 + Math.max(0, -depth) * 0.008),
            });
            pose.lastLightingStep = lightingStep;
        }
        BUTTON_PROPERTIES.forEach((property) => {
            const value = values[property];
            if (value === undefined || pose.lastValues.get(property) === value) return;
            pose.element.style.setProperty(property, value);
            pose.lastValues.set(property, value);
        });
    }
    // КОНЕЦ ФУНКЦИИ applyPose

    // НАЧАЛО ФУНКЦИИ updateScene
    /** Пять фаз образуют замкнутую орбиту; топология и напряжение меняют её наклон. */
    private updateScene(signals: Readonly<VisualSignalSnapshot>, dt: number): void {
        const storyAngle = (PHASE_INDEX[signals.phase] + signals.phaseProgress) * Math.PI * 2 / 5;
        const coherence = signals.kuramotoR - 0.5;
        const stress = signals.globalStress;
        const targetYaw = Math.cos(storyAngle) * 0.42 + Math.sin(storyAngle * 2) * 0.22 + coherence * 0.34 + stress * 0.26;
        const targetPitch = Math.sin(storyAngle) * 0.5 + coherence * 0.28 - stress * 0.28 + signals.pulse * 0.06;
        const targetRoll = Math.sin(storyAngle * 2) * 0.55 + (stress - 0.5) * 0.34 + coherence * 0.15;
        const targetDepth = Math.cos(storyAngle) * 0.42 + signals.kuramotoR * 0.3 - stress * 0.35;
        const response = 1 - Math.exp(-dt / 1.1);
        this.sceneYaw += (targetYaw - this.sceneYaw) * response;
        this.scenePitch += (targetPitch - this.scenePitch) * response;
        this.sceneRoll += (targetRoll - this.sceneRoll) * response;
        this.sceneDepth += (targetDepth - this.sceneDepth) * response;
    }
    // КОНЕЦ ФУНКЦИИ updateScene

    // НАЧАЛО ФУНКЦИИ update
    private update = (signals: Readonly<VisualSignalSnapshot>): void => {
        this.paused = signals.isPaused;
        if (this.paused) return;
        if (signals.reducedMotion) {
            if (!this.reducedMotion) this.buttons.forEach((pose) => this.neutralizePose(pose));
            this.reducedMotion = true;
            return;
        }
        this.reducedMotion = false;
        const dt = Number.isFinite(signals.frameDtSec) ? Math.max(0, Math.min(0.05, signals.frameDtSec)) : 0;
        if (dt === 0) return;
        this.activeTimeSec += dt;
        this.storyWeight += (STORY_WEIGHT[signals.phase] - this.storyWeight) * (1 - Math.exp(-dt / 1.2));
        const targetMusic = signals.low * 0.6 + signals.mid * 0.4;
        this.musicEnergy += (targetMusic - this.musicEnergy) * (1 - Math.exp(-dt / 0.7));
        this.updateScene(signals, dt);
        const amplitudeY = 22.5 * (0.9 + this.storyWeight * 0.1) * (1 + this.musicEnergy * 0.06);
        const amplitudeX = 24 * (0.9 + this.storyWeight * 0.1) * (1 + this.musicEnergy * 0.04);

        this.buttons.forEach((pose) => {
            pose.transitionSec += dt;
            if (pose.hovered || pose.focused) {
                const front = 1 - easeC2(pose.transitionSec / 0.28);
                this.applyPose(pose, pose.fromX * front, pose.fromY * front, pose.fromZ * front, pose.fromDepth * front);
                return;
            }
            const periodSec = 11.5 + (pose.index % 7) * 0.95;
            const orbit = this.activeTimeSec * Math.PI * 2 / periodSec;
            const phase = orbit + pose.index * 2.399963 + Math.sin(orbit * 0.63 + pose.index * 0.7) * 0.2;
            const y = Math.max(-29, Math.min(29, Math.sin(phase) * amplitudeY + this.sceneYaw * 5));
            const x = Math.max(-26, Math.min(26, Math.cos(orbit * 0.79 + pose.index * 1.17) * amplitudeX + this.scenePitch * 3.2));
            const z = Math.sin(orbit * 0.57 + pose.index * 1.91) * 3.8 + this.sceneRoll * 1.1;
            const depth = Math.sin(orbit * 0.46 + pose.index * 0.87) * 4.8 + this.sceneDepth * 1.8;
            const resume = easeC2(pose.transitionSec / 0.65);
            this.applyPose(pose,
                pose.fromX + (x - pose.fromX) * resume,
                pose.fromY + (y - pose.fromY) * resume,
                pose.fromZ + (z - pose.fromZ) * resume,
                pose.fromDepth + (depth - pose.fromDepth) * resume);
        });
    };
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 3
}

export const buttonMotionController = new ButtonMotionController();
