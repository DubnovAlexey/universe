// ============================================================================
// ФАЙЛ: frontend/src/tests/buttonMotion.test.ts
// НАЗНАЧЕНИЕ: Проверить индивидуальное движение кнопок, фокус и общий такт.
// РАЗДЕЛЫ: 1. Минимальный DOM/кадр; 2. Движение; 3. Пауза и освобождение.
// ФУНКЦИИ: makeHarness, angle, runButtonMotionChecks.
// ============================================================================
import { ButtonMotionController } from '../core/buttonMotion';
import { getVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM И КАДР
class MotionButton extends EventTarget {
    public dataset: Record<string, string> = {};
    public textContent = 'CANONICAL BUTTON';
    public values = new Map<string, string>();
    public writes = 0;
    public style = {
        // НАЧАЛО ФУНКЦИИ getPropertyValue
        getPropertyValue: (name: string): string => this.values.get(name) ?? '',
        // КОНЕЦ ФУНКЦИИ getPropertyValue
        // НАЧАЛО ФУНКЦИИ setProperty
        setProperty: (name: string, value: string): void => { this.writes++; this.values.set(name, value); },
        // КОНЕЦ ФУНКЦИИ setProperty
        // НАЧАЛО ФУНКЦИИ removeProperty
        removeProperty: (name: string): void => { this.writes++; this.values.delete(name); },
        // КОНЕЦ ФУНКЦИИ removeProperty
    };
}
// НАЧАЛО ФУНКЦИИ makeHarness
function makeHarness(count = 3) {
    const shared: { listener: ((frame: Readonly<VisualSignalSnapshot>) => void) | null; subscriptions: number; releases: number } = {
        listener: null, subscriptions: 0, releases: 0,
    };
    const controller = new ButtonMotionController((listener) => {
        shared.listener = listener;
        shared.subscriptions++;
        return () => { shared.listener = null; shared.releases++; };
    });
    const buttons = Array.from({ length: count }, () => new MotionButton());
    if (buttons[2]) {
        buttons[2].values.set('--button-rotate-x', '2deg');
        buttons[2].dataset.buttonMotion = 'previous';
    }
    const binding = controller.mount(buttons as unknown as HTMLElement[]);
    const frame: Readonly<VisualSignalSnapshot> = {
        ...getVisualSignals(), frameDtSec: 0.05, isPaused: false, reducedMotion: false,
        phase: '03_EVOLUTION', low: 0, mid: 0,
    };
    // НАЧАЛО ФУНКЦИИ step
    const step = (count: number, changes: Partial<VisualSignalSnapshot> = {}): void => {
        for (let i = 0; i < count; i++) shared.listener?.({ ...frame, ...changes });
    };
    // КОНЕЦ ФУНКЦИИ step
    return { shared, controller, buttons, binding, frame, step };
}
// КОНЕЦ ФУНКЦИИ makeHarness

// НАЧАЛО ФУНКЦИИ angle
function angle(button: MotionButton, axis: 'x' | 'y'): number {
    return Number.parseFloat(button.values.get(`--button-rotate-${axis}`) ?? '0');
}
// КОНЕЦ ФУНКЦИИ angle
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runButtonMotionChecks
export function runButtonMotionChecks(check: (passed: boolean, description: string) => void): void {
    const h = makeHarness();
    h.step(24);
    check(h.shared.subscriptions === 1 && h.binding.listenerCount === 12 &&
        h.buttons.every((button) => button.dataset.buttonMotion === '1' &&
            Math.abs(angle(button, 'y')) <= 24 && Math.abs(angle(button, 'x')) <= 7 &&
            button.textContent === 'CANONICAL BUTTON') &&
        Math.abs(angle(h.buttons[0], 'y')) > 1 && angle(h.buttons[0], 'y') !== angle(h.buttons[1], 'y'),
        'Corner buttons rotate individually within readable 3D angles on one shared frame without replacing labels');

    h.buttons[0].dispatchEvent(new Event('pointerenter'));
    h.step(7);
    const otherY = angle(h.buttons[2], 'y');
    const heldWrites = h.buttons[0].writes;
    h.step(6);
    check(angle(h.buttons[0], 'x') === 0 && angle(h.buttons[0], 'y') === 0 &&
        h.buttons[0].writes === heldWrites && angle(h.buttons[2], 'y') !== otherY,
        'Hover eases only its button to the front and freezes it while other buttons continue moving');

    h.buttons[1].dispatchEvent(new Event('focus'));
    h.step(7);
    h.buttons[1].dispatchEvent(new Event('pointerenter'));
    h.buttons[1].dispatchEvent(new Event('pointerleave'));
    h.step(4);
    check(angle(h.buttons[1], 'x') === 0 && angle(h.buttons[1], 'y') === 0,
        'Keyboard focus keeps a button front-facing even after the pointer leaves');

    h.buttons[0].dispatchEvent(new Event('pointerleave'));
    const beforeResume = angle(h.buttons[0], 'y');
    h.step(1);
    const firstResume = angle(h.buttons[0], 'y');
    h.step(10);
    check(beforeResume === 0 && Math.abs(firstResume) < 1 && Math.abs(angle(h.buttons[0], 'y')) > 1,
        'Pointer leave resumes its button through a smooth blend instead of jumping to the running orbital phase');

    const frozenValues = h.buttons.map((button) => JSON.stringify([...button.values]));
    const frozenWrites = h.buttons.map((button) => button.writes);
    h.step(12, { isPaused: true, frameDtSec: 0.05, simTimeSec: 10000 });
    check(h.buttons.every((button, index) => JSON.stringify([...button.values]) === frozenValues[index] &&
        button.writes === frozenWrites[index]),
        'Paused or hidden shared frames freeze all button angles and perform no style writes');

    const pausedInteraction = makeHarness(2);
    pausedInteraction.step(24);
    const wereTilted = pausedInteraction.buttons.every((button) =>
        Math.abs(angle(button, 'x')) + Math.abs(angle(button, 'y')) > 1);
    pausedInteraction.step(1, { isPaused: true });
    pausedInteraction.buttons[0].dispatchEvent(new Event('pointerenter'));
    pausedInteraction.buttons[1].dispatchEvent(new Event('focus'));
    let stayedFront = pausedInteraction.buttons.every((button) => angle(button, 'x') === 0 && angle(button, 'y') === 0);
    const frontWrites = pausedInteraction.buttons.map((button) => button.writes);
    for (let i = 0; i < 8; i++) {
        pausedInteraction.step(1);
        stayedFront &&= pausedInteraction.buttons.every((button, index) =>
            angle(button, 'x') === 0 && angle(button, 'y') === 0 && button.writes === frontWrites[index]);
    }
    check(wereTilted && stayedFront,
        'Hover or focus during pause keeps the button front-facing on every resumed frame without restoring its old tilt');
    pausedInteraction.binding.dispose();

    h.step(1, { reducedMotion: true });
    const reducedWrites = h.buttons.map((button) => button.writes);
    h.step(12, { reducedMotion: true });
    check(h.buttons.every((button, index) => angle(button, 'x') === 0 && angle(button, 'y') === 0 &&
        button.writes === reducedWrites[index]),
        'Reduced motion selects a neutral static pose once without continuous DOM writes');

    const sameTime = makeHarness(1);
    const jumpedTime = makeHarness(1);
    for (let i = 0; i < 30; i++) {
        sameTime.step(1, { simTimeSec: i * 0.05 });
        jumpedTime.step(1, { simTimeSec: i % 2 ? 5000 : -5000 });
    }
    const matchingClockIndependentPose = JSON.stringify([...sameTime.buttons[0].values]) ===
        JSON.stringify([...jumpedTime.buttons[0].values]);
    const steadyY = angle(jumpedTime.buttons[0], 'y');
    jumpedTime.step(1, { phase: '01_VOID', low: 1, mid: 1 });
    check(matchingClockIndependentPose &&
        Math.abs(angle(jumpedTime.buttons[0], 'y') - steadyY) < 2,
        'Button time ignores simulation-clock jumps and music/story changes affect its motion gently');
    sameTime.binding.dispose();
    jumpedTime.binding.dispose();

    h.binding.dispose();
    const disposedWrites = h.buttons.map((button) => button.writes);
    h.binding.dispose();
    h.buttons[0].dispatchEvent(new Event('pointerenter'));
    h.buttons[1].dispatchEvent(new Event('blur'));
    check(h.shared.releases === 1 && h.shared.listener === null &&
        h.buttons[0].dataset.buttonMotion === undefined && h.buttons[0].values.size === 0 &&
        h.buttons[2].dataset.buttonMotion === 'previous' && h.buttons[2].values.get('--button-rotate-x') === '2deg' &&
        h.buttons.every((button, index) => button.writes === disposedWrites[index]),
        'Disposal unsubscribes once, removes interaction handlers and restores the previous button styles');
}
// КОНЕЦ ФУНКЦИИ runButtonMotionChecks
