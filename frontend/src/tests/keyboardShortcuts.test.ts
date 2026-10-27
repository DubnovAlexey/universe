// ============================================================================
// ФАЙЛ: frontend/src/tests/keyboardShortcuts.test.ts
// НАЗНАЧЕНИЕ: Проверить глобальные команды клавиатуры, защиту ввода и освобождение слушателя.
// РАЗДЕЛЫ: 1. События и цели ввода; 2. Команды и раскладки; 3. Защита и жизненный цикл.
// ФУНКЦИИ: editableTarget, runKeyboardShortcutChecks, addEventListener,
// removeEventListener, dispatchKeyboard.
// ============================================================================
import { universeStore } from '../store/universeState';
import { audioSync } from '../utils/audioSync';
import { bindUniverseKeyboardShortcuts } from '../engine/hud/keyboardShortcuts';

// НАЧАЛО РАЗДЕЛА 1. СОБЫТИЯ И ЦЕЛИ ВВОДА
type KeyboardOptions = Partial<Pick<KeyboardEvent,
    'repeat' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'defaultPrevented'>>;

// НАЧАЛО ФУНКЦИИ editableTarget
function editableTarget(match: string): object {
    return {
        isContentEditable: match === '[contenteditable]',
        closest(selectors: string): object | null {
            return selectors.split(',').some((selector) => selector.trim() === match) ? this : null;
        },
    };
}
// КОНЕЦ ФУНКЦИИ editableTarget
// КОНЕЦ РАЗДЕЛА 1. СОБЫТИЯ И ЦЕЛИ ВВОДА

// НАЧАЛО ФУНКЦИИ runKeyboardShortcutChecks
export function runKeyboardShortcutChecks(check: (passed: boolean, description: string) => void): void {
    const handlers = new Map<string, Set<(event: KeyboardEvent) => void>>();
    let additions = 0;
    let removals = 0;
    const target = {
        // НАЧАЛО ФУНКЦИИ addEventListener
        addEventListener(type: string, handler: (event: KeyboardEvent) => void): void {
            additions++;
            if (!handlers.has(type)) handlers.set(type, new Set());
            handlers.get(type)!.add(handler);
        },
        // КОНЕЦ ФУНКЦИИ addEventListener
        // НАЧАЛО ФУНКЦИИ removeEventListener
        removeEventListener(type: string, handler: (event: KeyboardEvent) => void): void {
            removals++;
            handlers.get(type)?.delete(handler);
        },
        // КОНЕЦ ФУНКЦИИ removeEventListener
    };
    const calls: string[] = [];
    const actions = [
        { object: universeStore, name: 'setPhase', spy: (phase: unknown): void => { calls.push(`phase:${phase}`); } },
        { object: universeStore, name: 'toggleLayer', spy: (layer: unknown): void => { calls.push(`layer:${layer}`); } },
        { object: universeStore, name: 'togglePause', spy: (): void => { calls.push('pause'); } },
        { object: universeStore, name: 'triggerUniverseRestart', spy: (): void => { calls.push('restart'); } },
        { object: audioSync, name: 'toggleMute', spy: (): boolean => { calls.push('mute'); return true; } },
    ].map((action) => ({ ...action, descriptor: Object.getOwnPropertyDescriptor(action.object, action.name) }));
    let dispose: (() => void) | null = null;

    // НАЧАЛО ФУНКЦИИ dispatchKeyboard
    const dispatchKeyboard = (key: string, code = '', options: KeyboardOptions = {}, eventTarget: unknown = null): KeyboardEvent => {
        const event = new Event('keydown', { cancelable: true }) as KeyboardEvent;
        const { defaultPrevented, ...properties } = options;
        Object.defineProperties(event, Object.fromEntries(Object.entries({
            key, code, target: eventTarget, repeat: false, altKey: false, ctrlKey: false,
            metaKey: false, shiftKey: false, isComposing: false, ...properties,
        }).map(([name, value]) => [name, { value }])));
        if (defaultPrevented) event.preventDefault();
        handlers.get('keydown')?.forEach((handler) => handler(event));
        return event;
    };
    // КОНЕЦ ФУНКЦИИ dispatchKeyboard

    try {
        actions.forEach(({ object, name, spy }) => {
            Object.defineProperty(object, name, { configurable: true, writable: true, value: spy });
        });
        dispose = bindUniverseKeyboardShortcuts(target as unknown as Window);

        // НАЧАЛО РАЗДЕЛА 2. КОМАНДЫ, ФИЗИЧЕСКИЕ КЛАВИШИ И РАСКЛАДКИ
        const phaseEvents = [dispatchKeyboard('1', 'Digit1'),
            ...['@', '#', '$', '%'].map((key, index) => dispatchKeyboard(key, `Digit${index + 2}`, { shiftKey: true }))];
        check(phaseEvents.every((event) => event.defaultPrevented) && calls.join(',') ===
            'phase:01_VOID,phase:02_GENESIS,phase:03_EVOLUTION,phase:04_COLLAPSE,phase:05_SINGULARITY',
            'Digit1 and real shifted @/#/$/% events select all five phases through physical key codes');
        calls.length = 0;
        const layerEvents = [2, 3, 4, 5].map((digit) => dispatchKeyboard(String(digit), `Digit${digit}`));
        check(layerEvents.every((event) => event.defaultPrevented) && calls.join(',') ===
            'layer:layer2_metricsHud,layer:layer3_topologyGraph,layer:layer4_architectTerminal,layer:layer5_truthXRayMode',
            'Unshifted Digit2–5 toggle their four layers without selecting phases');
        calls.length = 0;
        const letterEvents = [dispatchKeyboard('з', 'KeyP'), dispatchKeyboard('P', 'KeyP', { shiftKey: true }),
            dispatchKeyboard('ь', 'KeyM'), dispatchKeyboard('M', 'KeyM', { shiftKey: true }),
            dispatchKeyboard('К', 'KeyR', { shiftKey: true })];
        check(letterEvents.every((event) => event.defaultPrevented) && calls.join(',') === 'pause,pause,mute,mute,restart',
            'P/M and Shift+R use physical codes across Cyrillic, uppercase and Shift states');
        calls.length = 0;
        const numpadEvents = [1, 2, 3, 4, 5].map((digit) => dispatchKeyboard(String(digit), `Numpad${digit}`));
        const fallbackEvents = [dispatchKeyboard('2'), dispatchKeyboard('3', '', { shiftKey: true }),
            dispatchKeyboard('P'), dispatchKeyboard('M'), dispatchKeyboard('R', '', { shiftKey: true })];
        const legacyCalls = calls.join(',');
        calls.length = 0;
        const shiftedNumpad = ['End', 'ArrowDown', 'PageDown', 'ArrowLeft', 'Clear']
            .map((key, index) => dispatchKeyboard(key, `Numpad${index + 1}`, { shiftKey: true }));
        check(numpadEvents.every((event) => event.defaultPrevented) && fallbackEvents.every((event) => event.defaultPrevented) &&
            legacyCalls === 'phase:01_VOID,layer:layer2_metricsHud,layer:layer3_topologyGraph,layer:layer4_architectTerminal,' +
                'layer:layer5_truthXRayMode,layer:layer2_metricsHud,phase:03_EVOLUTION,pause,mute,restart' &&
            shiftedNumpad.every((event) => !event.defaultPrevented) && calls.length === 0,
            'Plain numeric keypad and key-only fallback remain available while Shift+Numpad navigation keeps native behavior');
        // КОНЕЦ РАЗДЕЛА 2. КОМАНДЫ, ФИЗИЧЕСКИЕ КЛАВИШИ И РАСКЛАДКИ

        // НАЧАЛО РАЗДЕЛА 3. ЗАЩИТА ВВОДА И ЖИЗНЕННЫЙ ЦИКЛ
        const blockedOptions: KeyboardOptions[] = [{ repeat: true }, { isComposing: true },
            { defaultPrevented: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }];
        const blockedEvents = blockedOptions.map((options) => dispatchKeyboard('p', 'KeyP', options));
        const browserShortcuts = [dispatchKeyboard('p', 'KeyP', { ctrlKey: true }),
            dispatchKeyboard('R', 'KeyR', { ctrlKey: true, shiftKey: true }),
            dispatchKeyboard('@', 'Digit2', { metaKey: true, shiftKey: true })];
        check(calls.length === 0 && blockedEvents.every((event, index) =>
            event.defaultPrevented === Boolean(blockedOptions[index].defaultPrevented)) &&
            browserShortcuts.every((event) => !event.defaultPrevented),
            'Repeat, composition, prevented input and Alt/Ctrl/Meta combinations never trigger scene actions or consume browser shortcuts');

        const editors = ['input', 'textarea', 'select', '[contenteditable]', '[role="textbox"]',
            '[role="combobox"]', '[role="spinbutton"]'].map(editableTarget);
        const editableEvents = editors.map((editor) => dispatchKeyboard('@', 'Digit2', { shiftKey: true }, editor));
        const editorsUntouched = calls.length === 0 && editableEvents.every((event) => !event.defaultPrevented);
        const buttonEvent = dispatchKeyboard('p', 'KeyP', {}, editableTarget('button'));
        const linkEvent = dispatchKeyboard('m', 'KeyM', {}, editableTarget('a'));
        check(editorsUntouched && buttonEvent.defaultPrevented && linkEvent.defaultPrevented && calls.join(',') === 'pause,mute',
            'Text editors and editable ARIA controls keep native input; focused buttons and links still allow global shortcuts');
        calls.length = 0;
        const unhandled = [dispatchKeyboard('r', 'KeyR'), dispatchKeyboard('Tab', 'Tab'),
            dispatchKeyboard('ArrowLeft', 'ArrowLeft'), dispatchKeyboard(' ', 'Space'), dispatchKeyboard('x', 'KeyX')];
        check(calls.length === 0 && unhandled.every((event) => !event.defaultPrevented),
            'Unbound keys remain uncancelled, including plain R, Tab, arrows and Space');

        const singleListener = additions === 1 && handlers.size === 1 && handlers.get('keydown')?.size === 1;
        dispose();
        dispose();
        const afterDispose = dispatchKeyboard('p', 'KeyP');
        check(singleListener && removals === 1 && handlers.get('keydown')?.size === 0 &&
            calls.length === 0 && !afterDispose.defaultPrevented,
            'Binding adds one keydown listener; idempotent disposal removes it once and leaves subsequent input untouched');
        // КОНЕЦ РАЗДЕЛА 3. ЗАЩИТА ВВОДА И ЖИЗНЕННЫЙ ЦИКЛ
    } finally {
        try {
            dispose?.();
        } finally {
            actions.forEach(({ object, name, descriptor }) => {
                if (descriptor) Object.defineProperty(object, name, descriptor);
                else Reflect.deleteProperty(object, name);
            });
        }
    }
}
// КОНЕЦ ФУНКЦИИ runKeyboardShortcutChecks
