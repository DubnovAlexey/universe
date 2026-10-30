// ============================================================================
// ФАЙЛ: frontend/src/tests/pointerControls.test.ts
// НАЗНАЧЕНИЕ: Проверить ввод линзы, UI-исключения и очистку на выходе/отмене ввода.
// РАЗДЕЛЫ: 1. Реальные события; 2. Команды и lifecycle.
// ФУНКЦИИ: runPointerControlChecks.
// ============================================================================
import { bindUniversePointerControls } from '../engine/hud/pointerControls';
import { audioSync } from '../utils/audioSync';

// НАЧАЛО ФУНКЦИИ runPointerControlChecks
export function runPointerControlChecks(check: (passed: boolean, description: string) => void): void {
    const target = new EventTarget(), root = new EventTarget();
    const positions: unknown[][] = [];
    let audioStarts = 0;
    const descriptor = Object.getOwnPropertyDescriptor(audioSync, 'startPlayback');
    const dispatch = (type: string, eventTarget: EventTarget = target, ui = '', code = ''): void => {
        const event = new Event(type);
        const hit = { closest: (selector: string) => selector.split(',').some(part => part.trim() === ui) ? {} : null };
        Object.defineProperties(event, { target: { value: hit }, clientX: { value: 100 }, clientY: { value: 80 }, code: { value: code } });
        eventTarget.dispatchEvent(event);
    };
    Object.defineProperty(audioSync, 'startPlayback', { configurable: true, value: () => { audioStarts++; } });
    const binding = bindUniversePointerControls({ setPointerState: (...args) => { positions.push(args); } },
        target as unknown as Window, root as unknown as HTMLElement);
    try {
        dispatch('pointermove'); dispatch('pointerdown'); dispatch('pointerup');
        check(JSON.stringify(positions) === JSON.stringify([[100,80,undefined,true],[100,80,true,true],[100,80,false,true]]) && audioStarts === 1,
            'Scene pointer events preserve coordinates and begin one user-requested audio attempt');
        positions.length = 0;
        dispatch('pointermove', target, '[data-ui-panel]'); dispatch('pointerdown', target, 'button'); dispatch('pointerup', target, 'a');
        check(positions.every(value => value[3] === false) && positions[1][2] === false && audioStarts === 2,
            'Reading panels and interactive controls never activate the lens; their gesture may still unlock audio');
        const beforeAudio = audioStarts;
        dispatch('pointerdown', target, '#btn-toggle-audio');
        check(audioStarts === beforeAudio,
            'The explicit AUDIO button is handled by its command rather than a preceding pointer unlock');
        positions.length = 0;
        dispatch('pointerleave', root); dispatch('pointercancel'); dispatch('blur');
        check(positions.length === 3 && positions.every(value => JSON.stringify(value) === '[-9999,-9999,false,false]'),
            'HTML pointerleave, canceled pointers and window blur all clear the lens and pressed state');
        binding.dispose(); binding.dispose(); positions.length = 0;
        dispatch('pointermove'); dispatch('pointerleave', root); dispatch('pointerdown');
        check(binding.listenerCount === 6 && positions.length === 0 && audioStarts === beforeAudio,
            'Idempotent pointer disposal removes all six listeners from their actual event targets');
    } finally {
        binding.dispose();
        if (descriptor) Object.defineProperty(audioSync, 'startPlayback', descriptor); else Reflect.deleteProperty(audioSync, 'startPlayback');
    }
}
// КОНЕЦ ФУНКЦИИ runPointerControlChecks
