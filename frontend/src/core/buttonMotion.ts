// ============================================================================
// ФАЙЛ: frontend/src/core/buttonMotion.ts
// НАЗНАЧЕНИЕ: Медленный индивидуальный 3D-наклон кнопок на общем кадре сцены.
// РАЗДЕЛЫ: 1. Контракты и плавность; 2. Привязка/освобождение; 3. Общий кадр.
// ФУНКЦИИ: easeC2, constructor, mount, dispose, setInteracting, applyPose, update.
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
    readonly originalX: string;
    readonly originalY: string;
    readonly originalMarker: string | undefined;
    cleanup: () => void;
    hovered: boolean;
    focused: boolean;
    angleX: number;
    angleY: number;
    fromX: number;
    fromY: number;
    transitionSec: number;
    lastX: string;
    lastY: string;
}
const STORY_WEIGHT: Readonly<Record<VisualSignalSnapshot['phase'], number>> = Object.freeze({
    '01_VOID': 0.72, '02_GENESIS': 1, '03_EVOLUTION': 1.12,
    '04_COLLAPSE': 0.88, '05_SINGULARITY': 0.74,
});
// НАЧАЛО ФУНКЦИИ easeC2
function easeC2(value: number): number {
    const u = Math.max(0, Math.min(1, value));
    return u * u * u * (u * (u * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ easeC2
// КОНЕЦ РАЗДЕЛА 1

export class ButtonMotionController {
    private buttons: ButtonPose[] = [];
    private unsubscribe: (() => void) | null = null;
    private activeTimeSec = 0;
    private storyWeight = 0.85;
    private musicEnergy = 0;
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
        this.paused = false;
        this.reducedMotion = false;
        this.buttons = Array.from(new Set(elements)).map((element, index) => {
            const pose: ButtonPose = {
                element, index,
                originalX: element.style.getPropertyValue('--button-rotate-x'),
                originalY: element.style.getPropertyValue('--button-rotate-y'),
                originalMarker: element.dataset.buttonMotion,
                cleanup: () => {}, hovered: false, focused: false,
                angleX: 0, angleY: 0, fromX: 0, fromY: 0,
                transitionSec: 0, lastX: '', lastY: '',
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
            this.applyPose(pose, 0, 0);
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
            if (pose.originalX) pose.element.style.setProperty('--button-rotate-x', pose.originalX);
            else pose.element.style.removeProperty('--button-rotate-x');
            if (pose.originalY) pose.element.style.setProperty('--button-rotate-y', pose.originalY);
            else pose.element.style.removeProperty('--button-rotate-y');
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
        pose.transitionSec = 0;
        // Даже при паузе новую выбранную кнопку можно сразу читать спереди.
        if ((hovered || focused) && (this.paused || this.reducedMotion)) {
            this.applyPose(pose, 0, 0);
            pose.fromX = 0;
            pose.fromY = 0;
        }
    }
    // КОНЕЦ ФУНКЦИИ setInteracting
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ОБЩИЙ КАДР
    // НАЧАЛО ФУНКЦИИ applyPose
    private applyPose(pose: ButtonPose, x: number, y: number): void {
        pose.angleX = x;
        pose.angleY = y;
        const xText = `${Math.abs(x) < 0.0005 ? 0 : x.toFixed(3)}deg`;
        const yText = `${Math.abs(y) < 0.0005 ? 0 : y.toFixed(3)}deg`;
        if (pose.lastX !== xText) {
            pose.element.style.setProperty('--button-rotate-x', xText);
            pose.lastX = xText;
        }
        if (pose.lastY !== yText) {
            pose.element.style.setProperty('--button-rotate-y', yText);
            pose.lastY = yText;
        }
    }
    // КОНЕЦ ФУНКЦИИ applyPose

    // НАЧАЛО ФУНКЦИИ update
    private update = (signals: Readonly<VisualSignalSnapshot>): void => {
        this.paused = signals.isPaused;
        if (this.paused) return;
        if (signals.reducedMotion) {
            if (!this.reducedMotion) this.buttons.forEach((pose) => {
                this.applyPose(pose, 0, 0);
                pose.fromX = 0; pose.fromY = 0; pose.transitionSec = 0;
            });
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
        const amplitudeY = 18 * (0.84 + this.storyWeight * 0.16) * (1 + this.musicEnergy * 0.12);
        const amplitudeX = 5.5 * (0.9 + this.storyWeight * 0.1) * (1 + this.musicEnergy * 0.08);

        this.buttons.forEach((pose) => {
            pose.transitionSec += dt;
            if (pose.hovered || pose.focused) {
                const front = 1 - easeC2(pose.transitionSec / 0.28);
                this.applyPose(pose, pose.fromX * front, pose.fromY * front);
                return;
            }
            const periodSec = 7.2 + (pose.index % 6) * 0.58;
            const phase = this.activeTimeSec * Math.PI * 2 / periodSec + pose.index * 2.399963;
            const y = Math.sin(phase) * amplitudeY;
            const x = Math.cos(phase * 0.73 + pose.index * 0.4) * amplitudeX;
            const resume = easeC2(pose.transitionSec / 0.45);
            this.applyPose(pose,
                pose.fromX + (x - pose.fromX) * resume,
                pose.fromY + (y - pose.fromY) * resume);
        });
    };
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 3
}

export const buttonMotionController = new ButtonMotionController();
