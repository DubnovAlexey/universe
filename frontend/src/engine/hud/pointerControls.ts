// ============================================================================
// ФАЙЛ: frontend/src/engine/hud/pointerControls.ts
// НАЗНАЧЕНИЕ: Ввод линзы BREACH с исключением интерфейса и сбросом за пределами окна.
// РАЗДЕЛЫ: 1. Контракты; 2. Привязка и освобождение шести слушателей.
// ФУНКЦИИ: isUniverseUiTarget, bindUniversePointerControls, move, down, up, clear, dispose.
// ============================================================================
import { audioSync, AudioSyncEngine } from '../../utils/audioSync';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ
interface PointerScene {
    setPointerState(x: number, y: number, isDown?: boolean, isInside?: boolean): void;
}

// НАЧАЛО ФУНКЦИИ isUniverseUiTarget
export function isUniverseUiTarget(target: EventTarget | null): boolean {
    return Boolean((target as Element | null)?.closest?.(
        '[data-ui-panel], [data-github-card], button, a, input, textarea, select, dialog[open]'));
}
// КОНЕЦ ФУНКЦИИ isUniverseUiTarget
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРИВЯЗКА И ОСВОБОЖДЕНИЕ
// НАЧАЛО ФУНКЦИИ bindUniversePointerControls
export function bindUniversePointerControls(renderer: PointerScene, target: Window,
    root: HTMLElement): { listenerCount: number; dispose(): void } {
    // НАЧАЛО ФУНКЦИИ move
    function move(event: PointerEvent): void {
        renderer.setPointerState(event.clientX, event.clientY, undefined, !isUniverseUiTarget(event.target));
    }
    // КОНЕЦ ФУНКЦИИ move
    // НАЧАЛО ФУНКЦИИ down
    function down(event: PointerEvent): void {
        if (!AudioSyncEngine.isExplicitAudioCommand(event)) audioSync.startPlayback(true);
        const inside = !isUniverseUiTarget(event.target);
        renderer.setPointerState(event.clientX, event.clientY, inside, inside);
    }
    // КОНЕЦ ФУНКЦИИ down
    // НАЧАЛО ФУНКЦИИ up
    function up(event: PointerEvent): void {
        renderer.setPointerState(event.clientX, event.clientY, false, !isUniverseUiTarget(event.target));
    }
    // КОНЕЦ ФУНКЦИИ up
    // НАЧАЛО ФУНКЦИИ clear
    function clear(): void { renderer.setPointerState(-9999, -9999, false, false); }
    // КОНЕЦ ФУНКЦИИ clear

    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerdown', down, { passive: true });
    target.addEventListener('pointerup', up, { passive: true });
    target.addEventListener('pointercancel', clear, { passive: true });
    target.addEventListener('blur', clear, { passive: true });
    // pointerleave не всплывает до window; html получает реальный выход из документа.
    root.addEventListener('pointerleave', clear, { passive: true });
    let disposed = false;
    return {
        listenerCount: 6,
        // НАЧАЛО ФУНКЦИИ dispose
        dispose(): void {
            if (disposed) return;
            disposed = true;
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerdown', down);
            target.removeEventListener('pointerup', up);
            target.removeEventListener('pointercancel', clear);
            target.removeEventListener('blur', clear);
            root.removeEventListener('pointerleave', clear);
        },
        // КОНЕЦ ФУНКЦИИ dispose
    };
}
// КОНЕЦ ФУНКЦИИ bindUniversePointerControls
// КОНЕЦ РАЗДЕЛА 2
