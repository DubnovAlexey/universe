// ============================================================================
// ФАЙЛ: frontend/src/engine/hud/keyboardShortcuts.ts
// НАЗНАЧЕНИЕ: Горячие клавиши сцены с учётом раскладки, фокуса и системных сочетаний.
// РАЗДЕЛЫ: 1. Обработка клавиш; 2. Привязка и освобождение слушателя.
// ФУНКЦИИ: handleUniverseShortcut, bindUniverseKeyboardShortcuts, disposeKeyboardShortcuts.
// ============================================================================

import { PHASE_ORDER, universeStore } from '../../store/universeState';
import { audioSync } from '../../utils/audioSync';

// НАЧАЛО РАЗДЕЛА 1. ОБРАБОТКА КЛАВИШ
// --- НАЧАЛО ФУНКЦИИ handleUniverseShortcut ---
/** Физическая позиция клавиши сохраняет команды при Shift и смене раскладки. */
function handleUniverseShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest?.('dialog[open]')) return;
    if (target?.isContentEditable || target?.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
        '[role="textbox"], [role="combobox"], [role="spinbutton"]'
    )) return;

    const physicalDigit = /^Digit([1-5])$/.exec(event.code)?.[1];
    const numpadDigit = !event.shiftKey && /^Numpad[1-5]$/.test(event.code) && /^[1-5]$/.test(event.key)
        ? event.key : undefined;
    // key остаётся резервом для источников событий, не предоставляющих code.
    const legacyDigit = !event.code && /^[1-5]$/.test(event.key) ? event.key : undefined;
    const digit = physicalDigit ?? numpadDigit ?? legacyDigit;

    if (digit) {
        const index = Number(digit) - 1;
        if (event.shiftKey || index === 0) {
            universeStore.setPhase(PHASE_ORDER[index]);
        } else {
            const layers = ['layer2_metricsHud', 'layer3_topologyGraph',
                'layer4_architectTerminal', 'layer5_truthXRayMode'] as const;
            universeStore.toggleLayer(layers[index - 1]);
        }
    } else {
        const code = event.code || `Key${event.key.toUpperCase()}`;
        if (code === 'KeyP') universeStore.togglePause();
        else if (code === 'KeyM') audioSync.toggleFromUserCommand();
        else if (code === 'KeyR' && event.shiftKey) universeStore.triggerUniverseRestart();
        else return;
    }
    event.preventDefault();
}
// --- КОНЕЦ ФУНКЦИИ handleUniverseShortcut ---
// КОНЕЦ РАЗДЕЛА 1. ОБРАБОТКА КЛАВИШ

// НАЧАЛО РАЗДЕЛА 2. ПРИВЯЗКА И ОСВОБОЖДЕНИЕ СЛУШАТЕЛЯ
// --- НАЧАЛО ФУНКЦИИ bindUniverseKeyboardShortcuts ---
/** Возвращает очистку одного страничного слушателя; цикл restart её не вызывает. */
export function bindUniverseKeyboardShortcuts(target: Window): () => void {
    target.addEventListener('keydown', handleUniverseShortcut);
    let disposed = false;
    // --- НАЧАЛО ФУНКЦИИ disposeKeyboardShortcuts ---
    return function disposeKeyboardShortcuts(): void {
        if (disposed) return;
        disposed = true;
        target.removeEventListener('keydown', handleUniverseShortcut);
    };
    // --- КОНЕЦ ФУНКЦИИ disposeKeyboardShortcuts ---
}
// --- КОНЕЦ ФУНКЦИИ bindUniverseKeyboardShortcuts ---
// КОНЕЦ РАЗДЕЛА 2. ПРИВЯЗКА И ОСВОБОЖДЕНИЕ СЛУШАТЕЛЯ
